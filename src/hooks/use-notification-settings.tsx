import { useEffect, useState, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/use-auth"
import type { Database } from "@/lib/database.types"

export type NotificationSettings = Database["public"]["Tables"]["notification_settings"]["Row"]

export function useNotificationSettings() {
  const { user } = useAuth()
  const [settings, setSettings] = useState<NotificationSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchSettings = useCallback(async () => {
    if (!user) return

    setIsLoading(true)
    const { data, error } = await supabase
      .from("notification_settings")
      .select("*")
      .eq("user_id", user.id)
      .single()

    if (error && error.code === 'PGRST116') {
      // Settings don't exist yet, create them
      const { data: newData, error: insertError } = await supabase
        .from("notification_settings")
        .insert({ user_id: user.id })
        .select()
        .single()
      
      if (!insertError && newData) {
        setSettings(newData as NotificationSettings)
      }
    } else if (!error && data) {
      setSettings(data as NotificationSettings)
    }
    setIsLoading(false)
  }, [user])

  useEffect(() => {
    const init = async () => {
      await fetchSettings()
    }
    init()
  }, [fetchSettings])

  const updateSettings = async (updates: Partial<NotificationSettings>) => {
    if (!user) return

    const { error } = await supabase
      .from("notification_settings")
      .update(updates)
      .eq("user_id", user.id)

    if (!error) {
      setSettings((prev) => prev ? { ...prev, ...updates } : null)
      return true
    }
    return false
  }

  return {
    settings,
    isLoading,
    updateSettings,
    refresh: fetchSettings,
  }
}
