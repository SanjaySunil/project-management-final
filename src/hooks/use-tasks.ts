import { useEffect, useState, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabase"
import type { Task } from "@/components/projects/kanban-board"
import { toast } from "sonner"

interface UseTasksOptions {
  projectId?: string
  phaseId?: string
  userId?: string
  isPersonal?: boolean
  /**
   * If true, will not apply server-side filtering to the subscription.
   * Useful for complex filters that must be handled client-side.
   */
  broadSubscription?: boolean
}

export function useTasks(options: UseTasksOptions = {}) {
  const { projectId, phaseId, userId, isPersonal, broadSubscription } = options
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const lastFetchId = useRef(0)

  const fetchTasks = useCallback(async () => {
    const fetchId = ++lastFetchId.current
    setIsLoading(true)

    try {
      const table = isPersonal ? "personal_tasks" : "tasks"
      
      // If we are looking for tasks for a specific user, we need to check both user_id and task_members
      // This is primarily for project tasks
      if (userId && !isPersonal) {
        // First get task IDs from task_members
        const { data: memberships } = await supabase
          .from("task_members")
          .select("task_id")
          .eq("user_id", userId)
        
        const memberTaskIds = (memberships || []).map(m => m.task_id)

        let query = supabase
          .from(table)
          .select(`
            *,
            profiles:user_id (
              id,
              full_name,
              avatar_url,
              email,
              role
            ),
            phases (
              id,
              title,
              project_id,
              projects (
                id,
                name,
                status
              )
            ),
            projects (
              id,
              name,
              status
            ),
            task_attachments (*),
            task_members (
              user_id,
              profiles (
                id,
                full_name,
                avatar_url,
                email,
                role
              )
            )
          `)

        if (memberTaskIds.length > 0) {
          query = query.or(`user_id.eq.${userId},id.in.(${memberTaskIds.join(",")})`)
        } else {
          query = query.eq("user_id", userId)
        }

        if (projectId) query = query.eq("project_id", projectId)
        if (phaseId) query = query.eq("phase_id", phaseId)

        const { data, error } = await query.order("order_index", { ascending: true })
        if (fetchId !== lastFetchId.current) return
        if (error) throw error
        setTasks((data || []) as unknown as Task[])
      } else {
        // Standard filtering
        let query = supabase
          .from(table)
          .select(`
            *,
            profiles:user_id (
              id,
              full_name,
              avatar_url,
              email,
              role
            ),
            phases (
              id,
              title,
              project_id,
              projects (
                id,
                name,
                status
              )
            ),
            projects (
              id,
              name,
              status
            ),
            task_attachments (*),
            task_members (
              user_id,
              profiles (
                id,
                full_name,
                avatar_url,
                email,
                role
              )
            )
          `)

        if (projectId) query = query.eq("project_id", projectId)
        if (phaseId) query = query.eq("phase_id", phaseId)
        if (userId) query = query.eq("user_id", userId)

        const { data, error } = await query.order("order_index", { ascending: true })
        if (fetchId !== lastFetchId.current) return
        if (error) throw error
        setTasks((data || []) as unknown as Task[])
      }
    } catch (error: any) {
      console.error("Error fetching tasks:", error)
      toast.error("Failed to fetch tasks")
    } finally {
      if (fetchId === lastFetchId.current) {
        setIsLoading(false)
      }
    }
  }, [projectId, phaseId, userId, isPersonal])

  useEffect(() => {
    fetchTasks()

    const table = isPersonal ? "personal_tasks" : "tasks"
    
    // Determine subscription filter
    // Postgres changes filter is limited, so we often need a broad subscription
    let subscriptionFilter = undefined
    if (!broadSubscription) {
      if (phaseId) {
        subscriptionFilter = `phase_id=eq.${phaseId}`
      } else if (projectId) {
        subscriptionFilter = `project_id=eq.${projectId}`
      } else if (userId && isPersonal) {
        subscriptionFilter = `user_id=eq.${userId}`
      }
    }

    const channel = supabase
      .channel(`${table}-changes-${projectId || "all"}-${phaseId || "all"}-${userId || "all"}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: table,
          filter: subscriptionFilter,
        },
        async (payload) => {
          // DELETE handler
          if (payload.eventType === "DELETE") {
            setTasks(prev => prev.filter(t => t.id !== payload.old.id))
            return
          }

          // INSERT or UPDATE
          const newId = payload.new.id
          
          // Client-side filtering if subscription was broad
          if (broadSubscription || !subscriptionFilter) {
            if (phaseId && (payload.new as any).phase_id !== phaseId) return
            if (projectId && (payload.new as any).project_id !== projectId) return
          }

          // Fetch full task with joins
          const { data, error } = await supabase
            .from(table)
            .select(`
              *,
              profiles:user_id (
                id,
                full_name,
                avatar_url,
                email,
                role
              ),
              phases (
                id,
                title,
                project_id,
                projects (
                  id,
                  name,
                  status
                )
              ),
              projects (
                id,
                name,
                status
              ),
              task_attachments (*),
              task_members (
                user_id,
                profiles (
                  id,
                  full_name,
                  avatar_url,
                  email,
                  role
                )
              )
            `)
            .eq("id", newId)
            .single()

          if (!error && data) {
            const task = data as unknown as Task
            
            // Final check for userId filter if broad subscription
            if (userId && !isPersonal && !broadSubscription && !subscriptionFilter) {
               const isOwner = task.user_id === userId
               const isMember = task.task_members?.some(m => m.user_id === userId)
               if (!isOwner && !isMember) return
            }

            setTasks(prev => {
              const exists = prev.some(t => t.id === task.id)
              if (exists) {
                return prev.map(t => t.id === task.id ? task : t)
              }
              return [...prev, task]
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchTasks, projectId, phaseId, userId, isPersonal, broadSubscription])

  return {
    tasks,
    setTasks,
    isLoading,
    refresh: fetchTasks,
  }
}
