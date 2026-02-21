import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DeliverablesManager, type Deliverable } from "./deliverables-manager"
import { LineItemsManager, type LineItem } from "./line-items-manager"
import type { Tables } from "@/lib/database.types"
import { useAuth } from "@/hooks/use-auth"

type Phase = Tables<"phases">

interface PhaseFormProps {
  initialData?: Phase | null
  initialDeliverables?: Deliverable[]
  onSubmit: (values: any, deliverables: Deliverable[], lineItems: LineItem[]) => Promise<void>
  onCancel: () => void
  isSubmitting?: boolean
}

export function PhaseForm({
  initialData,
  initialDeliverables = [],
  onSubmit,
  onCancel,
  isSubmitting = false,
}: PhaseFormProps) {
  const { role } = useAuth()
  const isAdmin = role === "admin"
  const [deliverables, setDeliverables] = React.useState<Deliverable[]>(initialDeliverables)
  const [lineItems, setLineItems] = React.useState<LineItem[]>((initialData as any)?.invoice_line_items || [])
  const [orderSource, setOrderSource] = React.useState<string>(initialData?.order_source || "direct")
  const [amount, setAmount] = React.useState<number>(Number(initialData?.amount) || 0)

  React.useEffect(() => {
    setDeliverables(initialDeliverables)
  }, [initialDeliverables])

  const commissionRate = orderSource === "fiverr" ? 0.20 : 0
  const commissionAmount = amount * commissionRate
  const netAmount = amount - commissionAmount

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const values: any = {
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      status: formData.get("status") as string,
      order_source: orderSource,
    }

    if (isAdmin) {
      values.amount = amount
      values.commission_rate = commissionRate
      values.commission_amount = commissionAmount
      values.net_amount = netAmount
    }

    await onSubmit(values, deliverables, lineItems)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pt-4">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            name="title"
            placeholder="e.g. Website Redesign Phase 1"
            defaultValue={initialData?.title}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            name="description"
            placeholder="Briefly describe the phase..."
            defaultValue={initialData?.description || ""}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="order_source">Order Source</Label>
            <select
              id="order_source"
              name="order_source"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={orderSource}
              onChange={(e) => setOrderSource(e.target.value)}
            >
              <option value="direct">Direct (Bank Transfer)</option>
              <option value="fiverr">Fiverr</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              name="status"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              defaultValue={initialData?.status || "draft"}
            >
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="active">Active</option>
              <option value="on_hold">On Hold</option>
              <option value="complete">Complete</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
        
        {isAdmin && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Gross Amount ($)</Label>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={amount || ""}
                  onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                  required
                />
              </div>
              {orderSource === "fiverr" && (
                <div className="space-y-2">
                  <Label>Commission (20%)</Label>
                  <div className="h-10 flex items-center px-3 rounded-md border border-input bg-muted/50 text-sm">
                    -${commissionAmount.toFixed(2)}
                  </div>
                </div>
              )}
            </div>
            {orderSource === "fiverr" && (
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/10 flex justify-between items-center">
                <span className="text-sm font-medium">Net Revenue</span>
                <span className="text-lg font-bold text-primary">${netAmount.toFixed(2)}</span>
              </div>
            )}
          </>
        )}
      </div>

      <hr className="border-border" />

      <DeliverablesManager 
        deliverables={deliverables} 
        onChange={setDeliverables} 
      />

      <hr className="border-border" />

      <LineItemsManager
        lineItems={lineItems}
        onChange={setLineItems}
      />

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : initialData ? "Update Phase" : "Create Phase"}
        </Button>
      </div>
    </form>
  )
}
