import { useEffect, useState, useCallback, useRef } from "react"
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
  const lastFetchId = useRef(0)

  const fetchNotifications = useCallback(async () => {
    if (!user) return

    const fetchId = ++lastFetchId.current
    setIsLoading(true)
    
    try {
      const { data, error } = await supabase.from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50)

      if (fetchId !== lastFetchId.current) return

      if (!error && data) {
        setNotifications(data as Notification[])
        
        // Get actual unread count
        const { count } = await supabase
          .from("notifications")
          .select("*", { count: 'exact', head: true })
          .eq("user_id", user.id)
          .eq("is_read", false)
        
        if (fetchId === lastFetchId.current) {
          setUnreadCount(count || 0)
        }
      }
    } finally {
      if (fetchId === lastFetchId.current) {
        setIsLoading(false)
      }
    }
  }, [user])

  useEffect(() => {
    if (!user) return

    const init = async () => {
      await fetchNotifications()
    }
    init()

    let timeout: ReturnType<typeof setTimeout>
    const debouncedFetch = () => {
      clearTimeout(timeout)
      timeout = setTimeout(() => {
        fetchNotifications()
      }, 500)
    }

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
          debouncedFetch()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      clearTimeout(timeout)
    }
  }, [user, fetchNotifications])

  const markAsRead = async (id: string) => {
    const { error } = await supabase.from("notifications")
      .update({ is_read: true })
      .eq("id", id)

    if (error) {
      console.error("Error marking notification as read:", error)
      return false
    }

    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    )
    setUnreadCount((prev) => Math.max(0, prev - 1))
    return true
  }

  const markAllAsRead = async () => {
    if (!user) return false
    const { error } = await supabase.from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false)

    if (error) {
      console.error("Error marking all notifications as read:", error)
      return false
    }

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    setUnreadCount(0)
    lastFetchId.current++
    return true
  }

  const deleteNotification = async (id: string) => {
    const { error } = await supabase.from("notifications")
      .delete()
      .eq("id", id)

    if (error) {
      console.error("Error deleting notification:", error)
      return false
    }

    setNotifications((prev) => {
      const notification = prev.find(n => n.id === id)
      if (notification && !notification.is_read) {
        setUnreadCount(count => Math.max(0, count - 1))
      }
      return prev.filter((n) => n.id !== id)
    })
    lastFetchId.current++
    return true
  }

  const deleteNotifications = async (ids: string[]) => {
    if (ids.length === 0) return true
    const { error } = await supabase.from("notifications")
      .delete()
      .in("id", ids)

    if (error) {
      console.error("Error deleting notifications:", error)
      return false
    }

    setNotifications((prev) => {
      const deletedUnreadCount = prev.filter(n => ids.includes(n.id) && !n.is_read).length
      setUnreadCount(count => Math.max(0, count - deletedUnreadCount))
      return prev.filter((n) => !ids.includes(n.id))
    })
    lastFetchId.current++
    return true
  }

  const deleteAllNotifications = async () => {
    if (!user) return false
    const { error } = await supabase.from("notifications")
      .delete()
      .eq("user_id", user.id)

    if (error) {
      console.error("Error deleting all notifications:", error)
      return false
    }

    setNotifications([])
    setUnreadCount(0)
    lastFetchId.current++
    return true
  }

  const markNotificationsAsRead = async (ids: string[]) => {
    if (ids.length === 0) return true
    const { error } = await supabase.from("notifications")
      .update({ is_read: true })
      .in("id", ids)

    if (error) {
      console.error("Error marking notifications as read:", error)
      return false
    }

    setNotifications((prev) =>
      prev.map((n) => (ids.includes(n.id) ? { ...n, is_read: true } : n))
    )
    setUnreadCount((prev) => {
      const markedReadCount = notifications.filter(n => ids.includes(n.id) && !n.is_read).length
      return Math.max(0, prev - markedReadCount)
    })
    lastFetchId.current++
    return true
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
    deleteAllNotifications,
    refresh: fetchNotifications,
  }
}
