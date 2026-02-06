import * as React from "react"
import { useParams, Link } from "react-router-dom"
import { IconArrowLeft } from "@tabler/icons-react"
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
    <PageContainer className="h-full overflow-hidden">
      <SEO title="Proposal Details" />
      <div className="flex flex-1 flex-col gap-4 h-full overflow-hidden">
        <div className="flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between">
            <Button asChild variant="ghost" className="w-fit -ml-2 h-8 text-muted-foreground">
              <Link to={`/dashboard/projects/${projectId}`}>
                <IconArrowLeft className="mr-2 h-4 w-4" /> Back to Project
              </Link>
            </Button>
          </div>
        </div>

        <ProposalDetails projectId={projectId} proposalId={proposalId} />
      </div>
    </PageContainer>
  )
}