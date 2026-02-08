import * as React from "react"
import { useParams, Link } from "react-router-dom"
import { toast } from "sonner"
import { IconArrowLeft } from "@tabler/icons-react"
import { supabase } from "@/lib/supabase"
import type { Tables } from "@/lib/database.types"
import { PageContainer } from "@/components/page-container"
import { SEO } from "@/components/seo"
import { DocumentsTable } from "@/components/projects/documents-table"
import { DocumentForm } from "@/components/projects/document-form"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"

type Document = Tables<"documents">

export default function ProjectDocumentsPage() {
  const { projectId } = useParams()
  const { user } = useAuth()
  const [documents, setDocuments] = React.useState<Document[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [editingDocument, setEditingDocument] = React.useState<Document | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false)
  const [documentToDelete, setDocumentToDelete] = React.useState<string | null>(null)

  const fetchDocuments = React.useCallback(async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("project_id", projectId as string)
        .order("created_at", { ascending: false })

      if (error) throw error
      setDocuments(data || [])
    } catch (error: any) {
      toast.error("Failed to fetch documents: " + error.message)
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  React.useEffect(() => {
    if (projectId) {
      fetchDocuments()
    }
  }, [fetchDocuments, projectId])

  const handleAdd = () => {
    setEditingDocument(null)
    setIsDialogOpen(true)
  }

  const handleEdit = (doc: Document) => {
    setEditingDocument(doc)
    setIsDialogOpen(true)
  }

  const handleDelete = (id: string) => {
    setDocumentToDelete(id)
    setDeleteConfirmOpen(true)
  }

  const confirmDelete = async () => {
    if (!documentToDelete) return

    try {
      const { error } = await supabase.from("documents").delete().eq("id", documentToDelete)
      if (error) throw error
      
      toast.success("Document deleted successfully")
      fetchDocuments()
    } catch (error: any) {
      toast.error("Failed to delete document: " + error.message)
    } finally {
      setDeleteConfirmOpen(false)
      setDocumentToDelete(null)
    }
  }

  const handleSubmit = async (values: any) => {
    try {
      setIsSubmitting(true)

      const documentData = {
        ...values,
        project_id: projectId as string,
        user_id: user?.id
      }

      if (editingDocument?.id) {
        const { error } = await supabase
          .from("documents")
          .update(documentData)
          .eq("id", editingDocument.id)
        if (error) throw error
        toast.success("Document updated successfully")
      } else {
        const { error } = await supabase
          .from("documents")
          .insert([documentData])
        if (error) throw error
        toast.success("Document created successfully")
      }

      setIsDialogOpen(false)
      fetchDocuments()
    } catch (error: any) {
      toast.error("Failed to save document: " + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <PageContainer>
      <SEO title="Project Documents" description="Manage meeting notes and documents for this project." />
      <div className="flex flex-1 flex-col gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/dashboard/projects/${projectId}/overview`}>
              <IconArrowLeft className="mr-2 h-4 w-4" />
              Back to Overview
            </Link>
          </Button>
        </div>
        
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">Project Documents</h1>
          <p className="text-muted-foreground">
            Create and manage meeting notes and project documentation.
          </p>
        </div>

        <DocumentsTable 
          data={documents} 
          onEdit={handleEdit}
          onDelete={handleDelete}
          onAdd={handleAdd}
          isLoading={isLoading}
        />
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingDocument ? "Edit Document" : "New Document"}</DialogTitle>
            <DialogDescription>
              {editingDocument
                ? "Update your meeting notes or document."
                : "Record notes from your meeting with the client."}
            </DialogDescription>
          </DialogHeader>
          
          <DocumentForm
            initialData={editingDocument}
            onSubmit={handleSubmit}
            onCancel={() => setIsDialogOpen(false)}
            isSubmitting={isSubmitting}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        onConfirm={confirmDelete}
        title="Delete Document"
        description="Are you sure you want to delete this document? This action cannot be undone."
      />
    </PageContainer>
  )
}
