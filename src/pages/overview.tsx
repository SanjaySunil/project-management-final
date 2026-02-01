import { PageContainer } from "@/components/page-container"
import { SectionCards } from "@/components/section-cards"
import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { OverviewTable } from "@/components/dashboard/overview-table"
import { SEO } from "@/components/seo"
import data from "@/app/dashboard/data.json"

export default function OverviewPage() {
  return (
    <PageContainer>
      <SEO title="Overview" description="Executive summary of your business performance and project statuses." />
      <div className="flex flex-1 flex-col gap-4">
        <SectionCards />
        <ChartAreaInteractive />
        <div className="flex-1 pb-4">
          <OverviewTable data={data as any} />
        </div>
      </div>
    </PageContainer>
  )
}

