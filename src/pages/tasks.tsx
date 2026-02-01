import * as React from "react"
import { toast } from "sonner"
import { IconLayoutKanban } from "@tabler/icons-react"
import { supabase } from "@/lib/supabase"
import type { Tables } from "@/lib/database.types"
import { PageContainer } from "@/components/page-container"
import { SEO } from "@/components/seo"
import { KanbanBoard } from "@/components/projects/kanban-board"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { TaskForm, type TaskFormValues } from "@/components/projects/task-form"

type Task = Tables<"tasks"> & {
  proposals?: {
    id: string
    title: string
    projects?: {
      name: string
    } | null
  } | null
  profiles?: {
    full_name: string | null
    avatar_url: string | null
    email: string | null
  } | null
}

export default function TasksPage() {
  const [tasks, setTasks] = React.useState<Task[]>([])
  const [proposals, setProposals] = React.useState<Tables<"proposals">[]>([])
  const [members, setMembers] = React.useState<Tables<"profiles">[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false)
  const [editingTask, setEditingTask] = React.useState<Task | null>(null)
  const [creatingStatus, setCreatingStatus] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const fetchInitialData = React.useCallback(async () => {
    try {
      setIsLoading(true)
      
      const [tasksRes, proposalsRes, membersRes] = await Promise.all([
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
            )
          `)
          .order("order_index", { ascending: true }),
        supabase
          .from("proposals")
          .select("*")
          .order("title", { ascending: true }),
        supabase
          .from("profiles")
          .select("*")
          .order("full_name", { ascending: true })
      ])

      if (tasksRes.error) throw tasksRes.error
      if (proposalsRes.error) throw proposalsRes.error
      if (membersRes.error) throw membersRes.error

      const fetchedMembers = membersRes.data || []
      const fetchedTasks = (tasksRes.data || []).map(task => ({
        ...task,
        profiles: fetchedMembers.find(m => m.id === task.user_id) || null
      }))

      setTasks(fetchedTasks as Task[])
      setProposals(proposalsRes.data || [])
      setMembers(fetchedMembers)
    } catch (error: unknown) {
      toast.error("Failed to fetch data: " + (error instanceof Error ? error.message : String(error)))
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
    } catch (error: unknown) {
      toast.error("Failed to update task: " + (error instanceof Error ? error.message : String(error)))
    }
  }

  const handleTaskCreateTrigger = (status: string) => {
    setCreatingStatus(status)
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
          )
        `)
        .single()

      if (error) throw error

      const newTask = {
        ...data,
        profiles: members.find(m => m.id === data.user_id) || null
      }

      setTasks(prev => [...prev, newTask as Task])
      setIsCreateDialogOpen(false)
      toast.success("Task created successfully")
    } catch (error: unknown) {
      toast.error("Failed to create task: " + (error instanceof Error ? error.message : String(error)))
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
        // We also need to update the proposals object if it changed
        proposals: updates.proposal_id 
          ? (proposals.find(p => p.id === updates.proposal_id) as Task["proposals"]) 
          : null
      } : t))
      
      setIsEditDialogOpen(false)
      setEditingTask(null)
      toast.success("Task updated successfully")
    } catch (error: unknown) {
      toast.error("Failed to update task: " + (error instanceof Error ? error.message : String(error)))
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
    } catch (error: unknown) {
      toast.error("Failed to delete task: " + (error instanceof Error ? error.message : String(error)))
    }
  }

  return (
    <PageContainer>
      <SEO title="Tasks - Kanban Board" />
      <div className="flex flex-1 flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <IconLayoutKanban className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
              <p className="text-sm text-muted-foreground">Manage and track your project tasks across all proposals.</p>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-[500px]">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <p>Loading tasks...</p>
            </div>
          ) : (
            <KanbanBoard 
              tasks={tasks} 
              members={members}
              onTaskUpdate={handleTaskUpdate}
              onTaskCreate={handleTaskCreateTrigger}
              onTaskEdit={handleTaskEditTrigger}
              onTaskDelete={handleTaskDelete}
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
            onCancel={() => setIsCreateDialogOpen(false)}
            isLoading={isSubmitting}
            members={members}
            proposals={proposals}
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
              isLoading={isSubmitting}
              members={members}
              proposals={proposals}
              defaultValues={{
                title: editingTask.title,
                description: editingTask.description || "",
                user_id: editingTask.user_id,
                proposal_id: editingTask.proposal_id,
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}