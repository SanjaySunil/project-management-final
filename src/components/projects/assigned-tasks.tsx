import * as React from "react"
import { toast } from "sonner"
import { IconFilter, IconClipboardList, IconBriefcase, IconPlus, IconShieldLock } from "@tabler/icons-react"
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

import { useTasks } from "@/hooks/use-tasks"

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
  
  const [kanbanMode, setKanbanMode] = React.useState<"development" | "admin">("development")
  const [selectedProjectId, setSelectedProjectId] = React.useState<string>("all")
  const [members, setMembers] = React.useState<Tables<"profiles">[]>([])
  const [phases, setPhases] = React.useState<Tables<"phases">[]>([])
  const [projects, setProjects] = React.useState<Tables<"projects">[]>([])
  const [isLoadingMetadata, setIsLoadingMetadata] = React.useState(true)
  const [statusFilter, setStatusFilter] = React.useState<string>(defaultStatusFilter)
  const [editingTask, setEditingTask] = React.useState<Task | null>(null)

  const { tasks: projectTasks, isLoading: isProjectTasksLoading, setTasks: setProjectTasks } = useTasks({ 
    userId: targetUserId, 
    isPersonal: false,
    broadSubscription: true // Use broad to catch changes in task_members too
  })
  
  const { tasks: personalTasks, isLoading: isPersonalTasksLoading, setTasks: setPersonalTasks } = useTasks({ 
    userId: targetUserId, 
    isPersonal: true 
  })

  // Memoize projects that have tasks assigned to this user
  const projectsWithTasks = React.useMemo(() => {
    if (kanbanMode !== "development") return []
    const projectMap = new Map<string, { id: string, name: string }>()
    projectTasks.forEach(task => {
      const project = (task as any).projects || (task.phases as any)?.projects
      if (project?.id && project?.name) {
        projectMap.set(project.id, {
          id: project.id,
          name: project.name
        })
      }
    })
    return Array.from(projectMap.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [projectTasks, kanbanMode])

  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false)
  const [creatingStatus, setCreatingStatus] = React.useState<string | null>(null)
  const [creatingParentId, setCreatingParentId] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const fetchMetadata = React.useCallback(async () => {
    if (!targetUserId) return

    try {
      setIsLoadingMetadata(true)
      
      const [membersRes, phasesRes, projectsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .neq("role", "client")
          .order("full_name", { ascending: true }),
        supabase
          .from("phases")
          .select("*")
          .order("order_index", { ascending: true })
          .order("title", { ascending: true }),
        supabase
          .from("projects")
          .select("*")
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
  }, [targetUserId])

  React.useEffect(() => {
    fetchMetadata()
  }, [fetchMetadata])

  const isLoading = isLoadingMetadata || isProjectTasksLoading || isPersonalTasksLoading

  // Handle deep linking for tasks
  React.useEffect(() => {
    const allTasks = [...projectTasks, ...personalTasks]
    if (taskIdParam && allTasks.length > 0 && !editingTask) {
      const task = allTasks.find(t => t.id === taskIdParam)
      if (task) {
        setEditingTask(task)
        setIsEditDialogOpen(true)
      }
    }
  }, [taskIdParam, projectTasks, personalTasks, editingTask])

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

  const filteredTasks = React.useMemo(() => {
    // Filter project tasks by mode
    const filteredProjectTasks = projectTasks.filter(task => {
      const hasAdmin = (task as any).task_members?.some((m: any) => m.profiles?.role === 'admin')
      const isAdminType = task.type === 'admin'
      if (kanbanMode === 'admin') {
        return hasAdmin || isAdminType
      }
      return !hasAdmin && !isAdminType
    })

    // Personal tasks only show in admin mode
    const filteredPersonalTasks = kanbanMode === 'admin' ? personalTasks : []

    let filtered = [...filteredProjectTasks, ...filteredPersonalTasks]

    // Filter by project if in development mode
    if (kanbanMode === "development" && selectedProjectId !== "all") {
      filtered = filtered.filter(t => {
        const projectId = (t as any).project_id || (t.phases as any)?.project_id
        return projectId === selectedProjectId
      })
    }

    if (statusFilter === "all") return filtered
    if (statusFilter === "active") return filtered.filter(t => t.status !== "complete")
    if (statusFilter === "complete") return filtered.filter(t => t.status === "complete")
    // If it's a specific status (e.g. "in progress")
    return filtered.filter(t => t.status === statusFilter)
  }, [projectTasks, personalTasks, statusFilter, selectedProjectId, kanbanMode])

  const handleTaskUpdate = async (taskId: string, updates: Partial<Task>) => {
    try {
      const allTasks = [...projectTasks, ...personalTasks]
      const task = allTasks.find(t => t.id === taskId)
      if (!task) return

      const isPersonal = (task as any).is_personal

      // Optimistic update
      if (isPersonal) {
        setPersonalTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t))
      } else {
        setProjectTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t))
      }

      // Strip non-column fields
      const dbUpdates = { ...updates } as any
      delete dbUpdates.phases
      delete dbUpdates.profiles
      delete dbUpdates.task_attachments
      delete dbUpdates.task_members
      delete dbUpdates.projects

      const table = isPersonal ? "personal_tasks" : "tasks"
      const { error } = await (supabase.from as any)(table)
        .update(dbUpdates)
        .eq("id", taskId)

      if (error) throw error

      // Update task_members in DB if user_id changed
      if (!isPersonal && "user_id" in updates) {
        await supabase.from("task_members").delete().eq("task_id", taskId)
        if (updates.user_id) {
          await supabase.from("task_members").insert([{
            task_id: taskId,
            user_id: updates.user_id
          }])
        }
      }
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
      const isPersonal = kanbanMode === "admin" && !values.project_id && !values.phase_id
      const table = isPersonal ? "personal_tasks" : "tasks"
      
      const assigneeIds = values.assignee_ids || []
      const finalUserId = assigneeIds.length > 0 ? assigneeIds[0] : (values.user_id === "unassigned" ? null : (values.user_id || targetUserId))

      const payload: any = {
        title: values.title,
        description: values.description,
        type: values.type || 'feature',
        user_id: finalUserId,
        status: finalStatus,
        order_index: (isPersonal ? personalTasks : projectTasks).filter(t => t.status === finalStatus).length,
        parent_id: values.parent_id === "none" ? null : (values.parent_id || creatingParentId)
      }

      if (!isPersonal) {
        payload.project_id = values.project_id === "none" ? null : values.project_id
        payload.phase_id = values.phase_id === "none" ? null : values.phase_id
      }

      const { data, error } = await (supabase.from as any)(table).insert([payload]).select().single()

      if (error) throw error

      const taskId = data.id

      // Handle multiple assignees
      if (!isPersonal && assigneeIds.length > 0) {
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
          phase_id: !isPersonal ? data.phase_id : null,
          order_index: index
        }))
        
        await (supabase.from as any)(table).insert(subtasksToInsert)
      }

      // Handle attachments (only for project tasks)
      if (!isPersonal && values.files && values.files.length > 0 && typeof window !== 'undefined') {
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

          await supabase
            .from('task_attachments')
            .insert([{
              task_id: taskId,
              user_id: currentUser.id,
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
      const isPersonal = (editingTask as any).is_personal
      
      const assigneeIds = values.assignee_ids || []
      const finalUserId = assigneeIds.length > 0 ? assigneeIds[0] : (values.user_id === "unassigned" ? null : (values.user_id || null))

      const updates: any = {
        title: values.title,
        description: values.description || null,
        status: values.status || editingTask.status,
        type: values.type || editingTask.type || 'feature',
        user_id: finalUserId,
        parent_id: values.parent_id === "none" ? null : (values.parent_id || null)
      }

      if (!isPersonal) {
        updates.project_id = values.project_id === "none" ? null : (values.project_id || null)
        updates.phase_id = values.phase_id === "none" ? null : (values.phase_id || null)
      }

      const table = isPersonal ? "personal_tasks" : "tasks"
      const { error } = await (supabase.from as any)(table)
        .update(updates)
        .eq("id", editingTask.id)

      if (error) throw error

      // Update task_members for project tasks
      if (!isPersonal) {
        await supabase.from("task_members").delete().eq("task_id", editingTask.id)
        
        if (assigneeIds.length > 0) {
          const assignments = assigneeIds.map(userId => ({
            task_id: editingTask.id,
            user_id: userId
          }))
          await supabase.from("task_members").insert(assignments)
        }
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

  const handleTaskQuickCreate = async (status: string, parentId: string, title: string) => {
    if (!targetUserId) return

    try {
      const allTasks = [...projectTasks, ...personalTasks]
      const task = allTasks.find(t => t.id === parentId)
      const isPersonal = (task as any)?.is_personal
      const table = isPersonal ? "personal_tasks" : "tasks"
      
      const payload: any = {
        title,
        status,
        type: task?.type || 'feature',
        parent_id: parentId,
        user_id: targetUserId,
        order_index: (isPersonal ? personalTasks : projectTasks).filter(t => t.parent_id === parentId).length
      }

      if (!isPersonal) {
        payload.phase_id = task?.phase_id || null
      }

      await (supabase.from as any)(table).insert([payload])
      toast.success("Subtask added")
    } catch (error: any) {
      console.error("Quick create task error:", error)
      const message = error.message || error.details || (typeof error === 'object' ? JSON.stringify(error) : String(error))
      toast.error("Failed to add subtask: " + message)
    }
  }

  const handleTaskDelete = async (taskId: string) => {
    try {
      const allTasks = [...projectTasks, ...personalTasks]
      const task = allTasks.find(t => t.id === taskId)
      const isPersonal = (task as any)?.is_personal
      
      // Optimistic delete
      if (isPersonal) {
        setPersonalTasks(prev => prev.filter(t => t.id !== taskId))
      } else {
        setProjectTasks(prev => prev.filter(t => t.id !== taskId))
      }

      const table = isPersonal ? "personal_tasks" : "tasks"
      const { error } = await (supabase.from as any)(table)
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
      const allTasks = [...projectTasks, ...personalTasks]
      const tasksToUpdate = allTasks.filter(t => taskIds.includes(t.id))
      
      const projectTaskIds = tasksToUpdate.filter(t => !(t as any).is_personal).map(t => t.id)
      const personalTaskIds = tasksToUpdate.filter(t => (t as any).is_personal).map(t => t.id)

      // Optimistic update
      setProjectTasks(prev => prev.map(t => taskIds.includes(t.id) ? { ...t, status: targetStatus } : t))
      setPersonalTasks(prev => prev.map(t => taskIds.includes(t.id) ? { ...t, status: targetStatus } : t))

      if (projectTaskIds.length > 0) {
        const { error } = await supabase
          .from("tasks")
          .update({ status: targetStatus })
          .in("id", projectTaskIds)
        if (error) throw error
      }

      if (personalTaskIds.length > 0) {
        const { error } = await (supabase.from as any)("personal_tasks")
          .update({ status: targetStatus })
          .in("id", personalTaskIds)
        if (error) throw error
      }
      
      toast.success(`Moved ${taskIds.length} tasks to ${targetStatus}`)
    } catch (error: any) {
      console.error("Move all tasks error:", error)
      toast.error("Failed to move tasks")
    }
  }

  const handleTaskConvert = async (task: Task) => {
    try {
      const isPersonal = (task as any).is_personal
      const isAdmin = task.type === 'admin'
      
      if (isPersonal) {
        const newType = 'feature'
        const { data: newTask, error } = await supabase
          .from("tasks")
          .insert([{
            title: task.title,
            description: task.description,
            status: task.status,
            type: newType,
            user_id: task.user_id,
            order_index: projectTasks.filter(t => t.status === task.status).length,
          }])
          .select()
          .single()

        if (error) throw error

        if (newTask.user_id) {
          await supabase.from("task_members").insert([{
            task_id: newTask.id,
            user_id: newTask.user_id
          }])
        }

        await (supabase.from as any)("personal_tasks").delete().eq("id", task.id)
        toast.success("Converted to development task")
      } else {
        const newType = isAdmin ? 'feature' : 'admin'
        const { error } = await supabase
          .from("tasks")
          .update({ type: newType })
          .eq("id", task.id)

        if (error) throw error
        toast.success(`Converted to ${newType === 'admin' ? 'admin' : 'development'} task`)
      }
    } catch (error: any) {
      console.error("Convert task error:", error)
      toast.error("Failed to convert task: " + error.message)
    }
  }

  const targetUser = React.useMemo(() => {
    return members.find(m => m.id === targetUserId)
  }, [members, targetUserId])

  const title = React.useMemo(() => {
    const modePrefix = kanbanMode === "development" ? "Development Tasks" : "Admin Tasks"
    if (!targetUserId || targetUserId === currentUser?.id) return modePrefix
    return targetUser?.full_name ? `${modePrefix} - ${targetUser.full_name}` : modePrefix
  }, [targetUserId, currentUser?.id, targetUser, kanbanMode])

  return (
    <div className="flex flex-1 flex-col gap-4 min-h-0 overflow-hidden">
      {!hideHeader && (
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between shrink-0">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">
              {kanbanMode === "development" 
                ? "Manage tasks that are specifically assigned to you in projects."
                : "Manage administrative and personal tasks."}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Tabs value={kanbanMode} onValueChange={(v) => {
              setKanbanMode(v as "development" | "admin")
              setSelectedProjectId("all")
            }}>
              <TabsList>
                <TabsTrigger value="development" className="flex items-center gap-2">
                  <IconBriefcase className="size-4" />
                  Development Tasks
                </TabsTrigger>
                <TabsTrigger value="admin" className="flex items-center gap-2">
                  <IconShieldLock className="size-4" />
                  Admin Tasks
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
        <div className="flex items-center justify-between shrink-0">
          <Tabs value={kanbanMode} onValueChange={(v) => {
            setKanbanMode(v as "development" | "admin")
            setSelectedProjectId("all")
          }}>
            <TabsList>
              <TabsTrigger value="development" className="flex items-center gap-2">
                <IconBriefcase className="size-4" />
                Development Tasks
              </TabsTrigger>
              <TabsTrigger value="admin" className="flex items-center gap-2">
                <IconShieldLock className="size-4" />
                Admin Tasks
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      )}

      {kanbanMode === "development" && projectsWithTasks.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar shrink-0 px-1">
          <Button
            variant={selectedProjectId === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedProjectId("all")}
            className="rounded-full px-4 h-8 text-xs"
          >
            All Projects
          </Button>
          {projectsWithTasks.map((project) => (
            <Button
              key={project.id}
              variant={selectedProjectId === project.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedProjectId(project.id)}
              className="rounded-full px-4 h-8 text-xs whitespace-nowrap"
            >
              {project.name}
            </Button>
          ))}
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
          {kanbanMode === "admin" && (
            <Button onClick={() => handleTaskCreateTrigger(statusFilter === "all" || statusFilter === "active" ? "todo" : statusFilter)} className="mt-4">
              Add {statusFilter === "active" ? "an Active" : statusFilter === "in progress" ? "a Working" : "a"} Admin Task
            </Button>
          )}
        </Empty>
      ) : (
        <div className="flex flex-1 flex-col overflow-hidden min-h-0">
          <KanbanBoard 
            tasks={filteredTasks}
            members={members}
            onTaskUpdate={handleTaskUpdate}
            onTaskConvert={handleTaskConvert}
            onTaskCreate={handleTaskCreateTrigger}
            onTaskQuickCreate={handleTaskQuickCreate}
            onTaskEdit={(task) => {
              setEditingTask(task as Task)
              setIsEditDialogOpen(true)
            }}
            onTaskDelete={handleTaskDelete}
            onMoveAllTasks={handleMoveAllTasks}
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
            disablePadding
            mode={kanbanMode}
          />
        </div>
      )}

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New {kanbanMode === "admin" ? "Admin" : "Development"} Task</DialogTitle>
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
            tasks={[...projectTasks, ...personalTasks]}
            hideAssignee={kanbanMode === "admin" && !creatingParentId}
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
            <DialogTitle>Edit {kanbanMode === "admin" ? "Admin" : "Development"} Task</DialogTitle>
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
              phases={phases}
              projects={projects}
              tasks={[...projectTasks, ...personalTasks]}
              hideAssignee={(editingTask as any).is_personal}
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
    </div>
  )
}
