import * as React from "react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/use-auth"
import { PageContainer } from "@/components/page-container"
import { SEO } from "@/components/seo"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ProjectForm } from "@/components/projects/project-form"
import { ProjectsTable, type ProjectWithClient } from "@/components/projects/projects-table"
import { ProjectDetailsModal } from "@/components/projects/project-details-modal"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import type { Tables } from "@/lib/database.types"

export default function ProjectsPage() {
  const { user, role } = useAuth()
  const [projects, setProjects] = React.useState<ProjectWithClient[]>([])
  const [profiles, setProfiles] = React.useState<Tables<"profiles">[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [editingProject, setEditingProject] = React.useState<ProjectWithClient | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false)
  const [projectToDelete, setProjectToDelete] = React.useState<string | null>(null)
  
  const [detailsModalOpen, setDetailsModalOpen] = React.useState(false)
  const [selectedProject, setSelectedProject] = React.useState<ProjectWithClient | null>(null)

  const fetchProfiles = React.useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("full_name", { ascending: true })
      
      if (error) throw error
      setProfiles(data || [])
    } catch (error: any) {
      console.error("Failed to fetch profiles:", error)
    }
  }, [])

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
      
      // Filter by assigned projects if not admin or manager
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
  }, [user, role])

  React.useEffect(() => {
    fetchProjects()
    fetchProfiles()
  }, [fetchProjects, fetchProfiles])

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

  const handleViewDetails = (project: ProjectWithClient) => {
    setSelectedProject(project)
    setDetailsModalOpen(true)
  }

  const handleAssignMembers = async (projectId: string, memberIds: string[]) => {
    try {
      // Update members: delete old, insert new
      const { error: deleteError } = await supabase
        .from("project_members")
        .delete()
        .eq("project_id", projectId)
      
      if (deleteError) throw deleteError

      if (memberIds.length > 0) {
        const memberEntries = memberIds.map((userId) => ({
          project_id: projectId,
          user_id: userId,
        }))
        const { error: insertError } = await supabase
          .from("project_members")
          .insert(memberEntries)
        if (insertError) throw insertError
      }

      toast.success("Project members updated")
      fetchProjects()
    } catch (error: any) {
      toast.error("Failed to update members: " + error.message)
    }
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
      
      if (editingProject) {
        projectId = editingProject.id
        const { error } = await supabase
          .from("projects")
          .update(projectValues)
          .eq("id", projectId)
        if (error) throw error
        
        // Update members using the helper logic
        await handleAssignMembers(projectId, member_ids || [])
      } else {
        const { data, error } = await supabase
          .from("projects")
          .insert([projectValues])
          .select()
          .single()
        if (error) throw error
        projectId = data.id

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
      }

      toast.success(editingProject ? "Project updated successfully" : "Project added successfully")
      setIsDialogOpen(false)
      fetchProjects()
    } catch (error: any) {
      toast.error("Failed to save project: " + error.message)
    }
  }

  const initialFormValues = React.useMemo(() => {
    if (!editingProject) return {}
    return {
      ...editingProject,
      member_ids: editingProject.project_members?.map(m => m.user_id) || []
    }
  }, [editingProject])

  return (
    <PageContainer>
      <SEO title="Projects" description="Manage and track all your active and upcoming projects." />
      <div className="flex flex-1 flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
        </div>

        <div className="flex-1">
          <ProjectsTable 
            data={projects}
            profiles={profiles}
            isLoading={isLoading}
            onEdit={handleEditProject}
            onDelete={handleDeleteProject}
            onAdd={handleAddProject}
            onViewProposals={handleViewDetails}
            onRowClick={handleViewDetails}
            onAssignMembers={handleAssignMembers}
          />
        </div>
      </div>

      <ProjectDetailsModal 
        project={selectedProject}
        open={detailsModalOpen}
        onOpenChange={setDetailsModalOpen}
        onProjectUpdated={fetchProjects}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingProject ? "Edit Project" : "Add Project"}</DialogTitle>
            <DialogDescription>
              {editingProject
                ? "Update the project's information below."
                : "Fill in the details to create a new project linked to a client."}
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
    </PageContainer>
  )
}

