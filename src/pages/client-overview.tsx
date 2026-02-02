import { useParams } from "react-router-dom"
import { PageContainer } from "@/components/page-container"
import { SEO } from "@/components/seo"
import { ClientOverview } from "@/components/clients/client-overview"

export default function ClientOverviewPage() {
  const { clientId } = useParams()
  
  return (
    <PageContainer>
      <SEO title="Client Overview" />
      <ClientOverview clientId={clientId!} />
    </PageContainer>
  )
}