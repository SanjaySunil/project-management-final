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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { LineItemsManager, type LineItem } from "@/components/projects/line-items-manager"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { format } from "date-fns"
import type { Tables } from "@/lib/database.types"

interface EditInvoiceModalProps {
  invoice: Tables<"invoices"> | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function EditInvoiceModal({
  invoice,
  open,
  onOpenChange,
  onSuccess,
}: EditInvoiceModalProps) {
  const [loading, setLoading] = React.useState(false)
  const [invoiceNumber, setInvoiceNumber] = React.useState("")
  const [dueDate, setDueDate] = React.useState("")
  const [status, setStatus] = React.useState("")
  const [notes, setNotes] = React.useState("")
  const [lineItems, setLineItems] = React.useState<LineItem[]>([])

  React.useEffect(() => {
    if (invoice && open) {
      setInvoiceNumber(invoice.invoice_number || "")
      setDueDate(invoice.due_date ? format(new Date(invoice.due_date), "yyyy-MM-dd") : "")
      setStatus(invoice.status || "draft")
      setNotes(invoice.notes || "")
      setLineItems((invoice.line_items as unknown as LineItem[]) || [])
    }
  }, [invoice, open])

  const calculateTotal = (items: LineItem[]) => {
    return items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0)
  }

  const handleSave = async () => {
    if (!invoice || !invoiceNumber.trim()) {
      toast.error("Invoice number is required")
      return
    }

    setLoading(true)
    try {
      const amount = calculateTotal(lineItems)
      
      const { error } = await supabase
        .from("invoices")
        .update({
          invoice_number: invoiceNumber,
          due_date: dueDate || null,
          status,
          notes,
          line_items: lineItems as any,
          amount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", invoice.id)

      if (error) throw error

      // If invoice is linked to a phase, update the phase as well
      if (invoice.phase_id) {
        await supabase
          .from("phases")
          .update({
            invoice_line_items: lineItems as any,
            amount: amount,
          })
          .eq("id", invoice.phase_id)
      }

      toast.success("Invoice updated successfully")
      onSuccess()
      onOpenChange(false)
    } catch (error) {
      console.error("Error updating invoice:", error)
      toast.error("Failed to update invoice")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Invoice</DialogTitle>
          <DialogDescription>
            Update the invoice details below. The total amount will be calculated automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="invoice_number">Invoice Number</Label>
              <Input
                id="invoice_number"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="due_date">Due Date</Label>
              <Input
                id="due_date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <LineItemsManager 
            lineItems={lineItems} 
            onChange={setLineItems} 
          />

          <div className="flex justify-end items-center gap-2 pt-2 border-t font-semibold">
            <span>Total Amount:</span>
            <span className="text-xl">
              ${calculateTotal(lineItems).toLocaleString()}
            </span>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes or payment instructions..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
