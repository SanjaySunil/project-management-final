import { useParams } from "react-router-dom"
import { PageContainer } from "@/components/page-container"
import { SEO } from "@/components/seo"
import { ClientProjectsTab } from "@/components/clients/client-projects-tab"

export default function ClientProjectsPage() {
  const { clientId } = useParams()
  
  return (
    <PageContainer>
      <SEO title="Client Projects" />
      <ClientProjectsTab clientId={clientId!} />
    </PageContainer>
  )
}