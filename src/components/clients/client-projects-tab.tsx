import * as React from "react"
import { useNavigate } from "react-router-dom"
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
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

interface ClientProjectsTabProps {
  clientId: string
}

export function ClientProjectsTab({ clientId }: ClientProjectsTabProps) {
  const navigate = useNavigate()
  const { user, role, loading: authLoading } = useAuth()
  const [projects, setProjects] = React.useState<ProjectWithClient[]>([])
  const [profiles, setProfiles] = React.useState<any[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [editingProject, setEditingProject] = React.useState<ProjectWithClient | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false)
  const [projectToDelete, setProjectToDelete] = React.useState<string | null>(null)

  const fetchProfiles = React.useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .neq("role", "client")
        .order("full_name", { ascending: true })

      if (error) throw error
      setProfiles(data || [])
    } catch (error: any) {
      console.error("Failed to fetch profiles:", error)
    }
  }, [])

  const fetchProjects = React.useCallback(async () => {
    if (!user || authLoading) return

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
          ),
          phases (
            status,
            tasks (
              status
            )
          )
        `)
        .eq("client_id", clientId)

      const normalizedRole = role?.toLowerCase()
      const isAdmin = normalizedRole === "admin"
      if (!isAdmin) {
        query = query.filter("project_members.user_id", "eq", user.id)
      }

      const { data, error } = await query.order("order_index", { ascending: true })

      if (error) throw error
      const projectsData = (data as any) || []

      setProjects(projectsData)
    } catch (error: any) {
      toast.error("Failed to fetch projects: " + error.message)
    } finally {
      setIsLoading(false)
    }
  }, [clientId, user, role, authLoading])

  React.useEffect(() => {
    if (clientId) {
      fetchProjects()
      fetchProfiles()
    }
  }, [fetchProjects, fetchProfiles, clientId])

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

  const handleViewPhases = (project: ProjectWithClient) => {
    navigate(`/dashboard/projects/${project.id}`)
  }

  const handleAssignMembers = async (projectId: string, memberIds: string[]) => {
    try {
      // Fetch all admins to ensure they are always added to all projects
      const { data: admins, error: adminsError } = await supabase
        .from("profiles")
        .select("id")
        .eq("role", "admin")

      if (adminsError) throw adminsError
      const adminIds = admins?.map(a => a.id) || []

      // Combine employee IDs from the UI with all admin IDs
      const allMemberIds = Array.from(new Set([...memberIds, ...adminIds]))

      // Update members: delete old, insert new
      const { error: deleteError } = await supabase
        .from("project_members")
        .delete()
        .eq("project_id", projectId)

      if (deleteError) throw deleteError

      if (allMemberIds.length > 0) {
        const memberEntries = allMemberIds.map((userId) => ({
          project_id: projectId,
          user_id: userId,
        }))
        const { error: insertError } = await supabase
          .from("project_members")
          .insert(memberEntries)
        if (insertError) throw insertError
      }

      fetchProjects()
    } catch (error: any) {
      toast.error("Failed to update members: " + error.message)
    }
  }

  const confirmDeleteProject = async () => {
    if (!projectToDelete) return

    if (role === 'client') {
      toast.error("Clients are not authorized to delete projects")
      setDeleteConfirmOpen(false)
      setProjectToDelete(null)
      return
    }

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
    if (role === 'client') {
      toast.error("Clients are not authorized to create or edit projects")
      return
    }

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

        // Update members using the helper logic (which now includes admins)
        await handleAssignMembers(projectId, member_ids || [])
      } else {
        const { data, error } = await supabase
          .from("projects")
          .insert([{
            ...projectData,
            order_index: projects.length
          }])
          .select()
          .single()
        if (error) throw error
        projectId = data.id

        // Insert new members using the same helper logic to include admins
        await handleAssignMembers(projectId, member_ids || [])
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
      member_ids: editingProject.project_members
        ?.filter(m => profiles.some(p => p.id === m.user_id))
        ?.map(m => m.user_id) || []
    }
  }, [editingProject, clientId, profiles])

  return (
    <div className="flex flex-1 flex-col gap-4 py-4">
      <div className="flex-1">
        <ProjectsTable
          data={projects}
          profiles={profiles}
          isLoading={isLoading}
          onEdit={handleEditProject}
          onDelete={handleDeleteProject}
          onAdd={handleAddProject}
          onViewPhases={handleViewPhases}
          onAssignMembers={handleAssignMembers}
          disablePadding={true}
        />
      </div>

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
