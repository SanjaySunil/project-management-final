import * as React from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import type { Tables } from "@/lib/database.types"
import { ProposalsTable } from "./proposals-table"
import { ProposalForm } from "./proposal-form"
import type { Deliverable } from "./deliverables-manager"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { type ProjectWithClient } from "./projects-table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { ProjectForm } from "./project-form"
import { updateProjectStatus } from "@/lib/projects"
import { slugify } from "@/lib/utils"

type Proposal = Tables<"proposals">

interface ProjectDetailsModalProps {
  project: ProjectWithClient | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onProjectUpdated?: () => void
}

export function ProjectDetailsModal({
  project,
  open,
  onOpenChange,
  onProjectUpdated,
}: ProjectDetailsModalProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [proposals, setProposals] = React.useState<Proposal[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [isFormDialogOpen, setIsFormDialogOpen] = React.useState(false)
  const [editingProposal, setEditingProposal] = React.useState<Proposal | null>(null)
  const [deliverables, setDeliverables] = React.useState<Deliverable[]>([])
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false)
  const [proposalToDelete, setProposalToDelete] = React.useState<string | null>(null)
  const [isSavingProject, setIsSavingProject] = React.useState(false)

  const fetchProposals = React.useCallback(async () => {
    if (!project) return
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from("proposals")
        .select("*")
        .eq("project_id", project.id)
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: false })

      if (error) throw error
      setProposals(data || [])
    } catch (error: any) {
      toast.error("Failed to fetch proposals: " + error.message)
    } finally {
      setIsLoading(false)
    }
  }, [project])

  const handleReorderProposals = async (newData: Proposal[]) => {
    // Optimistic update
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
    if (open && project) {
      fetchProposals()
    }
  }, [open, project, fetchProposals])

  const handleEditProposal = async (proposal: Proposal | null) => {
    setEditingProposal(proposal)
    if (proposal) {
      await fetchDeliverables(proposal.id)
    } else {
      setDeliverables([])
    }
    setIsFormDialogOpen(true)
  }

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const { error } = await supabase
        .from("proposals")
        .update({ status })
        .eq("id", id)

      if (error) throw error
      
      if (project) {
        await updateProjectStatus(project.id)
        if (onProjectUpdated) onProjectUpdated()
      }
      
      toast.success("Proposal status updated")
      fetchProposals()
    } catch (error: any) {
      toast.error("Failed to update status: " + error.message)
    }
  }

  const handleDeleteProposal = (id: string) => {
    setProposalToDelete(id)
    setDeleteConfirmOpen(true)
  }

  const confirmDeleteProposal = async () => {
    if (!proposalToDelete || !project) return

    try {
      const { error } = await supabase.from("proposals").delete().eq("id", proposalToDelete)
      if (error) throw error
      
      await updateProjectStatus(project.id)
      if (onProjectUpdated) onProjectUpdated()
      
      toast.success("Proposal deleted successfully")
      fetchProposals()
    } catch (error: any) {
      toast.error("Failed to delete proposal: " + error.message)
    } finally {
      setDeleteConfirmOpen(false)
      setProposalToDelete(null)
    }
  }

  const handleProposalSubmit = async (values: any, updatedDeliverables: Deliverable[]) => {
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

        // Update channel name if title changed
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

      await updateProjectStatus(project.id)
      if (onProjectUpdated) onProjectUpdated()

      setIsFormDialogOpen(false)
      fetchProposals()
    } catch (error: any) {
      toast.error("Failed to save proposal: " + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleProjectSubmit = async (values: any) => {
    if (!project) return
    const { member_ids, ...projectValues } = values
    
    try {
      setIsSavingProject(true)
      const { error } = await supabase
        .from("projects")
        .update(projectValues)
        .eq("id", project.id)
      if (error) throw error
      
      // Update members: delete old, insert new
      await supabase.from("project_members").delete().eq("project_id", project.id)
      
      if (member_ids && member_ids.length > 0) {
        const memberEntries = member_ids.map((userId: string) => ({
          project_id: project.id,
          user_id: userId,
        }))
        const { error: memberError } = await supabase
          .from("project_members")
          .insert(memberEntries)
        if (memberError) throw memberError
      }

      toast.success("Project updated successfully")
      if (onProjectUpdated) onProjectUpdated()
    } catch (error: any) {
      toast.error("Failed to update project: " + error.message)
    } finally {
      setIsSavingProject(false)
    }
  }

  const initialProjectFormValues = React.useMemo(() => {
    if (!project) return {}
    return {
      ...project,
      member_ids: project.project_members?.map(m => m.user_id) || []
    }
  }, [project])

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-5xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>Project Details: {project?.name}</DialogTitle>
            <DialogDescription>
              View and manage project information and proposals.
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="proposals" className="flex-1 flex flex-col min-h-0">
            <div className="px-6 border-b">
              <TabsList variant="line" className="w-full justify-start h-12 bg-transparent p-0 gap-6">
                <TabsTrigger 
                  value="proposals" 
                  className="h-12 rounded-none data-[state=active]:bg-transparent shadow-none"
                >
                  Project Proposals
                </TabsTrigger>
                <TabsTrigger 
                  value="overview" 
                  className="h-12 rounded-none data-[state=active]:bg-transparent shadow-none"
                >
                  Project Overview
                </TabsTrigger>
                <TabsTrigger 
                  value="documents" 
                  className="h-12 rounded-none data-[state=active]:bg-transparent shadow-none"
                >
                  Documents
                </TabsTrigger>
              </TabsList>
            </div>
            
            <div className="flex-1 overflow-y-auto overflow-x-auto p-6">
              <TabsContent value="proposals" className="mt-0">
                <ProposalsTable 
                  data={proposals} 
                  projectId={project?.id || ""}
                  onEdit={handleEditProposal}
                  onDelete={handleDeleteProposal}
                  onView={(p) => {
                    navigate(`/dashboard/projects/${project?.id}/proposals/${p.id}`, {
                      state: { returnTo: location.pathname }
                    })
                    onOpenChange(false)
                  }}
                  onStatusChange={handleStatusChange}
                  onDataChange={handleReorderProposals}
                  isLoading={isLoading}
                />
              </TabsContent>

              <TabsContent value="overview" className="mt-0">
                <ProjectForm
                  initialValues={initialProjectFormValues}
                  onSubmit={handleProjectSubmit}
                  onCancel={() => onOpenChange(false)}
                  isLoading={isSavingProject}
                />
              </TabsContent>

              <TabsContent value="documents" className="mt-0">
                <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-muted/10">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-6 w-6"
                    >
                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold">Meeting Notes & Documents</h3>
                  <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                    Access project documentation and take notes from your client meetings.
                  </p>
                  <Button onClick={() => {
                    navigate(`/dashboard/projects/${project?.id}/documents`)
                    onOpenChange(false)
                  }}>
                    Go to Documents
                  </Button>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>

      <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto z-[60]">
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
            onSubmit={handleProposalSubmit}
            onCancel={() => setIsFormDialogOpen(false)}
            isSubmitting={isSubmitting}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        onConfirm={confirmDeleteProposal}
        title="Delete Proposal"
        description="Are you sure you want to delete this proposal? This action cannot be undone."
      />
    </>
  )
}