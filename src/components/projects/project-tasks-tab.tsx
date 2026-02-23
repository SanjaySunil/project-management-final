import * as React from "react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { KanbanBoard, type Task, type KanbanMode } from "@/components/projects/kanban-board"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TaskForm } from "@/components/projects/task-form"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { Tables } from "@/lib/database.types"
import { useAuth } from "@/hooks/use-auth"

interface ProjectTasksTabProps {
  projectId: string
}

export function ProjectTasksTab({ projectId }: ProjectTasksTabProps) {
  const { user } = useAuth()
  const [phases, setPhases] = React.useState<Tables<"phases">[]>([])
  const [selectedPhaseId, setSelectedPhaseId] = React.useState<string>("all")
  const [tasks, setTasks] = React.useState<Task[]>([])
  const [members, setMembers] = React.useState<Tables<"profiles">[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [mode, setMode] = React.useState<KanbanMode>("development")
  
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

  const fetchTasks = React.useCallback(async () => {
    try {
      setIsLoading(true)
      let query = supabase
        .from("tasks")
        .select(`
          *,
          phases (
            id,
            title,
            project_id,
            projects (
              id,
              name
            )
          ),
          task_members (
            user_id,
            profiles (
              id,
              full_name,
              avatar_url,
              email,
              role
            )
          ),
          task_attachments (*)
        `)
        .eq("project_id", projectId)

      if (selectedPhaseId !== "all") {
        query = query.eq("phase_id", selectedPhaseId)
      }

      const { data, error } = await query.order("order_index", { ascending: true })

      if (error) throw error
      
      // Join profiles in memory since the database relationship might not be explicitly defined
      const tasksWithProfiles = (data || []).map(task => ({
        ...task,
        profiles: members.find(m => m.id === task.user_id) || null
      }))

      setTasks(tasksWithProfiles as unknown as Task[])
    } catch (error: any) {
      toast.error("Failed to fetch tasks: " + error.message)
    } finally {
      setIsLoading(false)
    }
  }, [projectId, selectedPhaseId, members])

  React.useEffect(() => {
    fetchPhases()
    fetchProjectMembers()
  }, [fetchPhases, fetchProjectMembers])

  React.useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const handleTaskUpdate = async (taskId: string, updates: Partial<Task>) => {
    try {
      const { error } = await supabase
        .from("tasks")
        .update(updates)
        .eq("id", taskId)

      if (error) throw error
      
      // Update local state for immediate feedback if needed, 
      // or just refetch. KanbanBoard already updates local state for reordering.
      fetchTasks()
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
      fetchTasks()
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
      const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", taskId)

      if (error) throw error
      toast.success("Task deleted")
      fetchTasks()
    } catch (error: any) {
      toast.error("Failed to delete task: " + error.message)
    }
  }

  const handleFormSubmit = async (values: any) => {
    try {
      const { assignee_ids, files, subtasks, ...rest } = values
      
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
      fetchTasks()
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
