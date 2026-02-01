import * as React from "react"
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable"
import { IconPlus, IconPencil, IconTrash, IconLayoutKanban, IconTable } from "@tabler/icons-react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Tables } from "@/lib/database.types"
import { DataTable } from "@/components/data-table"
import { type ColumnDef } from "@tanstack/react-table"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

type Task = Tables<"tasks"> & {
  proposals?: {
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
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void
  onTaskCreate: (status: string) => void
  onTaskEdit: (task: Task) => void
  onTaskDelete: (taskId: string) => void
  view?: "kanban" | "table"
  onViewChange?: (view: "kanban" | "table") => void
  hideControls?: boolean
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
  hideControls = false
}: KanbanBoardProps) {
  const [tasks, setTasks] = React.useState<Task[]>(initialTasks)
  const [activeTask, setActiveTask] = React.useState<Task | null>(null)
  const [internalView, setInternalView] = React.useState<"kanban" | "table">("kanban")

  const view = externalView || internalView
  const setView = onViewChange || setInternalView

  React.useEffect(() => {
    setTasks(initialTasks)
  }, [initialTasks])

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
      if (groups[task.status]) {
        groups[task.status].push(task)
      } else {
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
    const task = tasks.find((t) => t.id === active.id)
    if (task) setActiveTask(task)
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over) return

    const activeId = active.id
    const overId = over.id

    if (activeId === overId) return

    const activeTask = tasks.find((t) => t.id === activeId)
    const overTask = tasks.find((t) => t.id === overId)

    // Find the column we're hovering over
    const isOverAColumn = COLUMNS.some((col) => col.id === overId)
    
    if (activeTask && (overTask || isOverAColumn)) {
      const newStatus = isOverAColumn ? (overId as string) : overTask!.status
      
      if (activeTask.status !== newStatus) {
        setTasks((prev) => {
          const activeIndex = prev.findIndex((t) => t.id === activeId)
          const newTasks = [...prev]
          newTasks[activeIndex] = { ...newTasks[activeIndex], status: newStatus }
          return newTasks
        })
      }
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    const taskBeforeEnd = activeTask
    setActiveTask(null)

    if (!over) return

    const activeId = active.id
    const overId = over.id

    const activeTaskFinal = tasks.find((t) => t.id === activeId)
    const overTask = tasks.find((t) => t.id === overId)

    if (!activeTaskFinal) return

    // If status changed, sync with backend
    if (taskBeforeEnd && activeTaskFinal.status !== taskBeforeEnd.status) {
      onTaskUpdate(activeTaskFinal.id, { status: activeTaskFinal.status })
    }

    if (overTask && activeTaskFinal.status === overTask.status) {
      const columnTasks = tasksByStatus[activeTaskFinal.status]
      const oldIndex = columnTasks.findIndex((t) => t.id === activeId)
      const newIndex = columnTasks.findIndex((t) => t.id === overId)

      if (oldIndex !== newIndex) {
        const reorderedColumnTasks = arrayMove(columnTasks, oldIndex, newIndex)
        
        // Update local state for immediate feedback
        setTasks((prev) => {
          const otherTasks = prev.filter((t) => t.status !== activeTaskFinal.status)
          const updatedColumnTasks = reorderedColumnTasks.map((t, idx) => ({
            ...t,
            order_index: idx,
          }))
          return [...otherTasks, ...updatedColumnTasks]
        })

        // Sync the moved task's index with backend
        onTaskUpdate(activeTaskFinal.id, { order_index: newIndex })
      }
    }
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      {!hideControls && (
        <div className="flex items-center justify-between">
          <Tabs value={view} onValueChange={(v) => setView(v as "kanban" | "table")}>
            <TabsList>
              <TabsTrigger value="kanban" className="flex items-center gap-2">
                <IconLayoutKanban className="size-4" />
                Kanban
              </TabsTrigger>
              <TabsTrigger value="table" className="flex items-center gap-2">
                <IconTable className="size-4" />
                Table
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          {view !== "kanban" && (
            <Button onClick={() => onTaskCreate("todo")} size="sm">
              <IconPlus className="size-4 mr-2" />
              Add Task
            </Button>
          )}
        </div>
      )}

      {view === "kanban" ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex h-full gap-4 overflow-x-auto pb-4">
            {COLUMNS.map((column) => (
              <KanbanColumn
                key={column.id}
                id={column.id}
                title={column.title}
                tasks={tasksByStatus[column.id]}
                members={members}
                onAddTask={() => onTaskCreate(column.id)}
                onTaskEdit={onTaskEdit}
                onTaskUpdate={onTaskUpdate}
              />
            ))}
          </div>

          <DragOverlay>
            {activeTask ? (
              <TaskCard 
                task={activeTask} 
                isOverlay 
                members={members} 
                onEdit={() => onTaskEdit(activeTask)}
                onUpdate={(updates) => onTaskUpdate(activeTask.id, updates)}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <TaskTableView
          tasks={tasks}
          members={members}
          onTaskEdit={onTaskEdit}
          onTaskUpdate={onTaskUpdate}
          onTaskDelete={onTaskDelete}
        />
      )}
    </div>
  )
}

function TaskTableView({ tasks, members, onTaskEdit, onTaskUpdate, onTaskDelete }: TaskViewProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState<string | null>(null)

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
        data={tasks} 
        disablePadding
        searchPlaceholder="Search tasks..."
      />
      <ConfirmDialog
        open={!!isDeleteDialogOpen}
        onOpenChange={(open) => !open && setIsDeleteDialogOpen(null)}
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
  onTaskEdit: (task: Task) => void
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void
  onTaskDelete: (taskId: string) => void
}

interface KanbanColumnProps {
  id: string
  title: string
  tasks: Task[]
  members: Tables<"profiles">[]
  onAddTask: () => void
  onTaskEdit: (task: Task) => void
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void
}

function KanbanColumn({ id, title, tasks, members, onAddTask, onTaskEdit, onTaskUpdate }: KanbanColumnProps) {
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
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-foreground"
          onClick={onAddTask}
        >
          <IconPlus className="size-4" />
        </Button>
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
  onEdit: (task: Task) => void
  onUpdate: (taskId: string, updates: Partial<Task>) => void
}

function SortableTaskCard({ task, members, onEdit, onUpdate }: SortableTaskCardProps) {
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
      />
    </div>
  )
}

interface TaskCardProps {
  task: Task
  isOverlay?: boolean
  members: Tables<"profiles">[]
  onEdit: () => void
  onUpdate: (updates: Partial<Task>) => void
}

function TaskCard({ task, isOverlay, members, onEdit, onUpdate }: TaskCardProps) {
  const userInitials = task.profiles?.full_name
    ? task.profiles.full_name.split(' ').map(n => n[0]).join('').toUpperCase()
    : task.profiles?.email?.slice(0, 2).toUpperCase() || '?'

  return (
    <Card 
      className={`group relative cursor-grab active:cursor-grabbing hover:border-primary/50 transition-colors ${isOverlay ? "ring-2 ring-primary" : ""}`}
      onClick={onEdit}
    >
      <CardHeader className="p-3">
        <CardTitle className="text-sm font-medium line-clamp-2">
          {task.title}
        </CardTitle>
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

