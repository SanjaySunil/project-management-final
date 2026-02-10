import * as React from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { 
  IconDotsVertical,
  IconEdit,
  IconTrash,
  IconExternalLink,
  IconPlus,
  IconCheck,
  IconBrandGithub,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import type { Tables } from "@/lib/database.types"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"

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
  profiles?: Tables<"profiles">[]
  isLoading?: boolean
  onEdit: (project: ProjectWithClient) => void
  onDelete: (id: string) => void
  onAdd: () => void
  onViewPhases: (project: ProjectWithClient) => void
  disablePadding?: boolean
  onRowClick?: (project: ProjectWithClient) => void
  onAssignMembers?: (projectId: string, memberIds: string[]) => Promise<void>
  defaultTab?: string
}

export function ProjectsTable({ 
  data, 
  profiles = [],
  isLoading, 
  onEdit, 
  onDelete, 
  onAdd,
  onViewPhases,
  disablePadding = true,
  onRowClick,
  onAssignMembers,
  defaultTab = "all",
}: ProjectsTableProps) {
  const { checkPermission } = useAuth()
  const [activeTab, setActiveTab] = React.useState(defaultTab)

  const canCreate = checkPermission('create', 'projects')
  const canUpdate = checkPermission('update', 'projects')
  const canDelete = checkPermission('delete', 'projects')

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
      id: "repos",
      header: "GitHub Repo",
      cell: ({ row }) => {
        const source = row.original.source_repo
        
        if (!source) return <span className="text-muted-foreground text-xs italic">N/A</span>
        
        return (
          <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
            <a 
              href={`https://github.com/${source}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <IconBrandGithub className="h-4 w-4" />
              <span className="truncate max-w-[150px]">{source.split('/').pop()}</span>
            </a>
          </div>
        )
      },
    },
    {
      id: "members",
      header: "Assigned To",
      cell: ({ row }) => {
        const members = row.original.project_members || []
        const currentMemberIds = members.map(m => m.user_id)
        
        return (
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex -space-x-2 overflow-hidden">
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
            
            {canUpdate && onAssignMembers && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7 rounded-full border border-dashed border-muted-foreground/50 hover:border-muted-foreground"
                  >
                    <IconPlus className="h-3.5 w-3.5" />
                    <span className="sr-only">Assign members</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search team..." />
                    <CommandList>
                      <CommandEmpty>No one found.</CommandEmpty>
                      <CommandGroup>
                        {profiles.map((profile) => (
                          <CommandItem
                            key={profile.id}
                            onSelect={() => {
                              const newIds = currentMemberIds.includes(profile.id)
                                ? currentMemberIds.filter(id => id !== profile.id)
                                : [...currentMemberIds, profile.id]
                              onAssignMembers(row.original.id, newIds)
                            }}
                          >
                            <div className="flex items-center gap-2 flex-1">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={profile.avatar_url || undefined} />
                                <AvatarFallback className="text-[10px]">
                                  {(profile.full_name || profile.email || "?").charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="truncate">{profile.full_name || profile.email}</span>
                            </div>
                            <IconCheck
                              className={cn(
                                "ml-auto h-4 w-4",
                                currentMemberIds.includes(profile.id)
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}
            
            {members.length === 0 && !canUpdate && (
              <span className="text-muted-foreground text-xs italic">Unassigned</span>
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
      id: "updated_at",
      header: "Last Updated",
      accessorFn: (row) => row.updated_at || row.created_at,
      cell: ({ row }) => {
        const date = row.original.updated_at || row.original.created_at
        if (!date) return "N/A"
        
        const d = new Date(date)
        return (
          <div className="flex flex-col">
            <span>{d.toLocaleDateString()}</span>
            <span className="text-[10px] text-muted-foreground">
              {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )
      },
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
            <DropdownMenuItem onClick={() => onViewPhases(row.original)}>
              <IconExternalLink className="mr-2 h-4 w-4" /> View Phases
            </DropdownMenuItem>
            
            {canUpdate && (
              <DropdownMenuItem onClick={() => onEdit(row.original)}>
                <IconEdit className="mr-2 h-4 w-4" /> Edit
              </DropdownMenuItem>
            )}

            {canDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => onDelete(row.original.id)}
                >
                  <IconTrash className="mr-2 h-4 w-4" /> Delete
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
      data={filteredData}
      isLoading={isLoading}
      searchPlaceholder="Search projects..."
      addLabel="Add Project"
      onAdd={canCreate ? onAdd : undefined}
      disablePadding={disablePadding}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onRowClick={onRowClick || onViewPhases}
    />
  )
}