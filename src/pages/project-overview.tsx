import * as React from "react"
import { useParams, Link } from "react-router-dom"
import { toast } from "sonner"
import { IconArrowLeft, IconBriefcase, IconFileText, IconUsers } from "@tabler/icons-react"
import { supabase } from "@/lib/supabase"
import { PageContainer } from "@/components/page-container"
import { SEO } from "@/components/seo"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { updateProjectStatus } from "@/lib/projects"

export default function ProjectOverviewPage() {
  const { projectId } = useParams()
  const [project, setProject] = React.useState<any>(null)
  const [isLoading, setIsLoading] = React.useState(true)

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
      
      // Sync status
      if (data && projectId) {
        const currentStatus = await updateProjectStatus(projectId)
        if (currentStatus !== data.status) {
          data.status = currentStatus
        }
      }

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
    <PageContainer>
      <SEO title={`Project: ${project.name}`} />
      <div className="flex flex-1 flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Button asChild variant="ghost" className="w-fit -ml-2 h-8 text-muted-foreground">
            <Link to="/dashboard/projects" state={{ openProposalsFor: projectId }}>
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

        <div className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                {project.description || "No description provided."}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button asChild className="w-full justify-start gap-2" variant="outline">
                <Link to={`/dashboard/projects/${projectId}/proposals`}>
                  <IconFileText className="h-4 w-4" /> View Proposals
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Client Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-muted-foreground">Client Name</p>
                <p className="font-semibold">
                  {project.clients?.first_name} {project.clients?.last_name}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <IconUsers className="h-5 w-5" /> Team Members
                </CardTitle>
              </div>
              <CardDescription>Members assigned to this project.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                {project.project_members?.length > 0 ? (
                  project.project_members.map((member: any) => (
                    <div key={member.user_id} className="flex items-center gap-3 bg-muted/50 p-2 rounded-lg pr-4">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={member.profiles?.avatar_url || ""} />
                        <AvatarFallback>
                          {member.profiles?.full_name?.charAt(0) || member.profiles?.email?.charAt(0) || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <p className="text-sm font-medium leading-none">{member.profiles?.full_name}</p>
                        <p className="text-xs text-muted-foreground">{member.profiles?.email}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground py-4">No members assigned yet.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  )
}
