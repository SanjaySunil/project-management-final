import { useEffect, useState } from "react"
import { PageContainer } from "@/components/page-container"
import { SEO } from "@/components/seo"
import { supabase } from "@/lib/supabase"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { DataTable } from "@/components/data-table"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import { 
  FileText,
  Download,
  Trash2,
  MoreHorizontal,
  Edit2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { useAuth } from "@/hooks/use-auth"
import { EditInvoiceModal } from "@/components/invoices/edit-invoice-modal"
import { DownloadInvoiceDialog } from "@/components/invoices/download-invoice-dialog"
import type { Tables } from "@/lib/database.types"

export default function InvoicesPage() {
  const { isAdmin } = useAuth()
  const [loading, setLoading] = useState(true)
  const [invoices, setInvoices] = useState<any[]>([])
  const [selectedInvoice, setSelectedInvoice] = useState<Tables<"invoices"> | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDownloadDialogOpen, setIsDownloadDialogOpen] = useState(false)
  const [invoiceToDownload, setInvoiceToDownload] = useState<any>(null)

  const fetchInvoices = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("invoices")
        .select(`
          *,
          projects (name),
          clients (first_name, last_name, email)
        `)
        .order("created_at", { ascending: false })

      if (error) throw error
      setInvoices(data || [])
    } catch (error) {
      console.error("Error fetching invoices:", error)
      toast.error("Failed to load invoices")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInvoices()
  }, [])

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this invoice?")) return

    try {
      const { error } = await supabase
        .from("invoices")
        .delete()
        .eq("id", id)

      if (error) throw error
      toast.success("Invoice deleted")
      fetchInvoices()
    } catch (error) {
      console.error("Error deleting invoice:", error)
      toast.error("Failed to delete invoice")
    }
  }

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const { error } = await supabase
        .from("invoices")
        .update({ status })
        .eq("id", id)

      if (error) throw error
      toast.success("Invoice status updated")
      fetchInvoices()
    } catch (error) {
      console.error("Error updating invoice status:", error)
      toast.error("Failed to update status")
    }
  }

  const handleDownloadClick = (invoice: any) => {
    setInvoiceToDownload(invoice)
    setIsDownloadDialogOpen(true)
  }

  const columns = [
    {
      accessorKey: "invoice_number",
      header: "Invoice #",
      cell: ({ row }: any) => <span className="font-mono font-medium">{row.getValue("invoice_number")}</span>
    },
    {
      accessorKey: "projects.name",
      header: "Project",
      cell: ({ row }: any) => row.original.projects?.name || "N/A"
    },
    {
      accessorKey: "clients",
      header: "Client",
      cell: ({ row }: any) => {
        const client = row.original.clients
        if (!client) return "N/A"
        return [client.first_name?.trim(), client.last_name?.trim()].filter(Boolean).join(" ")
      }
    },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: ({ row }: any) => formatCurrency(row.getValue("amount"))
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }: any) => {
        const status = row.getValue("status")
        if (!isAdmin) {
          return (
            <Badge 
              variant={
                status === "paid" ? "default" : 
                status === "sent" ? "secondary" : "outline"
              } 
              className="capitalize"
            >
              {status}
            </Badge>
          )
        }
        return (
          <Select
            value={status}
            onValueChange={(value) => handleStatusChange(row.original.id, value)}
          >
            <SelectTrigger className="h-8 w-[110px] capitalize">
              <SelectValue>{status}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft" className="capitalize">Draft</SelectItem>
              <SelectItem value="sent" className="capitalize">Sent</SelectItem>
              <SelectItem value="paid" className="capitalize">Paid</SelectItem>
              <SelectItem value="cancelled" className="capitalize">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        )
      }
    },
    {
      accessorKey: "created_at",
      header: "Date",
      cell: ({ row }: any) => new Date(row.getValue("created_at")).toLocaleDateString()
    },
    {
      id: "actions",
      cell: ({ row }: any) => {
        const invoice = row.original
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleDownloadClick(invoice)}>
                <Download className="mr-2 h-4 w-4" /> Download
              </DropdownMenuItem>
              {isAdmin && (
                <>
                  <DropdownMenuItem onClick={() => {
                    setSelectedInvoice(invoice)
                    setIsEditModalOpen(true)
                  }}>
                    <Edit2 className="mr-2 h-4 w-4" /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDelete(invoice.id)} className="text-red-600">
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      }
    }
  ]

  if (!isAdmin) {
    return (
      <PageContainer>
        <div className="flex h-[400px] flex-col items-center justify-center gap-2">
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground">You do not have permission to view this page.</p>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <SEO title="Invoices" description="Manage and track your invoices." />
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
            <p className="text-muted-foreground">Manage and track all your project invoices.</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable 
              columns={columns} 
              data={invoices} 
              isLoading={loading}
              searchPlaceholder="Search invoices..."
            />
            {invoices.length === 0 && !loading && (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <FileText className="mx-auto h-12 w-12 opacity-20" />
                  <h3 className="mt-4 text-lg font-semibold">No invoices found</h3>
                  <p className="text-sm">Invoices you generate will appear here.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <EditInvoiceModal
        invoice={selectedInvoice}
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        onSuccess={fetchInvoices}
      />

      <DownloadInvoiceDialog
        invoice={invoiceToDownload}
        open={isDownloadDialogOpen}
        onOpenChange={setIsDownloadDialogOpen}
      />
    </PageContainer>
  )
}
