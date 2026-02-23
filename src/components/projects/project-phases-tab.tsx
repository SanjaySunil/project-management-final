import * as React from "react"
import { toast } from "sonner"
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import { supabase } from "@/lib/supabase"
import { useOrganization } from "@/hooks/use-organization"
import type { Tables } from "@/lib/database.types"
import { PhasesTable } from "@/components/projects/phases-table"
import { PhaseForm } from "@/components/projects/phase-form"
import { PhaseDetailsModal } from "@/components/projects/phase-details-modal"
import type { Deliverable } from "@/components/projects/deliverables-manager"
import type { LineItem } from "@/components/projects/line-items-manager"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Button } from "@/components/ui/button"
import { IconFileText } from "@tabler/icons-react"
import { updateProjectStatus } from "@/lib/projects"
import { slugify } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import { GenerateInvoiceDialog } from "./generate-invoice-dialog"
import { AREHSOFT_LOGO_BASE64 } from "@/lib/logo-base64"

type Phase = Tables<"phases">

interface ProjectPhasesTabProps {
  projectId: string
}

export function ProjectPhasesTab({ projectId }: ProjectPhasesTabProps) {
  const { organization } = useOrganization()
  const { role } = useAuth()
  const isAdmin = role === "admin"
  const [phases, setPhases] = React.useState<Phase[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [editingPhase, setEditingPhase] = React.useState<Phase | null>(null)
  const [viewingPhase, setViewingPhase] = React.useState<Phase | null>(null)
  const [isViewModalOpen, setIsViewModalOpen] = React.useState(false)
  const [deliverables, setDeliverables] = React.useState<Deliverable[]>([])
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false)
  const [phaseToDelete, setPhaseToDelete] = React.useState<string | null>(null)
  const [rowSelection, setRowSelection] = React.useState<Record<string, boolean>>({})

  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = React.useState(false)
  const [phaseForInvoice, setPhaseForInvoice] = React.useState<Phase | null>(null)
  const [isGeneratingInvoice, setIsGeneratingInvoice] = React.useState(false)

  const selectedPhases = React.useMemo(() => {
    return phases.filter(p => rowSelection[p.id])
  }, [phases, rowSelection])

  const handleGenerateInvoice = async (phase: Phase) => {
    setPhaseForInvoice(phase)
    setIsInvoiceDialogOpen(true)
  }

  const handleExportProposal = async (phase: Phase) => {
    try {
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select(`
          name,
          clients (
            first_name,
            last_name,
            email
          )
        `)
        .eq("id", projectId)
        .single()

      if (projectError) throw projectError

      const { data: deliverables, error: deliverablesError } = await supabase
        .from("deliverables")
        .select("*")
        .eq("phase_id", phase.id)
        .order("order_index", { ascending: true })

      if (deliverablesError) throw deliverablesError

      const doc = new jsPDF()
      const client: any = project.clients

      // Header
      doc.addImage(AREHSOFT_LOGO_BASE64, "PNG", 20, 10, 15, 15)

      doc.setFontSize(22)
      doc.setTextColor(0, 0, 0)
      doc.text("PROJECT PROPOSAL", 190, 20, { align: "right" })

      doc.setFontSize(10)
      doc.setTextColor(100)
      doc.text(organization.name || "Arehsoft", 20, 30)
      doc.text(organization.email || "contact@arehsoft.com", 20, 35)

      // Proposal Date
      doc.setFontSize(10)
      doc.setTextColor(0)
      doc.text(`Date: ${new Date().toLocaleDateString()}`, 190, 30, { align: "right" })

      // Client Info
      doc.setFontSize(12)
      doc.text("Prepared For:", 20, 50)
      doc.setFontSize(10)
      if (client) {
        const fullName = [client.first_name?.trim(), client.last_name?.trim()].filter(Boolean).join(" ")
        doc.text(fullName, 20, 57)
      } else {
        doc.text("N/A", 20, 57)
      }

      // Project Info
      doc.setFontSize(12)
      doc.text("Project:", 120, 50)
      doc.setFontSize(10)
      doc.text(project.name, 120, 57)
      doc.text(`Phase: ${phase.title}`, 120, 62)

      // Summary
      doc.setFontSize(14)
      doc.text("Executive Summary", 20, 80)
      doc.setFontSize(10)
      const splitDescription = doc.splitTextToSize(phase.description || "No description provided.", 170)
      doc.text(splitDescription, 20, 87)

      const summaryHeight = splitDescription.length * 5
      let nextY = 87 + summaryHeight + 15

      // Deliverables
      if (deliverables && deliverables.length > 0) {
        doc.setFontSize(14)
        doc.text("Deliverables", 20, nextY)
        nextY += 7

        const deliverableData = deliverables.map((d: any, index: number) => [
          (index + 1).toString(),
          d.title,
          d.description || ""
        ])

        autoTable(doc, {
          startY: nextY,
          head: [["#", "Deliverable", "Description"]],
          body: deliverableData,
          theme: "grid",
          headStyles: { fillColor: [0, 0, 0] },
          margin: { left: 20, right: 20 },
          styles: { fontSize: 9 },
          columnStyles: {
            0: { cellWidth: 10 },
            1: { cellWidth: 50 },
            2: { cellWidth: "auto" }
          }
        })

        nextY = (doc as any).lastAutoTable.finalY + 15
      }

      // Technical Stack & Architecture
      if (phase.tech_stack) {
        if (nextY > 250) {
          doc.addPage()
          nextY = 20
        }
        doc.setFontSize(14)
        doc.text("Technical Stack & Architecture", 20, nextY)
        nextY += 7
        doc.setFontSize(10)
        const splitTechStack = doc.splitTextToSize(phase.tech_stack, 170)
        doc.text(splitTechStack, 20, nextY)
        nextY += (splitTechStack.length * 5) + 15
      }

      // Project Timeline & Milestones
      if (phase.timeline) {
        if (nextY > 250) {
          doc.addPage()
          nextY = 20
        }
        doc.setFontSize(14)
        doc.text("Project Timeline & Milestones", 20, nextY)
        nextY += 7
        doc.setFontSize(10)
        const splitTimeline = doc.splitTextToSize(phase.timeline, 170)
        doc.text(splitTimeline, 20, nextY)
        nextY += (splitTimeline.length * 5) + 15
      }

      // Payment Schedule
      if (phase.payment_schedule) {
        if (nextY > 250) {
          doc.addPage()
          nextY = 20
        }
        doc.setFontSize(14)
        doc.text("Payment Schedule", 20, nextY)
        nextY += 7
        doc.setFontSize(10)
        const splitPayment = doc.splitTextToSize(phase.payment_schedule, 170)
        doc.text(splitPayment, 20, nextY)
        nextY += (splitPayment.length * 5) + 15
      }

      // Investment
      if (nextY > 250) {
        doc.addPage()
        nextY = 20
      }

      doc.setFontSize(14)
      doc.text("Investment", 20, nextY)
      nextY += 7

      doc.setFontSize(10)
      doc.text("The total investment for this phase is:", 20, nextY)
      doc.setFontSize(16)
      doc.text(`$${Number(phase.amount).toLocaleString()} USD`, 20, nextY + 10)

      // Footer
      doc.setFontSize(10)
      doc.setTextColor(100)
      const footerY = 280
      doc.text("Thank you for considering our proposal.", 20, footerY)
      doc.text("Valid for 30 days.", 190, footerY, { align: "right" })

      doc.save(`Proposal-${project.name}-${phase.title}.pdf`)
      toast.success("Proposal exported successfully")
    } catch (error: any) {
      toast.error("Failed to export proposal: " + error.message)
    }
  }

  const handleConfirmInvoice = async (invoiceNumber: string, hideLineItems: boolean) => {
    if (!phaseForInvoice) return

    try {
      setIsGeneratingInvoice(true)
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select(`
          name,
          client_id,
          clients (
            first_name,
            last_name,
            email,
            address,
            city,
            state,
            country
          )
        `)
        .eq("id", projectId)
        .single()

      if (projectError) throw projectError

      const lineItems: LineItem[] = (phaseForInvoice as any).invoice_line_items || []
      const totalAmount = lineItems.length > 0
        ? lineItems.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0)
        : Number(phaseForInvoice.amount)

      // Save to database
      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices")
        .insert({
          invoice_number: invoiceNumber,
          project_id: projectId,
          phase_id: phaseForInvoice.id,
          client_id: project.client_id,
          amount: totalAmount,
          line_items: lineItems as any,
          status: "sent"
        })
        .select()
        .single()

      if (invoiceError) throw invoiceError

      // Link phase to invoice
      await supabase
        .from("phases")
        .update({ invoice_id: invoice.id })
        .eq("id", phaseForInvoice.id)

      const doc = new jsPDF()
      const client: any = project.clients

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
      doc.text(`Invoice #: ${invoiceNumber}`, 190, 30, { align: "right" })
      doc.text(`Date: ${new Date().toLocaleDateString()}`, 190, 35, { align: "right" })

      // Client Info
      doc.setFontSize(12)
      doc.text("Bill To:", 20, 55)
      doc.setFontSize(10)
      if (client) {
        const fullName = [client.first_name?.trim(), client.last_name?.trim()].filter(Boolean).join(" ")
        doc.text(fullName, 20, 62)
        if (client.email) doc.text(client.email, 20, 67)
      } else {
        doc.text("N/A", 20, 62)
      }

      // Table
      const tableData = lineItems.length > 0
        ? lineItems.map(item => {
          const row = [item.description, item.details]
          if (!hideLineItems) {
            row.push(`$${Number(item.price).toLocaleString()}`)
            row.push(item.quantity.toString())
            row.push(`$${(Number(item.price) * Number(item.quantity)).toLocaleString()}`)
          }
          return row
        })
        : [
          (() => {
            const row = [phaseForInvoice.title, phaseForInvoice.description || "Project Phase"]
            if (!hideLineItems) {
              row.push(`$${Number(phaseForInvoice.amount).toLocaleString()}`)
              row.push("1")
              row.push(`$${Number(phaseForInvoice.amount).toLocaleString()}`)
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

      doc.setFontSize(10)
      doc.setTextColor(100)
      doc.text("Total Amount (USD)", 190, finalY, { align: "right" })
      doc.setFontSize(16)
      doc.setTextColor(0)
      doc.text(`$${totalAmount.toLocaleString()}`, 190, finalY + 10, { align: "right" })

      // Footer
      doc.setFontSize(10)
      doc.setTextColor(100)
      doc.text("Thank you for your business!", 20, finalY + 40)

      doc.save(`Invoice-${project.name}-${phaseForInvoice.title}.pdf`)
      toast.success("Invoice generated and saved successfully")
      setIsInvoiceDialogOpen(false)
      setPhaseForInvoice(null)
    } catch (error: any) {
      toast.error("Failed to generate invoice: " + error.message)
    } finally {
      setIsGeneratingInvoice(false)
    }
  }

  const fetchPhases = React.useCallback(async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from("phases")
        .select("*")
        .eq("project_id", projectId)
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: false })

      if (error) throw error
      setPhases(data || [])
    } catch (error: any) {
      toast.error("Failed to fetch phases: " + error.message)
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  const handleReorder = async (newData: Phase[]) => {
    const oldData = [...phases]
    setPhases(newData)

    try {
      const updatePromises = newData.map((phase, index) =>
        supabase
          .from("phases")
          .update({ order_index: index })
          .eq("id", phase.id)
      )

      const results = await Promise.all(updatePromises)
      const error = results.find(r => r.error)?.error

      if (error) throw error
      toast.success("Order updated")
    } catch (error: any) {
      setPhases(oldData)
      toast.error("Failed to update order: " + error.message)
    }
  }

  const fetchDeliverables = React.useCallback(async (phaseId: string) => {
    try {
      const { data, error } = await supabase
        .from("deliverables")
        .select("*")
        .eq("phase_id", phaseId)
        .order("order_index", { ascending: true })

      if (error) throw error
      setDeliverables(data || [])
    } catch (error: any) {
      toast.error("Failed to fetch deliverables: " + error.message)
    }
  }, [])

  React.useEffect(() => {
    if (projectId) {
      fetchPhases()
    }
  }, [fetchPhases, projectId])

  const handleEdit = async (phase: Phase | null) => {
    setEditingPhase(phase)
    if (phase) {
      await fetchDeliverables(phase.id)
    } else {
      setDeliverables([])
    }
    setIsDialogOpen(true)
  }

  const handleView = (phase: Phase) => {
    setViewingPhase(phase)
    setIsViewModalOpen(true)
  }

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const { error } = await supabase
        .from("phases")
        .update({ status })
        .eq("id", id)

      if (error) throw error

      await updateProjectStatus(projectId)

      toast.success("Phase status updated")
      fetchPhases()
    } catch (error: any) {
      toast.error("Failed to update status: " + error.message)
    }
  }

  const handleDelete = (id: string) => {
    setPhaseToDelete(id)
    setDeleteConfirmOpen(true)
  }

  const confirmDelete = async () => {
    if (!phaseToDelete) return

    try {
      const { error } = await supabase.from("phases").delete().eq("id", phaseToDelete)
      if (error) throw error

      await updateProjectStatus(projectId)

      toast.success("Phase deleted successfully")
      fetchPhases()
    } catch (error: any) {
      toast.error("Failed to delete phase: " + error.message)
    } finally {
      setDeleteConfirmOpen(false)
      setPhaseToDelete(null)
    }
  }

  const handleSubmit = async (values: any, updatedDeliverables: Deliverable[], lineItems: LineItem[]) => {
    try {
      setIsSubmitting(true)
      let phaseId = editingPhase?.id

      const phaseData = {
        ...values,
        project_id: projectId,
        invoice_line_items: lineItems
      }

      if (editingPhase?.id) {
        const { error } = await supabase
          .from("phases")
          .update(phaseData)
          .eq("id", editingPhase.id)
        if (error) throw error

        if (values.title) {
          await supabase
            .from("channels")
            .update({ name: slugify(values.title) })
            .eq("phase_id", editingPhase.id)
        }

        toast.success("Phase updated successfully")
      } else {
        const { data, error } = await supabase
          .from("phases")
          .insert([{
            ...phaseData,
            order_index: phases.length
          }])
          .select()
          .single()
        if (error) throw error
        phaseId = data.id
        toast.success("Phase added successfully")
      }

      if (phaseId) {
        const { error: deleteError } = await supabase
          .from("deliverables")
          .delete()
          .eq("phase_id", phaseId)

        if (deleteError) throw deleteError

        if (updatedDeliverables.length > 0) {
          const deliverablesToInsert = updatedDeliverables.map((d, index) => ({
            phase_id: phaseId,
            title: d.title,
            description: d.description,
            order_index: index,
          }))

          const { error: insertError } = await supabase
            .from("deliverables")
            .insert(deliverablesToInsert)

          if (insertError) throw insertError
        }
      }

      await updateProjectStatus(projectId)

      setIsDialogOpen(false)
      fetchPhases()
    } catch (error: any) {
      toast.error("Failed to save phase: " + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 min-h-0">
      <PhasesTable
        data={phases}
        projectId={projectId}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onView={handleView}
        onStatusChange={handleStatusChange}
        onGenerateInvoice={handleGenerateInvoice}
        onExportProposal={handleExportProposal}
        onRowSelectionChange={setRowSelection}
        onDataChange={handleReorder}
        isLoading={isLoading}
        toolbar={
          isAdmin && selectedPhases.length > 0 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (selectedPhases.length === 1) {
                    handleExportProposal(selectedPhases[0])
                  } else {
                    toast.info("Generating multiple proposals is not yet supported. Exporting the first selected phase.")
                    handleExportProposal(selectedPhases[0])
                  }
                }}
              >
                <IconFileText className="mr-2 h-4 w-4" />
                Export Proposal ({selectedPhases.length})
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (selectedPhases.length === 1) {
                    handleGenerateInvoice(selectedPhases[0])
                  } else {
                    toast.info("Generating multiple invoices is not yet supported. Generating for the first selected phase.")
                    handleGenerateInvoice(selectedPhases[0])
                  }
                }}
              >
                <IconFileText className="mr-2 h-4 w-4" />
                Generate Invoice ({selectedPhases.length})
              </Button>
            </div>
          )
        }
      />

      <PhaseDetailsModal
        phase={viewingPhase}
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false)
          setViewingPhase(null)
        }}
        projectId={projectId}
      />

      <GenerateInvoiceDialog
        open={isInvoiceDialogOpen}
        onOpenChange={setIsInvoiceDialogOpen}
        onConfirm={handleConfirmInvoice}
        isSubmitting={isGeneratingInvoice}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPhase ? "Edit Phase" : "Create Phase"}</DialogTitle>
            <DialogDescription>
              {editingPhase
                ? "Update the phase's information below."
                : "Fill in the details to create a new phase for this project."}
            </DialogDescription>
          </DialogHeader>

          <PhaseForm
            initialData={editingPhase}
            initialDeliverables={deliverables}
            onSubmit={handleSubmit}
            onCancel={() => setIsDialogOpen(false)}
            isSubmitting={isSubmitting}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        onConfirm={confirmDelete}
        title="Delete Phase"
        description="Are you sure you want to delete this phase? This action cannot be undone."
      />
    </div>
  )
}
