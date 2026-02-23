import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import { useOrganization } from "@/hooks/use-organization"
import { AREHSOFT_LOGO_BASE64 } from "@/lib/logo-base64"

interface DownloadInvoiceDialogProps {
  invoice: any
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DownloadInvoiceDialog({
  invoice,
  open,
  onOpenChange,
}: DownloadInvoiceDialogProps) {
  const [hideLineItems, setHideLineItems] = React.useState(false)
  const { organization } = useOrganization()

  const handleDownload = () => {
    if (!invoice) return

    try {
      const doc = new jsPDF()
      
      // Header
      doc.addImage(AREHSOFT_LOGO_BASE64, "PNG", 20, 10, 15, 15)
      
      doc.setFontSize(10)
      doc.setTextColor(100)
      doc.text(organization.name || "Arehsoft", 20, 30)
      doc.text(organization.email || "contact@arehsoft.com", 20, 35)
      doc.text(organization.website || "arehsoft.com", 20, 40)
      
      // Invoice Label
      doc.setFontSize(24)
      doc.setTextColor(0)
      doc.text("INVOICE", 190, 20, { align: "right" })
      
      doc.setFontSize(10)
      doc.text(`Invoice #: ${invoice.invoice_number}`, 190, 30, { align: "right" })
      doc.text(`Date: ${new Date(invoice.created_at).toLocaleDateString()}`, 190, 35, { align: "right" })
      if (invoice.due_date) {
        doc.text(`Due Date: ${new Date(invoice.due_date).toLocaleDateString()}`, 190, 40, { align: "right" })
      }
      
      // Client Info
      doc.setFontSize(12)
      doc.text("Bill To:", 20, 55)
      doc.setFontSize(10)
      const client = invoice.clients
      if (client) {
        const fullName = [client.first_name?.trim(), client.last_name?.trim()].filter(Boolean).join(" ")
        doc.text(fullName, 20, 62)
        if (client.email) doc.text(client.email, 20, 67)
      } else {
        doc.text("N/A", 20, 62)
      }
      
      // Table
      const lineItems = invoice.line_items || []
      const tableData = lineItems.length > 0 
        ? lineItems.map((item: any) => {
            const row = [item.description, item.details || ""]
            if (!hideLineItems) {
              row.push(`$${Number(item.price).toLocaleString()}`)
              row.push(item.quantity.toString())
              row.push(`$${(Number(item.price) * Number(item.quantity)).toLocaleString()}`)
            }
            return row
          })
        : [
            (() => {
              const row = ["Project Services", invoice.projects?.name || "Services"]
              if (!hideLineItems) {
                row.push(`$${Number(invoice.amount).toLocaleString()}`)
                row.push("1")
                row.push(`$${Number(invoice.amount).toLocaleString()}`)
              }
              return row
            })()
          ]
      
      const head = ["Description", "Details"]
      if (!hideLineItems) {
        head.push("Price (USD)", "Qty", "Total (USD)")
      }

      autoTable(doc, {
        startY: 90,
        head: [head],
        body: tableData,
        theme: "striped",
        headStyles: { fillColor: [0, 0, 0] },
        margin: { left: 20, right: 20 },
        styles: { fontSize: 9 },
        columnStyles: hideLineItems ? {} : {
          2: { halign: 'right' },
          3: { halign: 'center' },
          4: { halign: 'right' }
        }
      })
      
      const finalY = (doc as any).lastAutoTable.finalY + 15
      
      // Totals
      doc.setFontSize(10)
      doc.setTextColor(100)
      doc.text("Total Amount (USD)", 190, finalY, { align: "right" })
      doc.setFontSize(16)
      doc.setTextColor(0)
      doc.text(`$${Number(invoice.amount).toLocaleString()}`, 190, finalY + 10, { align: "right" })
      
      // Footer
      doc.setFontSize(10)
      doc.setTextColor(100)
      doc.text("Thank you for your business!", 20, finalY + 40)
      
      doc.save(`Invoice-${invoice.invoice_number}.pdf`)
      onOpenChange(false)
    } catch (error) {
      console.error("Error generating PDF:", error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Download Invoice</DialogTitle>
          <DialogDescription>
            Choose your options for the invoice PDF.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="hide-line-items-download" 
              checked={hideLineItems}
              onCheckedChange={(checked) => setHideLineItems(checked === true)}
            />
            <Label 
              htmlFor="hide-line-items-download"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Hide line item price, quantity and totals
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleDownload}>
            Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
