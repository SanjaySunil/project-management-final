import * as React from "react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { PageContainer } from "@/components/page-container"
import { SEO } from "@/components/seo"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CredentialForm } from "@/components/credentials/credential-form"
import { CredentialsTable, type CredentialWithProject } from "@/components/credentials/credentials-table"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { CredentialDetailsModal } from "@/components/credentials/credential-details-modal"

export default function CredentialsPage() {
  const [credentials, setCredentials] = React.useState<CredentialWithProject[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [isDetailsOpen, setIsDetailsOpen] = React.useState(false)
  const [editingCredential, setEditingCredential] = React.useState<CredentialWithProject | null>(null)
  const [selectedCredential, setSelectedCredential] = React.useState<CredentialWithProject | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false)
  const [credentialToDelete, setCredentialToDelete] = React.useState<string | null>(null)

  const fetchCredentials = React.useCallback(async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from("credentials")
        .select("*, projects(name)")
        .order("created_at", { ascending: false })

      if (error) throw error
      setCredentials((data as any) || [])
    } catch (error: any) {
      toast.error("Failed to fetch credentials: " + error.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchCredentials()
  }, [fetchCredentials])

  const handleAddCredential = () => {
    setEditingCredential(null)
    setIsDialogOpen(true)
  }

  const handleEditCredential = (credential: CredentialWithProject) => {
    setEditingCredential(credential)
    setIsDialogOpen(true)
  }

  const handleCredentialClick = (credential: CredentialWithProject) => {
    setSelectedCredential(credential)
    setIsDetailsOpen(true)
  }

  const handleDeleteClick = (id: string) => {
    setCredentialToDelete(id)
    setDeleteConfirmOpen(true)
  }

  const confirmDelete = async () => {
    if (!credentialToDelete) return

    try {
      // Find the credential first to check for user_id
      const credential = credentials.find(c => c.id === credentialToDelete)
      const userId = credential?.user_id

      // 1. Delete the credential
      const { error } = await supabase
        .from("credentials")
        .delete()
        .eq("id", credentialToDelete)

      if (error) throw error

      // 2. If there's an associated user_id, clean up auth and related tables
      if (userId) {
        // Unlink from clients and clear email
        await supabase
          .from("clients")
          .update({ 
            user_id: null,
            email: null
          })
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

      toast.success("Credential deleted successfully")
      fetchCredentials()
    } catch (error: any) {
      toast.error("Failed to delete credential: " + error.message)
    } finally {
      setDeleteConfirmOpen(false)
      setCredentialToDelete(null)
    }
  }

  const handleSubmit = async (values: any) => {
    try {
      if (editingCredential) {
        const { error } = await supabase
          .from("credentials")
          .update(values)
          .eq("id", editingCredential.id)
        if (error) throw error
        toast.success("Credential updated successfully")
      } else {
        const { error } = await supabase.from("credentials").insert([values])
        if (error) throw error
        toast.success("Credential added successfully")
      }
      setIsDialogOpen(false)
      fetchCredentials()
    } catch (error: any) {
      toast.error("Failed to save credential: " + error.message)
    } 
  }

  return (
    <PageContainer>
      <SEO title="Credentials" description="Securely store and manage project credentials and access keys." />
      <div className="flex flex-1 flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Credentials</h1>
        </div>

        <div className="flex-1">
          <CredentialsTable 
            data={credentials} 
            isLoading={isLoading} 
            onAdd={handleAddCredential}
            onEdit={handleEditCredential}
            onDelete={handleDeleteClick}
            onRowClick={handleCredentialClick}
          />
        </div>
      </div>

      <CredentialDetailsModal
        credential={selectedCredential}
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
        onEdit={handleEditCredential}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingCredential ? "Edit Credential" : "Add Credential"}</DialogTitle>
            <DialogDescription>
              {editingCredential
                ? "Update the credential information below."
                : "Securely add new credentials for your projects."}
            </DialogDescription>
          </DialogHeader>
          <CredentialForm
            initialValues={editingCredential || {}}
            onSubmit={handleSubmit}
            onCancel={() => setIsDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        onConfirm={confirmDelete}
        title="Delete Credential"
        description="Are you sure you want to delete this credential? This action cannot be undone."
      />
    </PageContainer>
  )
}