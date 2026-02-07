import * as React from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/use-auth"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ProjectForm } from "@/components/projects/project-form"
import { ProjectsTable, type ProjectWithClient } from "@/components/projects/projects-table"
import { ProjectProposalsModal } from "@/components/projects/project-proposals-modal"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

interface ClientProjectsTabProps {
  clientId: string
}

export function ClientProjectsTab({ clientId }: ClientProjectsTabProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, role } = useAuth()
  const [projects, setProjects] = React.useState<ProjectWithClient[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [editingProject, setEditingProject] = React.useState<ProjectWithClient | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false)
  const [projectToDelete, setProjectToDelete] = React.useState<string | null>(null)

  const [proposalsModalOpen, setProposalsModalOpen] = React.useState(false)
  const [selectedProjectForProposals, setSelectedProjectForProposals] = React.useState<ProjectWithClient | null>(null)

  const fetchProjects = React.useCallback(async () => {
    if (!user) return
    
    try {
      setIsLoading(true)
      let query = supabase
        .from("projects")
        .select(`
          *,
          clients (
            first_name,
            last_name
          ),
          project_members (
            user_id,
            profiles (
              full_name,
              avatar_url
            )
          )
        `)
        .eq("client_id", clientId)
      
      const isAdmin = role === "admin" || role === "manager"
      if (!isAdmin) {
        query = query.filter("project_members.user_id", "eq", user.id)
      }

      const { data, error } = await query.order("created_at", { ascending: false })

      if (error) throw error
      setProjects((data as any) || [])
    } catch (error: any) {
      toast.error("Failed to fetch projects: " + error.message)
    } finally {
      setIsLoading(false)
    }
  }, [clientId, user, role])

  React.useEffect(() => {
    if (clientId) {
      fetchProjects()
    }
  }, [fetchProjects, clientId])

  // Handle opening proposals modal from state (e.g. when navigating back from a proposal)
  React.useEffect(() => {
    if (!isLoading && projects.length > 0 && location.state?.openProposalsFor) {
      const projectId = location.state.openProposalsFor
      const project = projects.find(p => p.id === projectId)
      if (project) {
        setSelectedProjectForProposals(project)
        setProposalsModalOpen(true)
        // Clear the state so it doesn't re-open on refresh
        navigate(location.pathname, { replace: true, state: {} })
      }
    }
  }, [isLoading, projects, location.state, navigate, location.pathname])

  const handleAddProject = () => {
    setEditingProject(null)
    setIsDialogOpen(true)
  }

  const handleEditProject = (project: ProjectWithClient) => {
    setEditingProject(project)
    setIsDialogOpen(true)
  }

  const handleDeleteProject = (id: string) => {
    setProjectToDelete(id)
    setDeleteConfirmOpen(true)
  }

  const handleViewProposals = (project: ProjectWithClient) => {
    setSelectedProjectForProposals(project)
    setProposalsModalOpen(true)
  }

  const confirmDeleteProject = async () => {
    if (!projectToDelete) return

    try {
      const { error } = await supabase.from("projects").delete().eq("id", projectToDelete)
      if (error) throw error
      toast.success("Project deleted successfully")
      fetchProjects()
    } catch (error: any) {
      toast.error("Failed to delete project: " + error.message)
    } finally {
      setDeleteConfirmOpen(false)
      setProjectToDelete(null)
    }
  }

  const handleSubmit = async (values: any) => {
    const { member_ids, ...projectValues } = values
    
    try {
      let projectId: string
      const projectData = {
        ...projectValues,
        client_id: clientId
      }

      if (editingProject) {
        projectId = editingProject.id
        const { error } = await supabase
          .from("projects")
          .update(projectData)
          .eq("id", projectId)
        if (error) throw error
        
        // Update members: delete old, insert new
        await supabase.from("project_members").delete().eq("project_id", projectId)
      } else {
        const { data, error } = await supabase
          .from("projects")
          .insert([projectData])
          .select()
          .single()
        if (error) throw error
        projectId = data.id
      }

      // Insert new members
      if (member_ids && member_ids.length > 0) {
        const memberEntries = member_ids.map((userId: string) => ({
          project_id: projectId,
          user_id: userId,
        }))
        const { error: memberError } = await supabase
          .from("project_members")
          .insert(memberEntries)
        if (memberError) throw memberError
      }

      toast.success(editingProject ? "Project updated successfully" : "Project added successfully")
      setIsDialogOpen(false)
      fetchProjects()
    } catch (error: any) {
      toast.error("Failed to save project: " + error.message)
    }
  }

  const initialFormValues = React.useMemo(() => {
    if (!editingProject) return { client_id: clientId }
    return {
      ...editingProject,
      member_ids: editingProject.project_members?.map(m => m.user_id) || []
    }
  }, [editingProject, clientId])

  return (
    <div className="flex flex-1 flex-col gap-4 py-4">
      <div className="flex-1">
        <ProjectsTable 
          data={projects}
          isLoading={isLoading}
          onEdit={handleEditProject}
          onDelete={handleDeleteProject}
          onAdd={handleAddProject}
          onViewProposals={handleViewProposals}
          disablePadding={true}
        />
      </div>

      <ProjectProposalsModal 
        project={selectedProjectForProposals}
        open={proposalsModalOpen}
        onOpenChange={setProposalsModalOpen}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editingProject ? "Edit Project" : "Add Project"}</DialogTitle>
            <DialogDescription>
              {editingProject
                ? "Update the project's information below."
                : "Fill in the details to create a new project for this client."}
            </DialogDescription>
          </DialogHeader>
          <ProjectForm
            initialValues={initialFormValues}
            onSubmit={handleSubmit}
            onCancel={() => setIsDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        onConfirm={confirmDeleteProject}
        title="Delete Project"
        description="Are you sure you want to delete this project? This action cannot be undone."
      />
    </div>
  )
}
