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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Send, Hash, MessageSquare } from "lucide-react"

type Proposal = Tables<"proposals">

interface Message {
  id: string
  content: string
  created_at: string
  user_id: string
  profiles: {
    full_name: string | null
    avatar_url: string | null
    email: string | null
  }
}

interface ProposalDetailsProps {
  projectId: string
  proposalId: string
}

export function ProposalDetails({ projectId, proposalId }: ProposalDetailsProps) {
  const { user } = useAuth()
  
  // Proposal & Deliverables state
  const [proposal, setProposal] = React.useState<Proposal | null>(null)
  const [deliverables, setDeliverables] = React.useState<Deliverable[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  // Kanban state
  const [tasks, setTasks] = React.useState<Task[]>([])
  const [members, setMembers] = React.useState<Tables<"profiles">[]>([])
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false)
  const [editingTask, setEditingTask] = React.useState<Task | null>(null)
  const [creatingStatus, setCreatingStatus] = React.useState<string | null>(null)
  const [isTaskSubmitting, setIsTaskSubmitting] = React.useState(false)

  // Chat state
  const [messages, setMessages] = React.useState<Message[]>([])
  const [newMessage, setNewMessage] = React.useState("")
  const [channel, setChannel] = React.useState<Tables<"channels"> | null>(null)
  const [isChatLoading, setIsChatLoading] = React.useState(false)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  const scrollToBottom = React.useCallback(() => {
    if (scrollRef.current) {
      const scrollElement = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight
      }
    }
  }, [])

  React.useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom()
    }
  }, [messages, scrollToBottom])

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
            )
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
      toast.error("Failed to fetch proposal details: " + error.message)
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
      toast.error("Failed to save proposal: " + error.message)
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
      toast.error("Failed to update task: " + error.message)
    }
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
          status: creatingStatus,
          order_index: tasks.filter(t => t.status === creatingStatus).length
        }])
        .select(`*, proposals(id, title, project_id, projects(name))`)
        .single()

      if (error) throw error
      const newTask = { ...data, profiles: members.find(m => m.id === data.user_id) || null }
      setTasks(prev => [...prev, newTask as Task])
      setIsCreateDialogOpen(false)
      toast.success("Task created successfully")
    } catch (error: any) {
      toast.error("Failed to create task: " + error.message)
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
      toast.error("Failed to update task: " + error.message)
    } finally {
      setIsTaskSubmitting(false)
    }
  }

  const handleTaskDelete = async (taskId: string) => {
    try {
      const { error } = await supabase.from("tasks").delete().eq("id", taskId)
      if (error) throw error
      setTasks(prev => prev.filter(t => t.id !== taskId))
      toast.success("Task deleted successfully")
    } catch (error: any) {
      toast.error("Failed to delete task: " + error.message)
    }
  }

  // --- Chat Actions ---
  React.useEffect(() => {
    if (!proposalId || !proposal) return

    async function setupChat() {
      setIsChatLoading(true)
      // Find or create channel for this proposal
      let { data: channelData, error: channelError } = await supabase
        .from("channels")
        .select("*")
        .eq("proposal_id", proposalId)
        .maybeSingle()

      if (channelError) {
        toast.error("Failed to load chat channel")
        setIsChatLoading(false)
        return
      }

      if (!channelData) {
        // Create channel
        const { data: newChannel, error: createError } = await supabase
          .from("channels")
          .insert({
            name: `proposal-${proposal?.title.toLowerCase().replace(/\s+/g, "-")}`,
            project_id: projectId,
            proposal_id: proposalId,
            created_by: user?.id
          })
          .select()
          .single()
        
        if (createError) {
          // If another request created it in the meantime, try fetching it again
          if (createError.code === "23505") {
            const { data: existingChannel } = await supabase
              .from("channels")
              .select("*")
              .eq("proposal_id", proposalId)
              .single()
            channelData = existingChannel
          } else {
            toast.error("Failed to create chat channel")
            setIsChatLoading(false)
            return
          }
        } else {
          channelData = newChannel
        }
      }

      if (channelData) {
        setChannel(channelData)

        // Fetch messages
        const { data: messagesData, error: messagesError } = await supabase
          .from("messages")
          .select(`*, profiles:user_id (full_name, avatar_url, email)`)
          .eq("channel_id", channelData.id)
          .order("created_at", { ascending: true })

        if (messagesError) {
          toast.error("Failed to load messages")
        } else {
          setMessages((messagesData as unknown as Message[]) || [])
        }
      }
      setIsChatLoading(false)

      // Subscribe to new messages
      if (channelData) {
        const subscription = supabase
          .channel(`proposal_chat:${channelData.id}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "messages",
              filter: `channel_id=eq.${channelData.id}`,
            },
            async (payload) => {
              const { data, error } = await supabase
                .from("messages")
                .select(`*, profiles:user_id (full_name, avatar_url, email)`)
                .eq("id", payload.new.id)
                .single()

              if (!error && data) {
                setMessages((prev) => [...prev, data as unknown as Message])
              }
            }
          )
          .subscribe()

        return () => {
          supabase.removeChannel(subscription)
        }
      }
    }

    setupChat()
  }, [proposalId, proposal, projectId, user?.id])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !channel || !user) return

    const content = newMessage.trim()
    setNewMessage("")

    const { error } = await supabase.from("messages").insert({
      content,
      channel_id: channel.id,
      user_id: user.id,
    })

    if (error) toast.error("Failed to send message")
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
        <div className="flex flex-col gap-2">
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
        <div className="flex gap-4 border-b pb-1">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="grid gap-6 md:grid-cols-3 mt-4">
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
      <div className="flex flex-col gap-2 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <IconFileText className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{proposal.title}</h1>
          </div>
          <div className="flex items-center gap-3">
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
            {getStatusBadge(proposal.status)}
          </div>
        </div>
      </div>

      <Tabs defaultValue="kanban" className="flex-1 flex flex-col gap-4 min-h-0">
        <TabsList className="w-fit shrink-0">
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

        <TabsContent value="overview" className="flex-1 overflow-y-auto">
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
                  {proposal.order_source === "fiverr" && (
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
              onTaskCreate={(status) => { setCreatingStatus(status); setIsCreateDialogOpen(true); }}
              onTaskEdit={(task) => { setEditingTask(task); setIsEditDialogOpen(true); }}
              onTaskDelete={handleTaskDelete}
              isLoading={isLoading}
            />
          </div>
        </TabsContent>

        <TabsContent value="messages" className="flex-1 min-h-0">
          <div className="flex h-full flex-col overflow-hidden rounded-xl border bg-background shadow-sm">
            <div className="flex h-12 items-center px-4 border-b bg-muted/30">
              <Hash className="h-4 w-4 mr-2 text-muted-foreground" />
              <span className="font-bold text-sm">#{channel?.name || "proposal-chat"}</span>
            </div>
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
              <div className="space-y-4">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mb-2 opacity-20" />
                    <p>No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className="flex gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={m.profiles?.avatar_url || ""} />
                        <AvatarFallback className="text-xs">
                          {(m.profiles?.full_name || m.profiles?.email || "U").charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs">{m.profiles?.full_name || m.profiles?.email?.split("@")[0]}</span>
                          <span className="text-[10px] text-muted-foreground">{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
            <div className="p-4 border-t">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <textarea
                  placeholder="Type a message..."
                  className="flex-1 min-h-[40px] max-h-[120px] resize-none rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(e); } }}
                />
                <Button type="submit" size="icon" disabled={!newMessage.trim() || isChatLoading}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>
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
          <TaskForm onSubmit={handleTaskCreate} onCancel={() => setIsCreateDialogOpen(false)} isLoading={isTaskSubmitting} members={members} />
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
              isLoading={isTaskSubmitting} 
              members={members}
              defaultValues={{ title: editingTask.title, description: editingTask.description || "", user_id: editingTask.user_id, proposal_id: editingTask.proposal_id }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
