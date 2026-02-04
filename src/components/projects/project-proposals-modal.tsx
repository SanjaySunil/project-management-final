import * as React from "react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import type { Tables } from "@/lib/database.types"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ProposalsTable } from "@/components/projects/proposals-table"
import { ProposalForm } from "@/components/projects/proposal-form"
import type { Deliverable } from "@/components/projects/deliverables-manager"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import type { ProjectWithClient } from "@/components/projects/projects-table"

type Proposal = Tables<"proposals">

interface ProjectProposalsModalProps {
  project: ProjectWithClient | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ProjectProposalsModal({ project, open, onOpenChange }: ProjectProposalsModalProps) {
  const [proposals, setProposals] = React.useState<Proposal[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isFormOpen, setIsFormOpen] = React.useState(false)
  const [editingProposal, setEditingProposal] = React.useState<Proposal | null>(null)
  const [deliverables, setDeliverables] = React.useState<Deliverable[]>([])
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false)
  const [proposalToDelete, setProposalToDelete] = React.useState<string | null>(null)

  const fetchProposals = React.useCallback(async () => {
    if (!project) return
    
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from("proposals")
        .select("*")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false })

      if (error) throw error
      setProposals(data || [])
    } catch (error: any) {
      toast.error("Failed to fetch proposals: " + error.message)
    } finally {
      setIsLoading(false)
    }
  }, [project])

  const fetchDeliverables = React.useCallback(async (proposalId: string) => {
    try {
      const { data, error } = await supabase
        .from("deliverables")
        .select("*")
        .eq("proposal_id", proposalId)
        .order("order_index", { ascending: true })

      if (error) throw error
      setDeliverables(data || [])
    } catch (error: any) {
      toast.error("Failed to fetch deliverables: " + error.message)
    }
  }, [])

  React.useEffect(() => {
    if (open && project) {
      fetchProposals()
    }
  }, [open, project, fetchProposals])

  const handleEdit = async (proposal: Proposal | null) => {
    setEditingProposal(proposal)
    if (proposal) {
      await fetchDeliverables(proposal.id)
    } else {
      setDeliverables([])
    }
    setIsFormOpen(true)
  }

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const { error } = await supabase
        .from("proposals")
        .update({ status })
        .eq("id", id)

      if (error) throw error
      toast.success("Proposal status updated")
      fetchProposals()
    } catch (error: any) {
      toast.error("Failed to update status: " + error.message)
    }
  }

  const handleDelete = (id: string) => {
    setProposalToDelete(id)
    setDeleteConfirmOpen(true)
  }

  const confirmDelete = async () => {
    if (!proposalToDelete) return

    try {
      const { error } = await supabase.from("proposals").delete().eq("id", proposalToDelete)
      if (error) throw error
      toast.success("Proposal deleted successfully")
      fetchProposals()
    } catch (error: any) {
      toast.error("Failed to delete proposal: " + error.message)
    } finally {
      setDeleteConfirmOpen(false)
      setProposalToDelete(null)
    }
  }

  const handleSubmit = async (values: any, updatedDeliverables: Deliverable[]) => {
    if (!project) return

    try {
      setIsSubmitting(true)
      let proposalId = editingProposal?.id

      const proposalData = {
        ...values,
        project_id: project.id,
      }

      if (editingProposal?.id) {
        const { error } = await supabase
          .from("proposals")
          .update(proposalData)
          .eq("id", editingProposal.id)
        if (error) throw error
        toast.success("Proposal updated successfully")
      } else {
        const { data, error } = await supabase
          .from("proposals")
          .insert([proposalData])
          .select()
          .single()
        if (error) throw error
        proposalId = data.id
        toast.success("Proposal added successfully")
      }

      // Save deliverables
      if (proposalId) {
        // Delete existing deliverables for this proposal
        const { error: deleteError } = await supabase
          .from("deliverables")
          .delete()
          .eq("proposal_id", proposalId)
        
        if (deleteError) throw deleteError

        // Insert new deliverables
        if (updatedDeliverables.length > 0) {
          const deliverablesToInsert = updatedDeliverables.map((d, index) => ({
            proposal_id: proposalId,
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

      setIsFormOpen(false)
      fetchProposals()
    } catch (error: any) {
      toast.error("Failed to save proposal: " + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Project Proposals</DialogTitle>
            <DialogDescription>
              Manage proposals and deliverables for {project?.name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto py-4">
            <ProposalsTable 
              data={proposals} 
              projectId={project?.id || ""}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onStatusChange={handleStatusChange}
              isLoading={isLoading}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProposal ? "Edit Proposal" : "Create Proposal"}</DialogTitle>
            <DialogDescription>
              {editingProposal
                ? "Update the proposal's information below."
                : "Fill in the details to create a new proposal for this project."}
            </DialogDescription>
          </DialogHeader>
          
          <ProposalForm
            initialData={editingProposal}
            initialDeliverables={deliverables}
            onSubmit={handleSubmit}
            onCancel={() => setIsFormOpen(false)}
            isSubmitting={isSubmitting}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        onConfirm={confirmDelete}
        title="Delete Proposal"
        description="Are you sure you want to delete this proposal? This action cannot be undone."
      />
    </>
  )
}
