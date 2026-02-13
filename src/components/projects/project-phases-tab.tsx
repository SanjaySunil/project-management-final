import * as React from "react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import type { Tables } from "@/lib/database.types"
import { PhasesTable } from "@/components/projects/phases-table"
import { PhaseForm } from "@/components/projects/phase-form"
import { PhaseDetailsModal } from "@/components/projects/phase-details-modal"
import type { Deliverable } from "@/components/projects/deliverables-manager"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { updateProjectStatus } from "@/lib/projects"
import { slugify } from "@/lib/utils"

type Phase = Tables<"phases">

interface ProjectPhasesTabProps {
  projectId: string
}

export function ProjectPhasesTab({ projectId }: ProjectPhasesTabProps) {
  const [phases, setPhases] = React.useState<Phase[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [editingPhase, setEditingPhase] = React.useState<Phase | null>(null)
  const [viewingPhase, setViewingPhase] = React.useState<Phase | null>(null)
  const [isViewModalOpen, setIsViewModalOpen] = React.useState(false)
  const [deliverables, setDeliverables] = React.useState<Deliverable[]>([])
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false)
  const [phaseToDelete, setPhaseToDelete] = React.useState<string | null>(null)

  const fetchPhases = React.useCallback(async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from("phases")
        .select("*")
        .eq("project_id", projectId)
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: false })

      if (error) throw error
      setPhases(data || [])
    } catch (error: any) {
      toast.error("Failed to fetch phases: " + error.message)
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  const handleReorder = async (newData: Phase[]) => {
    const oldData = [...phases]
    setPhases(newData)

    try {
      const updatePromises = newData.map((phase, index) => 
        supabase
          .from("phases")
          .update({ order_index: index })
          .eq("id", phase.id)
      )

      const results = await Promise.all(updatePromises)
      const error = results.find(r => r.error)?.error

      if (error) throw error
      toast.success("Order updated")
    } catch (error: any) {
      setPhases(oldData)
      toast.error("Failed to update order: " + error.message)
    }
  }

  const fetchDeliverables = React.useCallback(async (phaseId: string) => {
    try {
      const { data, error } = await supabase
        .from("deliverables")
        .select("*")
        .eq("phase_id", phaseId)
        .order("order_index", { ascending: true })

      if (error) throw error
      setDeliverables(data || [])
    } catch (error: any) {
      toast.error("Failed to fetch deliverables: " + error.message)
    }
  }, [])

  React.useEffect(() => {
    if (projectId) {
      fetchPhases()
    }
  }, [fetchPhases, projectId])

  const handleEdit = async (phase: Phase | null) => {
    setEditingPhase(phase)
    if (phase) {
      await fetchDeliverables(phase.id)
    } else {
      setDeliverables([])
    }
    setIsDialogOpen(true)
  }

  const handleView = (phase: Phase) => {
    setViewingPhase(phase)
    setIsViewModalOpen(true)
  }

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const { error } = await supabase
        .from("phases")
        .update({ status })
        .eq("id", id)

      if (error) throw error
      
      await updateProjectStatus(projectId)
      
      toast.success("Phase status updated")
      fetchPhases()
    } catch (error: any) {
      toast.error("Failed to update status: " + error.message)
    }
  }

  const handleDelete = (id: string) => {
    setPhaseToDelete(id)
    setDeleteConfirmOpen(true)
  }

  const confirmDelete = async () => {
    if (!phaseToDelete) return

    try {
      const { error } = await supabase.from("phases").delete().eq("id", phaseToDelete)
      if (error) throw error
      
      await updateProjectStatus(projectId)
      
      toast.success("Phase deleted successfully")
      fetchPhases()
    } catch (error: any) {
      toast.error("Failed to delete phase: " + error.message)
    } finally {
      setDeleteConfirmOpen(false)
      setPhaseToDelete(null)
    }
  }

  const handleSubmit = async (values: any, updatedDeliverables: Deliverable[]) => {
    try {
      setIsSubmitting(true)
      let phaseId = editingPhase?.id

      const phaseData = {
        ...values,
        project_id: projectId,
      }

      if (editingPhase?.id) {
        const { error } = await supabase
          .from("phases")
          .update(phaseData)
          .eq("id", editingPhase.id)
        if (error) throw error

        if (values.title) {
          await supabase
            .from("channels")
            .update({ name: slugify(values.title) })
            .eq("phase_id", editingPhase.id)
        }

        toast.success("Phase updated successfully")
      } else {
        const { data, error } = await supabase
          .from("phases")
          .insert([{
            ...phaseData,
            order_index: phases.length
          }])
          .select()
          .single()
        if (error) throw error
        phaseId = data.id
        toast.success("Phase added successfully")
      }

      if (phaseId) {
        const { error: deleteError } = await supabase
          .from("deliverables")
          .delete()
          .eq("phase_id", phaseId)
        
        if (deleteError) throw deleteError

        if (updatedDeliverables.length > 0) {
          const deliverablesToInsert = updatedDeliverables.map((d, index) => ({
            phase_id: phaseId,
            title: d.title,
            description: d.description,
            order_index: index,
          }))

          const { error: insertError } = await supabase
            .from("deliverables")
            .insert(deliverablesToInsert)
          
          if (insertError) throw insertError
        }
      }

      await updateProjectStatus(projectId)

      setIsDialogOpen(false)
      fetchPhases()
    } catch (error: any) {
      toast.error("Failed to save phase: " + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <PhasesTable 
        data={phases} 
        projectId={projectId}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onView={handleView}
        onStatusChange={handleStatusChange}
        onDataChange={handleReorder}
        isLoading={isLoading}
      />

      <PhaseDetailsModal
        phase={viewingPhase}
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false)
          setViewingPhase(null)
        }}
        projectId={projectId}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPhase ? "Edit Phase" : "Create Phase"}</DialogTitle>
            <DialogDescription>
              {editingPhase
                ? "Update the phase's information below."
                : "Fill in the details to create a new phase for this project."}
            </DialogDescription>
          </DialogHeader>
          
          <PhaseForm
            initialData={editingPhase}
            initialDeliverables={deliverables}
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
        title="Delete Phase"
        description="Are you sure you want to delete this phase? This action cannot be undone."
      />
    </div>
  )
}
