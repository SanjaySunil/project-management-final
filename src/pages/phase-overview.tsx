import { useParams, Link } from "react-router-dom"
import { IconArrowLeft } from "@tabler/icons-react"
import { PageContainer } from "@/components/page-container"
import { SEO } from "@/components/seo"
import { Button } from "@/components/ui/button"
import { PhaseDetails } from "@/components/projects/phase-details"

export default function PhaseOverviewPage() {
  const { projectId, phaseId } = useParams()

  if (!projectId || !phaseId) {
    return (
      <PageContainer>
        <div className="flex flex-1 items-center justify-center p-4 text-center">
          <div>
            <p className="text-lg font-medium">Phase not found.</p>
            <Button asChild variant="link" className="mt-2">
              <Link to={`/dashboard/projects`}>Back to Projects</Link>
            </Button>
          </div>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer className="p-0 lg:p-0 min-h-0 overflow-hidden">
      <SEO title="Phase Details" />
      <div className="flex flex-1 flex-col gap-2 min-h-0 overflow-hidden pt-4 lg:pt-6">
        <div className="px-4 lg:px-6">
          <Button asChild variant="ghost" className="w-fit -ml-2 h-8 text-muted-foreground">
            <Link to={`/dashboard/projects/${projectId}/phases`}>
              <IconArrowLeft className="mr-2 h-4 w-4" /> Back to Phases
            </Link>
          </Button>
        </div>
        <PhaseDetails projectId={projectId} phaseId={phaseId} />
      </div>
    </PageContainer>
  )
}