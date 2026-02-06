import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ProposalDetails } from "./proposal-details"

interface ProposalDetailsModalProps {
  projectId: string
  proposalId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ProposalDetailsModal({ projectId, proposalId, open, onOpenChange }: ProposalDetailsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[95vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>Proposal Details</DialogTitle>
          <DialogDescription>
            View proposal overview, kanban board, and messages.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto p-6 pt-2">
          {proposalId && (
            <ProposalDetails projectId={projectId} proposalId={proposalId} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
