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
import { IconCircle, IconCircleCheck, IconPlus, IconPaperclip, IconX, IconLoader2 } from "@tabler/icons-react"
import type { Tables } from "@/lib/database.types"
import type { Task } from "./kanban-board"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/use-auth"
import imageCompression from "browser-image-compression"
import { toast } from "sonner"

const taskSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  user_id: z.string().nullable().optional(),
  project_id: z.string().nullable().optional(),
  proposal_id: z.string().nullable().optional(),
  parent_id: z.string().nullable().optional(),
  subtasks: z.array(z.string()).optional(),
  files: z.array(z.any()).optional(),
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

  const [localSubtasks, setLocalSubtasks] = React.useState<string[]>([])
  const [previews, setPreviews] = React.useState<{name: string, url: string}[]>([])

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
      subtasks: [],
      files: [],
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

  const { user } = useAuth()
  const [isUploading, setIsUploading] = React.useState(false)
  const [attachments, setAttachments] = React.useState<Tables<"task_attachments">[]>([])

  // Load attachments when editing
  React.useEffect(() => {
    if (defaultValues?.id) {
      const task = tasks.find(t => t.id === defaultValues.id)
      if (task?.task_attachments) {
        setAttachments(task.task_attachments)
      }
    }
  }, [defaultValues?.id, tasks])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0 || !user) return

    if (defaultValues?.id) {
      // Direct upload for existing task
      setIsUploading(true)
      try {
        for (const file of Array.from(files)) {
          let fileToUpload = file

          // Compress if it's an image
          if (file.type.startsWith('image/')) {
            const options = {
              maxSizeMB: 1,
              maxWidthOrHeight: 1920,
              useWebWorker: true
            }
            try {
              fileToUpload = await imageCompression(file, options)
            } catch (error) {
              console.error("Compression error:", error)
              // Fallback to original file
            }
          }

          const fileExt = file.name.split('.').pop()
          const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`
          const filePath = `${defaultValues.id}/${fileName}`

          const { error: uploadError } = await supabase.storage
            .from('task-attachments')
            .upload(filePath, fileToUpload)

          if (uploadError) throw uploadError

          const { data: attachment, error: dbError } = await supabase
            .from('task_attachments')
            .insert([{
              task_id: defaultValues.id,
              user_id: user.id,
              file_path: filePath,
              file_name: file.name,
              file_type: file.type,
              file_size: fileToUpload.size
            }])
            .select()
            .single()

          if (dbError) throw dbError

          setAttachments(prev => [...prev, attachment])
        }
        toast.success("File(s) uploaded successfully")
      } catch (error: any) {
        console.error("Upload error:", error)
        toast.error("Failed to upload file: " + error.message)
      } finally {
        setIsUploading(false)
        e.target.value = ''
      }
    } else {
      // Local storage for new task
      const newFiles = Array.from(files)
      
      const newPreviews = newFiles.map(file => ({
        name: file.name,
        url: file.type.startsWith('image/') ? URL.createObjectURL(file) : ''
      }))
      setPreviews(prev => [...prev, ...newPreviews])
      
      form.setValue("files", [...(form.getValues("files") || []), ...newFiles])
      e.target.value = ''
    }
  }

  const handleDeleteAttachment = async (attachment: Tables<"task_attachments">) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('task-attachments')
        .remove([attachment.file_path])

      if (storageError) throw storageError

      // Delete from DB
      const { error: dbError } = await supabase
        .from('task_attachments')
        .delete()
        .eq('id', attachment.id)

      if (dbError) throw dbError

      setAttachments(prev => prev.filter(a => a.id !== attachment.id))
      toast.success("Attachment deleted")
    } catch (error: any) {
      console.error("Delete attachment error:", error)
      toast.error("Failed to delete attachment: " + error.message)
    }
  }

  const handleRemoveLocalFile = (index: number) => {
    if (previews[index].url) {
      URL.revokeObjectURL(previews[index].url)
    }
    
    setPreviews(prev => prev.filter((_, i) => i !== index))
    
    const currentFiles = form.getValues("files") || []
    form.setValue("files", currentFiles.filter((_, i) => i !== index))
  }

  const handleQuickAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSubtaskTitle.trim()) return

    if (defaultValues?.id && onAddSubtask) {
      await onAddSubtask(newSubtaskTitle.trim())
    } else {
      const newTitle = newSubtaskTitle.trim()
      setLocalSubtasks(prev => [...prev, newTitle])
      form.setValue("subtasks", [...(form.getValues("subtasks") || []), newTitle])
    }
    
    setNewSubtaskTitle("")
    setIsAddingSubtask(false)
  }

  const handleRemoveLocalSubtask = (index: number) => {
    setLocalSubtasks(prev => prev.filter((_, i) => i !== index))
    const currentSubtasks = form.getValues("subtasks") || []
    form.setValue("subtasks", currentSubtasks.filter((_, i) => i !== index))
  }

  React.useEffect(() => {
    return () => {
      // Cleanup previews
      previews.forEach(p => {
        if (p.url) URL.revokeObjectURL(p.url)
      })
    }
  }, [])

  React.useEffect(() => {
    if (isAddingSubtask && subtaskInputRef.current) {
      subtaskInputRef.current.focus()
    }
  }, [isAddingSubtask])

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-4 max-h-[calc(100vh-250px)] custom-scrollbar">
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
              {currentSubtasks.length === 0 && localSubtasks.length === 0 && !isAddingSubtask && (
                <p className="text-xs text-muted-foreground py-2 text-center">No subtasks yet</p>
              )}
              
              {/* Existing subtasks (when editing) */}
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

              {/* Local subtasks (when creating) */}
              {localSubtasks.map((title, index) => (
                <div key={index} className="flex items-center gap-2 group">
                  <div className="size-5 shrink-0 flex items-center justify-center">
                    <IconCircle className="size-4 text-muted-foreground opacity-50" />
                  </div>
                  <span className="text-sm truncate flex-1">
                    {title}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-5 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                    onClick={() => handleRemoveLocalSubtask(index)}
                  >
                    <IconX className="size-3" />
                  </Button>
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
                    className="flex-1 bg-transparent border-none rounded py-0.5 text-base md:text-sm focus:ring-0 outline-none"
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

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <FormLabel>Attachments</FormLabel>
              <div className="flex gap-2">
                <input
                  type="file"
                  id="task-attachment"
                  className="hidden"
                  onChange={handleFileUpload}
                  multiple
                  accept="image/*"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs gap-1"
                  disabled={isUploading}
                  onClick={() => document.getElementById('task-attachment')?.click()}
                >
                  {isUploading ? (
                    <IconLoader2 className="size-3 animate-spin" />
                  ) : (
                    <IconPaperclip className="size-3" />
                  )}
                  {isUploading ? "Uploading..." : "Upload Images"}
                </Button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              {/* Existing attachments */}
              {attachments.map(attachment => (
                <div key={attachment.id} className="relative group border rounded-md overflow-hidden bg-muted/30 aspect-video">
                  {attachment.file_type.startsWith('image/') ? (
                    <img 
                      src={supabase.storage.from('task-attachments').getPublicUrl(attachment.file_path).data.publicUrl} 
                      alt={attachment.file_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full p-2">
                      <IconPaperclip className="size-6 text-muted-foreground mb-1" />
                      <span className="text-[10px] text-center truncate w-full">{attachment.file_name}</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeleteAttachment(attachment)}
                    className="absolute top-1 right-1 size-5 bg-black/50 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                  >
                    <IconX className="size-3" />
                  </button>
                  <a 
                    href={supabase.storage.from('task-attachments').getPublicUrl(attachment.file_path).data.publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute inset-0 z-0"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              ))}

              {/* Local files */}
              {previews.map((preview, index) => (
                <div key={index} className="relative group border rounded-md overflow-hidden bg-muted/30 aspect-video">
                  {preview.url ? (
                    <img 
                      src={preview.url} 
                      alt={preview.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full p-2">
                      <IconPaperclip className="size-6 text-muted-foreground mb-1" />
                      <span className="text-[10px] text-center truncate w-full">{preview.name}</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemoveLocalFile(index)}
                    className="absolute top-1 right-1 size-5 bg-black/50 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                  >
                    <IconX className="size-3" />
                  </button>
                </div>
              ))}

              {attachments.length === 0 && previews.length === 0 && !isUploading && (
                <p className="col-span-2 text-xs text-muted-foreground py-2 text-center border rounded-md border-dashed">
                  No attachments yet
                </p>
              )}
            </div>
          </div>

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
          
          <div className="grid grid-cols-2 gap-4 pb-2">
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
        </div>

        <div className="flex justify-between gap-2 pt-4 border-t mt-2">
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
