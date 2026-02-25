import * as React from "react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { KanbanBoard, type Task, type KanbanMode } from "@/components/projects/kanban-board"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TaskForm } from "@/components/projects/task-form"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { Tables } from "@/lib/database.types"
import { useAuth } from "@/hooks/use-auth"

import { useTasks } from "@/hooks/use-tasks"

interface ProjectTasksTabProps {
  projectId: string
}

export function ProjectTasksTab({ projectId }: ProjectTasksTabProps) {
  const { user } = useAuth()
  const [phases, setPhases] = React.useState<Tables<"phases">[]>([])
  const [selectedPhaseId, setSelectedPhaseId] = React.useState<string>("all")
  const [members, setMembers] = React.useState<Tables<"profiles">[]>([])
  const [mode, setMode] = React.useState<KanbanMode>("development")
  
  const { tasks, isLoading, setTasks } = useTasks({ 
    projectId, 
    phaseId: selectedPhaseId === "all" ? undefined : selectedPhaseId 
  })

  const [isTaskFormOpen, setIsTaskFormOpen] = React.useState(false)
  const [editingTask, setEditingTask] = React.useState<Task | null>(null)
  const [newTaskStatus, setNewTaskStatus] = React.useState<string>("todo")
  const [newTaskParentId, setNewTaskParentId] = React.useState<string | undefined>(undefined)

  const fetchPhases = React.useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("phases")
        .select("*")
        .eq("project_id", projectId)
        .order("order_index", { ascending: true })

      if (error) throw error
      setPhases(data || [])
    } catch (error: any) {
      console.error("Error fetching phases:", error)
    }
  }, [projectId])

  const fetchProjectMembers = React.useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("project_members")
        .select(`
          user_id,
          profiles (*)
        `)
        .eq("project_id", projectId)

      if (error) throw error
      const profileData = data?.map(m => m.profiles).filter(Boolean) as Tables<"profiles">[]
      setMembers(profileData || [])
    } catch (error: any) {
      console.error("Error fetching members:", error)
    }
  }, [projectId])

  React.useEffect(() => {
    fetchPhases()
    fetchProjectMembers()
  }, [fetchPhases, fetchProjectMembers])

  const handleTaskUpdate = async (taskId: string, updates: Partial<Task>) => {
    try {
      // Optimistically update local state for better UX
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t))

      // Clean up updates to only include database columns
      const dbUpdates = { ...updates } as any
      delete dbUpdates.phases
      delete dbUpdates.profiles
      delete dbUpdates.task_attachments
      delete dbUpdates.task_members
      delete dbUpdates.projects

      const { error } = await supabase
        .from("tasks")
        .update(dbUpdates)
        .eq("id", taskId)

      if (error) throw error
    } catch (error: any) {
      toast.error("Failed to update task: " + error.message)
    }
  }

  const handleTaskCreate = (status: string, parentId?: string) => {
    setNewTaskStatus(status)
    setNewTaskParentId(parentId)
    setEditingTask(null)
    setIsTaskFormOpen(true)
  }

  const handleTaskQuickCreate = async (status: string, parentId: string, title: string) => {
    try {
      const { error } = await supabase
        .from("tasks")
        .insert({
          title,
          status,
          parent_id: parentId,
          project_id: projectId,
          phase_id: selectedPhaseId === "all" ? (phases[0]?.id || null) : selectedPhaseId,
          user_id: user?.id,
          order_index: tasks.filter(t => t.parent_id === parentId).length
        })

      if (error) throw error
    } catch (error: any) {
      toast.error("Failed to create subtask: " + error.message)
    }
  }

  const handleTaskEdit = (task: Task) => {
    setEditingTask(task)
    setIsTaskFormOpen(true)
  }

  const handleTaskDelete = async (taskId: string) => {
    try {
      // Optimistic delete
      setTasks(prev => prev.filter(t => t.id !== taskId))

      const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", taskId)

      if (error) throw error
      toast.success("Task deleted")
    } catch (error: any) {
      toast.error("Failed to delete task: " + error.message)
    }
  }

  const handleMoveAllTasks = async (taskIds: string[], targetStatus: string) => {
    try {
      // Optimistic update
      setTasks(prev => prev.map(t => taskIds.includes(t.id) ? { ...t, status: targetStatus } : t))

      const { error } = await supabase
        .from("tasks")
        .update({ status: targetStatus })
        .in("id", taskIds)

      if (error) throw error
      toast.success(`Moved ${taskIds.length} tasks to ${targetStatus}`)
    } catch (error: any) {
      toast.error("Failed to move tasks: " + error.message)
    }
  }

  const handleFormSubmit = async (values: any) => {
    try {
      const { assignee_ids, subtasks, files, ...rest } = values
      
      const taskData = {
        ...rest,
        project_id: projectId,
        phase_id: rest.phase_id === "none" ? null : (rest.phase_id || (selectedPhaseId === "all" ? (phases[0]?.id || null) : selectedPhaseId)),
      }

      let taskId = editingTask?.id

      if (editingTask) {
        const { error } = await supabase
          .from("tasks")
          .update(taskData)
          .eq("id", editingTask.id)
        if (error) throw error
        toast.success("Task updated")
      } else {
        const { data, error } = await supabase
          .from("tasks")
          .insert({
            ...taskData,
            status: newTaskStatus,
            parent_id: newTaskParentId,
            order_index: tasks.filter(t => t.status === newTaskStatus && !t.parent_id).length
          })
          .select()
          .single()
        if (error) throw error
        taskId = data.id

        // Handle subtasks for new tasks
        if (subtasks && subtasks.length > 0) {
          const subtasksToInsert = subtasks.map((title: string, index: number) => ({
            title,
            status: "todo",
            parent_id: taskId,
            user_id: user?.id,
            project_id: projectId,
            phase_id: taskData.phase_id,
            order_index: index
          }))
          
          const { error: subtasksError } = await supabase
            .from("tasks")
            .insert(subtasksToInsert)
          
          if (subtasksError) console.error("Error creating subtasks:", subtasksError)
        }

        // Handle attachments for new tasks
        if (files && files.length > 0 && typeof window !== 'undefined') {
          const { default: imageCompression } = await import("browser-image-compression")
          
          for (const file of files as File[]) {
            let fileToUpload = file

            if (file.type.startsWith('image/')) {
              const options = {
                maxSizeMB: 1,
                maxWidthOrHeight: 1920,
                useWebWorker: true
              }
              try {
                fileToUpload = await imageCompression(file, options)
              } catch (error) {
                console.error("Compression error:", error)
              }
            }

            const fileExt = file.name.split('.').pop()
            const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`
            const filePath = `${taskId}/${fileName}`

            const { error: uploadError } = await supabase.storage
              .from('task-attachments')
              .upload(filePath, fileToUpload)

            if (!uploadError && user) {
              await supabase
                .from('task_attachments')
                .insert([{
                  task_id: taskId,
                  user_id: user.id,
                  file_path: filePath,
                  file_name: file.name,
                  file_type: file.type,
                  file_size: fileToUpload.size
                }])
            }
          }
        }

        toast.success("Task created")
      }

      // Handle assignees
      if (taskId && assignee_ids) {
        // Delete existing members
        await supabase
          .from("task_members")
          .delete()
          .eq("task_id", taskId)

        // Insert new members
        if (assignee_ids.length > 0) {
          const { error: memberError } = await supabase
            .from("task_members")
            .insert(assignee_ids.map((userId: string) => ({
              task_id: taskId,
              user_id: userId
            })))
          if (memberError) throw memberError
        }
      }

      setIsTaskFormOpen(false)
    } catch (error: any) {
      toast.error("Failed to save task: " + error.message)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 min-h-0">
      <KanbanBoard
        tasks={tasks}
        members={members}
        onTaskUpdate={handleTaskUpdate}
        onTaskCreate={handleTaskCreate}
        onTaskQuickCreate={handleTaskQuickCreate}
        onTaskEdit={handleTaskEdit}
        onTaskDelete={handleTaskDelete}
        onMoveAllTasks={handleMoveAllTasks}
        isLoading={isLoading}
        mode={mode}
        onModeChange={setMode}
        disablePadding
        extraControls={
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Phase:</span>
            <Select value={selectedPhaseId} onValueChange={setSelectedPhaseId}>
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue placeholder="Select phase" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Phases</SelectItem>
                {phases.map((phase) => (
                  <SelectItem key={phase.id} value={phase.id}>
                    {phase.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      <Dialog open={isTaskFormOpen} onOpenChange={setIsTaskFormOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTask ? "Edit Task" : "Create Task"}</DialogTitle>
            <DialogDescription>
              {editingTask ? "Update the task details below." : "Fill in the details to create a new task."}
            </DialogDescription>
          </DialogHeader>

          <TaskForm
            defaultValues={editingTask || { 
              project_id: projectId, 
              phase_id: selectedPhaseId === "all" ? null : selectedPhaseId,
              status: newTaskStatus,
              parent_id: newTaskParentId
            }}
            members={members}
            phases={phases}
            tasks={tasks}
            onSubmit={handleFormSubmit}
            onCancel={() => setIsTaskFormOpen(false)}
            onSubtaskToggle={async (subtaskId, currentStatus) => {
              const newStatus = currentStatus === 'complete' ? 'todo' : 'complete'
              await handleTaskUpdate(subtaskId, { status: newStatus })
            }}
            onAddSubtask={async (title) => {
              if (editingTask) {
                await handleTaskQuickCreate('todo', editingTask.id, title)
              }
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
