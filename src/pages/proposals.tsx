import * as React from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/use-auth"
import { PageContainer } from "@/components/page-container"
import { SEO } from "@/components/seo"
import { PhasesTable } from "@/components/projects/phases-table"
import { PhaseDetailsModal } from "@/components/projects/phase-details-modal"
import type { Tables } from "@/lib/database.types"

type Phase = Tables<"phases">

export default function ProposalsPage() {
  const navigate = useNavigate()
  const { user, role, loading: authLoading } = useAuth()
  const [phases, setPhases] = React.useState<any[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [viewingPhase, setViewingPhase] = React.useState<Phase | null>(null)
  const [isViewModalOpen, setIsViewModalOpen] = React.useState(false)

  const fetchPhases = React.useCallback(async () => {
    if (!user || authLoading) return
    
    try {
      setIsLoading(true)
      
      const normalizedRole = role?.toLowerCase()
      
      if (normalizedRole === "client") {
        // Fetch phases for projects belonging to this client
        const { data, error } = await supabase
          .from("phases")
          .select(`
            *,
            projects!inner (
              id,
              name,
              clients!inner (
                user_id
              )
            )
          `)
          .eq("projects.clients.user_id", user.id)
          .order("created_at", { ascending: false })

        if (error) throw error
        setPhases(data as any || [])
      } else {
        // For admin/employee, show all phases or handle differently
        // But this page is specifically requested for clients
        const { data, error } = await supabase
          .from("phases")
          .select(`
            *,
            projects!inner (
              id,
              name
            )
          `)
          .order("created_at", { ascending: false })

        if (error) throw error
        setPhases(data as any || [])
      }
    } catch (error: any) {
      console.error("Failed to fetch proposals:", error)
      toast.error("Failed to fetch proposals: " + error.message)
    } finally {
      setIsLoading(false)
    }
  }, [user, role, authLoading])

  React.useEffect(() => {
    fetchPhases()
  }, [fetchPhases])

  const handleViewPhase = (phase: Phase) => {
    setViewingPhase(phase)
    setIsViewModalOpen(true)
  }

  return (
    <PageContainer>
      <SEO title="Proposals" description="View and manage your project proposals and phases." />
      <div className="flex flex-1 flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Proposals</h1>
        </div>

        <div className="flex-1">
          <PhasesTable 
            data={phases}
            projectId="" // Not used when onView is provided
            onEdit={() => {}} // Clients can't edit
            onDelete={() => {}} // Clients can't delete
            onView={handleViewPhase}
            isLoading={isLoading}
          />
        </div>
      </div>

      <PhaseDetailsModal
        phase={viewingPhase}
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false)
          setViewingPhase(null)
        }}
        projectId={viewingPhase?.project_id || ""}
      />
    </PageContainer>
  )
}
