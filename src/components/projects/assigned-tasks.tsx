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
  const [tasks, setTasks] = React.useState<Task[]>([])
  const [personalTasks, setPersonalTasks] = React.useState<Task[]>([])
  const [members, setMembers] = React.useState<Tables<"profiles">[]>([])
  const [phases, setPhases] = React.useState<Tables<"phases">[]>([])
  const [projects, setProjects] = React.useState<Tables<"projects">[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [statusFilter, setStatusFilter] = React.useState<string>(defaultStatusFilter)
  const [editingTask, setEditingTask] = React.useState<Task | null>(null)

  // Memoize projects that have tasks assigned to this user
  const projectsWithTasks = React.useMemo(() => {
    if (kanbanMode !== "development") return []
    const projectMap = new Map<string, { id: string, name: string }>()
    tasks.forEach(task => {
      const project = (task as any).projects || (task.phases as any)?.projects
      if (project?.id && project?.name) {
        projectMap.set(project.id, {
          id: project.id,
          name: project.name
        })
      }
    })
    return Array.from(projectMap.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [tasks, kanbanMode])

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
      
      const [membersRes, phasesRes, projectsRes, membershipsRes, clientProjectsRes, memberTasksRes] = await Promise.all([
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
          .order("name", { ascending: true }),
        supabase
          .from("project_members")
          .select("project_id")
          .eq("user_id", targetUserId),
        supabase
          .from("projects")
          .select("id, clients!inner(user_id)")
          .eq("clients.user_id", targetUserId),
        supabase
          .from("task_members")
          .select("task_id")
          .eq("user_id", targetUserId)
      ])

      const memberTaskIds = (memberTasksRes.data || []).map(m => m.task_id)

      // Pull project tasks where user is assigned or member
      let tasksQuery = supabase
        .from("tasks")
        .select(`
          *,
          projects (
            id,
            name,
            status
          ),
          phases (
            id,
            title,
            project_id,
            projects (
              id,
              name,
              status
            )
          ),
          task_attachments (*),
          task_members (
            user_id,
            profiles (
              id,
              full_name,
              avatar_url,
              email,
              role
            )
          )
        `)

      if (memberTaskIds.length > 0) {
        tasksQuery = tasksQuery.or(`user_id.eq.${targetUserId},id.in.(${memberTaskIds.join(",")})`)
      } else {
        tasksQuery = tasksQuery.eq("user_id", targetUserId)
      }

      const projectTasksRes = await tasksQuery.order("order_index", { ascending: true })

      // Pull personal tasks
      const personalTasksRes = await (supabase.from as any)("personal_tasks")
        .select("*")
        .eq("user_id", targetUserId)
        .order("order_index", { ascending: true })

      if (projectTasksRes.error) throw projectTasksRes.error
      if (personalTasksRes.error) throw personalTasksRes.error
      if (membersRes.error) throw membersRes.error
      if (phasesRes.error) throw phasesRes.error
      if (projectsRes.error) throw projectsRes.error
      if (membershipsRes.error) throw membershipsRes.error

      const memberProjectIds = (membershipsRes.data || []).map(m => m.project_id)
      const clientProjectIds = (clientProjectsRes.data || []).map(p => p.id)
      const allAllowedProjectIds = Array.from(new Set([...memberProjectIds, ...clientProjectIds]))

      const fetchedMembers = membersRes.data || []
      
      const fetchedProjectTasks = (projectTasksRes.data || []).map((task: any) => ({
        ...task,
        profiles: fetchedMembers.find(m => m.id === task.user_id) || null
      })).filter((task: any) => {
        const project = task.projects || task.phases?.projects
        const projectId = task.project_id || task.phases?.project_id
        
        // Filter by project status - only show active projects
        if (project && project.status !== 'active') return false
        
        // Filter by membership - only show projects user is assigned to
        return projectId ? allAllowedProjectIds.includes(projectId) : true // Allow tasks without project
      })

      const fetchedPersonalTasks = (personalTasksRes.data || []).map((task: any) => ({
        ...task,
        profiles: fetchedMembers.find(m => m.id === task.user_id) || null,
        is_personal: true
      }))

      setTasks(fetchedProjectTasks as Task[])
      setPersonalTasks(fetchedPersonalTasks as Task[])
      setMembers(fetchedMembers)
      setPhases(phasesRes.data || [])
      setProjects(projectsRes.data || [])
    } catch (error: any) {
      console.error("Fetch tasks error:", error)
      const message = error.message || error.details || (typeof error === 'object' ? JSON.stringify(error) : String(error))
      toast.error("Failed to fetch tasks: " + message)
    } finally {
      setIsLoading(false)
    }
  }, [targetUserId])

  React.useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  React.useEffect(() => {
    if (!targetUserId) return

    // Listen to project tasks
    const projectChannel = supabase
      .channel(`assigned-project-tasks-${targetUserId}`)
      .on(
        "postgres_changes",
        { 
          event: "*", 
          schema: "public", 
          table: "tasks",
          filter: `user_id=eq.${targetUserId}`
        },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            const res = await supabase
              .from("tasks")
              .select(`
                *,
                phases (
                  id,
                  title,
                  project_id,
                  projects (
                    id,
                    name,
                    status
                  )
                ),
                task_attachments (*),
                task_members (
                  user_id,
                              profiles (
                                id,
                                full_name,
                                avatar_url,
                                email,
                                role
                              )                )
              `)
              .eq("id", payload.new.id)
              .single()
            
            if (!res.error && res.data) {
              const project = (res.data.phases as any)?.projects
              
              // Skip if not active
              if (project && project.status !== 'active') return
              
              const newTask = {
                ...res.data,
                profiles: members.find(m => m.id === res.data.user_id) || null
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

    // Listen to personal tasks
    const personalChannel = supabase
      .channel(`assigned-personal-tasks-${targetUserId}`)
      .on(
        "postgres_changes",
        { 
          event: "*", 
          schema: "public", 
          table: "personal_tasks",
          filter: `user_id=eq.${targetUserId}`
        },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            const res = await (supabase.from as any)("personal_tasks")
              .select("*")
              .eq("id", payload.new.id)
              .single()

            if (!res.error && res.data) {
              const newTask = {
                ...res.data,
                profiles: members.find(m => m.id === res.data.user_id) || null,
                is_personal: true
              }
              setPersonalTasks(prev => {
                if (prev.some(t => t.id === newTask.id)) return prev
                return [...prev, newTask as Task]
              })
            }
          } else if (payload.eventType === "UPDATE") {
            const updatedTask = payload.new as any
            setPersonalTasks(prev => prev.map(t => {
              if (t.id === updatedTask.id) {
                return {
                  ...t,
                  ...updatedTask,
                  profiles: members.find(m => m.id === updatedTask.user_id) || null,
                  is_personal: true
                }
              }
              return t
            }))
          } else if (payload.eventType === "DELETE") {
            setPersonalTasks(prev => prev.filter(t => t.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(projectChannel)
      supabase.removeChannel(personalChannel)
    }
  }, [targetUserId, members])

  const filteredTasks = React.useMemo(() => {
    const projectPool = tasks
    const personalPool = personalTasks

    // Filter project tasks by mode
    const filteredProjectTasks = projectPool.filter(task => {
      const hasAdmin = (task as any).task_members?.some((m: any) => m.profiles?.role === 'admin')
      const isAdminType = task.type === 'admin'
      if (kanbanMode === 'admin') {
        return hasAdmin || isAdminType
      }
      return !hasAdmin && !isAdminType
    })

    // Personal tasks only show in admin mode
    const filteredPersonalTasks = kanbanMode === 'admin' ? personalPool : []

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
  }, [tasks, personalTasks, statusFilter, selectedProjectId, kanbanMode])

  const handleTaskUpdate = async (taskId: string, updates: Partial<Task>) => {
    try {
      const task = [...tasks, ...personalTasks].find(t => t.id === taskId)
      if (!task) return

      const isPersonal = (task as any).is_personal

      const updatedData = { ...updates }
      if ("user_id" in updates) {
        (updatedData as Record<string, unknown>).profiles = members.find(m => m.id === updates.user_id) || null
      }

      const table = isPersonal ? "personal_tasks" : "tasks"
      const { error } = await (supabase.from as any)(table)
        .update(updates)
        .eq("id", taskId)

      if (error) throw error
      
      if (isPersonal) {
        setPersonalTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updatedData } : t))
      } else {
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updatedData } : t))
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
      
      const payload: any = {
        title: values.title,
        description: values.description,
        type: values.type || 'feature',
        user_id: values.user_id === "unassigned" ? null : (values.user_id || targetUserId),
        status: finalStatus,
        order_index: (isPersonal ? personalTasks : tasks).filter(t => t.status === finalStatus).length,
        parent_id: values.parent_id === "none" ? null : (values.parent_id || creatingParentId)
      }

      if (!isPersonal) {
        payload.project_id = values.project_id === "none" ? null : values.project_id
        payload.phase_id = values.phase_id === "none" ? null : values.phase_id
      }

      const query = (supabase.from as any)(table).insert([payload])
      
      let res
      if (!isPersonal) {
        res = await query.select(`
          *,
          phases (
            id,
            title,
            project_id,
            projects (
              id,
              name
            )
          ),
          task_attachments (*),
          task_members (
            user_id,
            profiles (
              id,
              full_name,
              avatar_url,
              email,
              role
            )
          )
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
          phase_id: !isPersonal ? res.data.phase_id : null,
          order_index: index
        }))
        
        const { data: createdSubtasks, error: subtasksError } = await (supabase.from as any)(table)
          .insert(subtasksToInsert)
          .select(!isPersonal ? `*, phases(id, title, project_id, projects(id, name)), task_attachments(*)` : `*`)

        if (subtasksError) throw subtasksError
        
        if (createdSubtasks) {
          const formattedSubtasks = (createdSubtasks as any[]).map(st => ({
            ...st,
            profiles: members.find(m => m.id === st.user_id) || null,
            is_personal: isPersonal
          }))
          if (isPersonal) {
            setPersonalTasks(prev => [...prev, ...formattedSubtasks as Task[]])
          } else {
            setTasks(prev => [...prev, ...formattedSubtasks as Task[]])
          }
        }
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
        profiles: members.find(m => m.id === res.data.user_id) || null,
        is_personal: isPersonal
      }

      if (isPersonal) {
        setPersonalTasks(prev => {
          if (prev.some(t => t.id === newTask.id)) return prev
          return [...prev, newTask as Task]
        })
      } else {
        setTasks(prev => {
          if (prev.some(t => t.id === newTask.id)) return prev
          return [...prev, newTask as Task]
        })
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
      const updates: any = {
        title: values.title,
        description: values.description || null,
        status: values.status || editingTask.status,
        type: values.type || editingTask.type || 'feature',
        user_id: values.user_id === "unassigned" ? null : (values.user_id || null),
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

      const updatedTask = { 
        ...editingTask, 
        ...updates,
        profiles: members.find(m => m.id === updates.user_id) || null,
      }

      if (isPersonal) {
        setPersonalTasks(prev => prev.map(t => t.id === editingTask.id ? updatedTask : t))
      } else {
        setTasks(prev => prev.map(t => t.id === editingTask.id ? updatedTask : t))
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
      const task = [...tasks, ...personalTasks].find(t => t.id === parentId)
      const isPersonal = (task as any)?.is_personal
      const table = isPersonal ? "personal_tasks" : "tasks"
      
      const payload: any = {
        title,
        status,
        type: task?.type || 'feature',
        parent_id: parentId,
        user_id: targetUserId,
        order_index: (isPersonal ? personalTasks : tasks).filter(t => t.parent_id === parentId).length
      }

      if (!isPersonal) {
        payload.phase_id = task?.phase_id || null
      }

      const query = (supabase.from as any)(table).insert([payload])
      
      let res
      if (!isPersonal) {
        res = await query.select(`
          *,
          phases (
            id,
            title,
            project_id,
            projects (
              id,
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
        profiles: members.find(m => m.id === res.data.user_id) || null,
        is_personal: isPersonal
      }

      if (isPersonal) {
        setPersonalTasks(prev => [...prev, newTask as Task])
      } else {
        setTasks(prev => [...prev, newTask as Task])
      }
      toast.success("Subtask added")
    } catch (error: any) {
      console.error("Quick create task error:", error)
      const message = error.message || error.details || (typeof error === 'object' ? JSON.stringify(error) : String(error))
      toast.error("Failed to add subtask: " + message)
    }
  }

  const handleTaskDelete = async (taskId: string) => {
    try {
      const task = [...tasks, ...personalTasks].find(t => t.id === taskId)
      const isPersonal = (task as any)?.is_personal
      const table = isPersonal ? "personal_tasks" : "tasks"
      
      const { error } = await (supabase.from as any)(table)
        .delete()
        .eq("id", taskId)

      if (error) throw error

      if (isPersonal) {
        setPersonalTasks(prev => prev.filter(t => t.id !== taskId))
      } else {
        setTasks(prev => prev.filter(t => t.id !== taskId))
      }
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
            tasks={[...tasks, ...personalTasks]}
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
              tasks={[...tasks, ...personalTasks]}
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
