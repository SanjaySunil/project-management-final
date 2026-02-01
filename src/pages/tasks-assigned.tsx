import { PageContainer } from "@/components/page-container"
import { AssignedTasks } from "@/components/projects/assigned-tasks"
import { SEO } from "@/components/seo"
import { useSearchParams } from "react-router-dom"

export default function AssignedTasksPage() {
  const [searchParams] = useSearchParams()
  const userId = searchParams.get("user") || undefined

  return (
    <PageContainer>
      <SEO title="Assigned Tasks" />
      <div className="flex flex-1 flex-col gap-4">
        <AssignedTasks userId={userId} />
      </div>
    </PageContainer>
  )
}