import * as React from "react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import type { Tables } from "@/lib/database.types"
import { Skeleton } from "@/components/ui/skeleton"
import { ClientForm } from "./client-form"

type Client = Tables<"clients">

interface ClientOverviewProps {
  clientId: string
  onUpdate?: () => void
}

export function ClientOverview({ clientId, onUpdate }: ClientOverviewProps) {
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
    try {
      setIsUpdating(true)
      const { error } = await supabase
        .from("clients")
        .update(values)
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
    <div className="max-w-2xl mx-auto py-4">
      <ClientForm
        initialValues={client}
        onSubmit={handleUpdate}
        onCancel={() => {}}
        isLoading={isUpdating}
      />
    </div>
  )
}
