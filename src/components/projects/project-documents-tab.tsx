import * as React from "react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import type { Tables } from "@/lib/database.types"
import { DocumentsTable } from "@/components/projects/documents-table"
import { DocumentForm } from "@/components/projects/document-form"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useAuth } from "@/hooks/use-auth"

type Document = Tables<"documents">
type Phase = Tables<"phases">

interface ProjectDocumentsTabProps {
  projectId: string
}

export function ProjectDocumentsTab({ projectId }: ProjectDocumentsTabProps) {
  const { user } = useAuth()
  const [documents, setDocuments] = React.useState<Document[]>([])
  const [phases, setPhases] = React.useState<Phase[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [editingDocument, setEditingDocument] = React.useState<Document | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false)
  const [documentToDelete, setDocumentToDelete] = React.useState<string | null>(null)

  // Conversion state
  const [isConvertDialogOpen, setIsConvertDialogOpen] = React.useState(false)
  const [convertingDocument, setConvertingDocument] = React.useState<Document | null>(null)
  const [selectedPhaseId, setSelectedPhaseId] = React.useState<string>("none")
  const [isConverting, setIsConverting] = React.useState(false)

  const fetchDocuments = React.useCallback(async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })

      if (error) throw error
      setDocuments(data || [])
    } catch (error: any) {
      toast.error("Failed to fetch documents: " + error.message)
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  const fetchPhases = React.useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("phases")
        .select("*")
        .eq("project_id", projectId)
        .order("order_index", { ascending: true })

      if (error) throw error
      setPhases(data || [])
    } catch (error: any) {
      console.error("Failed to fetch phases:", error)
    }
  }, [projectId])

  React.useEffect(() => {
    if (projectId) {
      fetchDocuments()
      fetchPhases()
    }
  }, [fetchDocuments, fetchPhases, projectId])

  const handleAdd = () => {
    setEditingDocument(null)
    setIsDialogOpen(true)
  }

  const handleEdit = (doc: Document) => {
    setEditingDocument(doc)
    setIsDialogOpen(true)
  }

  const handleConvertToTasks = (doc: Document) => {
    setConvertingDocument(doc)
    setIsConvertDialogOpen(true)
  }

  const confirmConversion = async () => {
    if (!convertingDocument || !user) return

    try {
      setIsConverting(true)
      const content = convertingDocument.content || ""
      const lines = content.split("\n").filter(l => l.trim() !== "")

      if (lines.length === 0) {
        toast.error("This document has no bullet points to convert.")
        return
      }

      const tasksToInsert = lines.map((line, index) => ({
        title: line.trim(),
        phase_id: selectedPhaseId === "none" ? null : selectedPhaseId,
        status: "todo",
        type: "feature",
        user_id: user.id,
        order_index: index
      }))

      const { error } = await supabase
        .from("tasks")
        .insert(tasksToInsert)

      if (error) throw error

      // Mark document as converted
      await supabase
        .from("documents")
        .update({ is_converted: true })
        .eq("id", convertingDocument.id)

      toast.success(`Successfully converted ${lines.length} bullet points to tasks.`)
      setIsConvertDialogOpen(false)
      setConvertingDocument(null)
      fetchDocuments()
    } catch (error: any) {
      toast.error("Failed to convert to tasks: " + error.message)
    } finally {
      setIsConverting(false)
    }
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
        project_id: projectId,
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
    <div className="flex flex-1 flex-col gap-4 min-h-0">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold tracking-tight">Project Documents</h2>
        <p className="text-sm text-muted-foreground">
          Create and manage meeting notes and project documentation.
        </p>
      </div>

      <DocumentsTable 
        data={documents} 
        onEdit={handleEdit}
        onDelete={handleDelete}
        onConvertToTasks={handleConvertToTasks}
        onAdd={handleAdd}
        isLoading={isLoading}
      />

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

      <Dialog open={isConvertDialogOpen} onOpenChange={setIsConvertDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Convert to Kanban Tasks</DialogTitle>
            <DialogDescription>
              Each bullet point in this document will be converted into a separate task in the Kanban board.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="phase">Assign to Phase (Optional)</Label>
              <Select value={selectedPhaseId} onValueChange={setSelectedPhaseId}>
                <SelectTrigger id="phase">
                  <SelectValue placeholder="Select a phase" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (General Tasks)</SelectItem>
                  {phases.map((phase) => (
                    <SelectItem key={phase.id} value={phase.id}>
                      {phase.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConvertDialogOpen(false)} disabled={isConverting}>
              Cancel
            </Button>
            <Button onClick={confirmConversion} disabled={isConverting}>
              {isConverting ? "Converting..." : "Convert to Tasks"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        onConfirm={confirmDelete}
        title="Delete Document"
        description="Are you sure you want to delete this document? This action cannot be undone."
      />
    </div>
  )
}
