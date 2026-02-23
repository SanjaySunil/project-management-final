import * as React from "react"
import { Link } from "react-router-dom"
import { IconExternalLink, IconFileText, IconChecklist, IconCurrencyDollar, IconCopy } from "@tabler/icons-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import type { Tables } from "@/lib/database.types"
import { supabase } from "@/lib/supabase"
import type { Deliverable } from "./deliverables-manager"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"

interface PhaseDetailsModalProps {
  phase: Tables<"phases"> | null
  isOpen: boolean
  onClose: () => void
  projectId: string
}

export function PhaseDetailsModal({ phase, isOpen, onClose, projectId }: PhaseDetailsModalProps) {
  const [deliverables, setDeliverables] = React.useState<Deliverable[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const { role } = useAuth()
  const isAdmin = role === "admin"

  React.useEffect(() => {
    if (phase && isOpen) {
      const fetchDeliverables = async () => {
        setIsLoading(true)
        try {
          const { data, error } = await supabase
            .from("deliverables")
            .select("*")
            .eq("phase_id", phase.id)
            .order("order_index", { ascending: true })

          if (error) throw error
          setDeliverables(data || [])
        } catch (error) {
          console.error("Error fetching deliverables:", error)
        } finally {
          setIsLoading(false)
        }
      }
      fetchDeliverables()
    }
  }, [phase, isOpen])

  if (!phase) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <IconFileText className="h-5 w-5" />
              </div>
              <DialogTitle className="text-xl truncate">{phase.title}</DialogTitle>
            </div>
            <Badge variant={
              phase.status === 'complete' ? 'default' :
                phase.status === 'on_hold' ? 'outline' :
                  'outline'
            } className={cn(
              "capitalize shrink-0",
              phase.status === 'on_hold' && "text-yellow-600 border-yellow-600"
            )}>
              {(phase.status || 'draft').replace("_", " ")}
            </Badge>
          </div>
          <DialogDescription>
            {phase.created_at ? `Created on ${new Date(phase.created_at).toLocaleDateString()}` : 'Phase details'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center justify-between">
              <span className="flex items-center gap-2">Description</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  navigator.clipboard.writeText(phase.description || "")
                  toast.success("Description copied to clipboard")
                }}
              >
                <IconCopy className="h-3.5 w-3.5" />
              </Button>
            </h4>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {phase.description || "No description provided."}
            </p>
          </div>

          {phase.tech_stack && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                <span className="flex items-center gap-2">Technical Stack & Architecture</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    navigator.clipboard.writeText(phase.tech_stack || "")
                    toast.success("Technical stack copied to clipboard")
                  }}
                >
                  <IconCopy className="h-3.5 w-3.5" />
                </Button>
              </h4>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {phase.tech_stack}
              </p>
            </div>
          )}

          {phase.timeline && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                <span className="flex items-center gap-2">Project Timeline & Milestones</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    navigator.clipboard.writeText(phase.timeline || "")
                    toast.success("Timeline copied to clipboard")
                  }}
                >
                  <IconCopy className="h-3.5 w-3.5" />
                </Button>
              </h4>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {phase.timeline}
              </p>
            </div>
          )}

          {phase.payment_schedule && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                <span className="flex items-center gap-2">Payment Schedule</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    navigator.clipboard.writeText(phase.payment_schedule || "")
                    toast.success("Payment schedule copied to clipboard")
                  }}
                >
                  <IconCopy className="h-3.5 w-3.5" />
                </Button>
              </h4>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {phase.payment_schedule}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {isAdmin && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconCurrencyDollar className="h-4 w-4" />
                  Financial Details
                </h4>
                <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Total Amount:</span>
                    <span className="font-semibold">${phase.amount?.toLocaleString()}</span>
                  </div>
                  {phase.order_source === "fiverr" && (
                    <>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Commission ({phase.commission_rate}%):</span>
                        <span className="text-destructive">-${phase.commission_amount?.toLocaleString()}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between items-center text-sm font-bold">
                        <span>Net Amount:</span>
                        <span className="text-primary">${phase.net_amount?.toLocaleString()}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">Information</h4>
              <div className="grid gap-2">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Order Source</span>
                  <Badge variant="secondary" className="w-fit capitalize">{phase.order_source || 'Direct'}</Badge>
                </div>
                {phase.updated_at && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Last Updated</span>
                    <span className="text-sm">{new Date(phase.updated_at).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <IconChecklist className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-medium">Deliverables</h4>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  const text = deliverables
                    .map((d, i) => `${i + 1}. ${d.title}${d.description ? `: ${d.description}` : ""}`)
                    .join("\n")
                  navigator.clipboard.writeText(text)
                  toast.success("Deliverables copied to clipboard")
                }}
              >
                <IconCopy className="h-3.5 w-3.5" />
              </Button>
            </div>
            {isLoading ? (
              <div className="space-y-2">
                <div className="h-12 w-full animate-pulse bg-muted rounded-lg" />
                <div className="h-12 w-full animate-pulse bg-muted rounded-lg" />
              </div>
            ) : deliverables.length > 0 ? (
              <div className="grid gap-3">
                {deliverables.map((d) => (
                  <div key={d.id} className="rounded-lg border bg-card p-3 shadow-sm space-y-1">
                    <p className="text-sm font-medium">{d.title}</p>
                    {d.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{d.description}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-center">
                <p className="text-sm text-muted-foreground italic">No deliverables listed.</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 mt-4">
          <Button variant="ghost" onClick={onClose} className="sm:w-24">
            Close
          </Button>
          <Button asChild className="gap-2 sm:px-8">
            <Link to={`/dashboard/projects/${projectId}/phases/${phase.id}`}>
              <IconExternalLink className="h-4 w-4" />
              Phase Work
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
