import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { IconCircle, IconCircleCheck, IconPlus } from "@tabler/icons-react"
import type { Tables } from "@/lib/database.types"
import type { Task } from "./kanban-board"

const taskSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  user_id: z.string().nullable().optional(),
  project_id: z.string().nullable().optional(),
  proposal_id: z.string().nullable().optional(),
  parent_id: z.string().nullable().optional(),
})

export type TaskFormValues = z.infer<typeof taskSchema>

interface TaskFormProps {
  onSubmit: (values: TaskFormValues) => void
  onCancel: () => void
  onDelete?: () => void
  onSubtaskToggle?: (subtaskId: string, currentStatus: string) => void | Promise<void>
  onAddSubtask?: (title: string) => void | Promise<void>
  isLoading?: boolean
  members: Tables<"profiles">[]
  proposals?: Tables<"proposals">[]
  projects?: Tables<"projects">[]
  tasks?: Task[]
  defaultValues?: Partial<TaskFormValues>
  hideAssignee?: boolean
}

export function TaskForm({ 
  onSubmit, 
  onCancel, 
  onDelete,
  onSubtaskToggle,
  onAddSubtask,
  isLoading, 
  members, 
  proposals = [],
  projects = [],
  tasks = [],
  defaultValues,
  hideAssignee = false
}: TaskFormProps) {
  const [isAddingSubtask, setIsAddingSubtask] = React.useState(false)
  const [newSubtaskTitle, setNewSubtaskTitle] = React.useState("")
  const subtaskInputRef = React.useRef<HTMLInputElement>(null)

  // Find initial project from proposal if provided
  const initialProjectId = React.useMemo(() => {
    if (defaultValues?.project_id) return defaultValues.project_id
    if (defaultValues?.proposal_id && proposals) {
      const proposal = proposals.find(p => p.id === defaultValues.proposal_id)
      return proposal?.project_id || null
    }
    return null
  }, [defaultValues?.project_id, defaultValues?.proposal_id, proposals])

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      id: defaultValues?.id,
      title: defaultValues?.title || "",
      description: defaultValues?.description || "",
      user_id: defaultValues?.user_id || null,
      project_id: initialProjectId,
      proposal_id: defaultValues?.proposal_id || null,
      parent_id: defaultValues?.parent_id || null,
    },
  })

  const selectedProjectId = form.watch("project_id")

  // Filter tasks that could be a parent (no recursion for now, just top-level)
  const potentialParents = React.useMemo(() => {
    return tasks.filter(t => !t.parent_id && t.id !== defaultValues?.id)
  }, [tasks, defaultValues?.id])

  // Get current subtasks
  const currentSubtasks = React.useMemo(() => {
    if (!defaultValues?.id) return []
    return tasks.filter(t => t.parent_id === defaultValues.id)
  }, [tasks, defaultValues?.id])

  const visibleProjects = React.useMemo(() => {
    return projects.filter(project => 
      project.status?.toLowerCase() === "active" || 
      project.id === initialProjectId ||
      project.id === selectedProjectId
    )
  }, [projects, initialProjectId, selectedProjectId])

  const filteredProposals = React.useMemo(() => {
    let base = proposals
    if (selectedProjectId && selectedProjectId !== "none") {
      base = proposals.filter(p => p.project_id === selectedProjectId)
    }
    
    return base.filter(proposal => 
      proposal.status?.toLowerCase() === "active" || 
      proposal.id === defaultValues?.proposal_id
    )
  }, [selectedProjectId, proposals, defaultValues?.proposal_id])

  const handleQuickAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSubtaskTitle.trim() || !onAddSubtask) return
    
    await onAddSubtask(newSubtaskTitle.trim())
    setNewSubtaskTitle("")
    setIsAddingSubtask(false)
  }

  React.useEffect(() => {
    if (isAddingSubtask && subtaskInputRef.current) {
      subtaskInputRef.current.focus()
    }
  }, [isAddingSubtask])

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title <span className="text-destructive">*</span></FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Task title..." 
                  className="min-h-[80px] resize-none" 
                  {...field} 
                />
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
                  placeholder="Task description..." 
                  className="min-h-[120px] resize-none" 
                  {...field} 
                  value={field.value || ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {defaultValues?.id && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <FormLabel>Subtasks</FormLabel>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs gap-1"
                onClick={() => setIsAddingSubtask(true)}
              >
                <IconPlus className="size-3" />
                Add Subtask
              </Button>
            </div>
            
            <div className="space-y-1.5 border rounded-md p-2 bg-muted/30">
              {currentSubtasks.length === 0 && !isAddingSubtask && (
                <p className="text-xs text-muted-foreground py-2 text-center">No subtasks yet</p>
              )}
              
              {currentSubtasks.map(st => (
                <div key={st.id} className="flex items-center gap-2 group">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-5 p-0 shrink-0 text-muted-foreground hover:text-primary transition-colors"
                    onClick={() => onSubtaskToggle?.(st.id, st.status)}
                  >
                    {st.status === 'complete' ? (
                      <IconCircleCheck className="size-4 text-green-500" />
                    ) : (
                      <IconCircle className="size-4" />
                    )}
                  </Button>
                  <span className={`text-sm truncate flex-1 ${st.status === 'complete' ? 'line-through text-muted-foreground' : ''}`}>
                    {st.title}
                  </span>
                </div>
              ))}

              {isAddingSubtask && (
                <div className="flex items-center gap-2 mt-1">
                  <div className="size-5 shrink-0 flex items-center justify-center">
                    <IconCircle className="size-4 text-muted-foreground opacity-50" />
                  </div>
                  <input
                    ref={subtaskInputRef}
                    type="text"
                    className="flex-1 bg-transparent border-none rounded py-0.5 text-sm focus:ring-0 outline-none"
                    placeholder="Subtask title..."
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleQuickAddSubtask(e)
                      } else if (e.key === 'Escape') {
                        setIsAddingSubtask(false)
                        setNewSubtaskTitle("")
                      }
                    }}
                    onBlur={() => {
                      if (!newSubtaskTitle.trim()) {
                        setIsAddingSubtask(false)
                      }
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {!hideAssignee && (
            <FormField
              control={form.control}
              name="user_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assign To</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value || "unassigned"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a member" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {members.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.full_name || member.email || member.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          
          {tasks && tasks.length > 0 && (
            <FormField
              control={form.control}
              name="parent_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Parent Task</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value || "none"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a parent" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {potentialParents.map((parent) => (
                        <SelectItem key={parent.id} value={parent.id}>
                          <span className="truncate max-w-[150px]">{parent.title}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          {projects.length > 0 && (
            <FormField
              control={form.control}
              name="project_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project</FormLabel>
                  <Select 
                    onValueChange={(val) => {
                      field.onChange(val)
                      // Reset proposal when project changes
                      form.setValue("proposal_id", "none")
                    }} 
                    value={field.value || "none"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select project" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {visibleProjects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          <div className="flex items-center justify-between w-full gap-2">
                            <span>{project.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {proposals && proposals.length > 0 && (
            <FormField
              control={form.control}
              name="proposal_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Proposal</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value || "none"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select proposal" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {filteredProposals.map((proposal) => (
                        <SelectItem key={proposal.id} value={proposal.id}>
                          <span className="truncate max-w-[150px]">{proposal.title}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        <div className="flex justify-between gap-2 pt-4 border-t">
          <div>
            {onDelete && (
              <Button 
                type="button" 
                variant="ghost" 
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={onDelete}
              >
                Delete Task
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : (defaultValues?.title ? "Save Changes" : "Save Task")}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  )
}
