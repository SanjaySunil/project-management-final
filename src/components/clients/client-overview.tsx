import * as React from "react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import type { Tables } from "@/lib/database.types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LiveTime } from "@/components/clients/live-time"
import { Skeleton } from "@/components/ui/skeleton"

type Client = Tables<"clients">

interface ClientOverviewProps {
  clientId: string
}

export function ClientOverview({ clientId }: ClientOverviewProps) {
  const [client, setClient] = React.useState<Client | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    async function fetchClient() {
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
    }

    if (clientId) {
      fetchClient()
    }
  }, [clientId])

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-[200px] w-full" />
        <Skeleton className="h-[200px] w-full" />
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
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
          <CardDescription>Basic contact details for the client.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <span className="text-sm font-medium text-muted-foreground">Email:</span>
            <p className="text-sm">{client.email || "No email provided."}</p>
          </div>
          <div>
            <span className="text-sm font-medium text-muted-foreground">Phone:</span>
            <p className="text-sm">{client.phone || "No phone provided."}</p>
          </div>
          <div>
            <span className="text-sm font-medium text-muted-foreground">Location:</span>
            <div className="text-sm">
              {[client.city, client.country].filter(Boolean).join(", ") || "No location specified."}
              {(client.city || client.country || client.timezone) && (
                <div className="mt-1 text-muted-foreground">
                  <LiveTime 
                    timezone={client.timezone} 
                    country={client.country}
                    city={client.city}
                  />
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>System Information</CardTitle>
          <CardDescription>Internal client data.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <span className="text-sm font-medium text-muted-foreground">Client ID:</span>
            <p className="text-xs font-mono break-all">{client.id}</p>
          </div>
          <div>
            <span className="text-sm font-medium text-muted-foreground">Created At:</span>
            <p className="text-sm">{new Date(client.created_at).toLocaleDateString()}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
