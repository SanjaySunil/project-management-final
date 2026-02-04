import { useEffect, useState } from "react"
import { PageContainer } from "@/components/page-container"
import { SectionCards } from "@/components/section-cards"
import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { DataTable } from "@/components/data-table"
import { SEO } from "@/components/seo"
import { supabase } from "@/lib/supabase"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDistanceToNow } from "date-fns"
import { IconArrowRight } from "@tabler/icons-react"
import { Link } from "react-router-dom"

export default function OverviewPage() {
  const [stats, setStats] = useState({
    totalProjects: 0,
    totalClients: 0,
    totalRevenue: 0,
    activeTasks: 0,
    revenueTrend: 0,
    projectsTrend: 0,
    clientsTrend: 0,
    tasksTrend: 0,
  })
  const [recentLogs, setRecentLogs] = useState<any[]>([])
  const [activeProjects, setActiveProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchOverviewData() {
      try {
        const [
          { count: projectsCount },
          { count: clientsCount },
          { data: proposalsData },
          { count: tasksCount },
          { data: auditLogs },
          { data: projectsData },
        ] = await Promise.all([
          supabase.from("projects").select("*", { count: "exact", head: true }),
          supabase.from("clients").select("*", { count: "exact", head: true }),
          supabase.from("proposals").select("amount").in("status", ["active", "complete"]),
          supabase.from("tasks").select("*", { count: "exact", head: true }).neq("status", "done"),
          supabase.from("audit_logs").select("*, profiles(full_name)").order("created_at", { ascending: false }).limit(5),
          supabase.from("projects").select("*, clients(first_name, last_name)").order("created_at", { ascending: false }).limit(5)
        ])

        const totalRevenue = proposalsData?.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0) || 0

        setStats({
          totalProjects: projectsCount || 0,
          totalClients: clientsCount || 0,
          totalRevenue,
          activeTasks: tasksCount || 0,
          revenueTrend: 12.5,
          projectsTrend: 5.2,
          clientsTrend: 3.4,
          tasksTrend: -2.1,
        })
        setRecentLogs(auditLogs || [])
        setActiveProjects(projectsData || [])
      } catch (error) {
        console.error("Error fetching overview data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchOverviewData()
  }, [])

  const logColumns = [
    {
      accessorKey: "created_at",
      header: "Time",
      cell: ({ row }: any) => formatDistanceToNow(new Date(row.getValue("created_at")), { addSuffix: true }),
    },
    {
      accessorKey: "action",
      header: "Action",
      cell: ({ row }: any) => (
        <Badge variant="outline" className="capitalize text-[10px] px-1 py-0 h-4">
          {row.getValue("action").replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      accessorKey: "profiles.full_name",
      header: "User",
      cell: ({ row }: any) => <span className="text-xs truncate block max-w-[80px]">{row.original.profiles?.full_name || "System"}</span>,
    },
  ]

  const projectColumns = [
    {
      accessorKey: "name",
      header: "Project",
      cell: ({ row }: any) => (
        <Link to={`/dashboard/projects/${row.original.id}`} className="font-medium hover:underline">
          {row.getValue("name")}
        </Link>
      )
    },
    {
      accessorKey: "clients",
      header: "Client",
      cell: ({ row }: any) => {
        const client = row.original.clients
        return client ? `${client.first_name} ${client.last_name || ""}` : "N/A"
      }
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }: any) => (
        <Badge variant={row.getValue("status") === "active" ? "default" : "secondary"} className="capitalize">
          {row.getValue("status")}
        </Badge>
      )
    }
  ]

  return (
    <PageContainer>
      <SEO title="Overview" description="Executive summary of your business performance and project statuses." />
      <div className="flex flex-1 flex-col gap-4">
        <SectionCards 
          data={{
            revenue: stats.totalRevenue,
            projects: stats.totalProjects,
            clients: stats.totalClients,
            tasks: stats.activeTasks,
            trends: {
              revenue: stats.revenueTrend,
              projects: stats.projectsTrend,
              clients: stats.clientsTrend,
              tasks: stats.tasksTrend,
            }
          }}
          loading={loading}
        />
        
        <div className="grid gap-4 lg:grid-cols-7">
          <div className="lg:col-span-4 flex flex-col gap-4">
            <ChartAreaInteractive />
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Recent Projects</CardTitle>
                <Link to="/dashboard/projects" className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1">
                  View all <IconArrowRight className="size-3" />
                </Link>
              </CardHeader>
              <CardContent>
                              <DataTable 
                                columns={projectColumns} 
                                data={activeProjects} 
                                isLoading={loading}
                              />
                            </CardContent>
                          </Card>
                        </div>
                        <div className="lg:col-span-3 flex flex-col gap-4">
                          <Card className="flex-1">
                            <CardHeader className="flex flex-row items-center justify-between">
                              <CardTitle>Activity Feed</CardTitle>
                              <Link to="/dashboard/audit-logs" className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1">
                                More <IconArrowRight className="size-3" />
                              </Link>
                            </CardHeader>
                            <CardContent>
                              <DataTable 
                                columns={logColumns} 
                                data={recentLogs} 
                                isLoading={loading}
                              />              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>System Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Database</span>
                  <div className="flex items-center gap-2">
                    <div className="size-2 rounded-full bg-emerald-500" />
                    <span>Healthy</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">API</span>
                  <div className="flex items-center gap-2">
                    <div className="size-2 rounded-full bg-emerald-500" />
                    <span>Operational</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Realtime</span>
                  <div className="flex items-center gap-2">
                    <div className="size-2 rounded-full bg-emerald-500" />
                    <span>Connected</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
