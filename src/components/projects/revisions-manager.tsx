import * as React from "react"
import { toast } from "sonner"
import { IconExternalLink, IconGitPullRequest, IconCheck, IconClock } from "@tabler/icons-react"
import { supabase } from "@/lib/supabase"
import type { Tables } from "@/lib/database.types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useAuth } from "@/hooks/use-auth"
import { getErrorMessage } from "@/lib/utils"
import { TaskForm, type TaskFormValues } from "./task-form"
import type { Task } from "./kanban-board"
import { DataTable } from "@/components/data-table"
import type { ColumnDef } from "@tanstack/react-table"

const revisionSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
})

type RevisionFormValues = z.infer<typeof revisionSchema>

type Revision = {
  id: string
  phase_id: string
  client_id: string
  title: string
  description: string | null
  status: string
  task_id: string | null
  created_at: string | null
  updated_at: string | null
  task?: {
    status: string
  } | null
}

interface RevisionsManagerProps {
  phaseId: string
  projectId: string
  members: Tables<"profiles">[]
  tasks: Task[]
}

export function RevisionsManager({ phaseId, projectId, members, tasks }: RevisionsManagerProps) {
  const { user, role } = useAuth()
  const isAdminOrEmployee = role === "admin" || role === "employee"
  const isClient = role === "client"

  const [revisions, setRevisions] = React.useState<Revision[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [isDelegateOpen, setIsDelegateOpen] = React.useState(false)
  const [isDetailOpen, setIsDetailOpen] = React.useState(false)
  const [selectedRevision, setSelectedRevision] = React.useState<Revision | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const form = useForm<RevisionFormValues>({
    resolver: zodResolver(revisionSchema),
    defaultValues: {
      title: "",
      description: "",
    },
  })

  const fetchRevisions = React.useCallback(async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from("revisions")
        .select(`
          *,
          task:tasks(status)
        `)
        .eq("phase_id", phaseId)
        .order("created_at", { ascending: false })

      if (error) throw error
      setRevisions(data || [])
    } catch (error: any) {
      console.error("Fetch revisions error:", error)
      toast.error("Failed to fetch revisions: " + getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }, [phaseId])

  React.useEffect(() => {
    fetchRevisions()
  }, [fetchRevisions])

  // Real-time subscription
  React.useEffect(() => {
    const channel = supabase
      .channel(`phase-revisions-${phaseId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "revisions",
          filter: `phase_id=eq.${phaseId}`,
        },
        () => {
          fetchRevisions()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [phaseId, fetchRevisions])

  const onCreateRevision = async (values: RevisionFormValues) => {
    if (!user) return
    try {
      setIsSubmitting(true)
      const { error } = await supabase.from("revisions").insert({
        phase_id: phaseId,
        client_id: user.id,
        title: values.title,
        description: values.description,
        status: "pending",
      })

      if (error) throw error

      toast.success("Revision request submitted")
      setIsCreateOpen(false)
      form.reset()
      fetchRevisions()
    } catch (error: any) {
      console.error("Create revision error:", error)
      toast.error("Failed to submit revision: " + getErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  const onDelegateTask = async (values: TaskFormValues) => {
    if (!selectedRevision) return
    try {
      setIsSubmitting(true)
      
      // 1. Create the task
      const { data: taskData, error: taskError } = await supabase
        .from("tasks")
        .insert({
          title: values.title,
          description: values.description,
          status: values.status || "todo",
          type: values.type || "feature",
          user_id: values.user_id === "unassigned" ? null : values.user_id,
          phase_id: phaseId,
          order_index: tasks.filter(t => t.status === (values.status || "todo")).length,
        })
        .select()
        .single()

      if (taskError) throw taskError

      // 2. Link revision to task and update status
      const { error: revisionError } = await supabase
        .from("revisions")
        .update({
          task_id: taskData.id,
          status: "delegated",
        })
        .eq("id", selectedRevision.id)

      if (revisionError) throw revisionError

      toast.success("Revision delegated to Kanban")
      setIsDelegateOpen(false)
      setIsDetailOpen(false)
      setSelectedRevision(null)
      fetchRevisions()
    } catch (error: any) {
      console.error("Delegate task error:", error)
      toast.error("Failed to delegate task: " + getErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  const getStatusBadge = (revision: Revision) => {
    // Find the latest task status from the tasks prop
    const linkedTask = tasks.find(t => t.id === revision.task_id)
    const currentStatus = linkedTask?.status || revision.task?.status

    if (revision.status === "completed" || currentStatus === "complete") {
      return <Badge className="bg-green-500 hover:bg-green-600 gap-1"><IconCheck className="size-3" /> Completed</Badge>
    }
    if (revision.status === "delegated") {
      return (
        <Badge variant="secondary" className="gap-1">
          <IconGitPullRequest className="size-3" /> 
          In Kanban ({currentStatus || "todo"})
        </Badge>
      )
    }
    return <Badge variant="outline" className="gap-1"><IconClock className="size-3" /> Pending</Badge>
  }

  const getLinkedTaskStatus = (revision: Revision) => {
    const linkedTask = tasks.find(t => t.id === revision.task_id)
    return linkedTask?.status || revision.task?.status || "todo"
  }

  const columns: ColumnDef<Revision>[] = [
    {
      accessorKey: "title",
      header: "Title",
      cell: ({ row }) => <div className="font-medium">{row.original.title}</div>,
    },
    {
      accessorKey: "created_at",
      header: "Requested On",
      cell: ({ row }) => (
        <div className="text-muted-foreground">
          {new Date(row.original.created_at || "").toLocaleDateString()}
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => getStatusBadge(row.original),
    },
  ]

  const handleRowClick = (revision: Revision) => {
    setSelectedRevision(revision)
    setIsDetailOpen(true)
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold">Revisions</h2>
        <p className="text-sm text-muted-foreground">Track and manage client revision requests.</p>
      </div>

      <DataTable
        columns={columns}
        data={revisions}
        isLoading={isLoading}
        onRowClick={handleRowClick}
        searchPlaceholder="Search revisions..."
        addLabel="New Revision"
        onAdd={isClient ? () => setIsCreateOpen(true) : undefined}
      />

      {/* Revision Details Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{selectedRevision?.title}</DialogTitle>
            <DialogDescription>
              Requested on {selectedRevision && new Date(selectedRevision.created_at || "").toLocaleDateString()}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Status:</span>
              {selectedRevision && getStatusBadge(selectedRevision)}
            </div>
            
            <div className="space-y-2">
              <span className="text-sm font-medium text-muted-foreground">Description:</span>
              <p className="text-sm whitespace-pre-wrap rounded-md bg-muted p-3">
                {selectedRevision?.description || "No description provided."}
              </p>
            </div>

            {selectedRevision?.task_id && (
              <div className="p-3 bg-muted/50 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <IconGitPullRequest className="size-4 text-primary" />
                  <span className="text-xs font-medium">Linked Kanban Task</span>
                </div>
                <Badge variant="outline" className="text-[10px] capitalize">
                  {selectedRevision && getLinkedTaskStatus(selectedRevision)}
                </Badge>
              </div>
            )}
          </div>

          <DialogFooter>
            {isAdminOrEmployee && selectedRevision?.status === "pending" && (
              <Button 
                className="gap-2"
                onClick={() => {
                  setIsDelegateOpen(true)
                }}
              >
                <IconExternalLink className="size-4" /> Delegate to Kanban
              </Button>
            )}
            <Button variant="outline" onClick={() => setIsDetailOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Revision Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request a Revision</DialogTitle>
            <DialogDescription>Describe the changes you would like to see.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onCreateRevision)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Brief title of the revision..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Detailed description of the requested changes..." 
                        className="min-h-[120px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Submitting..." : "Submit Request"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delegate Task Dialog */}
      <Dialog open={isDelegateOpen} onOpenChange={setIsDelegateOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Delegate Revision to Kanban</DialogTitle>
            <DialogDescription>Create a Kanban task based on this revision request.</DialogDescription>
          </DialogHeader>
          {selectedRevision && (
            <TaskForm 
              onSubmit={onDelegateTask}
              onCancel={() => setIsDelegateOpen(false)}
              members={members}
              tasks={tasks}
              isLoading={isSubmitting}
              defaultValues={{
                title: `[REVISION] ${selectedRevision.title}`,
                description: selectedRevision.description || "",
                status: "todo",
                phase_id: phaseId,
                project_id: projectId
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
