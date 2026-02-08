import * as React from "react"
import { toast } from "sonner"
import { IconFileText, IconEdit, IconLayoutKanban } from "@tabler/icons-react"
import { supabase } from "@/lib/supabase"
import type { Tables } from "@/lib/database.types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ProposalForm } from "@/components/projects/proposal-form"
import type { Deliverable } from "@/components/projects/deliverables-manager"
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
import { Skeleton } from "@/components/ui/skeleton"
import { MessageSquare } from "lucide-react"
import { slugify, getErrorMessage } from "@/lib/utils"
import { ProposalChat } from "./proposal-chat"

type Proposal = Tables<"proposals">

interface ProposalDetailsProps {
  projectId: string
  proposalId: string
}

export function ProposalDetails({ projectId, proposalId }: ProposalDetailsProps) {
  const { user, role } = useAuth()
  const isAdmin = role === "admin"
  
  // Proposal & Deliverables state
  const [proposal, setProposal] = React.useState<Proposal | null>(null)
  const [deliverables, setDeliverables] = React.useState<Deliverable[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState("kanban")

  // Kanban state
  const [tasks, setTasks] = React.useState<Task[]>([])
  const [members, setMembers] = React.useState<Tables<"profiles">[]>([])
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false)
  const [editingTask, setEditingTask] = React.useState<Task | null>(null)
  const [creatingStatus, setCreatingStatus] = React.useState<string | null>(null)
  const [creatingParentId, setCreatingParentId] = React.useState<string | null>(null)
  const [isTaskSubmitting, setIsTaskSubmitting] = React.useState(false)

  const fetchData = React.useCallback(async () => {
    try {
      setIsLoading(true)
      
      // Fetch proposal
      const { data: proposalData, error: proposalError } = await supabase
        .from("proposals")
        .select("*")
        .eq("id", proposalId)
        .single()

      if (proposalError) throw proposalError
      setProposal(proposalData)

      // Fetch deliverables, tasks, and members in parallel
      const [deliverablesRes, tasksRes, membersRes] = await Promise.all([
        supabase
          .from("deliverables")
          .select("*")
          .eq("proposal_id", proposalId)
          .order("order_index", { ascending: true }),
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
          .eq("proposal_id", proposalId)
          .order("order_index", { ascending: true }),
        supabase
          .from("profiles")
          .select("*")
          .order("full_name", { ascending: true })
      ])

      if (deliverablesRes.error) throw deliverablesRes.error
      if (tasksRes.error) throw tasksRes.error
      if (membersRes.error) throw membersRes.error

      setDeliverables(deliverablesRes.data || [])
      
      const fetchedMembers = membersRes.data || []
      const fetchedTasks = (tasksRes.data || []).map(task => ({
        ...task,
        profiles: fetchedMembers.find(m => m.id === task.user_id) || null
      }))
      setTasks(fetchedTasks as Task[])
      setMembers(fetchedMembers)

    } catch (error: any) {
      console.error("Fetch proposal details error:", error)
      toast.error("Failed to fetch proposal details: " + getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }, [proposalId])

  React.useEffect(() => {
    if (proposalId) {
      fetchData()
    }
  }, [fetchData, proposalId])

  // --- Proposal Actions ---
  const handleProposalSubmit = async (values: any, updatedDeliverables: Deliverable[]) => {
    try {
      setIsSubmitting(true)

      const { error } = await supabase
        .from("proposals")
        .update(values)
        .eq("id", proposalId)
      
      if (error) throw error

      // Update channel name if title changed
      if (values.title) {
        await supabase
          .from("channels")
          .update({ name: slugify(values.title) })
          .eq("proposal_id", proposalId)
      }

      // Save deliverables
      await supabase.from("deliverables").delete().eq("proposal_id", proposalId)

      if (updatedDeliverables.length > 0) {
        const deliverablesToInsert = updatedDeliverables.map((d, index) => ({
          proposal_id: proposalId,
          title: d.title,
          description: d.description,
          order_index: index,
        }))
        await supabase.from("deliverables").insert(deliverablesToInsert)
      }

      toast.success("Proposal updated successfully")
      setIsDialogOpen(false)
      fetchData()
    } catch (error: any) {
      console.error("Save proposal error:", error)
      toast.error("Failed to save proposal: " + getErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  // --- Kanban Actions ---
  const handleTaskUpdate = async (taskId: string, updates: Partial<Task>) => {
    try {
      const updatedData = { ...updates }
      if ("user_id" in updates) {
        (updatedData as any).profiles = members.find(m => m.id === updates.user_id) || null
      }
      const { error } = await supabase.from("tasks").update(updates).eq("id", taskId)
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
    if (!creatingStatus) return
    try {
      setIsTaskSubmitting(true)
      const { data, error } = await supabase
        .from("tasks")
        .insert([{
          title: values.title,
          description: values.description,
          user_id: values.user_id === "unassigned" ? null : values.user_id,
          proposal_id: proposalId,
          parent_id: values.parent_id === "none" ? null : (values.parent_id || creatingParentId),
          status: creatingStatus,
          order_index: tasks.filter(t => t.status === creatingStatus).length
        }])
        .select(`*, proposals(id, title, project_id, projects(name)), task_attachments(*)`)
        .single()

      if (error) throw error
      
      const taskId = data.id

      // Handle subtasks
      if (values.subtasks && values.subtasks.length > 0) {
        const subtasksToInsert = values.subtasks.map((title, index) => ({
          title,
          status: "todo",
          parent_id: taskId,
          proposal_id: proposalId,
          order_index: index
        }))
        
        const { data: createdSubtasks, error: subtasksError } = await supabase
          .from("tasks")
          .insert(subtasksToInsert)
          .select(`*, proposals(id, title, project_id, projects(name)), task_attachments(*)`)

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
          
          setTasks(prev => prev.map(t => {
            if (t.id === taskId) {
              return { ...t, task_attachments: [...(t.task_attachments || []), attachment] }
            }
            return t
          }))
        }
      }

      const newTask = { ...data, profiles: members.find(m => m.id === data.user_id) || null }
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
      setIsTaskSubmitting(false)
    }
  }

  const handleTaskEdit = async (values: TaskFormValues) => {
    if (!editingTask) return
    try {
      setIsTaskSubmitting(true)
      const updates = {
        title: values.title,
        description: values.description || null,
        user_id: values.user_id === "unassigned" ? null : (values.user_id || null),
        parent_id: values.parent_id === "none" ? null : (values.parent_id || null),
      }
      const { error } = await supabase.from("tasks").update(updates).eq("id", editingTask.id)
      if (error) throw error
      setTasks(prev => prev.map(t => t.id === editingTask.id ? { 
        ...t, ...updates, profiles: members.find(m => m.id === updates.user_id) || null 
      } : t))
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
      const { data, error } = await supabase
        .from("tasks")
        .insert([{
          title,
          status,
          parent_id: parentId,
          proposal_id: proposalId,
          order_index: tasks.filter(t => t.parent_id === parentId).length
        }])
        .select(`*, proposals(id, title, project_id, projects(name)), task_attachments(*)`)
        .single()

      if (error) throw error
      const newTask = { ...data, profiles: null }
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
      const { error } = await supabase.from("tasks").delete().eq("id", taskId)
      if (error) throw error
      setTasks(prev => prev.filter(t => t.id !== taskId))
      toast.success("Task deleted successfully")
    } catch (error: any) {
      console.error("Delete task error:", error)
      const message = error.message || error.details || (typeof error === 'object' ? JSON.stringify(error) : String(error))
      toast.error("Failed to delete task: " + message)
    }
  }

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "active": return <Badge className="bg-green-500 hover:bg-green-600">Active</Badge>
      case "complete": return <Badge className="bg-blue-500 hover:bg-blue-600">Complete</Badge>
      case "draft": return <Badge variant="secondary">Draft</Badge>
      case "sent": return <Badge variant="default">Sent</Badge>
      case "rejected": return <Badge variant="destructive">Rejected</Badge>
      default: return <Badge variant="outline">{status}</Badge>
    }
  }

  if (isLoading && !proposal) {
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

  if (!proposal) {
    return (
      <div className="flex flex-1 items-center justify-center p-4 text-center">
        <div>
          <p className="text-lg font-medium">Proposal not found.</p>
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
            <h1 className="text-2xl font-bold tracking-tight">{proposal.title}</h1>
          </div>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <div className="text-right mr-4">
                <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Total Amount</p>
                <div className="flex flex-col items-end">
                  <p className="text-2xl font-bold">${proposal.amount?.toLocaleString()}</p>
                  {proposal.order_source === "fiverr" && (
                    <p className="text-xs text-muted-foreground">
                      Net: <span className="font-medium text-primary">${proposal.net_amount?.toLocaleString()}</span>
                    </p>
                  )}
                </div>
              </div>
            )}
            {getStatusBadge(proposal.status)}
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col gap-4 min-h-0">
        <div className="px-4 lg:px-6 shrink-0">
          <TabsList className="w-fit">
            <TabsTrigger value="overview" className="gap-2">
              <IconFileText className="h-4 w-4" /> Overview
            </TabsTrigger>
            <TabsTrigger value="kanban" className="gap-2">
              <IconLayoutKanban className="h-4 w-4" /> Kanban
            </TabsTrigger>
            <TabsTrigger value="messages" className="gap-2">
              <MessageSquare className="h-4 w-4" /> Messages
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="flex-1 overflow-y-auto px-4 lg:px-6">
          <div className="flex flex-col gap-6 pb-6">
            <div className="flex justify-end">
              <Button onClick={() => setIsDialogOpen(true)} size="sm" className="gap-2">
                <IconEdit className="h-4 w-4" /> Edit Proposal
              </Button>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              <Card className="md:col-span-2">
                <CardHeader><CardTitle>Description</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-muted-foreground whitespace-pre-wrap">
                    {proposal.description || "No description provided."}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Details</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Created On</p>
                    <p>{proposal.created_at ? new Date(proposal.created_at).toLocaleDateString() : "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Order Source</p>
                    <p className="capitalize">{proposal.order_source === "fiverr" ? "Fiverr" : "Direct (Bank Transfer)"}</p>
                  </div>
                  {isAdmin && proposal.order_source === "fiverr" && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Commission (20%)</p>
                      <p className="text-destructive">-${proposal.commission_amount?.toLocaleString()}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Status</p>
                    <p className="capitalize">{proposal.status}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="md:col-span-3">
                <CardHeader>
                  <CardTitle>Deliverables</CardTitle>
                  <CardDescription>Included in this proposal.</CardDescription>
                </CardHeader>
                <CardContent>
                  {deliverables.length > 0 ? (
                    <div className="relative space-y-4 before:absolute before:inset-y-0 before:left-[17px] before:w-[2px] before:bg-muted">
                      {deliverables.map((d, i) => (
                        <div key={d.id} className="relative pl-10">
                          <div className="absolute left-0 top-1 flex h-9 w-9 items-center justify-center rounded-full border bg-background text-sm font-bold shadow-sm">{i+1}</div>
                          <div className="flex flex-col gap-1">
                            <h3 className="font-semibold">{d.title}</h3>
                            {d.description && <p className="text-sm text-muted-foreground">{d.description}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center border-2 border-dashed rounded-lg text-muted-foreground">No deliverables added.</div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="kanban" className="flex-1 min-h-0">
          <div className="flex flex-col h-full overflow-hidden">
            <KanbanBoard 
              tasks={tasks} 
              members={members}
              onTaskUpdate={handleTaskUpdate}
              onTaskCreate={handleTaskCreateTrigger}
              onTaskQuickCreate={handleTaskQuickCreate}
              onTaskEdit={(task) => { setEditingTask(task); setIsEditDialogOpen(true); }}
              onTaskDelete={handleTaskDelete}
              isLoading={isLoading}
            />
          </div>
        </TabsContent>

        <TabsContent value="messages" className="flex-1 min-h-0 flex flex-col px-4 lg:px-6 pb-4 lg:pb-6 mt-2">
          {proposal && (
            <ProposalChat 
              projectId={projectId} 
              proposalId={proposalId} 
              proposalTitle={proposal.title} 
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Proposal</DialogTitle>
            <DialogDescription>Update the proposal's information and deliverables.</DialogDescription>
          </DialogHeader>
          <ProposalForm initialData={proposal} initialDeliverables={deliverables} onSubmit={handleProposalSubmit} onCancel={() => setIsDialogOpen(false)} isSubmitting={isSubmitting} />
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

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
            <DialogDescription>Update the details of this task.</DialogDescription>
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
              isLoading={isTaskSubmitting} 
              members={members}
              tasks={tasks}
              defaultValues={{ 
                id: editingTask.id,
                title: editingTask.title, 
                description: editingTask.description || "", 
                user_id: editingTask.user_id, 
                proposal_id: editingTask.proposal_id,
                parent_id: editingTask.parent_id
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
