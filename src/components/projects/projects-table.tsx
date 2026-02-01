import * as React from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { 
  IconDotsVertical,
  IconEdit,
  IconTrash,
  IconExternalLink,
} from "@tabler/icons-react"

import { DataTable } from "@/components/data-table"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Tables } from "@/lib/database.types"

// Define a type for projects with client info
export type ProjectWithClient = Tables<"projects"> & {
  clients: {
    first_name: string
    last_name: string | null
  } | null
  project_members?: {
    user_id: string
    profiles?: {
      full_name: string | null
      avatar_url: string | null
    }
  }[]
}

interface ProjectsTableProps {
  data: ProjectWithClient[]
  isLoading?: boolean
  onEdit: (project: ProjectWithClient) => void
  onDelete: (id: string) => void
  onAdd: () => void
  onViewProposals: (project: ProjectWithClient) => void
  disablePadding?: boolean
  onRowClick?: (project: ProjectWithClient) => void
}

export function ProjectsTable({ 
  data, 
  isLoading, 
  onEdit, 
  onDelete, 
  onAdd,
  onViewProposals,
  disablePadding = true,
  onRowClick,
}: ProjectsTableProps) {
  const [activeTab, setActiveTab] = React.useState("all")

  const filteredData = React.useMemo(() => {
    if (activeTab === "all") return data
    return data.filter(project => project.status === activeTab)
  }, [data, activeTab])

  const tabs = [
    { value: "all", label: "All", badge: data.length },
    { value: "active", label: "Active", badge: data.filter(p => p.status === "active").length },
    { value: "completed", label: "Completed", badge: data.filter(p => p.status === "completed").length },
    { value: "on-hold", label: "On Hold", badge: data.filter(p => p.status === "on-hold").length },
    { value: "cancelled", label: "Cancelled", badge: data.filter(p => p.status === "cancelled").length },
  ]
  
  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "active":
        return <Badge variant="default" className="bg-green-500 hover:bg-green-600">Active</Badge>
      case "completed":
        return <Badge variant="secondary">Completed</Badge>
      case "on-hold":
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600">On Hold</Badge>
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const columns: ColumnDef<ProjectWithClient>[] = [
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
    {
      accessorKey: "name",
      header: "Project Name",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium text-primary">
            {row.original.name}
          </span>
          {row.original.description && (
            <p className="text-xs text-muted-foreground line-clamp-1">
              {row.original.description}
            </p>
          )}
        </div>
      ),
      enableHiding: false,
    },
    {
      id: "client",
      header: "Client",
      accessorFn: (row) => row.clients ? `${row.clients.first_name} ${row.clients.last_name || ""}`.trim() : "No Client",
      cell: ({ row }) => {
        const client = row.original.clients
        return client 
          ? `${client.first_name} ${client.last_name || ""}`.trim()
          : "No Client"
      },
    },
    {
      id: "members",
      header: "Assigned To",
      cell: ({ row }) => {
        const members = row.original.project_members || []
        if (members.length === 0) return <span className="text-muted-foreground text-xs italic">Unassigned</span>
        
        return (
          <div className="flex -space-x-2">
            {members.slice(0, 3).map((member, i) => {
              const name = member.profiles?.full_name || "Unknown"
              return (
                <Avatar key={i} className="h-7 w-7 border-2 border-background ring-0">
                  <AvatarImage src={member.profiles?.avatar_url || ""} />
                  <AvatarFallback className="text-[10px]">
                    {name.split(" ").map(n => n[0]).join("").toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              )
            })}
            {members.length > 3 && (
              <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-medium">
                +{members.length - 3}
              </div>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => getStatusBadge(row.original.status),
    },
    {
      accessorKey: "created_at",
      header: "Created At",
      cell: ({ row }) => row.original.created_at ? new Date(row.original.created_at).toLocaleDateString() : "N/A",
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="data-[state=open]:bg-muted text-muted-foreground flex size-8 p-0"
              size="icon"
            >
              <IconDotsVertical className="size-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => onViewProposals(row.original)}>
              <IconExternalLink className="mr-2 h-4 w-4" /> View Proposals
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(row.original)}>
              <IconEdit className="mr-2 h-4 w-4" /> Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => onDelete(row.original.id)}
            >
              <IconTrash className="mr-2 h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={filteredData}
      isLoading={isLoading}
      searchPlaceholder="Search projects..."
      addLabel="Add Project"
      onAdd={onAdd}
      disablePadding={disablePadding}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onRowClick={onRowClick || onEdit}
    />
  )
}