import * as React from "react"
import { toast } from "sonner"
import { IconFilter, IconClipboardList, IconUser, IconBriefcase, IconPlus } from "@tabler/icons-react"
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
import { useSearchParams } from "react-router-dom"

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
  const { user: currentUser, role } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const taskIdParam = searchParams.get("taskId")
  
  // If client, force targetUserId to be the currentUser.id
  const targetUserId = (role === "client") ? currentUser?.id : (userId || currentUser?.id)
  
  const [mode, setMode] = React.useState<"project" | "personal">("project")
  const [tasks, setTasks] = React.useState<Task[]>([])
  const [members, setMembers] = React.useState<Tables<"profiles">[]>([])
  const [proposals, setProposals] = React.useState<Tables<"proposals">[]>([])
  const [projects, setProjects] = React.useState<Tables<"projects">[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [statusFilter, setStatusFilter] = React.useState<string>(defaultStatusFilter)
  const [editingTask, setEditingTask] = React.useState<Task | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false)
  const [creatingStatus, setCreatingStatus] = React.useState<string | null>(null)
  const [creatingParentId, setCreatingParentId] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

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

  const fetchTasks = React.useCallback(async () => {
    if (!targetUserId) return

    try {
      setIsLoading(true)
      
      const [membersRes, proposalsRes, projectsRes] = await Promise.all([
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
            ),
            task_attachments (*)
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
      if (projectsRes.error) throw projectsRes.error

      const fetchedMembers = membersRes.data || []
      const fetchedTasks = (tasksRes.data || []).map((task: any) => ({
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
      toast.error("Failed to fetch tasks: " + message)
    } finally {
      setIsLoading(false)
    }
  }, [targetUserId, mode])

  React.useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  React.useEffect(() => {
    if (!targetUserId) return

    const table = mode === "project" ? "tasks" : "personal_tasks"
    const channel = supabase
      .channel(`assigned-tasks-${table}-${targetUserId}`)
      .on(
        "postgres_changes",
        { 
          event: "*", 
          schema: "public", 
          table: table,
          filter: `user_id=eq.${targetUserId}`
        },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            let data, error
            if (mode === "project") {
              const res = await supabase
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
                .eq("id", payload.new.id)
                .single()
              data = res.data
              error = res.error
            } else {
              const res = await (supabase.from as any)("personal_tasks")
                .select("*")
                .eq("id", payload.new.id)
                .single()
              data = res.data
              error = res.error
            }

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
            const updatedTask = payload.new as any
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
  }, [targetUserId, mode, members])

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

  const handleTaskCreate = async (values: TaskFormValues) => {
    if ((!creatingStatus && !values.status) || !targetUserId) return

    const finalStatus = values.status || creatingStatus || "todo"

    try {
      setIsSubmitting(true)
      const table = mode === "project" ? "tasks" : "personal_tasks"
      
      const payload: any = {
        title: values.title,
        description: values.description,
        type: values.type || 'feature',
        user_id: values.user_id === "unassigned" ? null : (values.user_id || targetUserId),
        status: finalStatus,
        order_index: tasks.filter(t => t.status === finalStatus).length,
        parent_id: values.parent_id === "none" ? null : (values.parent_id || creatingParentId)
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
          ),
          task_attachments (*)
        `).single()
      } else {
        res = await query.select("*").single()
      }

      if (res.error) throw res.error

      const taskId = res.data.id

      // Handle subtasks
      if (values.subtasks && values.subtasks.length > 0) {
        const subtasksToInsert = values.subtasks.map((title, index) => ({
          title,
          status: "todo",
          parent_id: taskId,
          user_id: targetUserId,
          proposal_id: mode === "project" ? res.data.proposal_id : null,
          order_index: index
        }))
        
        const { data: createdSubtasks, error: subtasksError } = await (supabase.from as any)(table)
          .insert(subtasksToInsert)
          .select(mode === "project" ? `*, proposals(id, title, project_id, projects(name)), task_attachments(*)` : `*`)

        if (subtasksError) throw subtasksError
        
        if (createdSubtasks) {
          const formattedSubtasks = (createdSubtasks as any[]).map(st => ({
            ...st,
            profiles: members.find(m => m.id === st.user_id) || null
          }))
          setTasks(prev => [...prev, ...formattedSubtasks as Task[]])
        }
      }

      // Handle attachments (only for project tasks)
      if (mode === "project" && values.files && values.files.length > 0 && typeof window !== 'undefined') {
        const { default: imageCompression } = await import("browser-image-compression")
        
        for (const file of values.files as File[]) {
          let fileToUpload = file

          if (file.type.startsWith('image/')) {
            const options = { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true }
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

          if (!currentUser) throw new Error("Not authenticated")

          const { data: attachment, error: dbError } = await supabase
            .from('task_attachments')
            .insert([{
              task_id: taskId,
              user_id: currentUser.id,
              file_path: filePath,
              file_name: file.name,
              file_type: file.type,
              file_size: fileToUpload.size
            }])
            .select()
            .single()

          if (dbError) throw dbError
          
          setTasks(prev => prev.map(t => {
            if (t.id === taskId) {
              return { ...t, task_attachments: [...(t.task_attachments || []), attachment] }
            }
            return t
          }))
        }
      }

      const newTask = {
        ...res.data,
        profiles: members.find(m => m.id === res.data.user_id) || null
      }

      setTasks(prev => {
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
      const updates: any = {
        title: values.title,
        description: values.description || null,
        status: values.status || editingTask.status,
        type: values.type || editingTask.type || 'feature',
        user_id: values.user_id === "unassigned" ? null : (values.user_id || null),
        parent_id: values.parent_id === "none" ? null : (values.parent_id || null)
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
    } catch (error: any) {
      console.error("Update task error:", error)
      const message = error.message || error.details || (typeof error === 'object' ? JSON.stringify(error) : String(error))
      toast.error("Failed to update task: " + message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleTaskQuickCreate = async (status: string, parentId: string, title: string) => {
    if (!targetUserId) return

    try {
      const table = mode === "project" ? "tasks" : "personal_tasks"
      const parentTask = tasks.find(t => t.id === parentId)
      
      const payload: any = {
        title,
        status,
        type: parentTask?.type || 'feature',
        parent_id: parentId,
        user_id: targetUserId,
        order_index: tasks.filter(t => t.parent_id === parentId).length
      }

      if (mode === "project") {
        payload.proposal_id = parentTask?.proposal_id || null
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
          ),
          task_attachments (*)
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
      toast.success("Subtask added")
    } catch (error: any) {
      console.error("Quick create task error:", error)
      const message = error.message || error.details || (typeof error === 'object' ? JSON.stringify(error) : String(error))
      toast.error("Failed to add subtask: " + message)
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
    } catch (error: any) {
      console.error("Delete task error:", error)
      const message = error.message || error.details || (typeof error === 'object' ? JSON.stringify(error) : String(error))
      toast.error("Failed to delete task: " + message)
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
            onTaskQuickCreate={handleTaskQuickCreate}
            onTaskEdit={(task) => {
              setEditingTask(task as Task)
              setIsEditDialogOpen(true)
            }}
            onTaskDelete={handleTaskDelete}
            onShare={(task) => {
              const shareData = {
                title: task.title,
                text: task.description || task.title,
                url: `${window.location.origin}${window.location.pathname}?taskId=${task.id}`,
              }

              if (navigator.share && navigator.canShare(shareData)) {
                navigator.share(shareData).catch(err => {
                  if (err.name !== 'AbortError') {
                    console.error("Error sharing:", err)
                    toast.error("Failed to share task")
                  }
                })
              } else {
                navigator.clipboard.writeText(shareData.url)
                toast.success("Link copied to clipboard")
              }
            }}
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
            onCancel={() => {
              setIsCreateDialogOpen(false)
              setCreatingParentId(null)
            }}
            isLoading={isSubmitting}
            members={members}
            proposals={proposals}
            projects={projects}
            tasks={tasks}
            hideAssignee={mode === "personal"}
            defaultValues={{
              user_id: targetUserId,
              parent_id: creatingParentId
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={handleEditDialogChange}>
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
              onCancel={() => handleEditDialogChange(false)}
              onDelete={() => {
                handleTaskDelete(editingTask.id)
                handleEditDialogChange(false)
              }}
              onShare={() => {
                const shareData = {
                  title: editingTask.title,
                  text: editingTask.description || editingTask.title,
                  url: `${window.location.origin}${window.location.pathname}?taskId=${editingTask.id}`,
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
              proposals={proposals}
              projects={projects}
              tasks={tasks}
              hideAssignee={mode === "personal"}
              defaultValues={{
                id: editingTask.id,
                title: editingTask.title,
                description: editingTask.description || "",
                status: editingTask.status,
                type: editingTask.type ?? undefined,
                user_id: editingTask.user_id,
                proposal_id: editingTask.proposal_id,
                parent_id: editingTask.parent_id,
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}


