import * as React from "react"
import { MoreVertical, Edit, Trash, ExternalLink } from "lucide-react"
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

type Client = Tables<"clients">

export default function ClientsPage() {
  const [clients, setClients] = React.useState<Client[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [editingClient, setEditingClient] = React.useState<Client | null>(null)
  const [viewingClient, setViewingClient] = React.useState<Client | null>(null)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = React.useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false)
  const [clientToDelete, setClientToDelete] = React.useState<string | null>(null)

  const fetchClients = React.useCallback(async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false })

      if (error) throw error
      setClients(data || [])
    } catch (error: any) {
      toast.error("Failed to fetch clients: " + error.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchClients()
  }, [fetchClients])

  const handleAddClient = () => {
    setEditingClient(null)
    setIsDialogOpen(true)
  }

  const handleEditClient = (client: Client) => {
    setEditingClient(client)
    setIsDialogOpen(true)
  }

  const handleViewClient = (client: Client) => {
    setViewingClient(client)
    setIsDetailsModalOpen(true)
  }

  const handleDeleteClient = (id: string) => {
    setClientToDelete(id)
    setDeleteConfirmOpen(true)
  }

  const confirmDeleteClient = async () => {
    if (!clientToDelete) return

    try {
      const { error } = await supabase.from("clients").delete().eq("id", clientToDelete)
      if (error) throw error
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
    try {
      if (editingClient) {
        const { error } = await supabase
          .from("clients")
          .update(values)
          .eq("id", editingClient.id)
        if (error) throw error
        toast.success("Client updated successfully")
      } else {
        const { error } = await supabase.from("clients").insert([values])
        if (error) throw error
        toast.success("Client added successfully")
      }
      setIsDialogOpen(false)
      fetchClients()
    } catch (error: any) {
      toast.error("Failed to save client: " + error.message)
    }
  }

  const columns: ColumnDef<Client>[] = [
    {
      accessorKey: "name",
      header: "Name",
      accessorFn: (row) => `${row.first_name} ${row.last_name || ""}`.trim(),
      cell: ({ row }) => (
        <div className="flex items-center gap-2 font-medium">
          {row.original.first_name} {row.original.last_name || ""}
        </div>
      ),
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => row.original.email || "-",
    },
    {
      accessorKey: "phone",
      header: "Phone",
      cell: ({ row }) => row.original.phone || "-",
    },
    {
      accessorKey: "location",
      header: "Location",
      accessorFn: (row) => `${row.city || ""} ${row.country || ""}`.trim(),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {[row.original.city, row.original.country].filter(Boolean).join(", ") || "-"}
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
          city={row.original.city}
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
            <DropdownMenuItem onClick={() => handleEditClient(row.original)}>
              <Edit className="mr-2 h-4 w-4" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => handleDeleteClient(row.original.id)}
            >
              <Trash className="mr-2 h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

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
            data={clients} 
            isLoading={isLoading}
            searchPlaceholder="Search clients..."
            addLabel="Add Client"
            onAdd={handleAddClient}
            onRowClick={handleViewClient}
          />
        </div>
      </div>

      <ClientDetailsModal
        client={viewingClient}
        open={isDetailsModalOpen}
        onOpenChange={setIsDetailsModalOpen}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
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