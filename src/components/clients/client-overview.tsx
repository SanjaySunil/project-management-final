import * as React from "react"
import { toast } from "sonner"
import { Clock, AlertTriangle, Trash2, Key, Copy, Eye, EyeOff } from "lucide-react"
import { supabase } from "@/lib/supabase"
import type { Tables } from "@/lib/database.types"
import { Skeleton } from "@/components/ui/skeleton"
import { ClientForm } from "./client-form"
import { LiveTime } from "./live-time"
import { createClient } from "@supabase/supabase-js"
import { useAuth } from "@/hooks/use-auth"
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"

type Client = Tables<"clients">
type Credential = Tables<"credentials">

interface ClientOverviewProps {
  clientId: string
  onUpdate?: () => void
  onCancel?: () => void
}

export function ClientOverview({ clientId, onUpdate, onCancel }: ClientOverviewProps) {
  const { organizationId } = useAuth()
  const [client, setClient] = React.useState<Client | null>(null)
  const [credentials, setCredentials] = React.useState<Credential | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [isUpdating, setIsUpdating] = React.useState(false)
  const [isDeletingLogin, setIsDeletingLogin] = React.useState(false)
  const [showPassword, setShowPassword] = React.useState(false)

  const fetchClient = React.useCallback(async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .single()

      if (error) throw error
      setClient(data)

      // Also fetch credentials for this client
      const { data: credData } = await supabase
        .from("credentials")
        .select("*")
        .ilike("name", `%Client Login: ${data.first_name}%`)
        .order("created_at", { ascending: false })
        .limit(1)
      
      if (credData && credData.length > 0) {
        setCredentials(credData[0])
      } else {
        setCredentials(null)
      }
    } catch (error: any) {
      toast.error("Failed to fetch client: " + error.message)
    } finally {
      setIsLoading(false)
    }
  }, [clientId])

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied to clipboard`)
  }

  const parsedCredentials = React.useMemo(() => {
    if (!credentials?.value) return null
    try {
      return JSON.parse(credentials.value)
    } catch {
      return null
    }
  }, [credentials])

  React.useEffect(() => {
    if (clientId) {
      fetchClient()
    }
  }, [clientId, fetchClient])

  const handleDeleteLoginProfile = async () => {
    if (!client?.user_id) return

    try {
      setIsDeletingLogin(true)
      
      const userId = client.user_id

      // 1. Unlink from client and clear email
      const { error: unlinkError } = await supabase
        .from("clients")
        .update({ 
          user_id: null,
          email: null
        })
        .eq("id", clientId)

      if (unlinkError) throw unlinkError

      // 2. Remove from project_members
      const { error: membersError } = await supabase
        .from("project_members")
        .delete()
        .eq("user_id", userId)
        
      if (membersError) console.error("Failed to remove from project_members:", membersError)

      // 3. Delete associated credentials
      const { error: credsError } = await supabase
        .from("credentials")
        .delete()
        .eq("user_id", userId)
      
      if (credsError) console.error("Failed to delete credentials:", credsError)

      // 4. Delete auth user via RPC
      const { error: deleteError } = await supabase.rpc('delete_user_account', {
        user_id_to_delete: userId
      })

      if (deleteError) throw deleteError

      toast.success("Client login profile deleted successfully")
      await fetchClient()
      onUpdate?.()
    } catch (error: any) {
      toast.error("Failed to delete login profile: " + error.message)
    } finally {
      setIsDeletingLogin(false)
    }
  }

  const handleUpdate = async (values: any) => {
    const { enable_login, ...clientValues } = values
    
    // Autogenerate email if it doesn't exist
    const email = client?.email || `${Math.floor(100000 + Math.random() * 900000)}@arehsoft.com`
    clientValues.email = email
    
    // Autogenerate password if enabling login
    const password = Math.random().toString(36).slice(-10)
    
    try {
      setIsUpdating(true)

      if (enable_login && !client?.user_id) {
        // Create auth user
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

        const tempSupabase = createClient(supabaseUrl, supabaseAnonKey, {
          auth: {
            persistSession: false
          }
        })

        const { data: authData, error: signUpError } = await tempSupabase.auth.signUp({
          email: email,
          password: password,
          options: {
            data: {
              full_name: `${values.first_name} ${values.last_name || ""}`.trim(),
              role: 'client',
              organization_id: organizationId
            }
          }
        })

        if (signUpError) throw signUpError
        if (authData.user) {
          clientValues.user_id = authData.user.id

          // Save credentials to credentials table for admin visibility
          await supabase.from("credentials").insert([{
            name: `Client Login: ${values.first_name} ${values.last_name || ""}`.trim(),
            type: "Email Password",
            value: JSON.stringify({ email, password }),
            user_id: authData.user.id,
            notes: `Autogenerated credentials for client ${values.first_name}`
          }])
        }
      } else if (!enable_login && client?.user_id) {
        // Disable login access by removing the link to auth user
        const oldUserId = client.user_id
        clientValues.user_id = null
        clientValues.email = null // Clear the autogenerated email
        
        // Also remove from project_members
        const { error: membersError } = await supabase
          .from("project_members")
          .delete()
          .eq("user_id", oldUserId)
          
        if (membersError) {
          console.error("Failed to remove from project_members:", membersError)
        }

        // Delete auth user via RPC
        await supabase.rpc('delete_user_account', {
          user_id_to_delete: oldUserId
        })

        // Delete associated credentials
        await supabase
          .from("credentials")
          .delete()
          .eq("user_id", oldUserId)
      }

      const { error } = await supabase
        .from("clients")
        .update(clientValues)
        .eq("id", clientId)

      if (error) throw error
      toast.success("Client updated successfully")
      await fetchClient()
      onUpdate?.()
    } catch (error: any) {
      toast.error("Failed to update client: " + error.message)
    } finally {
      setIsUpdating(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (!client) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <p>Client not found.</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-4 space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg border">
        <Clock className="h-4 w-4" />
        <span>Current local time:</span>
        <LiveTime 
          timezone={client.timezone} 
          country={client.country}
          state={client.state}
          city={client.city}
        />
      </div>

      {client.user_id && parsedCredentials && (
        <div className="rounded-lg border bg-card p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold">
              <Key className="h-4 w-4 text-primary" />
              <h3>Client Login Credentials</h3>
            </div>
            <Badge variant="secondary">Autogenerated</Badge>
          </div>
          
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground uppercase font-semibold">Email</span>
              <div className="flex items-center gap-2 bg-muted/50 p-2 rounded border group relative">
                <code className="text-sm font-mono truncate flex-1">{parsedCredentials.email}</code>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => copyToClipboard(parsedCredentials.email, "Email")}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground uppercase font-semibold">Password</span>
              <div className="flex items-center gap-2 bg-muted/50 p-2 rounded border group relative">
                <code className="text-sm font-mono truncate flex-1">
                  {showPassword ? parsedCredentials.password : "••••••••••••"}
                </code>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7"
                    onClick={() => copyToClipboard(parsedCredentials.password, "Password")}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground italic">
            These credentials are saved in the global <span className="font-medium">Credentials</span> vault for future reference.
          </p>
        </div>
      )}

      <ClientForm
        initialValues={client}
        onSubmit={handleUpdate}
        onCancel={onCancel || (() => {})}
        isLoading={isUpdating}
      />

      <div className="pt-6">
        <Separator className="my-6" />
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-destructive font-semibold">
            <AlertTriangle className="h-5 w-5" />
            <h3>Danger Zone</h3>
          </div>
          
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="font-medium text-destructive">Delete Login Profile</h4>
              <p className="text-sm text-muted-foreground">
                Permanently delete the Supabase login account for this client. They will no longer be able to sign in.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  className="shrink-0"
                  disabled={!client.user_id}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Login Profile
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action will permanently delete the client's Supabase login account and revoke all access. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleDeleteLoginProfile}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={isDeletingLogin}
                  >
                    {isDeletingLogin ? "Deleting..." : "Delete Login Profile"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </div>
  )
}
