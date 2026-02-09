import * as React from "react"
import { toast } from "sonner"
import { Clock, AlertTriangle, Trash2 } from "lucide-react"
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

type Client = Tables<"clients">

interface ClientOverviewProps {
  clientId: string
  onUpdate?: () => void
  onCancel?: () => void
}

export function ClientOverview({ clientId, onUpdate, onCancel }: ClientOverviewProps) {
  const { organizationId } = useAuth()
  const [client, setClient] = React.useState<Client | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [isUpdating, setIsUpdating] = React.useState(false)
  const [isDeletingCredentials, setIsDeletingCredentials] = React.useState(false)

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
    } catch (error: any) {
      toast.error("Failed to fetch client: " + error.message)
    } finally {
      setIsLoading(false)
    }
  }, [clientId])

  React.useEffect(() => {
    if (clientId) {
      fetchClient()
    }
  }, [clientId, fetchClient])

  const handleDeleteLoginProfile = async () => {
    if (!client?.user_id) return

    try {
      setIsDeletingCredentials(true)
      
      const userId = client.user_id

      // 1. Unlink from client
      const { error: unlinkError } = await supabase
        .from("clients")
        .update({ user_id: null })
        .eq("id", clientId)

      if (unlinkError) throw unlinkError

      // 2. Remove from project_members
      const { error: membersError } = await supabase
        .from("project_members")
        .delete()
        .eq("user_id", userId)
        
      if (membersError) console.error("Failed to remove from project_members:", membersError)

      // 3. Delete profile (this is the "credentials" the user meant)
      const { error: profileError } = await supabase
        .from("profiles")
        .delete()
        .eq("id", userId)

      if (profileError) throw profileError

      toast.success("Client login profile deleted successfully")
      await fetchClient()
      onUpdate?.()
    } catch (error: any) {
      toast.error("Failed to delete login profile: " + error.message)
    } finally {
      setIsDeletingCredentials(false)
    }
  }

  const handleUpdate = async (values: any) => {
    const { enable_login, password, ...clientValues } = values
    
    try {
      setIsUpdating(true)

      if (enable_login && !client?.user_id) {
        if (!password) {
          throw new Error("Password is required to enable login")
        }
        // Create auth user
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

        const tempSupabase = createClient(supabaseUrl, supabaseAnonKey, {
          auth: {
            persistSession: false
          }
        })

        const { data: authData, error: signUpError } = await tempSupabase.auth.signUp({
          email: values.email,
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
        }
      } else if (!enable_login && client?.user_id) {
        // Disable login access by removing the link to auth user
        const oldUserId = client.user_id
        clientValues.user_id = null
        
        // Also remove from project_members
        const { error: membersError } = await supabase
          .from("project_members")
          .delete()
          .eq("user_id", oldUserId)
          
        if (membersError) {
          console.error("Failed to remove from project_members:", membersError)
          // We don't throw here to allow the client update to proceed
        }
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
                Permanently delete the login profile and credentials for this client. They will no longer be able to sign in.
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
                    This action will permanently delete the client's login profile and revoke all access. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleDeleteLoginProfile}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={isDeletingCredentials}
                  >
                    {isDeletingCredentials ? "Deleting..." : "Delete Login Profile"}
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
