import * as React from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { 
  IconRocket, 
  IconBug, 
  IconGitPullRequest, 
  IconDotsVertical,
  IconPencil,
  IconTrash,
  IconShare,
  IconExternalLink
} from "@tabler/icons-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DataTable } from "@/components/data-table"
import { type Task } from "./kanban-board"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

interface TasksTableProps {
  tasks: Task[]
  onTaskEdit: (task: Task) => void
  onTaskDelete: (taskId: string) => void
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void
  onShare?: (task: Task) => void
  isLoading?: boolean
}

const statusColors: Record<string, string> = {
  backlog: "bg-slate-500/10 text-slate-600 border-slate-200",
  todo: "bg-blue-500/10 text-blue-600 border-blue-200",
  "in progress": "bg-amber-500/10 text-amber-600 border-amber-200",
  "in review": "bg-purple-500/10 text-purple-600 border-purple-200",
  complete: "bg-green-500/10 text-green-600 border-green-200",
}

export function TasksTable({
  tasks,
  onTaskEdit,
  onTaskDelete,
  onTaskUpdate,
  onShare,
  isLoading = false,
}: TasksTableProps) {
  const columns = React.useMemo<ColumnDef<Task>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Title",
        cell: ({ row }) => {
          const task = row.original
          return (
            <div className="flex flex-col gap-0.5 max-w-[300px]">
              <span className="font-medium truncate">{task.title}</span>
              {task.description && (
                <span className="text-xs text-muted-foreground truncate">
                  {task.description}
                </span>
              )}
            </div>
          )
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const status = row.getValue("status") as string
          return (
            <Badge 
              variant="outline" 
              className={cn("capitalize whitespace-nowrap", statusColors[status] || statusColors.backlog)}
            >
              {status}
            </Badge>
          )
        },
      },
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => {
          const type = row.getValue("type") as string
          return (
            <div className="flex items-center gap-1.5 capitalize">
              {type === 'bug' ? (
                <IconBug className="size-3.5 text-destructive" />
              ) : type === 'revision' ? (
                <IconGitPullRequest className="size-3.5 text-orange-600" />
              ) : (
                <IconRocket className="size-3.5 text-blue-600" />
              )}
              <span className="text-sm">{type || 'feature'}</span>
            </div>
          )
        },
      },
      {
        id: "assignee",
        header: "Assignee",
        cell: ({ row }) => {
          const task = row.original
          const profile = task.profiles
          
          if (!profile && (!task.task_members || task.task_members.length === 0)) {
            return <span className="text-xs text-muted-foreground italic">Unassigned</span>
          }

          if (task.task_members && task.task_members.length > 0) {
            return (
              <div className="flex items-center -space-x-2">
                {task.task_members.slice(0, 3).map((member, i) => {
                  const initials = member.profiles?.full_name
                    ? member.profiles.full_name.split(' ').map(n => n[0]).join('').toUpperCase()
                    : member.profiles?.email?.slice(0, 2).toUpperCase() || '?'
                  
                  return (
                    <Avatar key={member.user_id} className="h-6 w-6 border-2 border-background shrink-0" style={{ zIndex: 10 - i }}>
                      <AvatarImage src={member.profiles?.avatar_url || undefined} />
                      <AvatarFallback className="text-[8px]">{initials}</AvatarFallback>
                    </Avatar>
                  )
                })}
                {task.task_members.length > 3 && (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-muted text-[8px] font-medium" style={{ zIndex: 0 }}>
                    +{task.task_members.length - 3}
                  </div>
                )}
              </div>
            )
          }

          const initials = profile?.full_name
            ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase()
            : profile?.email?.slice(0, 2).toUpperCase() || '?'

          return (
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback className="text-[8px]">{initials}</AvatarFallback>
              </Avatar>
              <span className="text-sm truncate max-w-[100px]">
                {profile?.full_name || profile?.email?.split('@')[0]}
              </span>
            </div>
          )
        },
      },
      {
        id: "project",
        header: "Project / Phase",
        cell: ({ row }) => {
          const task = row.original
          const projectName = task.phases?.projects?.name
          const phaseTitle = task.phases?.title

          if (!projectName && !phaseTitle) return <span className="text-xs text-muted-foreground">-</span>

          return (
            <div className="flex flex-col gap-0.5">
              {projectName && <span className="text-sm font-medium">{projectName}</span>}
              {phaseTitle && <span className="text-xs text-muted-foreground">{phaseTitle}</span>}
            </div>
          )
        },
      },
      {
        accessorKey: "created_at",
        header: "Created",
        cell: ({ row }) => {
          const date = row.getValue("created_at") as string
          if (!date) return null
          return <span className="text-sm text-muted-foreground">{format(new Date(date), "MMM d, yyyy")}</span>
        },
      },
      {
        id: "actions",
        cell: ({ row }) => {
          const task = row.original

          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <IconDotsVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onTaskEdit(task)}>
                  <IconPencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onShare?.(task)}>
                  <IconShare className="mr-2 h-4 w-4" />
                  Share
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="text-destructive focus:text-destructive"
                  onClick={() => onTaskDelete(task.id)}
                >
                  <IconTrash className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      },
    ],
    [onTaskEdit, onTaskDelete, onTaskUpdate, onShare]
  )

  return (
    <DataTable
      columns={columns}
      data={tasks}
      isLoading={isLoading}
      searchPlaceholder="Search tasks..."
      onRowClick={onTaskEdit}
    />
  )
}
