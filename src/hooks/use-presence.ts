import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/use-auth'

export type PresenceState = {
  user_id: string
  online_at: string
}

export function usePresence() {
  const { user } = useAuth()
  const [onlineUsers, setOnlineUsers] = useState<Record<string, PresenceState[]>>({})

  useEffect(() => {
    if (!user) return

    const channel = supabase.channel('online-users', {
      config: {
        presence: {
          key: user.id,
        },
      },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceState>()
        setOnlineUsers(state)
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('join', key, newPresences)
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('leave', key, leftPresences)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: user.id,
            online_at: new Date().toISOString(),
          })
        }
      })

    return () => {
      channel.unsubscribe()
    }
  }, [user])

  const isOnline = (userId: string) => {
    return !!onlineUsers[userId]
  }

  return { onlineUsers, isOnline }
}
