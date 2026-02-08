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

export default function TasksPage() {
  const { user } = useAuth()
  const [tasks, setTasks] = React.useState<Task[]>([])
  const [members, setMembers] = React.useState<Tables<"profiles">[]>([])
  const [proposals, setProposals] = React.useState<Tables<"proposals">[]>([])
  const [projects, setProjects] = React.useState<Tables<"projects">[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false)
  const [editingTask, setEditingTask] = React.useState<Task | null>(null)
  const [creatingStatus, setCreatingStatus] = React.useState<string | null>(null)
  const [creatingParentId, setCreatingParentId] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const fetchInitialData = React.useCallback(async () => {
    try {
      setIsLoading(true)
      
      const [tasksRes, membersRes, proposalsRes, projectsRes] = await Promise.all([
        supabase
          .from("tasks")
          .select(`
            *,
            proposals (
              id,
              title,
              project_id,
              projects (
                name
              )
            ),
            task_attachments (*)
          `)
          .order("order_index", { ascending: true }),
        supabase
          .from("profiles")
          .select("*")
          .order("full_name", { ascending: true }),
        supabase
          .from("proposals")
          .select("*")
          .order("order_index", { ascending: true })
          .order("title", { ascending: true }),
        supabase
          .from("projects")
          .select("*")
          .order("name", { ascending: true })
      ])

      if (tasksRes.error) throw tasksRes.error
      if (membersRes.error) throw membersRes.error
      if (proposalsRes.error) throw proposalsRes.error
      if (projectsRes.error) throw projectsRes.error

      const fetchedMembers = membersRes.data || []
      const fetchedTasks = (tasksRes.data || []).map(task => ({
        ...task,
        profiles: fetchedMembers.find(m => m.id === task.user_id) || null
      }))

      setTasks(fetchedTasks as Task[])
      setMembers(fetchedMembers)
      setProposals(proposalsRes.data || [])
      setProjects(projectsRes.data || [])
    } catch (error: any) {
      console.error("Fetch tasks error:", error)
      const message = error.message || error.details || (typeof error === 'object' ? JSON.stringify(error) : String(error))
      toast.error("Failed to fetch data: " + message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchInitialData()
  }, [fetchInitialData])

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
    if (!creatingStatus) return

    try {
      setIsSubmitting(true)
      const { data, error } = await supabase
        .from("tasks")
        .insert([{
          title: values.title,
          description: values.description,
          user_id: values.user_id === "unassigned" ? null : values.user_id,
          proposal_id: values.proposal_id === "none" ? null : values.proposal_id,
          parent_id: (values.parent_id === "none" ? null : values.parent_id) || creatingParentId,
          status: creatingStatus,
          order_index: tasks.filter(t => t.status === creatingStatus).length
        }])
        .select(`
          *,
          proposals (
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
          proposal_id: data.proposal_id,
          order_index: index
        }))
        
        const { data: createdSubtasks, error: subtasksError } = await supabase
          .from("tasks")
          .insert(subtasksToInsert)
          .select(`
            *,
            proposals (
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
        user_id: values.user_id === "unassigned" ? null : (values.user_id || null),
        proposal_id: values.proposal_id === "none" ? null : (values.proposal_id || null),
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
      // Find parent task to inherit proposal/project if needed
      const parentTask = tasks.find(t => t.id === parentId)
      
      const { data, error } = await supabase
        .from("tasks")
        .insert([{
          title,
          status,
          parent_id: parentId,
          proposal_id: parentTask?.proposal_id || null,
          order_index: tasks.filter(t => t.parent_id === parentId).length
        }])
        .select(`
          *,
          proposals (
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
                <p className="text-sm text-muted-foreground">Manage and track your project tasks across all proposals.</p>
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
            proposals={proposals}
            projects={projects}
            tasks={tasks}
            defaultValues={{
              parent_id: creatingParentId
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
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
              onCancel={() => setIsEditDialogOpen(false)}
              onDelete={() => {
                handleTaskDelete(editingTask.id)
                setIsEditDialogOpen(false)
              }}
              onSubtaskToggle={(id, status) => handleTaskUpdate(id, { status: status === 'complete' ? 'todo' : 'complete' })}
              onAddSubtask={(title) => handleTaskQuickCreate(editingTask.status, editingTask.id, title)}
              isLoading={isSubmitting}
              members={members}
              proposals={proposals}
              projects={projects}
              tasks={tasks}
              defaultValues={{
                id: editingTask.id,
                title: editingTask.title,
                description: editingTask.description || "",
                user_id: editingTask.user_id,
                proposal_id: editingTask.proposal_id,
                parent_id: editingTask.parent_id,
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}