import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DeliverablesManager, type Deliverable } from "./deliverables-manager"
import type { Tables } from "@/lib/database.types"

type Proposal = Tables<"proposals">

interface ProposalFormProps {
  initialData?: Proposal | null
  initialDeliverables?: Deliverable[]
  onSubmit: (values: any, deliverables: Deliverable[]) => Promise<void>
  onCancel: () => void
  isSubmitting?: boolean
}

export function ProposalForm({
  initialData,
  initialDeliverables = [],
  onSubmit,
  onCancel,
  isSubmitting = false,
}: ProposalFormProps) {
  const [deliverables, setDeliverables] = React.useState<Deliverable[]>(initialDeliverables)

  React.useEffect(() => {
    setDeliverables(initialDeliverables)
  }, [initialDeliverables])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const values = {
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      amount: parseFloat(formData.get("amount") as string) || 0,
      status: formData.get("status") as string,
    }
    await onSubmit(values, deliverables)
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
            placeholder="Briefly describe the proposal..."
            defaultValue={initialData?.description || ""}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount ($)</Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              placeholder="0.00"
              defaultValue={initialData?.amount || ""}
              required
            />
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
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      <hr className="border-border" />

      <DeliverablesManager 
        deliverables={deliverables} 
        onChange={setDeliverables} 
      />

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : initialData ? "Update Proposal" : "Create Proposal"}
        </Button>
      </div>
    </form>
  )
}
