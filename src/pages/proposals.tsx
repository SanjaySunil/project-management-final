import * as React from "react"
import { useParams, Link } from "react-router-dom"
import { toast } from "sonner"
import { ArrowLeft } from "lucide-react"
import { supabase } from "@/lib/supabase"
import type { Tables } from "@/lib/database.types"
import { PageContainer } from "@/components/page-container"
import { SEO } from "@/components/seo"
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
import { Button } from "@/components/ui/button"

type Proposal = Tables<"proposals">

export default function ProposalsPage() {
  const { projectId } = useParams()
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
        .eq("project_id", projectId as string)
        .order("created_at", { ascending: false })

      if (error) throw error
      setProposals(data || [])
    } catch (error: any) {
      toast.error("Failed to fetch proposals: " + error.message)
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

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
    try {
      setIsSubmitting(true)
      let proposalId = editingProposal?.id

      const proposalData = {
        ...values,
        project_id: projectId as string,
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

      setIsDialogOpen(false)
      fetchProposals()
    } catch (error: any) {
      toast.error("Failed to save proposal: " + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <PageContainer>
      <SEO title="Project Proposals" description="Create and manage business proposals and deliverables for this project." />
      <div className="flex flex-1 flex-col gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/dashboard/projects">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Projects
            </Link>
          </Button>
        </div>
        <ProposalsTable 
          data={proposals} 
          projectId={projectId as string}
          onEdit={handleEdit}
          onDelete={handleDelete}
          isLoading={isLoading}
        />
      </div>

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
    </PageContainer>
  )
}