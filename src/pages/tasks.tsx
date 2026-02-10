import * as React from "react"
import { toast } from "sonner"
import { IconLayoutKanban, IconPlus } from "@tabler/icons-react"
import { supabase } from "@/lib/supabase"
import type { Tables } from "@/lib/database.types"
import { PageContainer } from "@/components/page-container"
import { SEO } from "@/components/seo"
import { Button } from "@/components/ui/button"
import { KanbanBoard, type Task } from "@/components/projects/kanban-board"
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

export default function TasksPage() {
  const { user, role, loading: authLoading } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const taskIdParam = searchParams.get("taskId")
  const [tasks, setTasks] = React.useState<Task[]>([])
  const [members, setMembers] = React.useState<Tables<"profiles">[]>([])
  const [phases, setPhases] = React.useState<Tables<"phases">[]>([])
  const [projects, setProjects] = React.useState<Tables<"projects">[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false)
  const [editingTask, setEditingTask] = React.useState<Task | null>(null)
  const [creatingStatus, setCreatingStatus] = React.useState<string | null>(null)
  const [creatingParentId, setCreatingParentId] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const fetchInitialData = React.useCallback(async () => {
    if (!user || authLoading) return

    try {
      setIsLoading(true)
      
      const normalizedRole = role?.toLowerCase()
      const isClient = normalizedRole === "client"

      let tasksQuery = supabase
        .from("tasks")
        .select(`
          *,
          phases!inner (
            id,
            title,
            project_id,
            projects!inner (
              id,
              name,
              client_id,
              clients!inner (
                user_id
              )
            )
          ),
          task_attachments (*)
        `)
      
      let phasesQuery = supabase.from("phases").select("*, projects!inner(clients!inner(user_id))")
      let projectsQuery = supabase.from("projects").select("*, clients!inner(user_id)")

      if (isClient) {
        tasksQuery = tasksQuery.eq("phases.projects.clients.user_id", user.id)
        
        // For phases and projects, we need to join through clients table
        phasesQuery = phasesQuery.eq("projects.clients.user_id", user.id)
        projectsQuery = projectsQuery.eq("clients.user_id", user.id)
      }

      const [tasksRes, membersRes, phasesRes, projectsRes] = await Promise.all([
        tasksQuery.order("order_index", { ascending: true }),
        supabase
          .from("profiles")
          .select("*")
          .order("full_name", { ascending: true }),
        phasesQuery
          .order("order_index", { ascending: true })
          .order("title", { ascending: true }),
        projectsQuery
          .order("name", { ascending: true })
      ])

      if (tasksRes.error) throw tasksRes.error
      if (membersRes.error) throw membersRes.error
      if (phasesRes.error) throw phasesRes.error
      if (projectsRes.error) throw projectsRes.error

      const fetchedMembers = membersRes.data || []
      const fetchedTasks = (tasksRes.data || []).map(task => ({
        ...task,
        profiles: fetchedMembers.find(m => m.id === task.user_id) || null
      }))

      setTasks(fetchedTasks as Task[])
      setMembers(fetchedMembers)
      setPhases(phasesRes.data || [])
      setProjects(projectsRes.data || [])
    } catch (error: any) {
      console.error("Fetch tasks error:", error)
      const message = error.message || error.details || (typeof error === 'object' ? JSON.stringify(error) : String(error))
      toast.error("Failed to fetch data: " + message)
    } finally {
      setIsLoading(false)
    }
  }, [user, role, authLoading])

  React.useEffect(() => {
    fetchInitialData()
  }, [fetchInitialData])

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

  React.useEffect(() => {
    const channel = supabase
      .channel("tasks-all-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            const { data, error } = await supabase
              .from("tasks")
              .select(`
                *,
                phases (
                  id,
                  title,
                  project_id,
                  projects (
                    name
                  )
                ),
                task_attachments (*)
              `)
              .eq("id", payload.new.id)
              .single()

            if (!error && data) {
              const newTask = {
                ...data,
                profiles: members.find(m => m.id === data.user_id) || null
              }
              setTasks(prev => {
                if (prev.some(t => t.id === newTask.id)) return prev
                return [...prev, newTask as Task]
              })
            }
          } else if (payload.eventType === "UPDATE") {
            const updatedTask = payload.new as Task
            setTasks(prev => prev.map(t => {
              if (t.id === updatedTask.id) {
                return {
                  ...t,
                  ...updatedTask,
                  profiles: members.find(m => m.id === updatedTask.user_id) || null
                }
              }
              return t
            }))
          } else if (payload.eventType === "DELETE") {
            setTasks(prev => prev.filter(t => t.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [members])

  const handleTaskUpdate = async (taskId: string, updates: Partial<Task>) => {
    try {
      // If user_id is changed, we need to update the profiles object locally as well
      const updatedData = { ...updates }
      if ("user_id" in updates) {
        (updatedData as Record<string, unknown>).profiles = members.find(m => m.id === updates.user_id) || null
      }

      const { error } = await supabase
        .from("tasks")
        .update(updates)
        .eq("id", taskId)

      if (error) throw error
      
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updatedData } : t))
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
      const { data, error } = await supabase
        .from("tasks")
        .insert([{
          title: values.title,
          description: values.description,
          type: values.type || 'feature',
          user_id: values.user_id === "unassigned" ? null : values.user_id,
          phase_id: values.phase_id === "none" ? null : values.phase_id,
          parent_id: (values.parent_id === "none" ? null : values.parent_id) || creatingParentId,
          status: finalStatus,
          order_index: tasks.filter(t => t.status === finalStatus).length
        }])
        .select(`
          *,
          phases (
            id,
            title,
            project_id,
            projects (
              name
            )
          ),
          task_attachments (*)
        `)
        .single()

      if (error) throw error

      const taskId = data.id

      // Handle subtasks
      if (values.subtasks && values.subtasks.length > 0) {
        const subtasksToInsert = values.subtasks.map((title, index) => ({
          title,
          status: "todo",
          parent_id: taskId,
          phase_id: data.phase_id,
          order_index: index
        }))
        
        const { data: createdSubtasks, error: subtasksError } = await supabase
          .from("tasks")
          .insert(subtasksToInsert)
          .select(`
            *,
            phases (
              id,
              title,
              project_id,
              projects (
                name
              )
            ),
            task_attachments (*)
          `)

        if (subtasksError) throw subtasksError
        
        if (createdSubtasks) {
          const formattedSubtasks = createdSubtasks.map(st => ({
            ...st,
            profiles: null
          }))
          setTasks(prev => [...prev, ...formattedSubtasks as Task[]])
        }
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

          const { data: attachment, error: dbError } = await supabase
            .from('task_attachments')
            .insert([{
              task_id: taskId,
              user_id: user.id,
              file_path: filePath,
              file_name: file.name,
              file_type: file.type,
              file_size: fileToUpload.size
            }])
            .select()
            .single()

          if (dbError) throw dbError
          
          // Update the task in state to include the new attachment
          setTasks(prev => prev.map(t => {
            if (t.id === taskId) {
              return {
                ...t,
                task_attachments: [...(t.task_attachments || []), attachment]
              }
            }
            return t
          }))
        }
      }

      const newTask = {
        ...data,
        profiles: members.find(m => m.id === data.user_id) || null
      }

      setTasks(prev => {
        // If task already exists (e.g. we updated it with attachments), just return prev
        if (prev.some(t => t.id === newTask.id)) return prev
        return [...prev, newTask as Task]
      })
      
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
      const updates = {
        title: values.title,
        description: values.description || null,
        status: values.status || editingTask.status,
        type: values.type || editingTask.type || 'feature',
        user_id: values.user_id === "unassigned" ? null : (values.user_id || null),
        phase_id: values.phase_id === "none" ? null : (values.phase_id || null),
        parent_id: values.parent_id === "none" ? null : (values.parent_id || null),
      }

      const { error } = await supabase
        .from("tasks")
        .update(updates)
        .eq("id", editingTask.id)

      if (error) throw error

      setTasks(prev => prev.map(t => t.id === editingTask.id ? { 
        ...t, 
        ...updates,
        profiles: members.find(m => m.id === updates.user_id) || null,
      } : t))
      
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
      const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", taskId)

      if (error) throw error

      setTasks(prev => prev.filter(t => t.id !== taskId))
      toast.success("Task deleted successfully")
    } catch (error: any) {
      console.error("Delete task error:", error)
      const message = error.message || error.details || (typeof error === 'object' ? JSON.stringify(error) : String(error))
      toast.error("Failed to delete task: " + message)
    }
  }

  const handleTaskQuickCreate = async (status: string, parentId: string, title: string) => {
    try {
      // Find parent task to inherit phase/project if needed
      const parentTask = tasks.find(t => t.id === parentId)
      
      const { data, error } = await supabase
        .from("tasks")
        .insert([{
          title,
          status,
          type: parentTask?.type || 'feature',
          parent_id: parentId,
          phase_id: parentTask?.phase_id || null,
          order_index: tasks.filter(t => t.parent_id === parentId).length
        }])
        .select(`
          *,
          phases (
            id,
            title,
            project_id,
            projects (
              name
            )
          ),
          task_attachments (*)
        `)
        .single()

      if (error) throw error

      const newTask = {
        ...data,
        profiles: null
      }

      setTasks(prev => [...prev, newTask as Task])
      toast.success("Subtask added")
    } catch (error: any) {
      console.error("Quick create task error:", error)
      const message = error.message || error.details || (typeof error === 'object' ? JSON.stringify(error) : String(error))
      toast.error("Failed to add subtask: " + message)
    }
  }

  return (
    <PageContainer className="min-h-0 overflow-hidden">
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
              <Button onClick={() => handleTaskCreateTrigger("todo")} size="sm">
                <IconPlus className="mr-2 h-4 w-4" />
                Add Task
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0">
          <KanbanBoard 
            tasks={tasks} 
            members={members}
            onTaskUpdate={handleTaskUpdate}
            onTaskCreate={handleTaskCreateTrigger}
            onTaskQuickCreate={handleTaskQuickCreate}
            onTaskEdit={handleTaskEditTrigger}
            onTaskDelete={handleTaskDelete}
            isLoading={isLoading}
          />
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