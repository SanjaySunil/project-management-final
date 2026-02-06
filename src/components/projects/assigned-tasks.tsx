import * as React from "react"
import { toast } from "sonner"
import { IconTable, IconLayoutKanban, IconFilter, IconClipboardList, IconUser, IconBriefcase, IconList, IconPlus } from "@tabler/icons-react"
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
import { KanbanBoard, type Task } from "@/components/projects/kanban-board"

interface AssignedTasksProps {
  userId?: string
  hideHeader?: boolean
  defaultStatusFilter?: string
}

export function AssignedTasks({ 
  userId, 
  hideHeader = false,
  defaultStatusFilter = "active"
}: AssignedTasksProps) {
  const { user: currentUser } = useAuth()
  const targetUserId = userId || currentUser?.id
  const [mode, setMode] = React.useState<"project" | "personal">("project")
  const [tasks, setTasks] = React.useState<Task[]>([])
  const [members, setMembers] = React.useState<Tables<"profiles">[]>([])
  const [proposals, setProposals] = React.useState<Tables<"proposals">[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
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
      
      const [membersRes, proposalsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .order("full_name", { ascending: true }),
        supabase
          .from("proposals")
          .select("*")
          .order("title", { ascending: true })
      ])

      let tasksRes
      if (mode === "project") {
        tasksRes = await supabase
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
          .order("order_index", { ascending: true })
      } else {
        tasksRes = await (supabase.from as any)("personal_tasks")
          .select("*")
          .eq("user_id", targetUserId)
          .order("order_index", { ascending: true })
      }

      if (tasksRes.error) throw tasksRes.error
      if (membersRes.error) throw membersRes.error
      if (proposalsRes.error) throw proposalsRes.error

      const fetchedMembers = membersRes.data || []
      const fetchedTasks = (tasksRes.data || []).map((task: any) => ({
        ...task,
        profiles: fetchedMembers.find(m => m.id === task.user_id) || null
      }))

      setTasks(fetchedTasks as Task[])
      setMembers(fetchedMembers)
      setProposals(proposalsRes.data || [])
    } catch (error: unknown) {
      toast.error("Failed to fetch tasks: " + (error instanceof Error ? error.message : String(error)))
    } finally {
      setIsLoading(false)
    }
  }, [targetUserId, mode])

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

      const table = mode === "project" ? "tasks" : "personal_tasks"
      const { error } = await (supabase.from as any)(table)
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
      const table = mode === "project" ? "tasks" : "personal_tasks"
      
      const payload: any = {
        title: values.title,
        description: values.description,
        user_id: values.user_id === "unassigned" ? null : (values.user_id || targetUserId),
        status: creatingStatus,
        order_index: tasks.filter(t => t.status === creatingStatus).length
      }

      if (mode === "project") {
        payload.proposal_id = values.proposal_id === "none" ? null : values.proposal_id
      }

      const query = (supabase.from as any)(table).insert([payload])
      
      let res
      if (mode === "project") {
        res = await query.select(`
          *,
          proposals (
            id,
            title,
            project_id,
            projects (
              name
            )
          )
        `).single()
      } else {
        res = await query.select("*").single()
      }

      if (res.error) throw res.error

      const newTask = {
        ...res.data,
        profiles: members.find(m => m.id === res.data.user_id) || null
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
      const updates: any = {
        title: values.title,
        description: values.description || null,
        user_id: values.user_id === "unassigned" ? null : (values.user_id || null),
      }

      if (mode === "project") {
        updates.proposal_id = values.proposal_id === "none" ? null : (values.proposal_id || null)
      }

      const table = mode === "project" ? "tasks" : "personal_tasks"
      const { error } = await (supabase.from as any)(table)
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
    } catch (error: unknown) {
      toast.error("Failed to update task: " + (error instanceof Error ? error.message : String(error)))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleTaskDelete = async (taskId: string) => {
    try {
      const table = mode === "project" ? "tasks" : "personal_tasks"
      const { error } = await (supabase.from as any)(table)
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
    const modePrefix = mode === "project" ? "Project Tasks" : "Personal Tasks"
    if (!targetUserId || targetUserId === currentUser?.id) return modePrefix
    return targetUser?.full_name ? `${modePrefix} - ${targetUser.full_name}` : modePrefix
  }, [targetUserId, currentUser?.id, targetUser, mode])

  return (
    <div className="flex flex-col gap-6 h-full overflow-hidden">
      {!hideHeader && (
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between shrink-0">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">
              {mode === "project" 
                ? "Manage tasks that are specifically assigned to you in projects."
                : "Manage your private personal tasks and todos."}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Tabs value={mode} onValueChange={(v) => setMode(v as "project" | "personal")}>
              <TabsList>
                <TabsTrigger value="project" className="flex items-center gap-2">
                  <IconBriefcase className="size-4" />
                  Project
                </TabsTrigger>
                <TabsTrigger value="personal" className="flex items-center gap-2">
                  <IconUser className="size-4" />
                  Personal
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-2">
              <Button onClick={() => handleTaskCreateTrigger("todo")} size="sm">
                <IconPlus className="mr-2 h-4 w-4" />
                Add Task
              </Button>

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
        </div>
      )}

      {hideHeader && (
        <div className="flex items-center justify-between mb-4 shrink-0">
          <Tabs value={mode} onValueChange={(v) => setMode(v as "project" | "personal")}>
            <TabsList>
              <TabsTrigger value="project" className="flex items-center gap-2">
                <IconBriefcase className="size-4" />
                Project
              </TabsTrigger>
              <TabsTrigger value="personal" className="flex items-center gap-2">
                <IconUser className="size-4" />
                Personal
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      )}

      {isLoading ? (
        <div className="flex h-64 items-center justify-center shrink-0">
          <p>Loading tasks...</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <Empty className="border-none bg-transparent shrink-0">
          <EmptyMedia variant="icon">
            <IconClipboardList className="h-6 w-6" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>No tasks found</EmptyTitle>
            <EmptyDescription>
              {statusFilter === "active" 
                ? (targetUserId === currentUser?.id ? "You don't have any active tasks." : "This member doesn't have any active tasks.")
                : statusFilter === "complete" 
                ? (targetUserId === currentUser?.id ? "You haven't completed any tasks yet." : "This member hasn't completed any tasks yet.")
                : statusFilter === "in progress"
                ? (targetUserId === currentUser?.id ? "You aren't currently working on any tasks." : "This member isn't currently working on any tasks.")
                : `No tasks found with status "${statusFilter}".`}
            </EmptyDescription>
          </EmptyHeader>
          {mode === "personal" && (
            <Button onClick={() => handleTaskCreateTrigger(statusFilter === "all" || statusFilter === "active" ? "todo" : statusFilter)} className="mt-4">
              Add {statusFilter === "active" ? "an Active" : statusFilter === "in progress" ? "a Working" : "a"} Personal Task
            </Button>
          )}
        </Empty>
      ) : (
        <div className="flex-1 overflow-hidden min-h-0">
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
            hideControls
          />
        </div>
      )}

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New {mode === "personal" ? "Personal" : "Project"} Task</DialogTitle>
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
            hideAssignee={mode === "personal"}
            defaultValues={{
              user_id: targetUserId
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit {mode === "personal" ? "Personal" : "Project"} Task</DialogTitle>
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
              isLoading={isSubmitting}
              members={members}
              proposals={proposals}
              hideAssignee={mode === "personal"}
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


