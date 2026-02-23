import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DeliverablesManager, type Deliverable } from "./deliverables-manager"
import { LineItemsManager, type LineItem } from "./line-items-manager"
import type { Tables } from "@/lib/database.types"
import { useAuth } from "@/hooks/use-auth"
import { IconCode, IconClock, IconCreditCard, IconCopy } from "@tabler/icons-react"
import { toast } from "sonner"

const DEFAULT_TECH_FIELDS = [
  { key: "Frontend", value: "Next.js, React, Tailwind" },
  { key: "Backend", value: "Node.js, Supabase" },
]

const DEFAULT_TIMELINE_FIELDS = [
  { key: "Phase 1: Planning", value: "1 week" },
  { key: "Phase 2: Development", value: "3 weeks" },
]

interface KeyValueField {
  id: string
  key: string
  value: string
}

interface SplitItem {
  id: string
  label: string
  percentage: number
}

import { IconPlus, IconTrash } from "@tabler/icons-react"

interface KeyValueTemplateProps {
  label: string
  icon: any
  useTemplate: boolean
  onToggle: () => void
  items: KeyValueField[]
  onAdd: () => void
  onRemove: (id: string) => void
  onChange: (id: string, field: "key" | "value", value: string) => void
  textareaName: string
  textareaPlaceholder: string
  defaultValue?: string
}

function KeyValueTemplate({
  label,
  icon: Icon,
  useTemplate,
  onToggle,
  items,
  onAdd,
  onRemove,
  onChange,
  textareaName,
  textareaPlaceholder,
  defaultValue,
}: KeyValueTemplateProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="size-4 text-primary" />
          {label}
        </Label>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              let text = ""
              if (useTemplate) {
                text = items
                  .filter(item => item.key && item.value)
                  .map(item => `• **${item.key}**: ${item.value}`)
                  .join("\n")
              } else {
                const textarea = document.getElementById(textareaName) as HTMLTextAreaElement
                text = textarea?.value || defaultValue || ""
              }
              navigator.clipboard.writeText(text)
              toast.success(`${label} copied to clipboard`)
            }}
            className="h-7 px-2 text-[10px] uppercase font-bold tracking-wider text-muted-foreground hover:text-foreground"
          >
            <IconCopy className="mr-1.5 size-3" />
            Copy
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="h-7 px-2 text-[10px] uppercase font-bold tracking-wider text-muted-foreground hover:text-foreground"
          >
            {useTemplate ? "Switch to Custom Text" : "Use Structured Template"}
          </Button>
        </div>
      </div>
      {useTemplate ? (
        <div className="space-y-2 p-3 rounded-xl border bg-muted/20 animate-in fade-in slide-in-from-top-1 duration-200">
          {items.map((item) => (
            <div key={item.id} className="flex gap-2 items-start">
              <div className="grid grid-cols-2 gap-2 flex-1">
                <Input
                  placeholder="Key (e.g. Frontend)"
                  value={item.key}
                  onChange={(e) => onChange(item.id, "key", e.target.value)}
                  className="h-8 text-xs bg-background/50 border-muted-foreground/20"
                />
                <Input
                  placeholder="Value (e.g. Next.js)"
                  value={item.value}
                  onChange={(e) => onChange(item.id, "value", e.target.value)}
                  className="h-8 text-xs bg-background/50 border-muted-foreground/20"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onRemove(item.id)}
                className="size-8 text-muted-foreground hover:text-destructive shrink-0"
              >
                <IconTrash className="size-3.5" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAdd}
            className="w-full h-8 border-dashed bg-transparent text-xs gap-1.5"
          >
            <IconPlus className="size-3" />
            Add Field
          </Button>
        </div>
      ) : (
        <Textarea
          id={textareaName}
          name={textareaName}
          placeholder={textareaPlaceholder}
          defaultValue={defaultValue}
          className="min-h-[100px] bg-background/50 border-muted-foreground/20"
        />
      )}
    </div>
  )
}

interface PaymentScheduleTemplateProps {
  useTemplate: boolean
  onToggle: () => void
  splits: SplitItem[]
  onAdd: () => void
  onRemove: (id: string) => void
  onChange: (id: string, field: "label" | "percentage", value: string | number) => void
  totalAmount: number
  textareaName: string
  textareaPlaceholder: string
  defaultValue?: string
}

