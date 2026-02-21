import * as React from "react"
import {
  DndContext,
  DragOverlay,
  closestCorners,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
  type CollisionDetection,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable"
import { IconPlus, IconTrash, IconLayoutKanban, IconCircle, IconCircleCheck, IconShare, IconBug, IconRocket, IconGitPullRequest, IconCode, IconShieldLock, IconAlarm } from "@tabler/icons-react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { Tables } from "@/lib/database.types"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ReminderForm } from "@/components/reminder-form"

// Custom collision detection strategy for multi-container kanban
const customCollisionDetection: CollisionDetection = (args) => {
  // First, see if there are any collisions with items
  const rectCollisions = rectIntersection(args)
  
  if (rectCollisions.length > 0) {
    return rectCollisions
  }

  // Fallback to closestCorners
  return closestCorners(args)
}

export type Task = {
  id: string
  created_at: string | null
  title: string
  description: string | null
  status: string
  type: string | null
  order_index: number | null
  user_id: string | null
  parent_id: string | null
  deliverable_id: string | null
  phase_id: string | null
  project_id: string | null
  phases?: {
    id: string
    title: string
    project_id?: string | null
    projects?: {
      id: string
      name: string
    } | null
  } | null
  profiles?: {
    full_name: string | null
    avatar_url: string | null
    email: string | null
    role?: string | null
  } | null
  task_attachments?: Tables<"task_attachments">[]
  task_members?: {
    user_id: string
    profiles: {
      id: string
      full_name: string | null
      avatar_url: string | null
      email: string | null
      role?: string | null
    } | null
  }[]
  is_personal?: boolean
}

export type KanbanMode = "development" | "admin"

interface KanbanBoardProps {
  tasks: Task[]
  members: Tables<"profiles">[]
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void | Promise<void>
  onTaskCreate: (status: string, parentId?: string) => void
  onTaskQuickCreate?: (status: string, parentId: string, title: string) => void | Promise<void>
  onTaskEdit: (task: Task) => void | Promise<void>
  onTaskDelete: (taskId: string) => void | Promise<void>
  onShare?: (task: Task) => void
  hideControls?: boolean
  hideCreate?: boolean
  isLoading?: boolean
  mode?: KanbanMode
  onModeChange?: (mode: KanbanMode) => void
  disablePadding?: boolean
}

const COLUMNS = [
  { id: "backlog", title: "Backlog" },
  { id: "todo", title: "To Do" },
  { id: "in progress", title: "In Progress" },
  { id: "in review", title: "In Review" },
  { id: "complete", title: "Complete" },
]

export function KanbanBoard({
  tasks: initialTasks,
  members,
  onTaskUpdate,
  onTaskCreate,
  onTaskQuickCreate,
  onTaskEdit,
  onTaskDelete,
  onShare,
  hideControls = false,
  hideCreate = false,
  isLoading = false,
  mode = "development",
  onModeChange,
  disablePadding = false
}: KanbanBoardProps) {
  const [tasks, setTasks] = React.useState<Task[]>(initialTasks)
  const [activeTask, setActiveTask] = React.useState<Task | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState<string | null>(null)
  
  // Use a ref to always have the latest tasks in handlers without re-rendering
  const tasksRef = React.useRef(tasks)
  React.useEffect(() => {
    tasksRef.current = tasks
  }, [tasks])

  // Update local tasks when initialTasks changes, but only if not dragging
  React.useEffect(() => {
    if (!activeTask) {
      setTasks(initialTasks)
    }
  }, [initialTasks, activeTask])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const tasksByStatus = React.useMemo(() => {
    const groups: Record<string, Task[]> = {}
    COLUMNS.forEach((col) => (groups[col.id] = []))
    
    // Get a set of IDs for quick lookup
    const taskIds = new Set(tasks.map(t => t.id))
    
    // Filter tasks based on mode
    const filteredTasks = tasks.filter(task => {
      const isPersonal = (task as any).is_personal
      const hasAdmin = task.task_members?.some(m => m.profiles?.role === 'admin')
      const isAdminType = task.type === 'admin'
      if (mode === 'admin') {
        return hasAdmin || isPersonal || isAdminType
      }
      // In development mode, show tasks that don't have admins, are not personal, and are not admin type
      return !hasAdmin && !isPersonal && !isAdminType
    })

    // Only include tasks that are top-level OR whose parent is NOT in this list
    filteredTasks.filter(t => !t.parent_id || !taskIds.has(t.parent_id)).forEach((task) => {
      const status = task.status
      if (groups[status]) {
        groups[status].push(task)
      } else {
        // Fallback to backlog if status is unknown or missing
        groups["backlog"].push(task)
      }
    })
    // Sort each group by order_index
    Object.keys(groups).forEach((status) => {
      groups[status].sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
    })
    return groups
  }, [tasks, mode])

  // Get subtasks for a task
  const getSubtasks = React.useCallback((taskId: string) => {
    return tasks.filter(t => {
      if (t.parent_id !== taskId) return false
      const isPersonal = (t as any).is_personal
      const hasAdmin = t.task_members?.some(m => m.profiles?.role === 'admin')
      const isAdminType = t.type === 'admin'
      if (mode === 'admin') return hasAdmin || isPersonal || isAdminType
      return !hasAdmin && !isPersonal && !isAdminType
    })
  }, [tasks, mode])

  const handleShare = React.useCallback(async (task: Task) => {
    if (onShare) {
      onShare(task)
      return
    }

    // Default share implementation if onShare prop is not provided
    const shareData = {
      title: task.title,
      text: task.description || task.title,
      url: `${window.location.origin}/dashboard/tasks?taskId=${task.id}`,
    }

    try {
      if (navigator.share && navigator.canShare(shareData)) {
        await navigator.share(shareData)
      } else {
        await navigator.clipboard.writeText(shareData.url)
        toast.success("Link copied to clipboard")
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error("Error sharing:", err)
        toast.error("Failed to share task")
      }
    }
  }, [onShare])

  function handleDragStart(event: DragStartEvent) {
    const { active } = event
    const task = tasksRef.current.find((t) => t.id === active.id)
    if (task) setActiveTask(task)
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over) return

    const activeId = active.id
    const overId = over.id

    if (activeId === overId) return

    const activeTaskObj = tasksRef.current.find((t) => t.id === activeId)
    if (!activeTaskObj) return

    // Find the container (status) of the 'over' element
    let overStatus: string | null = null
    
    // Is over a column?
    if (COLUMNS.some(col => col.id === overId)) {
      overStatus = overId as string
    } else {
      // Is over a task?
      const overTask = tasksRef.current.find(t => t.id === overId)
      if (overTask) {
        overStatus = overTask.status
      }
    }

    if (!overStatus) return

    if (activeTaskObj.status !== overStatus) {
      setTasks((prev) => {
        const activeIndex = prev.findIndex((t) => t.id === activeId)
        if (activeIndex === -1) return prev
        
        const updatedTasks = [...prev]
        updatedTasks[activeIndex] = { 
          ...updatedTasks[activeIndex], 
          status: overStatus! 
        }
        return updatedTasks
      })
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    const draggedTask = activeTask
    setActiveTask(null)

    if (!over) return

    const activeId = active.id
    const overId = over.id

    const activeTaskFinal = tasksRef.current.find((t) => t.id === activeId)
    if (!activeTaskFinal || !draggedTask) return

    // Determine target status
    let targetStatus: string = activeTaskFinal.status
    if (COLUMNS.some(col => col.id === overId)) {
      targetStatus = overId as string
    } else {
      const overTask = tasksRef.current.find(t => t.id === overId)
      if (overTask) {
        targetStatus = overTask.status
      }
    }

    const updates: Partial<Task> = {}
    let finalOrderIndex = activeTaskFinal.order_index

    // 1. Handle Status Change
    if (targetStatus !== draggedTask.status) {
      updates.status = targetStatus
    }

    // 2. Handle Reordering
    const overTask = tasksRef.current.find(t => t.id === overId)
    if (overTask && overTask.id !== activeId) {
      // Get tasks in the target column AFTER they've been updated by dragOver
      // We use tasksRef.current because it should have the latest status from handleDragOver
      const columnTasks = [...tasksRef.current.filter(t => t.status === targetStatus)]
      columnTasks.sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
      
      const oldIndex = columnTasks.findIndex((t) => t.id === activeId)
      const newIndex = columnTasks.findIndex((t) => t.id === overId)

      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const reordered = arrayMove(columnTasks, oldIndex, newIndex)
        finalOrderIndex = newIndex
        updates.order_index = finalOrderIndex

        // Update local state for immediate feedback
        setTasks(prev => {
          const otherTasks = prev.filter(t => t.status !== targetStatus)
          const updatedColumnTasks = reordered.map((t, idx) => ({
            ...t,
            order_index: idx
          }))
          return [...otherTasks, ...updatedColumnTasks]
        })
      }
    } else if (!overTask && COLUMNS.some(col => col.id === overId)) {
      // Dropped on empty column or column header
      const columnTasks = tasksRef.current.filter(t => t.status === targetStatus)
      finalOrderIndex = columnTasks.length
      updates.order_index = finalOrderIndex
    }

    // Sync with backend if anything changed
    if (Object.keys(updates).length > 0) {
      await onTaskUpdate(activeId as string, updates)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-3 min-h-0 overflow-hidden">
      {!hideControls && (
        <div className={cn(
          "flex items-center justify-between shrink-0",
          !disablePadding && "px-4 lg:px-6"
        )}>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md text-sm font-medium">
              <IconLayoutKanban className="size-4" />
              Kanban
            </div>

            <ToggleGroup 
              type="single" 
              value={mode} 
              onValueChange={(v) => v && onModeChange?.(v as KanbanMode)}
              className="bg-muted p-1 rounded-md"
            >
              <ToggleGroupItem value="development" className="text-xs h-7 px-2.5 gap-1.5 data-[state=on]:bg-background data-[state=on]:shadow-sm">
                <IconCode className="size-3.5" />
                Development Tasks
              </ToggleGroupItem>
              <ToggleGroupItem value="admin" className="text-xs h-7 px-2.5 gap-1.5 data-[state=on]:bg-background data-[state=on]:shadow-sm">
                <IconShieldLock className="size-3.5" />
                Admin Tasks
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          
          {!hideCreate && (
            <Button onClick={() => onTaskCreate("todo")} size="sm" disabled={isLoading}>
              <IconPlus className="size-4 mr-2" />
              Add Task
            </Button>
          )}
        </div>
      )}

      {isLoading ? (
        <div className={cn(
          "flex flex-1 gap-3 overflow-x-auto pb-3 min-h-0",
          !disablePadding && "px-4 lg:px-6"
        )}>
          {COLUMNS.map((column) => (
            <div key={column.id} className="flex h-full w-80 shrink-0 flex-col gap-2 rounded-lg bg-muted/40 p-2">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-6 rounded-full" />
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-2 overflow-hidden">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i} className="p-2.5">
                    <div className="space-y-2">
                      <Skeleton className="h-3.5 w-3/4" />
                      <div className="space-y-1.5">
                        <Skeleton className="h-2 w-full" />
                        <Skeleton className="h-2 w-1/2" />
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <Skeleton className="h-4 w-4 rounded-full" />
                        <Skeleton className="h-2 w-16" />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={cn(
          "flex flex-1 gap-3 overflow-x-auto pb-3 min-h-0",
          !disablePadding && "px-4 lg:px-6"
        )}>
          <DndContext
            sensors={sensors}
            collisionDetection={customCollisionDetection}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            {COLUMNS.map((column) => (
              <KanbanColumn
                key={column.id}
                id={column.id}
                title={column.title}
                tasks={tasksByStatus[column.id]}
                members={members}
                onAddTask={!hideCreate ? () => onTaskCreate(column.id) : undefined}
                onAddSubtask={!hideCreate ? (parentId) => onTaskCreate(column.id, parentId) : undefined}
                onQuickAddSubtask={!hideCreate && onTaskQuickCreate ? (parentId, title) => onTaskQuickCreate(column.id, parentId, title) : undefined}
                onTaskEdit={onTaskEdit}
                onTaskUpdate={onTaskUpdate}
                onTaskDelete={(id) => setIsDeleteDialogOpen(id)}
                onShare={handleShare}
                getSubtasks={getSubtasks}
              />
            ))}

            <DragOverlay>
              {activeTask ? (
                <TaskCard 
                  task={activeTask} 
                  isOverlay 
                  members={members} 
                  onEdit={onTaskEdit}
                  onUpdate={onTaskUpdate}
                  onDelete={() => setIsDeleteDialogOpen(activeTask.id)}
                  onShare={handleShare}
                  subtasks={getSubtasks(activeTask.id)}
                />
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      )}

      <ConfirmDialog
        open={!!isDeleteDialogOpen}
        onOpenChange={(open: boolean) => !open && setIsDeleteDialogOpen(null)}
        title="Delete Task"
        description="Are you sure you want to delete this task? This action cannot be undone."
        onConfirm={() => {
          if (isDeleteDialogOpen) {
            onTaskDelete(isDeleteDialogOpen)
            setIsDeleteDialogOpen(null)
          }
        }}
      />
    </div>
  )
}

interface KanbanColumnProps {
  id: string
  title: string
  tasks: Task[]
  members: Tables<"profiles">[]
  onAddTask?: () => void
  onAddSubtask?: (parentId: string) => void
  onQuickAddSubtask?: (parentId: string, title: string) => void | Promise<void>
  onTaskEdit: (task: Task) => void | Promise<void>
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void | Promise<void>
  onTaskDelete: (taskId: string) => void | Promise<void>
  onShare: (task: Task) => void
  getSubtasks: (taskId: string) => Task[]
}

function KanbanColumn({ id, title, tasks, members, onAddTask, onAddSubtask, onQuickAddSubtask, onTaskEdit, onTaskUpdate, onTaskDelete, onShare, getSubtasks }: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({
    id: id,
  })

  return (
    <div 
      ref={setNodeRef}
      className="flex h-full w-80 shrink-0 flex-col gap-2 rounded-lg bg-muted/40 p-2"
    >
      <div className="flex items-center justify-between px-1 mb-1">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-muted-foreground/80">{title}</h3>
          <span className="text-[10px] font-medium bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">
            {tasks.length}
          </span>
        </div>
        {onAddTask && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:text-foreground"
            onClick={onAddTask}
          >
            <IconPlus className="size-3.5" />
          </Button>
        )}
      </div>

      <SortableContext
        id={id}
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden min-h-0 pr-0.5 custom-scrollbar">
          {tasks.map((task) => (
            <SortableTaskCard 
              key={task.id} 
              task={task} 
              members={members}
              onEdit={onTaskEdit}
              onUpdate={onTaskUpdate}
              onTaskDelete={onTaskDelete}
              onAddSubtask={onAddSubtask}
              onQuickAddSubtask={onQuickAddSubtask}
              onShare={onShare}
              subtasks={getSubtasks(task.id)}
            />
          ))}
          {tasks.length === 0 && (
            <div className="flex flex-1 items-center justify-center rounded-lg border-2 border-dashed p-6 text-center text-xs text-muted-foreground/50">
              No tasks
            </div>
          )}
        </div>
      </SortableContext>
      
      {onAddTask && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-muted/50 mt-1 h-8 px-2 font-normal text-xs"
          onClick={onAddTask}
        >
          <IconPlus className="size-3.5 mr-2" />
          Add Task
        </Button>
      )}
    </div>
  )
}

interface SortableTaskCardProps {
  task: Task
  members: Tables<"profiles">[]
  onEdit: (task: Task) => void | Promise<void>
  onUpdate: (taskId: string, updates: Partial<Task>) => void | Promise<void>
  onTaskDelete: (taskId: string) => void | Promise<void>
  onAddSubtask?: (parentId: string) => void
  onQuickAddSubtask?: (parentId: string, title: string) => void | Promise<void>
  onShare: (task: Task) => void
  subtasks: Task[]
}

function SortableTaskCard({ task, members, onEdit, onUpdate, onTaskDelete, onAddSubtask, onQuickAddSubtask, onShare, subtasks }: SortableTaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: {
      type: "Task",
      task,
    },
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  }

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners}
      className={cn(
        "outline-none touch-none",
        isDragging && "opacity-0"
      )}
    >
      <TaskCard 
        task={task} 
        members={members} 
        onEdit={onEdit}
        onUpdate={onUpdate}
        onDelete={() => onTaskDelete(task.id)}
        onAddSubtask={onAddSubtask}
        onQuickAddSubtask={onQuickAddSubtask}
        onShare={onShare}
        subtasks={subtasks}
      />
    </div>
  )
}

interface TaskCardProps {
  task: Task
  isOverlay?: boolean
  members: Tables<"profiles">[]
  onEdit: (task: Task) => void | Promise<void>
  onUpdate: (taskId: string, updates: Partial<Task>) => void | Promise<void>
  onDelete: () => void
  onAddSubtask?: (parentId: string) => void
  onQuickAddSubtask?: (parentId: string, title: string) => void | Promise<void>
  onShare: (task: Task) => void
  subtasks: Task[]
}

function TaskCard({ task, isOverlay, members, onEdit, onUpdate, onDelete, onAddSubtask, onQuickAddSubtask, onShare, subtasks }: TaskCardProps) {
  const [isAddingSubtask, setIsAddingSubtask] = React.useState(false)
  const [newSubtaskTitle, setNewSubtaskTitle] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)

  const userInitials = task.profiles?.full_name
    ? task.profiles.full_name.split(' ').map(n => n[0]).join('').toUpperCase()
    : task.profiles?.email?.slice(0, 2).toUpperCase() || '?'

  const completedSubtasks = subtasks.filter(st => st.status === 'complete').length

  const imageAttachment = task.task_attachments?.find(a => a.file_type.startsWith('image/'))

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSubtaskTitle.trim() || !onQuickAddSubtask) return
    
    await onQuickAddSubtask(task.id, newSubtaskTitle.trim())
    setNewSubtaskTitle("")
    setIsAddingSubtask(false)
  }

  React.useEffect(() => {
    if (isAddingSubtask && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isAddingSubtask])

  return (
    <Card 
      className={cn(
        "group relative cursor-grab active:cursor-grabbing hover:border-primary/50 transition-colors p-2.5 shadow-none py-0 gap-0",
        isOverlay && "ring-2 ring-primary"
      )}
      onClick={() => onEdit(task)}
    >
      <div className="flex flex-col gap-2 py-2.5">
        {imageAttachment && (
          <div className="aspect-video w-full overflow-hidden rounded-md">
            <img 
              src={supabase.storage.from('task-attachments').getPublicUrl(imageAttachment.file_path).data.publicUrl} 
              alt={imageAttachment.file_name}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
              <button className="focus:outline-none">
                {task.type === 'bug' ? (
                  <Badge variant="destructive" className="h-4 px-1 text-[9px] gap-0.5 flex items-center uppercase font-bold tracking-wider">
                    <IconBug className="size-2.5" />
                    Bug
                  </Badge>
                ) : task.type === 'revision' ? (
                  <Badge variant="outline" className="h-4 px-1 text-[9px] gap-0.5 flex items-center bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 border-orange-200 uppercase font-bold tracking-wider">
                    <IconGitPullRequest className="size-2.5" />
                    Revision
                  </Badge>
                ) : task.type === 'admin' ? (
                  <Badge variant="outline" className="h-4 px-1 text-[9px] gap-0.5 flex items-center bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 border-purple-200 uppercase font-bold tracking-wider">
                    <IconShieldLock className="size-2.5" />
                    Admin
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="h-4 px-1 text-[9px] gap-0.5 flex items-center bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border-transparent uppercase font-bold tracking-wider">
                    <IconRocket className="size-2.5" />
                    Feature
                  </Badge>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-32">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onUpdate(task.id, { type: 'feature' }) }}>
                <IconRocket className="size-3.5 mr-2 text-blue-600" />
                <span>Feature</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onUpdate(task.id, { type: 'bug' }) }}>
                <IconBug className="size-3.5 mr-2 text-destructive" />
                <span>Bug</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onUpdate(task.id, { type: 'revision' }) }}>
                <IconGitPullRequest className="size-3.5 mr-2 text-orange-600" />
                <span>Revision</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onUpdate(task.id, { type: 'admin' }) }}>
                <IconShieldLock className="size-3.5 mr-2 text-purple-600" />
                <span>Admin</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-semibold leading-tight flex-1 min-w-0 break-words">
            {task.title}
          </h4>
          {!isOverlay && (
            <div className="flex gap-0.5 shrink-0">
              {onAddSubtask && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 -mt-1 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground shrink-0 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsAddingSubtask(true)
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <IconPlus className="size-3" />
                </Button>
              )}
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 -mt-1 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground shrink-0 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <IconAlarm className="size-3" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]" onClick={(e) => e.stopPropagation()}>
                  <DialogHeader>
                    <DialogTitle>Set Task Reminder</DialogTitle>
                    <DialogDescription>
                      Get notified about this task at a specific time.
                    </DialogDescription>
                  </DialogHeader>
                  <ReminderForm 
                    initialData={{
                      title: `Task: ${task.title}`,
                      task_id: task.id,
                      link: task.phase_id 
                        ? `/dashboard/projects/${task.phases?.project_id}/phases/${task.phase_id}?taskId=${task.id}`
                        : `/dashboard/tasks?taskId=${task.id}`
                    }}
                    onSuccess={() => {
                      // No need to close manually if we use controlled state, but for simplicity:
                      toast.success("Reminder set!")
                    }}
                  />
                </DialogContent>
              </Dialog>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 -mt-1 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground shrink-0 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation()
                  onShare(task)
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <IconShare className="size-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 -mr-1 -mt-1 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete()
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <IconTrash className="size-3" />
              </Button>
            </div>
          )}
        </div>

        {task.description && (
          <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed break-words">
            {task.description}
          </p>
        )}

        {(subtasks.length > 0 || isAddingSubtask) && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span className="font-medium">Subtasks</span>
              <span className="bg-muted px-1 rounded-sm">{completedSubtasks}/{subtasks.length}</span>
            </div>
            <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all" 
                style={{ width: `${subtasks.length > 0 ? (completedSubtasks / subtasks.length) * 100 : 0}%` }}
              />
            </div>
            <div className="space-y-0.5 max-h-24 overflow-y-auto overflow-x-hidden pr-1 custom-scrollbar">
              {subtasks.map(st => (
                <div 
                  key={st.id} 
                  className="flex items-center gap-1.5 text-[10px] py-0.5 px-1 rounded hover:bg-muted/50 group/st"
                  onClick={(e) => {
                    e.stopPropagation()
                    onEdit(st)
                  }}
                >
                  <button
                    type="button"
                    className="shrink-0 text-muted-foreground hover:text-primary transition-colors focus:outline-none"
                    onClick={(e) => {
                      e.stopPropagation()
                      onUpdate(st.id, { status: st.status === 'complete' ? 'todo' : 'complete' })
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    {st.status === 'complete' ? (
                      <IconCircleCheck className="size-3 text-green-500" />
                    ) : (
                      <IconCircle className="size-3" />
                    )}
                  </button>
                  <span className={cn(
                    "flex-1 min-w-0 break-words",
                    st.status === 'complete' && "line-through text-muted-foreground/60"
                  )}>
                    {st.title}
                  </span>
                </div>
              ))}
              
              {isAddingSubtask && (
                <form 
                  onSubmit={handleQuickAdd}
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 mt-0.5"
                >
                  <input
                    ref={inputRef}
                    type="text"
                    className="flex-1 min-w-0 bg-muted border-none rounded px-1 py-0.5 text-[10px] focus:ring-1 focus:ring-primary outline-none"
                    placeholder="Add subtask..."
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
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
                </form>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center -space-x-2 overflow-hidden">
            {task.task_members && task.task_members.length > 0 ? (
              task.task_members.map((member, i) => {
                const initials = member.profiles?.full_name
                  ? member.profiles.full_name.split(' ').map(n => n[0]).join('').toUpperCase()
                  : member.profiles?.email?.slice(0, 2).toUpperCase() || '?'
                
                return (
                  <Avatar key={member.user_id} className="h-5 w-5 border-2 border-background shrink-0" style={{ zIndex: 10 - i }}>
                    <AvatarImage src={member.profiles?.avatar_url || undefined} />
                    <AvatarFallback className="text-[7px]">{initials}</AvatarFallback>
                  </Avatar>
                )
              })
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                  <Button variant="ghost" className="h-6 p-0 hover:bg-transparent flex items-center gap-1.5">
                    <Avatar className="h-5 w-5 border border-background">
                      <AvatarImage src={task.profiles?.avatar_url || undefined} />
                      <AvatarFallback className="text-[8px]">{userInitials}</AvatarFallback>
                    </Avatar>
                    <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                      {task.profiles?.full_name || task.profiles?.email?.split('@')[0] || "Unassigned"}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuLabel>Assign To</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={(e) => {
                      e.stopPropagation()
                      onUpdate(task.id, { user_id: null })
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-[10px]">?</AvatarFallback>
                      </Avatar>
                      <span>Unassigned</span>
                    </div>
                  </DropdownMenuItem>
                  {members.map((member) => (
                    <DropdownMenuItem 
                      key={member.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        onUpdate(task.id, { user_id: member.id })
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={member.avatar_url || undefined} />
                          <AvatarFallback className="text-[10px]">
                            {member.full_name ? member.full_name.split(' ').map(n => n[0]).join('').toUpperCase() : member.email?.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate">{member.full_name || member.email}</span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          
          {task.task_members && task.task_members.length > 0 && (
            <span className="text-[10px] text-muted-foreground">
              {task.task_members.length} {task.task_members.length === 1 ? 'assignee' : 'assignees'}
            </span>
          )}
        </div>
      </div>
    </Card>
  )
}
