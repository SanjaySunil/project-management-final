import type { ColumnDef } from "@tanstack/react-table"
import { 
  IconDotsVertical,
  IconFileText,
  IconTrash,
  IconEdit,
  IconCalendar,
  IconLayoutKanban
} from "@tabler/icons-react"
import { DataTable } from "@/components/data-table"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Tables } from "@/lib/database.types"

type Document = Tables<"documents">

interface DocumentsTableProps {
  data: Document[]
  onEdit: (doc: Document) => void
  onDelete: (id: string) => void
  onConvertToTasks?: (doc: Document) => void
  onAdd: () => void
  isLoading?: boolean
}

export function DocumentsTable({ 
  data, 
  onEdit, 
  onDelete, 
  onConvertToTasks,
  onAdd,
  isLoading 
}: DocumentsTableProps) {
  const columns: ColumnDef<Document>[] = [
    {
      accessorKey: "title",
      header: "Title",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-primary/10 text-primary">
            <IconFileText className="h-4 w-4" />
          </div>
          <span className="font-medium">{row.original.title}</span>
        </div>
      ),
    },
    {
      accessorKey: "content",
      header: "Preview",
      cell: ({ row }) => {
        const content = row.original.content || ""
        const lines = content.split("\n").filter(l => l.trim() !== "")
        return (
          <div className="max-w-[400px] truncate text-muted-foreground text-sm">
            {lines.length > 0 ? (
              <div className="flex flex-col gap-0.5">
                {lines.slice(0, 2).map((line, i) => (
                  <div key={i} className="flex items-center gap-2 truncate">
                    <div className="h-1 w-1 rounded-full bg-muted-foreground shrink-0" />
                    <span className="truncate">{line}</span>
                  </div>
                ))}
                {lines.length > 2 && <span className="text-xs ml-3">+{lines.length - 2} more...</span>}
              </div>
            ) : (
              "No content"
            )}
          </div>
        )
      },
    },
    {
      accessorKey: "created_at",
      header: "Created At",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
          <IconCalendar className="h-3.5 w-3.5" />
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
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => onEdit(row.original)}>
              <IconEdit className="mr-2 h-4 w-4" /> Edit
            </DropdownMenuItem>
            {onConvertToTasks && (
              <DropdownMenuItem onClick={() => onConvertToTasks(row.original)}>
                <IconLayoutKanban className="mr-2 h-4 w-4" /> Convert to Tasks
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem 
                variant="destructive" 
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
      searchPlaceholder="Search documents..."
      addLabel="New Document"
      onAdd={onAdd}
      isLoading={isLoading}
    />
  )
}
