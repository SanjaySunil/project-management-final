import * as React from "react"
import { toast } from "sonner"
import { IconFileText, IconEdit, IconLayoutKanban, IconGitPullRequest } from "@tabler/icons-react"
import { supabase } from "@/lib/supabase"
import type { Tables } from "@/lib/database.types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PhaseForm } from "@/components/projects/phase-form"
import type { Deliverable } from "@/components/projects/deliverables-manager"
import type { LineItem } from "@/components/projects/line-items-manager"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { KanbanBoard, type Task } from "@/components/projects/kanban-board"
import { TaskForm, type TaskFormValues } from "@/components/projects/task-form"
import { useAuth } from "@/hooks/use-auth"
import { useSearchParams } from "react-router-dom"
import { Skeleton } from "@/components/ui/skeleton"
import { MessageSquare } from "lucide-react"
import { slugify, getErrorMessage } from "@/lib/utils"
import { PhaseChat } from "./phase-chat"
import { RevisionsManager } from "./revisions-manager"

import { useTasks } from "@/hooks/use-tasks"

type Phase = Tables<"phases">

interface PhaseDetailsProps {
  projectId: string
  phaseId: string
}

export function PhaseDetails({ projectId, phaseId }: PhaseDetailsProps) {
  const { user, role } = useAuth()
  const isAdmin = role === "admin"
  const isClient = role === "client"
  const isStaff = role === "admin" || role === "employee"
  const [searchParams, setSearchParams] = useSearchParams()
  const taskIdParam = searchParams.get("taskId")
  
  // Phase & Deliverables state
  const [phase, setPhase] = React.useState<Phase | null>(null)
  const [deliverables, setDeliverables] = React.useState<Deliverable[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState("kanban")

  // Kanban state
  const [members, setMembers] = React.useState<Tables<"profiles">[]>([])
  const [projectEmployees, setProjectEmployees] = React.useState<Tables<"profiles">[]>([])
  const [kanbanMode, setKanbanMode] = React.useState<"development" | "admin">("development")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false)
  const [editingTask, setEditingTask] = React.useState<Task | null>(null)
  const [creatingStatus, setCreatingStatus] = React.useState<string | null>(null)
  const [creatingParentId, setCreatingParentId] = React.useState<string | null>(null)
  const [isTaskSubmitting, setIsTaskSubmitting] = React.useState(false)

  const { tasks, setTasks } = useTasks({ phaseId })

  // Set default tab for client
  React.useEffect(() => {
    if (role === 'client' && activeTab !== 'revisions') {
      setActiveTab('revisions')
    }
  }, [role, activeTab])

  // Handle deep linking for tasks
  React.useEffect(() => {
    if (!isClient && taskIdParam && tasks.length > 0 && !editingTask) {
      const task = tasks.find(t => t.id === taskIdParam)
      if (task) {
        setEditingTask(task)
        setIsEditDialogOpen(true)
        setActiveTab("kanban")
      }
    }
  }, [taskIdParam, tasks, editingTask, isClient])

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

  const fetchData = React.useCallback(async () => {
    try {
      setIsLoading(true)
      
      // If client, verify project ownership
      if (isClient && user) {
        const { data: clientData } = await supabase
          .from("clients")
          .select("id")
          .eq("user_id", user.id)
          .single()
        
        if (!clientData) {
          throw new Error("Client record not found")
        }

        const { data: projectData } = await supabase
          .from("projects")
          .select("id")
          .eq("id", projectId)
          .eq("client_id", clientData.id)
          .single()
        
        if (!projectData) {
          throw new Error("You do not have access to this project")
        }
      }

      // Fetch phase
      const { data: phaseData, error: phaseError } = await supabase
        .from("phases")
        .select("*")
        .eq("id", phaseId)
        .single()

      if (phaseError) throw phaseError
      setPhase(phaseData)

      // Fetch deliverables, tasks, and members in parallel
      const [deliverablesRes, membersRes, projectMembersRes] = await Promise.all([
        supabase
          .from("deliverables")
          .select("*")
          .eq("phase_id", phaseId)
          .order("order_index", { ascending: true }),
        supabase
          .from("profiles")
          .select("*")
          .neq("role", "client")
          .order("full_name", { ascending: true }),
        supabase
          .from("project_members")
          .select(`
            user_id,
            profiles!inner (
              id,
              full_name,
              avatar_url,
              email,
              role
            )
          `)
          .eq("project_id", projectId)
      ])

      if (deliverablesRes.error) throw deliverablesRes.error
      if (membersRes.error) throw membersRes.error
      if (projectMembersRes.error) throw projectMembersRes.error

      setDeliverables(deliverablesRes.data || [])
      setMembers(membersRes.data || [])

      // Filter project members for employees only
      const employees = (projectMembersRes.data || [])
        .map(pm => pm.profiles)
        .filter(p => (p as any).role === "employee")
      setProjectEmployees(employees as any[])

    } catch (error: any) {
      console.error("Fetch phase details error:", error)
      toast.error("Failed to fetch phase details: " + getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }, [phaseId, isClient, user, projectId])

  React.useEffect(() => {
    if (phaseId) {
      fetchData()
    }
  }, [fetchData, phaseId])

  // --- Phase Actions ---
  const handlePhaseSubmit = async (values: any, updatedDeliverables: Deliverable[], lineItems: LineItem[]) => {
    try {
      setIsSubmitting(true)

      const { error } = await supabase
        .from("phases")
        .update({
          ...values,
          invoice_line_items: lineItems
        })
        .eq("id", phaseId)
      
      if (error) throw error

      // Update channel name if title changed
      if (values.title) {
        await supabase
          .from("channels")
          .update({ name: slugify(values.title) })
          .eq("phase_id", phaseId)
      }

      // Save deliverables
      await supabase.from("deliverables").delete().eq("phase_id", phaseId)

      if (updatedDeliverables.length > 0) {
        const deliverablesToInsert = updatedDeliverables.map((d, index) => ({
          phase_id: phaseId,
          title: d.title,
          description: d.description,
          order_index: index,
        }))
        await supabase.from("deliverables").insert(deliverablesToInsert)
      }

      toast.success("Phase updated successfully")
      setIsDialogOpen(false)
      fetchData()
    } catch (error: any) {
      console.error("Save phase error:", error)
      toast.error("Failed to save phase: " + getErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  // --- Kanban Actions ---
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
  
        const { error } = await supabase.from("tasks").update(dbUpdates).eq("id", taskId)
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

  const handleTaskCreate = async (values: TaskFormValues) => {
    if (!creatingStatus && !values.status) return
    const finalStatus = values.status || creatingStatus || "todo"
    try {
      setIsTaskSubmitting(true)
      
      // Handle multiple assignees based on mode
      let assigneeIds: string[] = []
      
      if (values.assignee_ids && values.assignee_ids.length > 0) {
        assigneeIds = values.assignee_ids
      } else {
        if (kanbanMode === "admin") {
          // Assign to all admins
          assigneeIds = members.filter(m => m.role === "admin").map(m => m.id)
        } else {
          // Assign to project employees
          assigneeIds = projectEmployees.length > 0 ? projectEmployees.map(emp => emp.id) : []
        }
      }
      
      // Set primary user_id to the first assignee if any
      const finalUserId = assigneeIds.length > 0 ? assigneeIds[0] : null;

      const { data, error } = await supabase
        .from("tasks")
        .insert([{
          title: values.title,
          description: values.description,
          type: values.type || 'feature',
          user_id: finalUserId,
          project_id: projectId,
          phase_id: phaseId,
          parent_id: values.parent_id === "none" ? null : (values.parent_id || creatingParentId),
          status: finalStatus,
          order_index: tasks.filter(t => t.status === finalStatus).length
        }])
        .select(`
          *,
          phases(id, title, project_id, projects(name)),
          task_attachments(*),
          task_members(
            *,
            profiles(*)
          )
        `)
        .single()

      if (error) throw error
      
      const taskId = data.id

      // Assign all selected assignees (or project employees if none selected)
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
          user_id: finalUserId, // Also assign the same primary user to subtasks
          parent_id: taskId,
          phase_id: phaseId,
          order_index: index
        }))
        
        const { data: createdSubtasks, error: subtasksError } = await supabase
          .from("tasks")
          .insert(subtasksToInsert)
          .select(`*, phases(id, title, project_id, projects(name)), task_attachments(*)`)

        if (subtasksError) throw subtasksError
        
        if (createdSubtasks) {
          // Auto-assign the same set of people to subtasks too
          if (assigneeIds.length > 0) {
            const subtaskAssignments = createdSubtasks.flatMap(st => 
              assigneeIds.map(userId => ({
                task_id: st.id,
                user_id: userId
              }))
            )
            await supabase.from("task_members").insert(subtaskAssignments)
          }
        }
      }

      // Handle attachments
      if (values.files && values.files.length > 0 && typeof window !== 'undefined') {
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
      setIsTaskSubmitting(false)
    }
  }

  const handleTaskEdit = async (values: TaskFormValues) => {
    if (!editingTask) return
    try {
      setIsTaskSubmitting(true)
      const assigneeIds = values.assignee_ids || []
      const finalUserId = assigneeIds.length > 0 ? assigneeIds[0] : null

      const updates = {
        title: values.title,
        description: values.description || null,
        status: values.status || editingTask.status,
        type: values.type || editingTask.type || 'feature',
        user_id: finalUserId,
        project_id: values.project_id === "none" ? null : (values.project_id || projectId),
        phase_id: values.phase_id === "none" ? null : (values.phase_id || phaseId),
        parent_id: values.parent_id === "none" ? null : (values.parent_id || null),
      }

      const { error } = await supabase.from("tasks").update(updates).eq("id", editingTask.id)
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
      setIsTaskSubmitting(false)
    }
  }

  const handleTaskQuickCreate = async (status: string, parentId: string, title: string) => {
    try {
      const parentTask = tasks.find(t => t.id === parentId)
      
      // Get assignees based on mode
      let assigneeIds: string[] = []
      if (kanbanMode === "admin") {
        assigneeIds = members.filter(m => m.role === "admin").map(m => m.id)
      } else {
        assigneeIds = projectEmployees.length > 0 ? projectEmployees.map(emp => emp.id) : []
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
          phase_id: phaseId,
          order_index: tasks.filter(t => t.parent_id === parentId).length
        }])
        .select(`
          *,
          phases(id, title, project_id, projects(name)),
          task_attachments(*),
          task_members(
            *,
            profiles(*)
          )
        `)
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

  const handleTaskDelete = async (taskId: string) => {
    try {
      // Optimistic delete
      setTasks(prev => prev.filter(t => t.id !== taskId))
      const { error } = await supabase.from("tasks").delete().eq("id", taskId)
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

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "active": return <Badge className="bg-green-500 hover:bg-green-600">Active</Badge>
      case "complete": return <Badge className="bg-blue-500 hover:bg-blue-600">Complete</Badge>
      case "on_hold": return <Badge variant="outline" className="text-yellow-600 border-yellow-600">On Hold</Badge>
      case "draft": return <Badge variant="secondary">Draft</Badge>
      case "sent": return <Badge variant="default">Sent</Badge>
      case "rejected": return <Badge variant="destructive">Rejected</Badge>
      default: return <Badge variant="outline">{status}</Badge>
    }
  }

  if (isLoading && !phase) {
    return (
      <div className="flex flex-1 flex-col gap-4">
        <div className="flex flex-col gap-2 px-4 lg:px-6">
          <Skeleton className="h-8 w-48" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <Skeleton className="h-8 w-64" />
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right mr-4">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-32" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          </div>
        </div>
        <div className="flex gap-4 border-b pb-1 px-4 lg:px-6">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="grid gap-6 md:grid-cols-3 mt-4 px-4 lg:px-6">
          <div className="md:col-span-2 space-y-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    )
  }

  if (!phase) {
    return (
      <div className="flex flex-1 items-center justify-center p-4 text-center">
        <div>
          <p className="text-lg font-medium">Phase not found.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-hidden">
      <div className="flex flex-col gap-2 shrink-0 px-4 lg:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <IconFileText className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{phase.title}</h1>
          </div>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <div className="text-right mr-4">
                <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Total Amount</p>
                <div className="flex flex-col items-end">
                  <p className="text-2xl font-bold">${phase.amount?.toLocaleString()}</p>
                  {phase.order_source === "fiverr" && (
                    <p className="text-xs text-muted-foreground">
                      Net: <span className="font-medium text-primary">${phase.net_amount?.toLocaleString()}</span>
                    </p>
                  )}
                </div>
              </div>
            )}
            {getStatusBadge(phase.status)}
            {isStaff && (
              <Button onClick={() => setIsDialogOpen(true)} size="sm" variant="outline" className="gap-2 ml-2">
                <IconEdit className="h-4 w-4" /> Edit Phase
              </Button>
            )}
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col gap-4 min-h-0">
        <div className="px-4 lg:px-6 shrink-0">
          <TabsList className="w-fit">
            {isStaff && (
              <TabsTrigger value="kanban" className="gap-2">
                <IconLayoutKanban className="h-4 w-4" /> Kanban
              </TabsTrigger>
            )}
            <TabsTrigger value="revisions" className="gap-2">
              <IconGitPullRequest className="h-4 w-4" /> Revisions
            </TabsTrigger>
            {isStaff && (
              <TabsTrigger value="messages" className="gap-2">
                <MessageSquare className="h-4 w-4" /> Messages
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        {isStaff && (
          <TabsContent value="kanban" className="flex-1 min-h-0 flex flex-col">
            <div className="flex flex-col h-full overflow-hidden">
              <KanbanBoard 
                tasks={tasks} 
                members={members}
                onTaskUpdate={handleTaskUpdate}
                onTaskCreate={handleTaskCreateTrigger}
                onTaskQuickCreate={handleTaskQuickCreate}
                onTaskEdit={(task) => { setEditingTask(task); setIsEditDialogOpen(true); }}
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
                isLoading={isLoading}
                mode={kanbanMode}
                onModeChange={setKanbanMode}
              />
            </div>
          </TabsContent>
        )}

        <TabsContent value="revisions" className="flex-1 overflow-y-auto px-4 lg:px-6">
          <RevisionsManager 
            phaseId={phaseId} 
            projectId={projectId}
            projectEmployees={projectEmployees}
            tasks={tasks}
          />
        </TabsContent>

        {isStaff && (
          <TabsContent value="messages" className="flex-1 min-h-0 flex flex-col px-4 lg:px-6 pb-4 lg:pb-6 mt-2">
            {phase && (
              <PhaseChat 
                projectId={projectId} 
                phaseId={phaseId} 
                phaseTitle={phase.title} 
              />
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* Dialogs */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Phase</DialogTitle>
            <DialogDescription>Update the phase's information and deliverables.</DialogDescription>
          </DialogHeader>
          <PhaseForm 
            initialData={phase} 
            initialDeliverables={deliverables} 
            onSubmit={handlePhaseSubmit} 
            onCancel={() => setIsDialogOpen(false)} 
            isSubmitting={isSubmitting} 
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
            <DialogDescription>Add a new task to the {creatingStatus} column.</DialogDescription>
          </DialogHeader>
          <TaskForm 
            onSubmit={handleTaskCreate} 
            onCancel={() => {
              setIsCreateDialogOpen(false)
              setCreatingParentId(null)
            }} 
            isLoading={isTaskSubmitting} 
            members={members} 
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
            <DialogDescription>Update the details of this task.</DialogDescription>
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
              isLoading={isTaskSubmitting} 
              members={members}
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
                parent_id: editingTask.parent_id
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
