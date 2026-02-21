import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProjectPhasesTab } from "./project-phases-tab"
import { ProjectDocumentsTab } from "./project-documents-tab"
import type { ProjectWithClient } from "./projects-table"
import { useAuth } from "@/hooks/use-auth"

interface ProjectDetailsModalProps {
  project: ProjectWithClient | null
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function ProjectDetailsModal({
  project,
  isOpen,
  onOpenChange,
}: ProjectDetailsModalProps) {
  const { role } = useAuth()
  const isClient = role === "client"

  if (!project) return null

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1000px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle>{project.name} - Details</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-6">
          <Tabs defaultValue="phases" className="flex flex-col">
            <TabsList className="w-fit mb-4">
              <TabsTrigger value="phases">Phases</TabsTrigger>
              {!isClient && <TabsTrigger value="documents">Documents</TabsTrigger>}
            </TabsList>
            <div className="mt-2">
              <TabsContent value="phases" className="m-0">
                <ProjectPhasesTab projectId={project.id} />
              </TabsContent>
              {!isClient && (
                <TabsContent value="documents" className="m-0">
                  <ProjectDocumentsTab projectId={project.id} hideHeader />
                </TabsContent>
              )}
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}
