import { useEffect, useState, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/use-auth"

export interface Notification {
  id: string
  user_id: string
  type: string
  title: string
  content: string
  link: string | null
  is_read: boolean
  metadata: any
  created_at: string
}

export function useNotifications() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const fetchNotifications = useCallback(async () => {
    if (!user) return

    setIsLoading(true)
    const { data, error } = await (supabase.from as any)("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50)

    if (!error && data) {
      setNotifications(data as Notification[])
      setUnreadCount(data.filter((n: any) => !n.is_read).length)
    }
    setIsLoading(false)
  }, [user])

  useEffect(() => {
    if (!user) return

    const init = async () => {
      await fetchNotifications()
    }
    init()

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchNotifications()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, fetchNotifications])

  const markAsRead = async (id: string) => {
    const { error } = await (supabase.from as any)("notifications")
      .update({ is_read: true })
      .eq("id", id)

    if (!error) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    }
  }

  const markAllAsRead = async () => {
    if (!user) return
    const { error } = await (supabase.from as any)("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false)

    if (!error) {
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
      setUnreadCount(0)
    }
  }

  const deleteNotification = async (id: string) => {
    const { error } = await (supabase.from as any)("notifications")
      .delete()
      .eq("id", id)

    if (!error) {
      setNotifications((prev) => {
        const filtered = prev.filter((n) => n.id !== id)
        setUnreadCount(filtered.filter(n => !n.is_read).length)
        return filtered
      })
    }
  }

  const deleteNotifications = async (ids: string[]) => {
    if (ids.length === 0) return
    const { error } = await (supabase.from as any)("notifications")
      .delete()
      .in("id", ids)

    if (!error) {
      setNotifications((prev) => {
        const filtered = prev.filter((n) => !ids.includes(n.id))
        setUnreadCount(filtered.filter(n => !n.is_read).length)
        return filtered
      })
    }
  }

  const markNotificationsAsRead = async (ids: string[]) => {
    if (ids.length === 0) return
    const { error } = await (supabase.from as any)("notifications")
      .update({ is_read: true })
      .in("id", ids)

    if (!error) {
      setNotifications((prev) =>
        prev.map((n) => (ids.includes(n.id) ? { ...n, is_read: true } : n))
      )
      setUnreadCount((prev) => {
        const markedReadCount = notifications.filter(n => ids.includes(n.id) && !n.is_read).length
        return Math.max(0, prev - markedReadCount)
      })
    }
  }

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    markNotificationsAsRead,
    deleteNotification,
    deleteNotifications,
    refresh: fetchNotifications,
  }
}
