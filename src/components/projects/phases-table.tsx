import { Link } from "react-router-dom"
import type { ColumnDef } from "@tanstack/react-table"
import { 
  IconCircleCheckFilled, 
  IconLoader, 
  IconDotsVertical,
  IconFileText,
  IconExternalLink,
  IconSend,
  IconX
} from "@tabler/icons-react"
import { toast } from "sonner"
import { DataTable, DragHandle } from "@/components/data-table"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Tables } from "@/lib/database.types"
import { useAuth } from "@/hooks/use-auth"

type Phase = Tables<"phases">

interface PhasesTableProps {
  data: Phase[]
  projectId: string
  onEdit: (phase: Phase | null) => void
  onDelete: (id: string) => void
  onView?: (phase: Phase) => void
  onStatusChange?: (id: string, status: string) => void
  onDataChange?: (data: Phase[]) => void
  isLoading?: boolean
}

export function PhasesTable({ 
  data, 
  projectId, 
  onEdit, 
  onDelete, 
  onView, 
  onStatusChange, 
  onDataChange,
  isLoading 
}: PhasesTableProps) {
  const { role, checkPermission } = useAuth()
  const isAdmin = role === "admin"
  
  const canUpdate = checkPermission('update', 'phases')
  const canDelete = checkPermission('delete', 'phases')
  const canCreate = checkPermission('create', 'phases')

  const columns: ColumnDef<Phase>[] = [
    {
      id: "drag-handle",
      header: "",
      cell: ({ row }) => (
        <div className="flex items-center justify-center">
          {canUpdate ? <DragHandle id={row.original.id} /> : <div className="w-4" />}
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      id: "select",
      header: ({ table }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
    },
    ...(!projectId ? [
      {
        accessorKey: "projects.name",
        header: "Project",
        cell: ({ row }: any) => (
          <div className="font-medium">
            {row.original.projects?.name || "N/A"}
          </div>
        ),
      }
    ] : []),
    {
      accessorKey: "title",
      header: "Title",
      cell: ({ row }) => {
        if (onView) {
          return (
            <div className="flex flex-col">
              <button
                onClick={() => onView(row.original)}
                className="flex items-center gap-2 hover:underline text-primary font-medium text-left"
              >
                <IconFileText className="h-4 w-4 text-muted-foreground" />
                {row.original.title}
              </button>
            </div>
          )
        }
        return (
          <div className="flex flex-col">
            <Link 
              to={`/dashboard/projects/${projectId}/phases/${row.original.id}`}
              className="flex items-center gap-2 hover:underline text-primary font-medium"
            >
              <IconFileText className="h-4 w-4 text-muted-foreground" />
              {row.original.title}
              <IconExternalLink className="h-3 w-3" />
            </Link>
          </div>
        )
      },
      enableHiding: false,
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => (
        <div className="max-w-[300px] truncate text-muted-foreground" title={row.original.description || ""}>
          {row.original.description || "No description"}
        </div>
      ),
    },
    ...(isAdmin ? [
      {
        accessorKey: "amount",
        header: () => <div className="w-full text-right">Amount</div>,
        cell: ({ row }: { row: any }) => (
          <div className="text-right font-medium">
            <div className="flex flex-col items-end">
              <span>${row.original.amount?.toLocaleString()}</span>
              {row.original.order_source === "fiverr" && (
                <span className="text-[10px] text-muted-foreground">
                  Net: ${row.original.net_amount?.toLocaleString()}
                </span>
              )}
            </div>
          </div>
        ),
      }
    ] : []),
    {
      accessorKey: "order_source",
      header: "Source",
      cell: ({ row }) => (
        <Badge variant="outline" className="capitalize">
          {row.original.order_source === "fiverr" ? "Fiverr" : "Direct"}
        </Badge>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.status || "draft"
        
        if (!canUpdate) {
          return (
            <div className="flex items-center px-3 py-1.5 text-sm">
              {status === "active" ? (
                <IconCircleCheckFilled className="size-4 fill-green-500 dark:fill-green-400 mr-2" />
              ) : status === "complete" ? (
                <IconCircleCheckFilled className="size-4 fill-blue-500 dark:fill-blue-400 mr-2" />
              ) : status === "draft" ? (
                <IconLoader className="size-4 animate-spin mr-2" />
              ) : status === "sent" ? (
                <IconSend className="size-4 text-orange-500 mr-2" />
              ) : status === "rejected" ? (
                <IconX className="size-4 text-red-500 mr-2" />
              ) : null}
              <span className="capitalize">{status}</span>
            </div>
          )
        }

        return (
          <Select
            value={status}
            onValueChange={(value) => onStatusChange?.(row.original.id, value)}
          >
            <SelectTrigger className="h-8 w-[120px] capitalize">
              <SelectValue>
                <div className="flex items-center">
                  {status === "active" ? (
                    <IconCircleCheckFilled className="size-4 fill-green-500 dark:fill-green-400 mr-2" />
                  ) : status === "complete" ? (
                    <IconCircleCheckFilled className="size-4 fill-blue-500 dark:fill-blue-400 mr-2" />
                  ) : status === "draft" ? (
                    <IconLoader className="size-4 animate-spin mr-2" />
                  ) : status === "sent" ? (
                    <IconSend className="size-4 text-orange-500 mr-2" />
                  ) : status === "rejected" ? (
                    <IconX className="size-4 text-red-500 mr-2" />
                  ) : null}
                  {status}
                </div>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft" className="capitalize">Draft</SelectItem>
              <SelectItem value="sent" className="capitalize">Sent</SelectItem>
              <SelectItem value="active" className="capitalize">Active</SelectItem>
              <SelectItem value="complete" className="capitalize">Complete</SelectItem>
              <SelectItem value="rejected" className="capitalize">Rejected</SelectItem>
            </SelectContent>
          </Select>
        )
      },
    },
    {
      accessorKey: "created_at",
      header: "Created At",
      cell: ({ row }) => (
        <div className="text-muted-foreground">
          {row.original.created_at ? new Date(row.original.created_at).toLocaleDateString() : "N/A"}
        </div>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="data-[state=open]:bg-muted text-muted-foreground flex size-8"
              size="icon"
            >
              <IconDotsVertical className="size-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem 
              onClick={() => {
                if (onView) {
                  onView(row.original)
                }
              }}
              asChild={!onView}
            >
              {onView ? (
                <div className="flex items-center">
                  <IconExternalLink className="mr-2 h-4 w-4" /> View Details
                </div>
              ) : (
                <Link to={`/dashboard/projects/${projectId}/phases/${row.original.id}`}>
                  <IconExternalLink className="mr-2 h-4 w-4" /> View Details
                </Link>
              )}
            </DropdownMenuItem>
            
            {canUpdate && (
              <DropdownMenuItem onClick={() => onEdit(row.original)}>Edit</DropdownMenuItem>
            )}

            <DropdownMenuItem onClick={() => {
                 navigator.clipboard.writeText(row.original.id)
                 toast.success("ID copied to clipboard")
            }}>Copy ID</DropdownMenuItem>
            
            {canDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                    variant="destructive" 
                    onClick={() => onDelete(row.original.id)}
                >
                    Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Search phases..."
      addLabel="Create Phase"
      onAdd={canCreate ? () => onEdit(null as any) : undefined}
      isLoading={isLoading}
      enableReordering={canUpdate}
      onDataChange={onDataChange}
      defaultSorting={[{ id: "title", desc: false }]}
    />
  )
}
