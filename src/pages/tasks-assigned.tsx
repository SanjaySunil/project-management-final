import { PageContainer } from "@/components/page-container"
import { AssignedTasks } from "@/components/projects/assigned-tasks"
import { SEO } from "@/components/seo"
import { useSearchParams } from "react-router-dom"

export default function AssignedTasksPage() {
  const [searchParams] = useSearchParams()
  const userId = searchParams.get("user") || undefined

  return (
    <PageContainer className="h-full overflow-hidden">
      <SEO title="Assigned Tasks" />
      <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
        <AssignedTasks userId={userId} />
      </div>
    </PageContainer>
  )
}