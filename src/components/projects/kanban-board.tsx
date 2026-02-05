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
import { IconPlus, IconPencil, IconTrash, IconLayoutKanban, IconTable, IconX, IconList, IconCircle, IconCircleCheck, IconChevronDown, IconChevronRight } from "@tabler/icons-react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Tables } from "@/lib/database.types"
import { DataTable } from "@/components/data-table"
import { type ColumnDef } from "@tanstack/react-table"
import { cn } from "@/lib/utils"

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
  created_at?: string | null
  title: string
  description?: string | null
  status: string
  order_index?: number | null
  user_id?: string | null
  deliverable_id?: string | null
  proposal_id?: string | null
  proposals?: {
    id: string
    title: string
    projects?: {
      name: string
    } | null
  } | null
  profiles?: {
    full_name: string | null
    avatar_url: string | null
    email: string | null
  } | null
}

interface KanbanBoardProps {
  tasks: Task[]
  members: Tables<"profiles">[]
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void | Promise<void>
  onTaskCreate: (status: string) => void
  onTaskEdit: (task: Task) => void | Promise<void>
  onTaskDelete: (taskId: string) => void | Promise<void>
  view?: "kanban" | "table" | "list"
  onViewChange?: (view: "kanban" | "table" | "list") => void
  hideControls?: boolean
  hideCreate?: boolean
  isLoading?: boolean
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
  onTaskEdit,
  onTaskDelete,
  view: externalView,
  onViewChange,
  hideControls = false,
  hideCreate = false,
  isLoading = false
}: KanbanBoardProps) {
  const [tasks, setTasks] = React.useState<Task[]>(initialTasks)
  const [activeTask, setActiveTask] = React.useState<Task | null>(null)
  const [internalView, setInternalView] = React.useState<"kanban" | "table" | "list">("kanban")
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState<string | null>(null)
  
  // Use a ref to always have the latest tasks in handlers without re-rendering
  const tasksRef = React.useRef(tasks)
  React.useEffect(() => {
    tasksRef.current = tasks
  }, [tasks])

  const view = externalView || internalView
  const setView = onViewChange || setInternalView

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
    tasks.forEach((task) => {
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
  }, [tasks])

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
    <div className="flex flex-col gap-4 h-full">
      {!hideControls && (
        <div className="flex items-center justify-between">
          <Tabs value={view} onValueChange={(v) => setView(v as "kanban" | "table" | "list")}>
            <TabsList>
              <TabsTrigger value="kanban" className="flex items-center gap-2">
                <IconLayoutKanban className="size-4" />
                Kanban
              </TabsTrigger>
              <TabsTrigger value="list" className="flex items-center gap-2">
                <IconList className="size-4" />
                List
              </TabsTrigger>
              <TabsTrigger value="table" className="flex items-center gap-2">
                <IconTable className="size-4" />
                Table
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          {view !== "kanban" && !hideCreate && (
            <Button onClick={() => onTaskCreate("todo")} size="sm" disabled={isLoading}>
              <IconPlus className="size-4 mr-2" />
              Add Task
            </Button>
          )}
        </div>
      )}

      {isLoading ? (
        view === "kanban" ? (
          <div className="flex h-full gap-4 overflow-x-auto pb-4">
            {COLUMNS.map((column) => (
              <div key={column.id} className="flex h-full w-72 flex-col gap-3 rounded-lg bg-muted/50 p-3">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-5 w-8 rounded-full" />
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Card key={i} className="p-3">
                      <div className="space-y-3">
                        <Skeleton className="h-4 w-3/4" />
                        <div className="space-y-2">
                          <Skeleton className="h-3 w-full" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-6 w-6 rounded-full" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : view === "list" ? (
          <div className="space-y-4">
            {COLUMNS.map((col) => (
              <div key={col.id} className="space-y-2">
                <Skeleton className="h-6 w-32" />
                <div className="space-y-1">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-md" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <TaskTableView
            tasks={[]}
            members={members}
            onTaskCreate={onTaskCreate}
            onTaskEdit={onTaskEdit}
            onTaskUpdate={onTaskUpdate}
            onTaskDelete={onTaskDelete}
            isLoading={true}
          />
        )
      ) : view === "kanban" ? (
        <div className="flex h-full gap-4 overflow-x-auto pb-4">
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
                onTaskEdit={onTaskEdit}
                onTaskUpdate={onTaskUpdate}
                onTaskDelete={(id) => setIsDeleteDialogOpen(id)}
              />
            ))}

            <DragOverlay>
              {activeTask ? (
                <TaskCard 
                  task={activeTask} 
                  isOverlay 
                  members={members} 
                  onEdit={() => onTaskEdit(activeTask)}
                  onUpdate={(updates) => onTaskUpdate(activeTask.id, updates)}
                  onDelete={() => setIsDeleteDialogOpen(activeTask.id)}
                />
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      ) : view === "list" ? (
        <TaskListView
          tasks={tasks}
          members={members}
          onTaskCreate={onTaskCreate}
          onTaskEdit={onTaskEdit}
          onTaskUpdate={onTaskUpdate}
          onTaskDelete={(id) => setIsDeleteDialogOpen(id)}
        />
      ) : (
        <TaskTableView
          tasks={tasks}
          members={members}
          onTaskCreate={onTaskCreate}
          onTaskEdit={onTaskEdit}
          onTaskUpdate={onTaskUpdate}
          onTaskDelete={(id) => setIsDeleteDialogOpen(id)}
        />
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

function TaskListView({ tasks, members, onTaskCreate, onTaskEdit, onTaskUpdate, onTaskDelete }: TaskViewProps) {
  const [expandedStatuses, setExpandedStatuses] = React.useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    COLUMNS.forEach(col => initial[col.id] = true)
    return initial
  })

  const tasksByStatus = React.useMemo(() => {
    const groups: Record<string, Task[]> = {}
    COLUMNS.forEach((col) => (groups[col.id] = []))
    tasks.forEach((task) => {
      const status = task.status
      if (groups[status]) {
        groups[status].push(task)
      } else {
        groups["backlog"].push(task)
      }
    })
    return groups
  }, [tasks])

  const toggleExpand = (statusId: string) => {
    setExpandedStatuses(prev => ({ ...prev, [statusId]: !prev[statusId] }))
  }

  const handleStatusToggle = async (task: Task) => {
    const isComplete = task.status === "complete"
    const newStatus = isComplete ? "todo" : "complete"
    await onTaskUpdate(task.id, { status: newStatus })
  }

  return (
    <div className="flex-1 space-y-4 overflow-y-auto pr-1">
      {COLUMNS.map((column) => (
        <div key={column.id} className="space-y-1">
          <div className="flex items-center justify-between group/header">
            <button
              onClick={() => toggleExpand(column.id)}
              className="flex items-center gap-2 px-2 py-1 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              {expandedStatuses[column.id] ? (
                <IconChevronDown className="size-4" />
              ) : (
                <IconChevronRight className="size-4" />
              )}
              <span className="capitalize">{column.title}</span>
              <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-[10px]">
                {tasksByStatus[column.id].length}
              </Badge>
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 opacity-0 group-hover/header:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
              onClick={() => onTaskCreate(column.id)}
            >
              <IconPlus className="size-4" />
            </Button>
          </div>

          {expandedStatuses[column.id] && (
            <div className="space-y-1 ml-6">
              {tasksByStatus[column.id].map((task) => (
                <div
                  key={task.id}
                  className="group flex items-center gap-3 rounded-md border bg-card p-2 px-3 hover:border-primary/50 transition-all cursor-pointer shadow-sm"
                  onClick={() => onTaskEdit(task)}
                >
                  <div 
                    onClick={(e) => {
                      e.stopPropagation()
                      handleStatusToggle(task)
                    }}
                    className="flex shrink-0 items-center justify-center cursor-pointer text-muted-foreground hover:text-primary transition-colors"
                  >
                    {task.status === "complete" ? (
                      <IconCircleCheck className="size-5 text-primary fill-primary/10" />
                    ) : (
                      <IconCircle className="size-5" />
                    )}
                  </div>
                  
                  <div className="flex flex-1 flex-col min-w-0">
                    <span className={cn(
                      "text-sm font-medium truncate",
                      task.status === "complete" && "text-muted-foreground line-through"
                    )}>
                      {task.title}
                    </span>
                    {task.proposals && (
                      <span className="text-[10px] text-muted-foreground truncate">
                        {task.proposals.projects?.name} • {task.proposals.title}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" className="h-auto p-0 hover:bg-transparent">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={task.profiles?.avatar_url || undefined} />
                            <AvatarFallback className="text-[10px]">
                              {task.profiles?.full_name ? task.profiles.full_name.split(' ').map(n => n[0]).join('').toUpperCase() : '?'}
                            </AvatarFallback>
                          </Avatar>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel>Assign To</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onTaskUpdate(task.id, { user_id: null }) }}>
                          Unassigned
                        </DropdownMenuItem>
                        {members.map((member) => (
                          <DropdownMenuItem 
                            key={member.id}
                            onClick={(e) => { e.stopPropagation(); onTaskUpdate(task.id, { user_id: member.id }) }}
                          >
                            {member.full_name || member.email}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation()
                        onTaskDelete(task.id)
                      }}
                    >
                      <IconTrash className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {tasksByStatus[column.id].length === 0 && (
                <div className="py-2 text-xs text-muted-foreground italic">
                  No tasks in this status
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-muted-foreground hover:text-foreground h-9 px-3"
                onClick={() => onTaskCreate(column.id)}
              >
                <IconPlus className="size-4 mr-2" />
                Add Task
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function TaskTableView({ tasks, members, onTaskCreate, onTaskEdit, onTaskUpdate, onTaskDelete, isLoading }: TaskViewProps) {
  const [statusFilter, setStatusFilter] = React.useState<string>("all")
  const [assigneeFilter, setAssigneeFilter] = React.useState<string>("all")
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState<string | null>(null)

  const filteredTasks = React.useMemo(() => {
    return tasks.filter(task => {
      const matchesStatus = statusFilter === "all" || task.status === statusFilter
      const matchesAssignee = assigneeFilter === "all" 
        || (assigneeFilter === "unassigned" ? !task.user_id : task.user_id === assigneeFilter)
      return matchesStatus && matchesAssignee
    })
  }, [tasks, statusFilter, assigneeFilter])

  const columns: ColumnDef<Task>[] = [
    {
      accessorKey: "title",
      header: "Task",
      cell: ({ row }) => {
        const task = row.original
        return (
          <div className="flex flex-col gap-1 py-1 min-w-0" onClick={() => onTaskEdit(task)}>
            <span className="font-medium cursor-pointer hover:underline break-words line-clamp-2">{task.title}</span>
            {task.description && (
              <span className="text-xs text-muted-foreground line-clamp-1 break-words">
                {task.description}
              </span>
            )}
          </div>
        )
      }
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant="outline" className="capitalize shrink-0">
          {row.getValue("status")}
        </Badge>
      )
    },
    {
      accessorKey: "user_id",
      header: "Assignee",
      cell: ({ row }) => {
        const task = row.original
        const userInitials = task.profiles?.full_name
          ? task.profiles.full_name.split(' ').map(n => n[0]).join('').toUpperCase()
          : task.profiles?.email?.slice(0, 2).toUpperCase() || '?'

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-auto p-0 hover:bg-transparent max-w-full">
                <div className="flex items-center gap-2 overflow-hidden">
                  <Avatar className="h-6 w-6 shrink-0">
                    <AvatarImage src={task.profiles?.avatar_url || undefined} />
                    <AvatarFallback className="text-[10px]">{userInitials}</AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-muted-foreground truncate">
                    {task.profiles?.full_name || task.profiles?.email || "Unassigned"}
                  </span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Assign To</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onTaskUpdate(task.id, { user_id: null })}>
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
                  onClick={() => onTaskUpdate(task.id, { user_id: member.id })}
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
        )
      }
    },
    {
      header: "Project / Proposal",
      cell: ({ row }) => {
        const task = row.original
        if (!task.proposals) return null
        return (
          <div className="flex flex-col gap-0.5 py-1 min-w-0">
            <span className="text-xs font-medium truncate">
              {task.proposals.projects?.name || "No Project"}
            </span>
            <span className="text-[10px] text-muted-foreground truncate">
              {task.proposals.title}
            </span>
          </div>
        )
      }
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const task = row.original
        return (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => onTaskEdit(task)}
            >
              <IconPencil className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setIsDeleteDialogOpen(task.id)}
            >
              <IconTrash className="size-4" />
            </Button>
          </div>
        )
      }
    }
  ]

  return (
    <div className="flex-1 overflow-hidden">
      <DataTable 
        columns={columns} 
        data={filteredTasks} 
        isLoading={isLoading}
        disablePadding
        searchPlaceholder="Search tasks..."
        toolbar={
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-[130px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {COLUMNS.map(col => (
                  <SelectItem key={col.id} value={col.id}>{col.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger className="h-8 w-[150px]">
                <SelectValue placeholder="Assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Assignees</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {members.map(member => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.full_name || member.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(statusFilter !== "all" || assigneeFilter !== "all") && (
              <Button 
                variant="ghost" 
                onClick={() => {
                  setStatusFilter("all")
                  setAssigneeFilter("all")
                }}
                className="h-8 px-2 lg:px-3"
              >
                Reset
                <IconX className="ml-2 h-4 w-4" />
              </Button>
            )}

            <Button 
              onClick={() => onTaskCreate(statusFilter === "all" ? "todo" : statusFilter)} 
              size="sm" 
              className="h-8 ml-auto"
            >
              <IconPlus className="size-4 mr-2" />
              Add Task
            </Button>
          </div>
        }
      />
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

interface TaskViewProps {
  tasks: Task[]
  members: Tables<"profiles">[]
  onTaskCreate: (status: string) => void
  onTaskEdit: (task: Task) => void | Promise<void>
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void | Promise<void>
  onTaskDelete: (taskId: string) => void | Promise<void>
  isLoading?: boolean
}

interface KanbanColumnProps {
  id: string
  title: string
  tasks: Task[]
  members: Tables<"profiles">[]
  onAddTask?: () => void
  onTaskEdit: (task: Task) => void | Promise<void>
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void | Promise<void>
  onTaskDelete: (taskId: string) => void | Promise<void>
}

function KanbanColumn({ id, title, tasks, members, onAddTask, onTaskEdit, onTaskUpdate, onTaskDelete }: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({
    id: id,
  })

  return (
    <div 
      ref={setNodeRef}
      className="flex h-full w-72 flex-col gap-3 rounded-lg bg-muted/50 p-3"
    >
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">{title}</h3>
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
            {tasks.length}
          </Badge>
        </div>
        {onAddTask && (
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-foreground"
            onClick={onAddTask}
          >
            <IconPlus className="size-4" />
          </Button>
        )}
      </div>

      <SortableContext
        id={id}
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
          {tasks.map((task) => (
            <SortableTaskCard 
              key={task.id} 
              task={task} 
              members={members}
              onEdit={onTaskEdit}
              onUpdate={onTaskUpdate}
              onTaskDelete={onTaskDelete}
            />
          ))}
          {tasks.length === 0 && (
            <div className="flex flex-1 items-center justify-center rounded-lg border-2 border-dashed p-8 text-center text-sm text-muted-foreground">
              No tasks
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  )
}

interface SortableTaskCardProps {
  task: Task
  members: Tables<"profiles">[]
  onEdit: (task: Task) => void | Promise<void>
  onUpdate: (taskId: string, updates: Partial<Task>) => void | Promise<void>
  onTaskDelete: (taskId: string) => void | Promise<void>
}

function SortableTaskCard({ task, members, onEdit, onUpdate, onTaskDelete }: SortableTaskCardProps) {
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

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="h-[100px] rounded-lg border-2 border-primary bg-primary/5 opacity-30"
      />
    )
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard 
        task={task} 
        members={members} 
        onEdit={() => onEdit(task)}
        onUpdate={(updates) => onUpdate(task.id, updates)}
        onDelete={() => onTaskDelete(task.id)}
      />
    </div>
  )
}

interface TaskCardProps {
  task: Task
  isOverlay?: boolean
  members: Tables<"profiles">[]
  onEdit: () => void | Promise<void>
  onUpdate: (updates: Partial<Task>) => void | Promise<void>
  onDelete: () => void
}

function TaskCard({ task, isOverlay, members, onEdit, onUpdate, onDelete }: TaskCardProps) {
  const userInitials = task.profiles?.full_name
    ? task.profiles.full_name.split(' ').map(n => n[0]).join('').toUpperCase()
    : task.profiles?.email?.slice(0, 2).toUpperCase() || '?'

  return (
    <Card 
      className={`group relative cursor-grab active:cursor-grabbing hover:border-primary/50 transition-colors ${isOverlay ? "ring-2 ring-primary" : ""}`}
      onClick={onEdit}
    >
      <CardHeader className="p-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-medium line-clamp-2">
            {task.title}
          </CardTitle>
          {!isOverlay && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7 -mr-1 -mt-1 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0 transition-opacity"
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
            >
              <IconTrash className="size-3.5" />
            </Button>
          )}
        </div>
      </CardHeader>

      {(task.description || members.length > 0) && (
        <CardContent className="px-3 pb-3 pt-0">
          {task.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
              {task.description}
            </p>
          )}
          <div className="flex items-center justify-between gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" className="h-auto p-0 hover:bg-transparent">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6 border-2 border-background">
                      <AvatarImage src={task.profiles?.avatar_url || undefined} />
                      <AvatarFallback className="text-[10px]">{userInitials}</AvatarFallback>
                    </Avatar>
                    <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                      {task.profiles?.full_name || task.profiles?.email || "Unassigned"}
                    </span>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Assign To</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={(e) => {
                    e.stopPropagation()
                    onUpdate({ user_id: null })
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
                      onUpdate({ user_id: member.id })
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
          </div>
        </CardContent>
      )}
    </Card>
  )
}

