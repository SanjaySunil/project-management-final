import * as React from "react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { type ProjectWithClient } from "./projects-table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProjectForm } from "./project-form"

interface ProjectDetailsModalProps {
  project: ProjectWithClient | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onProjectUpdated?: () => void
}

export function ProjectDetailsModal({
  project,
  open,
  onOpenChange,
  onProjectUpdated,
}: ProjectDetailsModalProps) {
  const [isSavingProject, setIsSavingProject] = React.useState(false)

  const handleProjectSubmit = async (values: any) => {
    if (!project) return
    const { member_ids, ...projectValues } = values
    
    try {
      setIsSavingProject(true)
      const { error } = await supabase
        .from("projects")
        .update(projectValues)
        .eq("id", project.id)
      if (error) throw error
      
      // Update members: delete old, insert new
      await supabase.from("project_members").delete().eq("project_id", project.id)
      
      if (member_ids && member_ids.length > 0) {
        const memberEntries = member_ids.map((userId: string) => ({
          project_id: project.id,
          user_id: userId,
        }))
        const { error: memberError } = await supabase
          .from("project_members")
          .insert(memberEntries)
        if (memberError) throw memberError
      }

      toast.success("Project updated successfully")
      if (onProjectUpdated) onProjectUpdated()
    } catch (error: any) {
      toast.error("Failed to update project: " + error.message)
    } finally {
      setIsSavingProject(false)
    }
  }

  const initialProjectFormValues = React.useMemo(() => {
    if (!project) return {}
    return {
      ...project,
      member_ids: project.project_members?.map(m => m.user_id) || []
    }
  }, [project])

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-5xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>Project Details: {project?.name}</DialogTitle>
            <DialogDescription>
              View and manage project information.
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="overview" className="flex-1 flex flex-col min-h-0">
            <div className="px-6 border-b">
              <TabsList variant="line" className="w-full justify-start h-12 bg-transparent p-0 gap-6">
                <TabsTrigger 
                  value="overview" 
                  className="h-12 rounded-none data-[state=active]:bg-transparent shadow-none"
                >
                  Project Overview
                </TabsTrigger>
              </TabsList>
            </div>
            
            <div className="flex-1 overflow-y-auto overflow-x-auto p-6">
              <TabsContent value="overview" className="mt-0">
                <ProjectForm
                  initialValues={initialProjectFormValues}
                  onSubmit={handleProjectSubmit}
                  onCancel={() => onOpenChange(false)}
                  isLoading={isSavingProject}
                />
              </TabsContent>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  )
}
