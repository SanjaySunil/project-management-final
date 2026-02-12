import * as React from "react"
import { toast } from "sonner"
import { IconExternalLink, IconGitPullRequest, IconCheck, IconClock, IconEdit, IconTrash, IconDotsVertical } from "@tabler/icons-react"
import { supabase } from "@/lib/supabase"
import type { Tables } from "@/lib/database.types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { type TaskFormValues } from "./task-form"
import type { Task } from "./kanban-board"
import { DataTable } from "@/components/data-table"
import type { ColumnDef } from "@tanstack/react-table"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

const revisionSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
})

type RevisionFormValues = z.infer<typeof revisionSchema>

type Revision = {
  id: string
  phase_id: string
  client_id: string | null
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
  projectEmployees?: Tables<"profiles">[]
  tasks: Task[]
}

export function RevisionsManager({ phaseId, projectId, projectEmployees = [], tasks }: RevisionsManagerProps) {
  const { user, role } = useAuth()
  const isAdminOrEmployee = role === "admin" || role === "employee"
  const isClient = role === "client"

  const [revisions, setRevisions] = React.useState<Revision[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [isDetailOpen, setIsDetailOpen] = React.useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = React.useState(false)
  const [selectedRevision, setSelectedRevision] = React.useState<Revision | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isEditing, setIsEditing] = React.useState(false)

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

  const onSubmitRevision = async (values: RevisionFormValues) => {
    if (!user) return
    try {
      setIsSubmitting(true)
      
      if (isEditing && selectedRevision) {
        const { error } = await supabase
          .from("revisions")
          .update({
            title: values.title,
            description: values.description,
            updated_at: new Date().toISOString(),
          })
          .eq("id", selectedRevision.id)

        if (error) throw error
        toast.success("Revision updated")
      } else {
        let clientId: string | null = user.id

        // If admin/employee, we need to find the project's client's profile ID
        if (isAdminOrEmployee) {
          const { data: projectData, error: projectError } = await supabase
            .from("projects")
            .select("clients(user_id)")
            .eq("id", projectId)
            .single()

          if (projectError) throw projectError
          clientId = projectData?.clients?.user_id || null
        }

        if (!clientId) throw new Error("Could not determine client for this revision")

        const { error } = await supabase.from("revisions").insert({
          phase_id: phaseId,
          client_id: clientId,
          title: values.title,
          description: values.description,
          status: "pending",
        } as any)

        if (error) throw error
        toast.success(isAdminOrEmployee ? "Revision created" : "Revision request submitted")
      }

      setIsCreateOpen(false)
      setIsEditing(false)
      form.reset()
      fetchRevisions()
    } catch (error: any) {
      console.error("Submit revision error:", error)
      toast.error(`Failed to ${isEditing ? "update" : "submit"} revision: ` + getErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  const onDeleteRevision = async () => {
    if (!selectedRevision) return
    try {
      setIsSubmitting(true)
      const { error } = await supabase
        .from("revisions")
        .delete()
        .eq("id", selectedRevision.id)

      if (error) throw error

      toast.success("Revision deleted")
      setIsDeleteConfirmOpen(false)
      setIsDetailOpen(false)
      setSelectedRevision(null)
      fetchRevisions()
    } catch (error: any) {
      console.error("Delete revision error:", error)
      toast.error("Failed to delete revision: " + getErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  const onDelegateTask = async (values: Partial<TaskFormValues>) => {
    if (!selectedRevision) return
    try {
      setIsSubmitting(true)
      
      // If there's only one project employee, auto-assign them as the user_id
      const finalUserId = values.user_id === "unassigned" 
        ? (projectEmployees.length === 1 ? projectEmployees[0].id : null)
        : (values.user_id || (projectEmployees.length === 1 ? projectEmployees[0].id : null));

      // 1. Create the task
      const { data: taskData, error: taskError } = await supabase
        .from("tasks")
        .insert({
          title: values.title || selectedRevision.title,
          description: values.description || selectedRevision.description || "",
          status: values.status || "todo",
          type: values.type || "revision",
          user_id: finalUserId,
          phase_id: phaseId,
          order_index: tasks.filter(t => t.status === (values.status || "todo")).length,
        })
        .select()
        .single()

      if (taskError) throw taskError

      // 2. Auto-assign all project employees
      if (projectEmployees.length > 0) {
        const assignments = projectEmployees.map(emp => ({
          task_id: taskData.id,
          user_id: emp.id
        }))
        await supabase.from("task_members").insert(assignments)
      }

      // 3. Link revision to task and update status
      const { error: revisionError } = await supabase
        .from("revisions")
        .update({
          task_id: taskData.id,
          status: "delegated",
        })
        .eq("id", selectedRevision.id)

      if (revisionError) throw revisionError

      toast.success("Revision delegated to Kanban")
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

  const handleRowClick = (revision: Revision) => {
    setSelectedRevision(revision)
    setIsDetailOpen(true)
  }

  const handleEdit = (revision: Revision) => {
    setSelectedRevision(revision)
    setIsEditing(true)
    form.reset({
      title: revision.title,
      description: revision.description || "",
    })
    setIsCreateOpen(true)
    setIsDetailOpen(false)
  }

  const canEdit = (revision: Revision) => {
    if (isAdminOrEmployee) return true
    if (isClient && revision.client_id === user?.id && revision.status === "pending") return true
    return false
  }

  const canDelete = (revision: Revision) => {
    if (isAdminOrEmployee) return true
    if (isClient && revision.client_id === user?.id && revision.status === "pending") return true
    return false
  }

  const columns = React.useMemo<ColumnDef<Revision>[]>(() => [
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
    {
      id: "actions",
      cell: ({ row }) => {
        const revision = row.original
        const canEditRevision = canEdit(revision)
        const canDeleteRevision = canDelete(revision)

        if (!canEditRevision && !canDeleteRevision) return null

        return (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <IconDotsVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canEditRevision && (
                  <DropdownMenuItem onClick={() => handleEdit(revision)}>
                    <IconEdit className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                )}
                {canDeleteRevision && (
                  <DropdownMenuItem 
                    className="text-destructive focus:text-destructive"
                    onClick={() => {
                      setSelectedRevision(revision)
                      setIsDeleteConfirmOpen(true)
                    }}
                  >
                    <IconTrash className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
    },
  ], [isAdminOrEmployee, isClient, user?.id, tasks])

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
        onAdd={() => {
          setIsEditing(false)
          form.reset({ title: "", description: "" })
          setIsCreateOpen(true)
        }}
      />

      {/* Revision Details Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>{selectedRevision?.title}</DialogTitle>
              <div className="flex items-center gap-2 mr-6">
                {selectedRevision && canEdit(selectedRevision) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => handleEdit(selectedRevision)}
                  >
                    <IconEdit className="size-4" />
                  </Button>
                )}
                {selectedRevision && canDelete(selectedRevision) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive hover:text-destructive"
                    onClick={() => setIsDeleteConfirmOpen(true)}
                  >
                    <IconTrash className="size-4" />
                  </Button>
                )}
              </div>
            </div>
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
                onClick={() => onDelegateTask({})}
                disabled={isSubmitting}
              >
                <IconExternalLink className="size-4" /> 
                {isSubmitting ? "Delegating..." : "Delegate to Kanban"}
              </Button>
            )}
            <Button variant="outline" onClick={() => setIsDetailOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Revision Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Revision" : isAdminOrEmployee ? "Create Revision" : "Request a Revision"}</DialogTitle>
            <DialogDescription>
              {isEditing ? "Update the details of the revision." : isAdminOrEmployee ? "Add a new revision to this phase." : "Describe the changes you would like to see."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitRevision)} className="space-y-4">
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
                        placeholder={isAdminOrEmployee ? "Detailed description of the changes..." : "Detailed description of the requested changes..."}
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
                  {isSubmitting ? "Submitting..." : isEditing ? "Save Changes" : isAdminOrEmployee ? "Create Revision" : "Submit Request"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={isDeleteConfirmOpen}
        onOpenChange={setIsDeleteConfirmOpen}
        title="Delete Revision"
        description="Are you sure you want to delete this revision request? This action cannot be undone."
        onConfirm={onDeleteRevision}
        variant="destructive"
      />
    </div>
  )
}
