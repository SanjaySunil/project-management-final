import { useState, useEffect } from "react"
import { PageContainer } from "@/components/page-container"
import { SEO } from "@/components/seo"
import { DataTable } from "@/components/data-table"
import { supabase } from "@/lib/supabase"
import type { Tables } from "@/lib/database.types"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import type { ColumnDef } from "@tanstack/react-table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"

type Ticket = Tables<"tickets"> & {
  profiles: {
    full_name: string | null
    email: string | null
  } | null
}

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTickets = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("tickets")
        .select("*, profiles(full_name, email)")
        .order("created_at", { ascending: false })

      if (error) throw error
      setTickets(data as Ticket[])
    } catch (error: any) {
      console.error("Error fetching tickets:", error)
      toast.error("Failed to load tickets")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTickets()
  }, [])

  const updateTicketStatus = async (ticketId: string, status: string) => {
    try {
      const { error } = await supabase
        .from("tickets")
        .update({ status })
        .eq("id", ticketId)

      if (error) throw error
      
      setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status } : t))
      toast.success("Ticket status updated")
    } catch (error: any) {
      console.error("Error updating ticket status:", error)
      toast.error("Failed to update status")
    }
  }

  const columns: ColumnDef<Ticket>[] = [
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => (
        <Badge variant={row.original.type === "bug" ? "destructive" : "default"}>
          {row.original.type}
        </Badge>
      ),
    },
    {
      accessorKey: "title",
      header: "Title",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.title}</span>
          <span className="text-xs text-muted-foreground truncate max-w-[300px]">
            {row.original.description}
          </span>
        </div>
      ),
    },
    {
      id: "user",
      header: "Submitted By",
      cell: ({ row }) => (
        <div className="flex flex-col text-sm">
          <span>{row.original.profiles?.full_name || "Unknown"}</span>
          <span className="text-xs text-muted-foreground">{row.original.profiles?.email}</span>
        </div>
      ),
    },
    {
      accessorKey: "priority",
      header: "Priority",
      cell: ({ row }) => {
        const priority = row.original.priority
        return (
          <Badge variant="outline" className={
            priority === "high" ? "border-red-500 text-red-500" :
            priority === "medium" ? "border-amber-500 text-amber-500" :
            "border-blue-500 text-blue-500"
          }>
            {priority}
          </Badge>
        )
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Select
          defaultValue={row.original.status}
          onValueChange={(value) => updateTicketStatus(row.original.id, value)}
        >
          <SelectTrigger className="h-8 w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      ),
    },
    {
      accessorKey: "created_at",
      header: "Date",
      cell: ({ row }) => format(new Date(row.original.created_at), "MMM d, yyyy"),
    },
  ]

  return (
    <PageContainer>
      <SEO title="Support Tickets" description="Manage bug reports and feature requests from users." />
      <div className="flex flex-1 flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Support Tickets</h1>
        </div>

        <div className="flex-1">
          <DataTable
            columns={columns}
            data={tickets}
            isLoading={loading}
            searchPlaceholder="Filter tickets..."
          />
        </div>
      </div>
    </PageContainer>
  )
}
