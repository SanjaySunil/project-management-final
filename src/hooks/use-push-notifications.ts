import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/use-auth'

const VAPID_PUBLIC_KEY = 'BLhxF8IL9-V7AKm8RbQPpVkkClyCHxlSwp3I6MkNchuD4K82IkI0LcK4naVJOiJz-h1FYe-hChqc3zcalULClvs'

export function usePushNotifications() {
  const { user } = useAuth()
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  )

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
  }

  const subscribeUser = async () => {
    if (!user) return

    try {
      const registration = await navigator.serviceWorker.ready
      
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })

      // Save subscription to Supabase
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: user.id,
          subscription: subscription.toJSON() as any,
        }, {
          onConflict: 'user_id,subscription'
        })

      if (error) {
        console.error('Error saving push subscription:', error)
      } else {
        console.log('Push subscription saved successfully')
      }
    } catch (error) {
      console.error('Failed to subscribe user to push:', error)
    }
  }

  const requestPermission = async () => {
    if (typeof Notification === 'undefined') return

    const result = await Notification.requestPermission()
    setPermission(result)
    if (result === 'granted') {
      await subscribeUser()
    }
  }

  useEffect(() => {
    if (permission === 'granted' && user) {
      subscribeUser()
    }
  }, [user])

  return {
    permission,
    requestPermission,
  }
}
