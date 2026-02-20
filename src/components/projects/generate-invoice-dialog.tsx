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
import { Checkbox } from "@/components/ui/checkbox"
import { getNextInvoiceNumber } from "@/lib/invoices"
import { toast } from "sonner"

interface GenerateInvoiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (invoiceNumber: string, hideLineItems: boolean) => Promise<void>
  initialInvoiceNumber?: string
  isSubmitting?: boolean
}

export function GenerateInvoiceDialog({
  open,
  onOpenChange,
  onConfirm,
  isSubmitting
}: GenerateInvoiceDialogProps) {
  const [invoiceNumber, setInvoiceNumber] = React.useState("")
  const [hideLineItems, setHideLineItems] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      const fetchNextNumber = async () => {
        setIsLoading(true)
        try {
          const next = await getNextInvoiceNumber()
          setInvoiceNumber(next)
        } catch (error) {
          console.error("Error fetching next invoice number:", error)
          toast.error("Failed to fetch next invoice number")
        } finally {
          setIsLoading(false)
        }
      }
      fetchNextNumber()
    }
  }, [open])

  const handleConfirm = async () => {
    if (!invoiceNumber.trim()) {
      toast.error("Invoice number is required")
      return
    }
    await onConfirm(invoiceNumber, hideLineItems)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Generate Invoice</DialogTitle>
          <DialogDescription>
            Please confirm the invoice number. You can manually override it if needed.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="invoice-number">Invoice Number</Label>
            <Input
              id="invoice-number"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="INV-0001"
              disabled={isLoading || isSubmitting}
            />
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="hide-line-items" 
              checked={hideLineItems}
              onCheckedChange={(checked) => setHideLineItems(checked === true)}
              disabled={isSubmitting}
            />
            <Label 
              htmlFor="hide-line-items"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Hide line item price, quantity and totals
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading || isSubmitting}>
            {isSubmitting ? "Generating..." : "Generate & Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
