import * as React from "react"
import { toast } from "sonner"
import { IconLayoutKanban, IconPlus, IconTable } from "@tabler/icons-react"
import { supabase } from "@/lib/supabase"
import type { Tables } from "@/lib/database.types"
import { PageContainer } from "@/components/page-container"
import { SEO } from "@/components/seo"
import { Button } from "@/components/ui/button"
import { KanbanBoard, type Task } from "@/components/projects/kanban-board"
import { TasksTable } from "@/components/projects/tasks-table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { TaskForm, type TaskFormValues } from "@/components/projects/task-form"
import { useAuth } from "@/hooks/use-auth"
import { useSearchParams } from "react-router-dom"
import { useTasks } from "@/hooks/use-tasks"

export default function TasksPage() {
  const { user, role, loading: authLoading } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const taskIdParam = searchParams.get("taskId")
  const [members, setMembers] = React.useState<Tables<"profiles">[]>([])
  const [phases, setPhases] = React.useState<Tables<"phases">[]>([])
  const [projects, setProjects] = React.useState<Tables<"projects">[]>([])
  const [isLoadingMetadata, setIsLoadingMetadata] = React.useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false)
  const [editingTask, setEditingTask] = React.useState<Task | null>(null)
  const [creatingStatus, setCreatingStatus] = React.useState<string | null>(null)
  const [creatingParentId, setCreatingParentId] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [kanbanMode, setKanbanMode] = React.useState<"development" | "admin">("development")
  const [viewMode, setViewMode] = React.useState<"kanban" | "table">("kanban")

  const { tasks, isLoading: isTasksLoading, setTasks } = useTasks()

  const fetchMetadata = React.useCallback(async () => {
    if (!user || authLoading) return

    try {
      setIsLoadingMetadata(true)
      
      const normalizedRole = role?.toLowerCase()
      const isClient = normalizedRole === "client"

      let phasesQuery = supabase.from("phases").select("*, projects(clients(user_id))")
      let projectsQuery = supabase.from("projects").select("*, clients(user_id)")

      if (isClient) {
        // For phases and projects, we need to join through clients table
        phasesQuery = phasesQuery.eq("projects.clients.user_id", user.id)
        projectsQuery = projectsQuery.eq("clients.user_id", user.id)
      }

      const [membersRes, phasesRes, projectsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .neq("role", "client")
          .order("full_name", { ascending: true }),
        phasesQuery
          .order("order_index", { ascending: true })
          .order("title", { ascending: true }),
        projectsQuery
          .order("name", { ascending: true })
      ])

      if (membersRes.error) throw membersRes.error
      if (phasesRes.error) throw phasesRes.error
      if (projectsRes.error) throw projectsRes.error

      setMembers(membersRes.data || [])
      setPhases(phasesRes.data || [])
      setProjects(projectsRes.data || [])
    } catch (error: any) {
      console.error("Fetch metadata error:", error)
      toast.error("Failed to fetch metadata")
    } finally {
      setIsLoadingMetadata(false)
    }
  }, [user, role, authLoading])

  React.useEffect(() => {
    fetchMetadata()
  }, [fetchMetadata])

  const isLoading = isLoadingMetadata || isTasksLoading

  // Handle deep linking for tasks
  React.useEffect(() => {
    if (taskIdParam && tasks.length > 0 && !editingTask) {
      const task = tasks.find(t => t.id === taskIdParam)
      if (task) {
        setEditingTask(task)
        setIsEditDialogOpen(true)
      }
    }
  }, [taskIdParam, tasks, editingTask])

  // Clear taskId from URL when dialog is closed
  const handleEditDialogChange = (open: boolean) => {
    setIsEditDialogOpen(open)
    if (!open) {
      setEditingTask(null)
      if (searchParams.has("taskId")) {
        const newParams = new URLSearchParams(searchParams)
        newParams.delete("taskId")
        setSearchParams(newParams)
      }
    }
  }

  const handleTaskUpdate = async (taskId: string, updates: Partial<Task>) => {
    try {
      // Optimistic update
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t))

      // Clean up updates to only include database columns
      const dbUpdates = { ...updates } as any
      delete dbUpdates.phases
      delete dbUpdates.profiles
      delete dbUpdates.task_attachments
      delete dbUpdates.task_members
      delete dbUpdates.projects

      const { error } = await supabase
        .from("tasks")
        .update(dbUpdates)
        .eq("id", taskId)

      if (error) throw error
    } catch (error: any) {
      console.error("Update task error:", error)
      const message = error.message || error.details || (typeof error === 'object' ? JSON.stringify(error) : String(error))
      toast.error("Failed to update task: " + message)
    }
  }

  const handleTaskCreateTrigger = (status: string, parentId?: string) => {
    setCreatingStatus(status)
    setCreatingParentId(parentId || null)
    setIsCreateDialogOpen(true)
  }

  const handleTaskEditTrigger = (task: Task) => {
    setEditingTask(task)
    setIsEditDialogOpen(true)
  }

  const handleTaskCreate = async (values: TaskFormValues) => {
    if (!creatingStatus && !values.status) return

    const finalStatus = values.status || creatingStatus || "todo"

    try {
      setIsSubmitting(true)

      // Handle multiple assignees based on mode
      let assigneeIds: string[] = []
      
      if (values.assignee_ids && values.assignee_ids.length > 0) {
        assigneeIds = values.assignee_ids
      } else if (kanbanMode === "admin") {
        // Assign to all admins
        assigneeIds = members.filter(m => m.role === "admin").map(m => m.id)
      }
      
      const finalUserId = assigneeIds.length > 0 ? assigneeIds[0] : null

      const { data, error } = await supabase
        .from("tasks")
        .insert([{
          title: values.title,
          description: values.description,
          type: values.type || 'feature',
          user_id: finalUserId,
          project_id: values.project_id === "none" ? null : values.project_id,
          phase_id: values.phase_id === "none" ? null : values.phase_id,
          parent_id: (values.parent_id === "none" ? null : values.parent_id) || creatingParentId,
          status: finalStatus,
          order_index: tasks.filter(t => t.status === finalStatus).length
        }])
        .select()
        .single()

      if (error) throw error

      const taskId = data.id

      // Handle multiple assignees
      if (assigneeIds.length > 0) {
        const assignments = assigneeIds.map(userId => ({
          task_id: taskId,
          user_id: userId
        }))
        await supabase.from("task_members").insert(assignments)
      }

      // Handle subtasks
      if (values.subtasks && values.subtasks.length > 0) {
        const subtasksToInsert = values.subtasks.map((title, index) => ({
          title,
          status: "todo",
          parent_id: taskId,
          user_id: finalUserId,
          phase_id: data.phase_id,
          order_index: index
        }))
        
        await supabase
          .from("tasks")
          .insert(subtasksToInsert)
      }

      // Handle attachments
      if (values.files && values.files.length > 0 && typeof window !== 'undefined') {
        const { default: imageCompression } = await import("browser-image-compression")
        
        for (const file of values.files as File[]) {
          let fileToUpload = file

          // Compress if it's an image
          if (file.type.startsWith('image/')) {
            const options = {
              maxSizeMB: 1,
              maxWidthOrHeight: 1920,
              useWebWorker: true
            }
            try {
              fileToUpload = await imageCompression(file, options)
            } catch (error) {
              console.error("Compression error:", error)
            }
          }

          const fileExt = file.name.split('.').pop()
          const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`
          const filePath = `${taskId}/${fileName}`

          const { error: uploadError } = await supabase.storage
            .from('task-attachments')
            .upload(filePath, fileToUpload)

          if (uploadError) throw uploadError

          if (!user) throw new Error("Not authenticated")

          await supabase
            .from('task_attachments')
            .insert([{
              task_id: taskId,
              user_id: user.id,
              file_path: filePath,
              file_name: file.name,
              file_type: file.type,
              file_size: fileToUpload.size
            }])
        }
      }

      setIsCreateDialogOpen(false)
      setCreatingParentId(null)
      toast.success("Task created successfully")
    } catch (error: any) {
      console.error("Create task error:", error)
      const message = error.message || error.details || (typeof error === 'object' ? JSON.stringify(error) : String(error))
      toast.error("Failed to create task: " + message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleTaskEdit = async (values: TaskFormValues) => {
    if (!editingTask) return

    try {
      setIsSubmitting(true)
      const assigneeIds = values.assignee_ids || []
      const finalUserId = assigneeIds.length > 0 ? assigneeIds[0] : null

      const updates = {
        title: values.title,
        description: values.description || null,
        status: values.status || editingTask.status,
        type: values.type || editingTask.type || 'feature',
        user_id: finalUserId,
        project_id: values.project_id === "none" ? null : (values.project_id || null),
        phase_id: values.phase_id === "none" ? null : (values.phase_id || null),
        parent_id: values.parent_id === "none" ? null : (values.parent_id || null),
      }

      const { error } = await supabase
        .from("tasks")
        .update(updates)
        .eq("id", editingTask.id)

      if (error) throw error

      // Update task_members
      await supabase.from("task_members").delete().eq("task_id", editingTask.id)
      
      if (assigneeIds.length > 0) {
        const assignments = assigneeIds.map(userId => ({
          task_id: editingTask.id,
          user_id: userId
        }))
        await supabase.from("task_members").insert(assignments)
      }

      setIsEditDialogOpen(false)
      setEditingTask(null)
      toast.success("Task updated successfully")
    } catch (error: any) {
      console.error("Update task error:", error)
      const message = error.message || error.details || (typeof error === 'object' ? JSON.stringify(error) : String(error))
      toast.error("Failed to update task: " + message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleTaskDelete = async (taskId: string) => {
    try {
      // Optimistic delete
      setTasks(prev => prev.filter(t => t.id !== taskId))

      const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", taskId)

      if (error) throw error

      toast.success("Task deleted successfully")
    } catch (error: any) {
      console.error("Delete task error:", error)
      const message = error.message || error.details || (typeof error === 'object' ? JSON.stringify(error) : String(error))
      toast.error("Failed to delete task: " + message)
    }
  }

  const handleMoveAllTasks = async (taskIds: string[], targetStatus: string) => {
    try {
      // Optimistic update
      setTasks(prev => prev.map(t => taskIds.includes(t.id) ? { ...t, status: targetStatus } : t))

      const { error } = await supabase
        .from("tasks")
        .update({ status: targetStatus })
        .in("id", taskIds)

      if (error) throw error

      toast.success(`Moved ${taskIds.length} tasks to ${targetStatus}`)
    } catch (error: any) {
      console.error("Move all tasks error:", error)
      toast.error("Failed to move tasks")
    }
  }

  const handleTaskQuickCreate = async (status: string, parentId: string, title: string) => {
    try {
      // Find parent task to inherit phase/project if needed
      const parentTask = tasks.find(t => t.id === parentId)
      
      // Get assignees based on mode
      let assigneeIds: string[] = []
      if (kanbanMode === "admin") {
        assigneeIds = members.filter(m => m.role === "admin").map(m => m.id)
      }

      // If there's only one assignee, auto-assign them as the user_id
      const finalUserId = assigneeIds.length === 1 ? assigneeIds[0] : null;

      const { data, error } = await supabase
        .from("tasks")
        .insert([{
          title,
          status,
          user_id: finalUserId,
          type: parentTask?.type || 'feature',
          parent_id: parentId,
          phase_id: parentTask?.phase_id || null,
          order_index: tasks.filter(t => t.parent_id === parentId).length
        }])
        .select()
        .single()

      if (error) throw error

      // Auto-assign all members from the mode
      if (assigneeIds.length > 0) {
        const assignments = assigneeIds.map(userId => ({
          task_id: data.id,
          user_id: userId
        }))
        await supabase.from("task_members").insert(assignments)
      }

      toast.success("Subtask added")
    } catch (error: any) {
      console.error("Quick create task error:", error)
      const message = error.message || error.details || (typeof error === 'object' ? JSON.stringify(error) : String(error))
      toast.error("Failed to add subtask: " + message)
    }
  }

  return (
    <PageContainer className="h-full overflow-hidden">
      <SEO title="Tasks - Kanban Board" />
      <div className="flex flex-1 flex-col gap-4 min-h-0 overflow-hidden">
        <div className="flex flex-col gap-2 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <IconLayoutKanban className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
                <p className="text-sm text-muted-foreground">Manage and track your project tasks across all phases.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ToggleGroup 
                type="single" 
                value={viewMode} 
                onValueChange={(v) => v && setViewMode(v as "kanban" | "table")}
                className="border rounded-lg p-1 bg-muted/50"
              >
                <ToggleGroupItem value="kanban" className="h-8 px-3 gap-2 data-[state=on]:bg-background">
                  <IconLayoutKanban className="size-4" />
                  <span className="text-xs font-medium">Kanban</span>
                </ToggleGroupItem>
                <ToggleGroupItem value="table" className="h-8 px-3 gap-2 data-[state=on]:bg-background">
                  <IconTable className="size-4" />
                  <span className="text-xs font-medium">Table</span>
                </ToggleGroupItem>
              </ToggleGroup>
              <Button onClick={() => handleTaskCreateTrigger("todo")} size="sm">
                <IconPlus className="mr-2 h-4 w-4" />
                Add Task
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          {viewMode === "kanban" ? (
            <KanbanBoard 
              tasks={tasks} 
              members={members}
              onTaskUpdate={handleTaskUpdate}
              onTaskCreate={handleTaskCreateTrigger}
              onTaskQuickCreate={handleTaskQuickCreate}
              onTaskEdit={handleTaskEditTrigger}
              onTaskDelete={handleTaskDelete}
              onMoveAllTasks={handleMoveAllTasks}
              isLoading={isLoading}
              mode={kanbanMode}
              onModeChange={setKanbanMode}
              disablePadding
            />
          ) : (
            <TasksTable 
              tasks={tasks}
              onTaskEdit={handleTaskEditTrigger}
              onTaskDelete={handleTaskDelete}
              onTaskUpdate={handleTaskUpdate}
              onShare={(task) => {
                const shareData = {
                  title: task.title,
                  text: task.description || task.title,
                  url: `${window.location.origin}/dashboard/tasks?taskId=${task.id}`,
                }
                if (navigator.share && navigator.canShare(shareData)) {
                  navigator.share(shareData).catch(err => {
                    if (err.name !== 'AbortError') toast.error("Failed to share task")
                  })
                } else {
                  navigator.clipboard.writeText(shareData.url)
                  toast.success("Link copied to clipboard")
                }
              }}
              isLoading={isLoading}
            />
          )}
        </div>
      </div>


      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
            <DialogDescription>
              Add a new task to the {creatingStatus} column.
            </DialogDescription>
          </DialogHeader>
          <TaskForm 
            onSubmit={handleTaskCreate}
            onCancel={() => {
              setIsCreateDialogOpen(false)
              setCreatingParentId(null)
            }}
            isLoading={isSubmitting}
            members={members}
            phases={phases}
            projects={projects}
            tasks={tasks}
            defaultValues={{
              parent_id: creatingParentId
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={handleEditDialogChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
            <DialogDescription>
              Update the details of this task.
            </DialogDescription>
          </DialogHeader>
          {editingTask && (
            <TaskForm 
              onSubmit={handleTaskEdit}
              onCancel={() => handleEditDialogChange(false)}
              onDelete={() => {
                handleTaskDelete(editingTask.id)
                handleEditDialogChange(false)
              }}
              onShare={() => {
                const shareData = {
                  title: editingTask.title,
                  text: editingTask.description || editingTask.title,
                  url: `${window.location.origin}/dashboard/tasks?taskId=${editingTask.id}`,
                }
                if (navigator.share && navigator.canShare(shareData)) {
                  navigator.share(shareData).catch(err => {
                    if (err.name !== 'AbortError') toast.error("Failed to share task")
                  })
                } else {
                  navigator.clipboard.writeText(shareData.url)
                  toast.success("Link copied to clipboard")
                }
              }}
              onSubtaskToggle={(id, status) => handleTaskUpdate(id, { status: status === 'complete' ? 'todo' : 'complete' })}
              onAddSubtask={(title) => handleTaskQuickCreate(editingTask.status, editingTask.id, title)}
              isLoading={isSubmitting}
              members={members}
              phases={phases}
              projects={projects}
              tasks={tasks}
              defaultValues={{
                id: editingTask.id,
                title: editingTask.title,
                description: editingTask.description || "",
                status: editingTask.status,
                type: editingTask.type ?? undefined,
                user_id: editingTask.user_id,
                project_id: (editingTask as any).project_id,
                phase_id: editingTask.phase_id,
                parent_id: editingTask.parent_id,
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}
