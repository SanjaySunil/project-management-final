import * as React from "react"
import { supabase } from "@/lib/supabase"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Label,
} from "recharts"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, TrendingUp, Users, Briefcase, CheckCircle2 } from "lucide-react"

interface WorkloadData {
  profiles: any[]
  tasks: any[]
  projects: any[]
  phases: any[]
}

export function TeamWorkload() {
  const [data, setData] = React.useState<WorkloadData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        const [
          { data: profiles },
          { data: tasks },
          { data: projects },
          { data: phases }
        ] = await Promise.all([
          supabase.from('profiles').select('*').neq('role', 'client'),
          supabase.from('tasks').select('*'),
          supabase.from('projects').select('*'),
          supabase.from('phases').select('*')
        ])

        setData({
          profiles: profiles || [],
          tasks: tasks || [],
          projects: projects || [],
          phases: phases || []
        })
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const memberWorkloadData = React.useMemo(() => {
    if (!data) return []

    return data.profiles.map(profile => {
      const memberTasks = data.tasks.filter(task => task.user_id === profile.id)
      return {
        name: profile.full_name || profile.username || 'Unknown',
        tasks: memberTasks.length,
        active: memberTasks.filter(t => t.status !== 'completed' && t.status !== 'done').length,
        completed: memberTasks.filter(t => t.status === 'completed' || t.status === 'done').length,
      }
    }).sort((a, b) => b.tasks - a.tasks)
  }, [data])

  const projectWorkloadData = React.useMemo(() => {
    if (!data) return []

    return data.projects.map(project => {
      const projectPhases = data.phases.filter(p => p.project_id === project.id)
      const phaseIds = projectPhases.map(p => p.id)
      const projectTasks = data.tasks.filter(task => phaseIds.includes(task.phase_id))
      
      return {
        name: project.name,
        tasks: projectTasks.length,
        active: projectTasks.filter(t => t.status !== 'completed' && t.status !== 'done').length,
      }
    }).filter(p => p.tasks > 0).sort((a, b) => b.tasks - a.tasks)
  }, [data])

  const statusData = React.useMemo(() => {
    if (!data) return []

    const counts: Record<string, number> = {}
    data.tasks.forEach(task => {
      const status = task.status || 'todo'
      counts[status] = (counts[status] || 0) + 1
    })

    return Object.entries(counts).map(([name, value], index) => ({ 
      name, 
      value,
      fill: `var(--chart-${(index % 5) + 1})`
    }))
  }, [data])

  const totalTasks = React.useMemo(() => {
    return data?.tasks.length || 0
  }, [data])

  const chartConfig = {
    active: {
      label: "Active Tasks",
      color: "hsl(var(--chart-1))",
    },
    completed: {
      label: "Completed Tasks",
      color: "hsl(var(--chart-2))",
    },
    tasks: {
      label: "Total Tasks",
      color: "hsl(var(--chart-3))",
    },
  }

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <Skeleton className="h-6 w-[200px]" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <Skeleton className="h-6 w-[200px]" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 flex flex-col">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Member Workload</CardTitle>
            </div>
            <CardDescription>Active vs Completed tasks per team member</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <ChartContainer config={chartConfig} className="h-[350px] w-full">
              <BarChart accessibilityLayer data={memberWorkloadData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  tickLine={false} 
                  axisLine={false} 
                  tickMargin={10}
                  fontSize={12}
                />
                <YAxis 
                  tickLine={false} 
                  axisLine={false} 
                  tickMargin={10}
                  fontSize={12}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar 
                  dataKey="active" 
                  fill="var(--color-active)" 
                  radius={[4, 4, 0, 0]} 
                />
                <Bar 
                  dataKey="completed" 
                  fill="var(--color-completed)" 
                  radius={[4, 4, 0, 0]} 
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="col-span-3 flex flex-col">
          <CardHeader className="items-center pb-0">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Task Distribution</CardTitle>
            </div>
            <CardDescription>Overall status of all tasks</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 pb-0">
            <ChartContainer
              config={chartConfig}
              className="mx-auto aspect-square max-h-[300px]"
            >
              <PieChart>
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent hideLabel />}
                />
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  strokeWidth={5}
                >
                  <Label
                    content={({ viewBox }) => {
                      if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                        return (
                          <text
                            x={viewBox.cx}
                            y={viewBox.cy}
                            textAnchor="middle"
                            dominantBaseline="middle"
                          >
                            <tspan
                              x={viewBox.cx}
                              y={viewBox.cy}
                              className="fill-foreground text-3xl font-bold"
                            >
                              {totalTasks.toLocaleString()}
                            </tspan>
                            <tspan
                              x={viewBox.cx}
                              y={(viewBox.cy || 0) + 24}
                              className="fill-muted-foreground text-sm"
                            >
                              Total Tasks
                            </tspan>
                          </text>
                        )
                      }
                    }}
                  />
                </Pie>
              </PieChart>
            </ChartContainer>
          </CardContent>
          <CardFooter className="flex-col gap-2 text-sm">
            <div className="flex items-center gap-2 leading-none font-medium">
              Task completion is healthy <TrendingUp className="h-4 w-4" />
            </div>
            <div className="text-muted-foreground leading-none">
              Showing distribution across {statusData.length} statuses
            </div>
          </CardFooter>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Workload by Project</CardTitle>
          </div>
          <CardDescription>Active tasks distribution across projects</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <BarChart 
              accessibilityLayer 
              data={projectWorkloadData} 
              layout="vertical"
              margin={{ left: 40 }}
            >
              <CartesianGrid horizontal={false} />
              <YAxis 
                dataKey="name" 
                type="category" 
                tickLine={false} 
                axisLine={false} 
                fontSize={12}
                width={120}
              />
              <XAxis type="number" hide />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar 
                dataKey="active" 
                fill="var(--color-active)" 
                radius={[0, 4, 4, 0]} 
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
}