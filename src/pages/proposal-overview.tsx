import { useParams, Link } from "react-router-dom"
import { PageContainer } from "@/components/page-container"
import { SEO } from "@/components/seo"
import { Button } from "@/components/ui/button"
import { ProposalDetails } from "@/components/projects/proposal-details"

export default function ProposalOverviewPage() {
  const { projectId, proposalId } = useParams()

  if (!projectId || !proposalId) {
    return (
      <PageContainer>
        <div className="flex flex-1 items-center justify-center p-4 text-center">
          <div>
            <p className="text-lg font-medium">Proposal not found.</p>
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
      <SEO title="Proposal Details" />
      <div className="flex flex-1 flex-col gap-2 min-h-0 overflow-hidden pt-4 lg:pt-6">
        <ProposalDetails projectId={projectId} proposalId={proposalId} />
      </div>
    </PageContainer>
  )
}