function PaymentScheduleTemplate({
  useTemplate,
  onToggle,
  splits,
  onAdd,
  onRemove,
  onChange,
  totalAmount,
  textareaName,
  textareaPlaceholder,
  defaultValue,
}: PaymentScheduleTemplateProps) {
  const totalPercentage = splits.reduce((sum, s) => sum + s.percentage, 0)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2 text-sm font-semibold">
          <IconCreditCard className="size-4 text-primary" />
          Payment Schedule
        </Label>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              let text = ""
              if (useTemplate) {
                text = splits
                  .filter(split => split.label && split.percentage > 0)
                  .map(split => {
                    const splitAmount = (split.percentage / 100) * totalAmount
                    return `• **${split.label}**: ${split.percentage}% ($${splitAmount.toFixed(2)})`
                  })
                  .join("\n")
              } else {
                const textarea = document.getElementById(textareaName) as HTMLTextAreaElement
                text = textarea?.value || defaultValue || ""
              }
              navigator.clipboard.writeText(text)
              toast.success("Payment schedule copied to clipboard")
            }}
            className="h-7 px-2 text-[10px] uppercase font-bold tracking-wider text-muted-foreground hover:text-foreground"
          >
            <IconCopy className="mr-1.5 size-3" />
            Copy
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="h-7 px-2 text-[10px] uppercase font-bold tracking-wider text-muted-foreground hover:text-foreground"
          >
            {useTemplate ? "Switch to Custom Text" : "Use Structured Template"}
          </Button>
        </div>
      </div>
      {useTemplate ? (
        <div className="space-y-2 p-3 rounded-xl border bg-muted/20 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="grid grid-cols-12 gap-2 mb-1 px-1">
            <span className="col-span-6 text-[10px] uppercase font-bold text-muted-foreground/70">Milestone / Split</span>
            <span className="col-span-3 text-[10px] uppercase font-bold text-muted-foreground/70 text-right">Percent</span>
            <span className="col-span-3 text-[10px] uppercase font-bold text-muted-foreground/70 text-right">Amount</span>
          </div>
          {splits.map((split) => (
            <div key={split.id} className="flex gap-2 items-center">
              <div className="grid grid-cols-12 gap-2 flex-1">
                <Input
                  placeholder="e.g. Deposit"
                  value={split.label}
                  onChange={(e) => onChange(split.id, "label", e.target.value)}
                  className="col-span-6 h-8 text-xs bg-background/50 border-muted-foreground/20"
                />
                <div className="col-span-3 relative">
                  <Input
                    type="number"
                    placeholder="50"
                    value={split.percentage || ""}
                    onChange={(e) => onChange(split.id, "percentage", parseFloat(e.target.value) || 0)}
                    className="h-8 pr-5 text-right text-xs bg-background/50 border-muted-foreground/20"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">%</span>
                </div>
                <div className="col-span-3 h-8 flex items-center justify-end px-2 rounded-md border border-muted-foreground/10 bg-background/30 text-xs font-medium">
                  ${((split.percentage / 100) * totalAmount).toFixed(2)}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onRemove(split.id)}
                className="size-8 text-muted-foreground hover:text-destructive shrink-0"
              >
                <IconTrash className="size-3.5" />
              </Button>
            </div>
          ))}
          <div className="flex justify-between items-center px-2 py-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onAdd}
              className="h-7 border-dashed bg-transparent text-[10px] gap-1 px-2"
            >
              <IconPlus className="size-3" />
              Add Split
            </Button>
            <div className={`text-[10px] font-bold ${totalPercentage !== 100 ? "text-destructive" : "text-primary"}`}>
              Total: {totalPercentage}%
            </div>
          </div>
        </div>
      ) : (
        <Textarea
          id={textareaName}
          name={textareaName}
          placeholder={textareaPlaceholder}
          defaultValue={defaultValue}
          className="min-h-[100px] bg-background/50 border-muted-foreground/20"
        />
      )}
    </div>
  )
}

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

  const [useTechTemplate, setUseTechTemplate] = React.useState(true)
  const [techStackItems, setTechStackItems] = React.useState<KeyValueField[]>([])

  const [useTimelineTemplate, setUseTimelineTemplate] = React.useState(true)
  const [timelineItems, setTimelineItems] = React.useState<KeyValueField[]>([])

  const [usePaymentTemplate, setUsePaymentTemplate] = React.useState(true)
  const [paymentSplits, setPaymentSplits] = React.useState<SplitItem[]>([])

  React.useEffect(() => {
    setDeliverables(initialDeliverables)

    if (initialData) {
      // Parse Tech Stack
      const tsMatches = initialData.tech_stack?.matchAll(/• \*\*(.*?)\*\*: (.*)/g)
      const tsItems: KeyValueField[] = []
      if (tsMatches) {
        for (const match of tsMatches) {
          tsItems.push({ id: crypto.randomUUID(), key: match[1], value: match[2] })
        }
      }

      if (tsItems.length > 0) {
        setTechStackItems(tsItems)
        setUseTechTemplate(true)
      } else if (initialData.tech_stack) {
        setUseTechTemplate(false)
      } else {
        setTechStackItems(DEFAULT_TECH_FIELDS.map(f => ({ ...f, id: crypto.randomUUID() })))
      }

      // Parse Timeline
      const tlMatches = initialData.timeline?.matchAll(/• \*\*(.*?)\*\*: (.*)/g)
      const tlItems: KeyValueField[] = []
      if (tlMatches) {
        for (const match of tlMatches) {
          tlItems.push({ id: crypto.randomUUID(), key: match[1], value: match[2] })
        }
      }

      if (tlItems.length > 0) {
        setTimelineItems(tlItems)
        setUseTimelineTemplate(true)
      } else if (initialData.timeline) {
        setUseTimelineTemplate(false)
      } else {
        setTimelineItems(DEFAULT_TIMELINE_FIELDS.map(f => ({ ...f, id: crypto.randomUUID() })))
      }

      // Parse Payment Splits
      const pMatches = initialData.payment_schedule?.matchAll(/• \*\*(.*?)\*\*: (.*?) \((.*?)\)/g)
      const pSplits: SplitItem[] = []
      if (pMatches) {
        for (const match of pMatches) {
          pSplits.push({
            id: crypto.randomUUID(),
            label: match[1],
            percentage: parseFloat(match[2].replace("%", "")) || 0
          })
        }
      }

      if (pSplits.length > 0) {
        setPaymentSplits(pSplits)
        setUsePaymentTemplate(true)
      } else if (initialData.payment_schedule) {
        setUsePaymentTemplate(false)
      } else {
        setPaymentSplits([
          { id: crypto.randomUUID(), label: "Initial Deposit", percentage: 50 },
          { id: crypto.randomUUID(), label: "Final Delivery", percentage: 50 },
        ])
      }
    } else {
      // New Phase Defaults
      setTechStackItems(DEFAULT_TECH_FIELDS.map(f => ({ ...f, id: crypto.randomUUID() })))
      setTimelineItems(DEFAULT_TIMELINE_FIELDS.map(f => ({ ...f, id: crypto.randomUUID() })))
      setPaymentSplits([
        { id: crypto.randomUUID(), label: "Initial Deposit", percentage: 50 },
        { id: crypto.randomUUID(), label: "Final Delivery", percentage: 50 },
      ])
    }
  }, [initialDeliverables, initialData])

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

    if (useTechTemplate) {
      values.tech_stack = techStackItems
        .filter(item => item.key && item.value)
        .map(item => `• **${item.key}**: ${item.value}`)
        .join("\n")
    } else {
      values.tech_stack = formData.get("tech_stack") as string
    }

    if (useTimelineTemplate) {
      values.timeline = timelineItems
        .filter(item => item.key && item.value)
        .map(item => `• **${item.key}**: ${item.value}`)
        .join("\n")
    } else {
      values.timeline = formData.get("timeline") as string
    }

    if (usePaymentTemplate) {
      values.payment_schedule = paymentSplits
        .filter(split => split.label && split.percentage > 0)
        .map(split => {
          const splitAmount = (split.percentage / 100) * amount
          return `• **${split.label}**: ${split.percentage}% ($${splitAmount.toFixed(2)})`
        })
        .join("\n")
    } else {
      values.payment_schedule = formData.get("payment_schedule") as string
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
          <div className="flex items-center justify-between">
            <Label htmlFor="description">Description (Executive Summary)</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                const textarea = document.getElementById("description") as HTMLTextAreaElement
                navigator.clipboard.writeText(textarea?.value || "")
                toast.success("Description copied to clipboard")
              }}
              className="h-7 px-2 text-[10px] uppercase font-bold tracking-wider text-muted-foreground hover:text-foreground"
            >
              <IconCopy className="mr-1.5 size-3" />
              Copy
            </Button>
          </div>
          <Textarea
            id="description"
            name="description"
            placeholder="Briefly describe the phase..."
            defaultValue={initialData?.description || ""}
          />
        </div>
        <KeyValueTemplate
          label="Technical Stack & Architecture"
          icon={IconCode}
          useTemplate={useTechTemplate}
          onToggle={() => setUseTechTemplate(!useTechTemplate)}
          items={techStackItems}
          onAdd={() => setTechStackItems([...techStackItems, { id: crypto.randomUUID(), key: "", value: "" }])}
          onRemove={(id) => setTechStackItems(techStackItems.filter(i => i.id !== id))}
          onChange={(id, field, val) => setTechStackItems(techStackItems.map(i => i.id === id ? { ...i, [field]: val } : i))}
          textareaName="tech_stack"
          textareaPlaceholder="Describe the tools, technologies, and architecture..."
          defaultValue={initialData?.tech_stack || ""}
        />

        <KeyValueTemplate
          label="Project Timeline & Milestones"
          icon={IconClock}
          useTemplate={useTimelineTemplate}
          onToggle={() => setUseTimelineTemplate(!useTimelineTemplate)}
          items={timelineItems}
          onAdd={() => setTimelineItems([...timelineItems, { id: crypto.randomUUID(), key: "", value: "" }])}
          onRemove={(id) => setTimelineItems(timelineItems.filter(i => i.id !== id))}
          onChange={(id, field, val) => setTimelineItems(timelineItems.map(i => i.id === id ? { ...i, [field]: val } : i))}
          textareaName="timeline"
          textareaPlaceholder="Outline the key dates and milestones..."
          defaultValue={initialData?.timeline || ""}
        />

        <PaymentScheduleTemplate
          useTemplate={usePaymentTemplate}
          onToggle={() => setUsePaymentTemplate(!usePaymentTemplate)}
          splits={paymentSplits}
          onAdd={() => setPaymentSplits([...paymentSplits, { id: crypto.randomUUID(), label: "", percentage: 0 }])}
          onRemove={(id) => setPaymentSplits(paymentSplits.filter(s => s.id !== id))}
          onChange={(id, field, val) => setPaymentSplits(paymentSplits.map(s => s.id === id ? { ...s, [field]: val } : s))}
          totalAmount={amount}
          textareaName="payment_schedule"
          textareaPlaceholder="Details about payment terms and schedule..."
          defaultValue={initialData?.payment_schedule || ""}
        />
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

      <div className="flex flex-col sm:flex-row justify-between gap-3 pt-4 border-t">
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            const titleInput = document.getElementById("title") as HTMLInputElement
            const title = titleInput?.value || initialData?.title || "Untitled Phase"

            let techStack = ""
            if (useTechTemplate) {
              techStack = techStackItems
                .filter(item => item.key && item.value)
                .map(item => `• **${item.key}**: ${item.value}`)
                .join("\n")
            } else {
              const textarea = document.getElementById("tech_stack") as HTMLTextAreaElement
              techStack = textarea?.value || initialData?.tech_stack || ""
            }

            const deliverablesText = deliverables
              .filter(d => d.title)
              .map((d, i) => `${i + 1}. ${d.title}${d.description ? `: ${d.description}` : ""}`)
              .join("\n")

            const fullProposal = `PHASE: ${title}\n\nTECHNICAL STACK & ARCHITECTURE\n${techStack}\n\nDELIVERABLES\n${deliverablesText}`

            navigator.clipboard.writeText(fullProposal)
            toast.success("Proposal copied to clipboard")
          }}
          className="h-9 gap-1.5 text-muted-foreground hover:text-foreground order-2 sm:order-1"
        >
          <IconCopy className="size-4" />
          Copy Proposal
        </Button>

        <div className="flex gap-3 order-1 sm:order-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting} className="flex-1 sm:flex-none">
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting} className="flex-1 sm:flex-none">
            {isSubmitting ? "Saving..." : initialData ? "Update Phase" : "Create Phase"}
          </Button>
        </div>
      </div>
    </form>
  )
}
