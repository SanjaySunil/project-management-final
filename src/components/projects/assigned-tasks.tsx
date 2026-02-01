import * as React from "react"
import { toast } from "sonner"
import { IconTable, IconLayoutKanban, IconFilter, IconClipboardList } from "@tabler/icons-react"
import { supabase } from "@/lib/supabase"
import type { Tables } from "@/lib/database.types"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from "@/components/ui/empty"
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { TaskForm, type TaskFormValues } from "@/components/projects/task-form"
import { KanbanBoard } from "@/components/projects/kanban-board"

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

interface AssignedTasksProps {
  userId?: string
  hideHeader?: boolean
  defaultView?: "kanban" | "table"
  hideViewToggle?: boolean
  defaultStatusFilter?: string
}

export function AssignedTasks({ 
  userId, 
  hideHeader = false,
  defaultView,
  hideViewToggle = false,
  defaultStatusFilter = "active"
}: AssignedTasksProps) {
  const { user: currentUser } = useAuth()
  const targetUserId = userId || currentUser?.id
  const [tasks, setTasks] = React.useState<Task[]>([])
  const [proposals, setProposals] = React.useState<Tables<"proposals">[]>([])
  const [members, setMembers] = React.useState<Tables<"profiles">[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [view, setView] = React.useState<"kanban" | "table">(defaultView || (hideHeader ? "table" : "kanban"))
  const [statusFilter, setStatusFilter] = React.useState<string>(defaultStatusFilter)
  const [editingTask, setEditingTask] = React.useState<Task | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false)
  const [creatingStatus, setCreatingStatus] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const fetchTasks = React.useCallback(async () => {
    if (!targetUserId) return

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
          .eq("user_id", targetUserId)
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
      toast.error("Failed to fetch tasks: " + (error instanceof Error ? error.message : String(error)))
    } finally {
      setIsLoading(false)
    }
  }, [targetUserId])

  React.useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const filteredTasks = React.useMemo(() => {
    if (statusFilter === "all") return tasks
    if (statusFilter === "active") return tasks.filter(t => t.status !== "complete")
    if (statusFilter === "complete") return tasks.filter(t => t.status === "complete")
    // If it's a specific status (e.g. "in progress")
    return tasks.filter(t => t.status === statusFilter)
  }, [tasks, statusFilter])

  const handleTaskUpdate = async (taskId: string, updates: Partial<Task>) => {
    try {
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

  const handleTaskCreate = async (values: TaskFormValues) => {
    if (!creatingStatus || !targetUserId) return

    try {
      setIsSubmitting(true)
      const { data, error } = await supabase
        .from("tasks")
        .insert([{
          title: values.title,
          description: values.description,
          user_id: values.user_id === "unassigned" ? null : (values.user_id || targetUserId),
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

  const targetUser = React.useMemo(() => {
    return members.find(m => m.id === targetUserId)
  }, [members, targetUserId])

  const title = React.useMemo(() => {
    if (!targetUserId || targetUserId === currentUser?.id) return "Assigned to Me"
    return targetUser?.full_name ? `Assigned to ${targetUser.full_name}` : "Assigned Tasks"
  }, [targetUserId, currentUser?.id, targetUser])

  return (
    <div className="flex flex-col gap-6 h-full">
      {!hideHeader && (
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">
              {targetUserId === currentUser?.id 
                ? "Manage tasks that are specifically assigned to you."
                : `Viewing tasks assigned to ${targetUser?.full_name || 'this user'}.`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!hideViewToggle && (
              <Tabs value={view} onValueChange={(v) => setView(v as "kanban" | "table")}>
                <TabsList>
                  <TabsTrigger value="kanban">
                    <IconLayoutKanban className="mr-2 h-4 w-4" />
                    Kanban
                  </TabsTrigger>
                  <TabsTrigger value="table">
                    <IconTable className="mr-2 h-4 w-4" />
                    Table
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <IconFilter className="mr-2 h-4 w-4" />
                  {statusFilter === "all" ? "All Tasks" : statusFilter === "active" ? "Active" : "Complete"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setStatusFilter("all")}>
                  All Tasks
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("active")}>
                  Active Tasks
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("complete")}>
                  Completed Tasks
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}

      {hideHeader && !hideViewToggle && (
        <div className="flex items-center justify-end mb-4">
          <Tabs value={view} onValueChange={(v) => setView(v as "kanban" | "table")}>
            <TabsList>
              <TabsTrigger value="kanban">
                <IconLayoutKanban className="mr-2 h-4 w-4" />
                Kanban
              </TabsTrigger>
              <TabsTrigger value="table">
                <IconTable className="mr-2 h-4 w-4" />
                Table
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      )}

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <p>Loading tasks...</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <Empty className="border-none bg-transparent">
          <EmptyMedia variant="icon">
            <IconClipboardList className="h-6 w-6" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>No tasks found</EmptyTitle>
            <EmptyDescription>
              {statusFilter === "active" 
                ? (targetUserId === currentUser?.id ? "You don't have any active tasks assigned to you." : "This member doesn't have any active tasks.")
                : statusFilter === "complete" 
                ? (targetUserId === currentUser?.id ? "You haven't completed any tasks yet." : "This member hasn't completed any tasks yet.")
                : statusFilter === "in progress"
                ? (targetUserId === currentUser?.id ? "You aren't currently working on any tasks." : "This member isn't currently working on any tasks.")
                : `No tasks found with status "${statusFilter}".`}
            </EmptyDescription>
          </EmptyHeader>
          <Button onClick={() => handleTaskCreateTrigger(statusFilter === "all" || statusFilter === "active" ? "todo" : statusFilter)} className="mt-4">
            Add {statusFilter === "active" ? "an Active" : statusFilter === "in progress" ? "a Working" : "a"} Task
          </Button>
        </Empty>
      ) : (
        <div className="flex-1 overflow-hidden min-h-[500px]">
          <KanbanBoard 
            tasks={filteredTasks}
            members={members}
            onTaskUpdate={handleTaskUpdate}
            onTaskCreate={handleTaskCreateTrigger}
            onTaskEdit={(task) => {
              setEditingTask(task as Task)
              setIsEditDialogOpen(true)
            }}
            onTaskDelete={handleTaskDelete}
            view={view}
            onViewChange={setView}
            hideControls
          />
        </div>
      )}

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
            defaultValues={{
              user_id: targetUserId
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
    </div>
  )
}

