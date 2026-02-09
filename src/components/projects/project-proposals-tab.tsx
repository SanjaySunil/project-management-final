import * as React from "react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import type { Tables } from "@/lib/database.types"
import { ProposalsTable } from "@/components/projects/proposals-table"
import { ProposalForm } from "@/components/projects/proposal-form"
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

type Proposal = Tables<"proposals">

interface ProjectProposalsTabProps {
  projectId: string
}

export function ProjectProposalsTab({ projectId }: ProjectProposalsTabProps) {
  const [proposals, setProposals] = React.useState<Proposal[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [editingProposal, setEditingProposal] = React.useState<Proposal | null>(null)
  const [deliverables, setDeliverables] = React.useState<Deliverable[]>([])
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false)
  const [proposalToDelete, setProposalToDelete] = React.useState<string | null>(null)

  const fetchProposals = React.useCallback(async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from("proposals")
        .select("*")
        .eq("project_id", projectId)
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: false })

      if (error) throw error
      setProposals(data || [])
    } catch (error: any) {
      toast.error("Failed to fetch proposals: " + error.message)
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  const handleReorder = async (newData: Proposal[]) => {
    const oldData = [...proposals]
    setProposals(newData)

    try {
      const updatePromises = newData.map((proposal, index) => 
        supabase
          .from("proposals")
          .update({ order_index: index })
          .eq("id", proposal.id)
      )

      const results = await Promise.all(updatePromises)
      const error = results.find(r => r.error)?.error

      if (error) throw error
      toast.success("Order updated")
    } catch (error: any) {
      setProposals(oldData)
      toast.error("Failed to update order: " + error.message)
    }
  }

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
    if (projectId) {
      fetchProposals()
    }
  }, [fetchProposals, projectId])

  const handleEdit = async (proposal: Proposal | null) => {
    setEditingProposal(proposal)
    if (proposal) {
      await fetchDeliverables(proposal.id)
    } else {
      setDeliverables([])
    }
    setIsDialogOpen(true)
  }

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const { error } = await supabase
        .from("proposals")
        .update({ status })
        .eq("id", id)

      if (error) throw error
      
      await updateProjectStatus(projectId)
      
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
      
      await updateProjectStatus(projectId)
      
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
    try {
      setIsSubmitting(true)
      let proposalId = editingProposal?.id

      const proposalData = {
        ...values,
        project_id: projectId,
      }

      if (editingProposal?.id) {
        const { error } = await supabase
          .from("proposals")
          .update(proposalData)
          .eq("id", editingProposal.id)
        if (error) throw error

        if (values.title) {
          await supabase
            .from("channels")
            .update({ name: slugify(values.title) })
            .eq("proposal_id", editingProposal.id)
        }

        toast.success("Proposal updated successfully")
      } else {
        const { data, error } = await supabase
          .from("proposals")
          .insert([{
            ...proposalData,
            order_index: proposals.length
          }])
          .select()
          .single()
        if (error) throw error
        proposalId = data.id
        toast.success("Proposal added successfully")
      }

      if (proposalId) {
        const { error: deleteError } = await supabase
          .from("deliverables")
          .delete()
          .eq("proposal_id", proposalId)
        
        if (deleteError) throw deleteError

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

      await updateProjectStatus(projectId)

      setIsDialogOpen(false)
      fetchProposals()
    } catch (error: any) {
      toast.error("Failed to save proposal: " + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <ProposalsTable 
        data={proposals} 
        projectId={projectId}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onStatusChange={handleStatusChange}
        onDataChange={handleReorder}
        isLoading={isLoading}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
            onCancel={() => setIsDialogOpen(false)}
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
    </div>
  )
}
