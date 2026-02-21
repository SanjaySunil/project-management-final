import * as React from "react"
import { MoreVertical, Edit, Trash, ExternalLink, Clock, X, User, Mail } from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import type { Tables } from "@/lib/database.types"
import { PageContainer } from "@/components/page-container"
import { SEO } from "@/components/seo"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ClientForm } from "@/components/clients/client-form"
import { ClientDetailsModal } from "@/components/clients/client-details-modal"
import { LiveTime } from "@/components/clients/live-time"
import { DataTable } from "@/components/data-table"
import type { ColumnDef } from "@tanstack/react-table"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useAuth } from "@/hooks/use-auth"
import { Input } from "@/components/ui/input"
import { createClient } from "@supabase/supabase-js"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { usePresence } from "@/hooks/use-presence"

type Client = Tables<"clients">
type ClientWithProjects = Client & {
  projects: { status: string | null }[]
}

export default function ClientsPage() {
  const { checkPermission, organizationId } = useAuth()
  const { isOnline } = usePresence()
  const [clients, setClients] = React.useState<ClientWithProjects[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [activeTab, setActiveTab] = React.useState("all")
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [editingClient, setEditingClient] = React.useState<ClientWithProjects | null>(null)
  const [viewingClient, setViewingClient] = React.useState<ClientWithProjects | null>(null)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = React.useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false)
  const [clientToDelete, setClientToDelete] = React.useState<string | null>(null)
  const [simulatedTime, setSimulatedTime] = React.useState<string>("")

  const canCreate = checkPermission('create', 'clients')
  const canUpdate = checkPermission('update', 'clients')
  const canDelete = checkPermission('delete', 'clients')

  const baseTime = React.useMemo(() => {
    if (!simulatedTime) return null
    const [hours, minutes] = simulatedTime.split(":").map(Number)
    const now = new Date()
    now.setHours(hours, minutes, 0, 0)
    return now
  }, [simulatedTime])

  const fetchClients = React.useCallback(async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from("clients")
        .select(`
          *,
          projects (
            status
          )
        `)
        .order("created_at", { ascending: false })

      if (error) throw error
      setClients((data as any) || [])
    } catch (error: any) {
      toast.error("Failed to fetch clients: " + error.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchClients()
  }, [fetchClients])

  const handleAddClient = React.useCallback(() => {
    setEditingClient(null)
    setIsDialogOpen(true)
  }, [])

  const handleEditClient = React.useCallback((client: ClientWithProjects) => {
    setEditingClient(client)
    setIsDialogOpen(true)
  }, [])

  const handleViewClient = React.useCallback((client: ClientWithProjects) => {
    setViewingClient(client)
    setIsDetailsModalOpen(true)
  }, [])

  const handleDeleteClient = React.useCallback((id: string) => {
    setClientToDelete(id)
    setDeleteConfirmOpen(true)
  }, [])

  const confirmDeleteClient = async () => {
    if (!clientToDelete) return

    try {
      // Find the client first to check for user_id
      const client = clients.find(c => c.id === clientToDelete)
      const userId = client?.user_id

      // 1. Delete the client
      const { error } = await supabase.from("clients").delete().eq("id", clientToDelete)
      if (error) throw error

      // 2. If there's an associated user_id, clean up auth and credentials
      if (userId) {
        // Delete associated credentials
        await supabase
          .from("credentials")
          .delete()
          .eq("user_id", userId)

        // Remove from project_members
        await supabase
          .from("project_members")
          .delete()
          .eq("user_id", userId)

        // Delete auth user via RPC
        await supabase.rpc('delete_user_account', {
          user_id_to_delete: userId
        })
      }

      toast.success("Client deleted successfully")
      fetchClients()
    } catch (error: any) {
      toast.error("Failed to delete client: " + error.message)
    } finally {
      setDeleteConfirmOpen(false)
      setClientToDelete(null)
    }
  }

  const handleSubmit = async (values: any) => {
    const { enable_login, ...clientValues } = values
    
    // Strictly autogenerate email for NEW clients
    // For existing clients, keep their email
    let email: string
    if (editingClient) {
      email = editingClient.email || `${Math.floor(100000 + Math.random() * 900000)}@arehsoft.com`
    } else {
      email = `${Math.floor(100000 + Math.random() * 900000)}@arehsoft.com`
    }
    clientValues.email = email
    
    // Autogenerate password if enabling login
    const password = Math.random().toString(36).slice(-10)

    try {
      if (enable_login && !editingClient?.user_id) {
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
      } else if (!enable_login && editingClient?.user_id) {
        // Disable login access by removing the link to auth user
        const oldUserId = editingClient.user_id
        clientValues.user_id = null
        clientValues.email = null // Clear the autogenerated email
        
        // Also remove from project_members
        await supabase
          .from("project_members")
          .delete()
          .eq("user_id", oldUserId)
          
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

      if (editingClient) {
        const { error } = await supabase
          .from("clients")
          .update(clientValues)
          .eq("id", editingClient.id)
        if (error) throw error
        toast.success("Client updated successfully")
      } else {
        const { error } = await supabase.from("clients").insert([clientValues])
        if (error) throw error
        toast.success("Client added successfully")
      }
      setIsDialogOpen(false)
      fetchClients()
    } catch (error: any) {
      toast.error("Failed to save client: " + error.message)
    }
  }

  const columns: ColumnDef<ClientWithProjects>[] = React.useMemo(() => [
    {
      id: "user",
      header: "User",
      cell: ({ row }) => (
        <div className="relative inline-block">
          <Avatar className="h-8 w-8">
            <AvatarFallback>
              {row.original.first_name?.charAt(0) || <User className="h-4 w-4" />}
            </AvatarFallback>
          </Avatar>
          {row.original.user_id && isOnline(row.original.user_id) && (
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background bg-emerald-500" title="Online" />
          )}
        </div>
      ),
    },
    {
      accessorKey: "name",
      header: "Name",
      accessorFn: (row) => `${row.first_name} ${row.last_name || ""}`.trim(),
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">
            {row.original.first_name} {row.original.last_name || ""}
          </span>
          <span className="text-xs text-muted-foreground">
            {row.original.email}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Mail className="h-3 w-3 text-muted-foreground" />
          {row.original.email}
        </div>
      ),
    },
    {
      accessorKey: "phone",
      header: "Phone",
      cell: ({ row }) => row.original.phone || "-",
    },
    {
      accessorKey: "location",
      header: "Location",
      accessorFn: (row) => `${row.city || ""} ${row.state || ""} ${row.country || ""}`.trim(),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {[row.original.city, row.original.state, row.original.country].filter(Boolean).join(", ") || "-"}
        </span>
      ),
    },
    {
      id: "local_time",
      header: "Local Time",
      cell: ({ row }) => (
        <LiveTime 
          timezone={row.original.timezone} 
          country={row.original.country}
          state={row.original.state}
          city={row.original.city}
          baseTime={baseTime}
        />
      ),
    },
    {
      accessorKey: "created_at",
      header: "Created At",
      cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString(),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleViewClient(row.original)}>
              <ExternalLink className="mr-2 h-4 w-4" /> View Details
            </DropdownMenuItem>
            
            {canUpdate && (
              <DropdownMenuItem onClick={() => handleEditClient(row.original)}>
                <Edit className="mr-2 h-4 w-4" /> Edit
              </DropdownMenuItem>
            )}

            {canDelete && (
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => handleDeleteClient(row.original.id)}
              >
                <Trash className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ], [baseTime, canUpdate, canDelete, handleViewClient, handleEditClient, handleDeleteClient, isOnline])

  const filteredClients = React.useMemo(() => {
    if (activeTab === "all") return clients
    if (activeTab === "active") {
      return clients.filter(c => c.projects?.some(p => p.status === 'active'))
    }
    if (activeTab === "inactive") {
      return clients.filter(c => !c.projects?.some(p => p.status === 'active'))
    }
    return clients
  }, [clients, activeTab])

  const tabs = React.useMemo(() => [
    { value: "all", label: "All", badge: clients.length },
    { value: "active", label: "Active", badge: clients.filter(c => c.projects?.some(p => p.status === 'active')).length },
    { value: "inactive", label: "Inactive", badge: clients.filter(c => !c.projects?.some(p => p.status === 'active')).length },
  ], [clients])

  return (
    <PageContainer>
      <SEO title="Clients" description="View and manage your client database and relationships." />
      <div className="flex flex-1 flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
        </div>

        <div className="flex-1">
          <DataTable 
            columns={columns} 
            data={filteredClients} 
            isLoading={isLoading}
            searchPlaceholder="Search clients..."
            addLabel="Add Client"
            onAdd={canCreate ? handleAddClient : undefined}
            onRowClick={handleViewClient}
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            toolbar={
              <div className="flex items-center gap-2 rounded-md border bg-background px-2 h-8">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="time"
                  value={simulatedTime}
                  onChange={(e) => setSimulatedTime(e.target.value)}
                  className="h-full w-[80px] border-none p-0 focus-visible:ring-0 text-sm bg-transparent"
                />
                {simulatedTime && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setSimulatedTime("")}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            }
          />
        </div>
      </div>

      <ClientDetailsModal
        client={viewingClient}
        open={isDetailsModalOpen}
        onOpenChange={setIsDetailsModalOpen}
        onUpdate={() => {
          fetchClients()
          setIsDetailsModalOpen(false)
        }}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editingClient ? "Edit Client" : "Add Client"}</DialogTitle>
            <DialogDescription>
              {editingClient
                ? "Update the client's information below."
                : "Fill in the details to add a new client to your company."}
            </DialogDescription>
          </DialogHeader>
          <ClientForm
            initialValues={editingClient || {}}
            onSubmit={handleSubmit}
            onCancel={() => setIsDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        onConfirm={confirmDeleteClient}
        title="Delete Client"
        description="Are you sure you want to delete this client? This action cannot be undone and will delete all associated data."
      />
    </PageContainer>
  )
}