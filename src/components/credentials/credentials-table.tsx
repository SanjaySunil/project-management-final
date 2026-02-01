import * as React from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { 
  IconDotsVertical,
  IconEdit,
  IconTrash,
  IconCopy,
  IconEye,
  IconEyeOff
} from "@tabler/icons-react"
import { toast } from "sonner"

import { DataTable } from "@/components/data-table"
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
import type { Tables } from "@/lib/database.types"

// Define a type for credentials with project info
export type CredentialWithProject = Tables<"credentials"> & {
  projects: {
    name: string
  } | null
}

interface CredentialsTableProps {
  data: CredentialWithProject[]
  isLoading?: boolean
  onEdit: (credential: CredentialWithProject) => void
  onDelete: (id: string) => void
  onAdd: () => void
  onRowClick?: (credential: CredentialWithProject) => void
}

export function CredentialsTable({ 
  data, 
  isLoading, 
  onEdit, 
  onDelete, 
  onAdd,
  onRowClick
}: CredentialsTableProps) {
  const [visibleValues, setVisibleValues] = React.useState<Record<string, boolean>>({})

  const toggleVisibility = (id: string) => {
    setVisibleValues(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success("Copied to clipboard")
  }

  const columns: ColumnDef<CredentialWithProject>[] = [
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
      header: "Name",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium text-primary">
            {row.original.name}
          </span>
          {row.original.notes && (
            <p className="text-xs text-muted-foreground line-clamp-1">
              {row.original.notes}
            </p>
          )}
        </div>
      ),
      enableHiding: false,
    },
    {
      id: "project",
      header: "Project",
      accessorFn: (row) => row.projects?.name || "No Project",
      cell: ({ row }) => row.original.projects?.name || "No Project",
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => (
        <Badge variant="outline">{row.original.type}</Badge>
      ),
    },
    {
      accessorKey: "value",
      header: "Value",
      cell: ({ row }) => {
        const isVisible = visibleValues[row.original.id]
        let displayValue = row.original.value

        if (row.original.type === "Email Password") {
          try {
            const parsed = JSON.parse(row.original.value)
            displayValue = `${parsed.email} | ${parsed.password}`
          } catch (e) {
            // fallback to raw value if not valid JSON
          }
        }

        return (
          <div className="flex items-center gap-2">
            <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono max-w-[200px] truncate">
              {isVisible ? displayValue : "••••••••••••••••"}
            </code>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6" 
              onClick={() => toggleVisibility(row.original.id)}
            >
              {isVisible ? <IconEyeOff className="h-3 w-3" /> : <IconEye className="h-3 w-3" />}
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6" 
              onClick={() => copyToClipboard(displayValue)}
            >
              <IconCopy className="h-3 w-3" />
            </Button>
          </div>
        )
      },
    },
    {
      accessorKey: "created_at",
      header: "Added",
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
            <DropdownMenuItem onClick={() => onEdit(row.original)}>
              <IconEdit className="mr-2 h-4 w-4" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => copyToClipboard(row.original.value)}>
              <IconCopy className="mr-2 h-4 w-4" /> Copy Value
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
      data={data}
      isLoading={isLoading}
      searchPlaceholder="Search credentials..."
      addLabel="Add Credential"
      onAdd={onAdd}
      onRowClick={onRowClick}
    />
  )
}
