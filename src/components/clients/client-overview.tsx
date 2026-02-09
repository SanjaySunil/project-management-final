import * as React from "react"
import { toast } from "sonner"
import { Clock } from "lucide-react"
import { supabase } from "@/lib/supabase"
import type { Tables } from "@/lib/database.types"
import { Skeleton } from "@/components/ui/skeleton"
import { ClientForm } from "./client-form"
import { LiveTime } from "./live-time"
import { createClient } from "@supabase/supabase-js"
import { useAuth } from "@/hooks/use-auth"

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

  const handleUpdate = async (values: any) => {
    const { enable_login, password, ...clientValues } = values
    
    try {
      setIsUpdating(true)

      if (enable_login && password && !client?.user_id) {
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
    </div>
  )
}
