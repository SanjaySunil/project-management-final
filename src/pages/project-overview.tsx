import * as React from "react"
import { useParams, Link, useNavigate, useLocation } from "react-router-dom"
import { toast } from "sonner"
import { IconArrowLeft, IconBriefcase, IconFileText } from "@tabler/icons-react"
import { supabase } from "@/lib/supabase"
import { PageContainer } from "@/components/page-container"
import { SEO } from "@/components/seo"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProjectPhasesTab } from "@/components/projects/project-phases-tab"
import { ProjectDocumentsTab } from "@/components/projects/project-documents-tab"
import { ProjectTasksTab } from "@/components/projects/project-tasks-tab"
import { useAuth } from "@/hooks/use-auth"
import { IconLayoutKanban } from "@tabler/icons-react"

export default function ProjectOverviewPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { role } = useAuth()
  const isClient = role === 'client'
  const [project, setProject] = React.useState<any>(null)
  const [isLoading, setIsLoading] = React.useState(true)

  // Get active tab from URL or default to phases
  const pathParts = location.pathname.split('/')
  const lastPart = pathParts[pathParts.length - 1]
  const [activeTab, setActiveTab] = React.useState(
    ["phases", "documents", "tasks"].includes(lastPart) ? lastPart : "phases"
  )

  const fetchProjectDetails = React.useCallback(async () => {
    if (!projectId) return
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from("projects")
        .select(`
          *,
          clients (
            first_name,
            last_name
          ),
          project_members (
            user_id,
            profiles (
              full_name,
              avatar_url,
              email
            )
          )
        `)
        .eq("id", projectId)
        .single()

      if (error) throw error
      
      setProject(data)
    } catch (error: any) {
      toast.error("Failed to fetch project details: " + error.message)
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  React.useEffect(() => {
    if (projectId) {
      fetchProjectDetails()
    }
  }, [fetchProjectDetails, projectId])

  // Sync active tab with URL and handle permissions
  React.useEffect(() => {
    const pathParts = location.pathname.split('/')
    const lastPart = pathParts[pathParts.length - 1]
    
    if (isClient && (lastPart === "documents" || lastPart === "tasks")) {
      setActiveTab("phases")
      navigate(`/dashboard/projects/${projectId}/phases`, { replace: true })
      return
    }

    if (["phases", "documents", "tasks"].includes(lastPart)) {
      setActiveTab(lastPart)
    } else if (lastPart === projectId) {
      setActiveTab("phases")
    }
  }, [location.pathname, projectId, isClient, navigate])

  const handleTabChange = (value: string) => {
    setActiveTab(value)
    navigate(`/dashboard/projects/${projectId}/${value}`)
  }

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex flex-col gap-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid gap-6 md:grid-cols-3">
            <Skeleton className="h-48 md:col-span-2" />
            <Skeleton className="h-48" />
          </div>
        </div>
      </PageContainer>
    )
  }

  if (!project) {
    return (
      <PageContainer>
        <div className="flex flex-1 items-center justify-center p-4 text-center">
          <div>
            <p className="text-lg font-medium">Project not found.</p>
            <Button asChild variant="link" className="mt-2">
              <Link to="/dashboard/projects">Back to Projects</Link>
            </Button>
          </div>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer className="overflow-hidden">
      <SEO title={`Project: ${project.name}`} />
      <div className="flex flex-1 flex-col gap-6 min-h-0">
        <div className="flex flex-col gap-2 shrink-0">
          <Button asChild variant="ghost" className="w-fit -ml-2 h-8 text-muted-foreground">
            <Link to="/dashboard/projects">
              <IconArrowLeft className="mr-2 h-4 w-4" /> Back to Projects
            </Link>
          </Button>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <IconBriefcase className="h-6 w-6" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
            </div>
            <Badge variant={project.status === "active" ? "default" : "secondary"} className="capitalize">
              {project.status}
            </Badge>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-1 flex-col gap-4 min-h-0">
          <TabsList className="w-fit shrink-0">
            <TabsTrigger value="phases" className="gap-2">
              <IconFileText className="h-4 w-4" /> Phases
            </TabsTrigger>
            {!isClient && (
              <TabsTrigger value="tasks" className="gap-2">
                <IconLayoutKanban className="h-4 w-4" /> Tasks
              </TabsTrigger>
            )}
            {!isClient && (
              <TabsTrigger value="documents" className="gap-2">
                <IconFileText className="h-4 w-4" /> Documents
              </TabsTrigger>
            )}
          </TabsList>

          <div className="flex-1 flex flex-col min-h-0">
            <TabsContent value="phases" className="m-0 border-none p-0 flex-1 flex flex-col min-h-0">
              <ProjectPhasesTab projectId={projectId as string} />
            </TabsContent>
            {!isClient && (
              <TabsContent value="tasks" className="m-0 border-none p-0 flex-1 flex flex-col min-h-0">
                <ProjectTasksTab projectId={projectId as string} />
              </TabsContent>
            )}
            {!isClient && (
              <TabsContent value="documents" className="m-0 border-none p-0 flex-1 flex flex-col min-h-0">
                <ProjectDocumentsTab projectId={projectId as string} />
              </TabsContent>
            )}
          </div>
        </Tabs>
      </div>
    </PageContainer>
  )
}