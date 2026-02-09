import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { hasPermission } from '@/lib/rbac'

interface AuthContextType {
  session: Session | null
  user: User | null
  role: string | null
  organizationId: string | null
  pin: string | null
  isPinVerified: boolean
  loading: boolean
  signOut: () => Promise<void>
  checkPermission: (action: string, resource: string) => boolean
  verifyPin: (pin: string) => Promise<boolean>
  setPin: (pin: string, isInitial?: boolean) => Promise<void>
  logPinAttempt: (pin: string, type: string, success: boolean) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [pin, setPinState] = useState<string | null>(null)
  const [isPinVerified, setIsPinVerified] = useState(false)
  const [loading, setLoading] = useState(true)

  const logPinAttempt = useCallback(async (pinEntered: string, type: string, success: boolean) => {
    if (!user) return
    try {
      await supabase.from('pin_logs').insert({
        user_id: user.id,
        pin_entered: pinEntered,
        attempt_type: type,
        is_success: success
      })
    } catch (error) {
      console.error('Error logging pin attempt:', error)
    }
  }, [user])

  const fetchData = useCallback(async (userId: string) => {
    console.log('AuthProvider: Background fetching profile for', userId)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role, organization_id, pin')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('AuthProvider: Error fetching profile:', error)
      }

      console.log('AuthProvider: Profile data received:', data)

      if (data) {
        console.log('AuthProvider: Setting role to', data.role)
        setRole(data.role?.toLowerCase() ?? null)
        setOrganizationId(data.organization_id ?? null)
        setPinState(data.pin ?? null)
      } else {
        console.warn('AuthProvider: No profile data found for user')
      }
      console.log('AuthProvider: Profile fetching sequence complete')
    } catch (error) {
      console.error('AuthProvider: Unexpected error fetching supplemental data:', error)
    }
  }, [])

  useEffect(() => {
    let mounted = true
    let timeoutFinished = false

    // Safety timeout: 3 seconds is plenty for a local storage lookup
    const timeout = setTimeout(() => {
      if (mounted && loading) {
        console.warn('AuthProvider: Loading safety trigger (3s timeout)')
        timeoutFinished = true
        setLoading(false)
      }
    }, 3000)

    async function initialize() {
      console.log('AuthProvider: Initializing session check...')
      try {
        // Immediate check of the local session
        const { data: { session: initialSession }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('AuthProvider: getSession error:', error)
        }

        if (!mounted || timeoutFinished) return

        console.log('AuthProvider: Session found:', !!initialSession)
        setSession(initialSession)
        setUser(initialSession?.user ?? null)
        
        if (initialSession) {
          // Await profile data fetch during initialization
          await fetchData(initialSession.user.id)
        }
      } catch (error) {
        console.error('AuthProvider: Fatal initialization error:', error)
      } finally {
        if (mounted && !timeoutFinished) {
          console.log('AuthProvider: Ending loading state')
          setLoading(false)
          clearTimeout(timeout)
        }
      }
    }

    initialize()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      console.log('AuthProvider: Auth state changed event:', event)
      if (!mounted) return

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        setSession(currentSession)
        setUser(currentSession?.user ?? null)
        if (currentSession?.user) {
          fetchData(currentSession.user.id)
        }
        setLoading(false)
      } else if (event === 'SIGNED_OUT') {
        setSession(null)
        setUser(null)
        setRole(null)
        setOrganizationId(null)
        setPinState(null)
        setIsPinVerified(false)
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [fetchData])

  const checkPermission = useCallback((action: string, resource: string) => {
    return hasPermission(role, action, resource)
  }, [role])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const verifyPin = async (enteredPin: string) => {
    const success = enteredPin === pin
    await logPinAttempt(enteredPin, 'verification', success)
    if (success) {
      setIsPinVerified(true)
    }
    return success
  }

  const setPin = async (newPin: string, isInitial: boolean = false) => {
    if (!user) return
    const { error } = await supabase
      .from('profiles')
      .update({ pin: newPin })
      .eq('id', user.id)

    if (error) {
      await logPinAttempt(newPin, isInitial ? 'setup' : 'update', false)
      throw error
    }
    
    await logPinAttempt(newPin, isInitial ? 'setup' : 'update', true)
    setPinState(newPin)
    setIsPinVerified(true)
  }

  const value = {
    session,
    user,
    role,
    organizationId,
    pin,
    isPinVerified,
    loading,
    signOut,
    checkPermission,
    verifyPin,
    setPin,
    logPinAttempt
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}