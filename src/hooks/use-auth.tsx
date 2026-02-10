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
  resetPin: (password: string) => Promise<void>
  logPinAttempt: (pin: string, type: string, success: boolean) => Promise<void>
  isPinBlacklisted: (pin: string) => boolean
}

const PIN_BLACKLIST = [
  '1970', '2819', '2008', '0609', '9575', '1234', '0000', '5755', '0908', '1111',
  '0317', '2021', '6767', '2807', '6969', '2022', '2023', '2020', '2024', '2025'
]

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [pin, setPinState] = useState<string | null>(null)
  const [isPinVerified, setIsPinVerified] = useState(false)
  const [loading, setLoading] = useState(true)

  const isPinBlacklisted = useCallback((pinToCheck: string) => {
    if (!pinToCheck) return false
    const sanitizedPin = pinToCheck.toString().trim()
    return PIN_BLACKLIST.includes(sanitizedPin)
  }, [])

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
    console.log('AuthProvider: Starting fetchData for', userId)
    
    try {
      console.log('AuthProvider: Executing profiles query...')
      const { data, error } = await supabase
        .from('profiles')
        .select('role, organization_id, pin')
        .eq('id', userId)
        .maybeSingle()

      if (error) {
        console.error('AuthProvider: Error fetching profile:', error)
      }

      console.log('AuthProvider: Profiles query result:', data)

      if (data) {
        console.log('AuthProvider: Setting role to', data.role)
        setRole(data.role?.toLowerCase() ?? null)
        setOrganizationId(data.organization_id ?? null)
        setPinState(data.pin ?? null)
      } else {
        console.warn('AuthProvider: No profile found for user ID', userId)
      }
    } catch (error: any) {
      console.error('AuthProvider: Unexpected error in fetchData:', error)
    } finally {
      console.log('AuthProvider: fetchData complete')
    }
  }, [])

  const handleSession = useCallback(async (currentSession: Session | null, source: string) => {
    console.log(`AuthProvider: handleSession from ${source}, session exists:`, !!currentSession)
    
    setSession(currentSession)
    setUser(currentSession?.user ?? null)
    
    if (currentSession?.user) {
      console.log('AuthProvider: User detected, starting fetchData (non-blocking)...')
      // Don't await fetchData here if we want to ensure loading is set to false eventually
      // But we DO want the role before we say we are finished loading.
      // Let's use a timeout-wrapped promise.
      const fetchDataWithTimeout = async () => {
        try {
          // Give the connection a moment to stabilize if needed
          await new Promise(resolve => setTimeout(resolve, 100));
          await fetchData(currentSession.user.id);
        } catch (e) {
          console.error('AuthProvider: Error in fetchData promise:', e);
        } finally {
          console.log(`AuthProvider: handleSession ${source} - setting loading to false`);
          setLoading(false);
        }
      };
      
      fetchDataWithTimeout();
    } else {
      setRole(null)
      setOrganizationId(null)
      setPinState(null)
      setIsPinVerified(false)
      console.log(`AuthProvider: handleSession ${source} (no user) - setting loading to false`)
      setLoading(false)
    }
  }, [fetchData])

  useEffect(() => {
    let mounted = true
    let initialized = false

    // Safety timeout: 5 seconds is plenty for a local storage lookup
    const timeout = setTimeout(() => {
      if (mounted && !initialized) {
        console.warn('AuthProvider: Initialization safety trigger (5s timeout)')
        setLoading(false)
      }
    }, 5000)

    async function initialize() {
      if (initialized || !mounted) return
      console.log('AuthProvider: Initializing...')
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession()
        if (error) throw error
        
        if (!initialized && mounted) {
          initialized = true
          await handleSession(initialSession, 'initialize')
        }
      } catch (error) {
        console.error('AuthProvider: Initialization error:', error)
        if (mounted) setLoading(false)
      }
    }

    initialize()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      console.log('AuthProvider: Auth state change:', event)
      if (!mounted) return

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (!initialized) {
          initialized = true
          await handleSession(currentSession, 'onAuthStateChange_INITIAL')
        } else if (event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') {
          await handleSession(currentSession, 'onAuthStateChange_UPDATE')
        }
      } else if (event === 'SIGNED_OUT') {
        initialized = true
        await handleSession(null, 'SIGNED_OUT')
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [handleSession])

  // Require PIN re-entry when switching tabs/apps
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && isPinVerified) {
        setIsPinVerified(false)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isPinVerified])

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
    
    const sanitizedPin = newPin.toString().trim()
    if (isPinBlacklisted(sanitizedPin)) {
      await logPinAttempt(sanitizedPin, isInitial ? 'setup_blocked' : 'update_blocked', false)
      throw new Error("You've entered a commonly used passcode, please try another one.")
    }

    const { error } = await supabase
      .from('profiles')
      .update({ pin: sanitizedPin })
      .eq('id', user.id)

    if (error) {
      await logPinAttempt(sanitizedPin, isInitial ? 'setup_failed' : 'update_failed', false)
      throw error
    }
    
    await logPinAttempt(sanitizedPin, isInitial ? 'setup' : 'update', true)
    setPinState(sanitizedPin)
    setIsPinVerified(true)
  }

  const resetPin = async (password: string) => {
    if (!user?.email) throw new Error('No user email found')

    // Verify password by attempting to sign in
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password,
    })

    if (authError) {
      await logPinAttempt('', 'reset_failed', false)
      throw new Error('Invalid password')
    }

    // Clear PIN in profiles
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ pin: null })
      .eq('id', user.id)

    if (profileError) {
      await logPinAttempt('', 'reset_profile_failed', false)
      throw profileError
    }
    
    await logPinAttempt('', 'reset_success', true)
    setPinState(null)
    setIsPinVerified(false)
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
    resetPin,
    logPinAttempt,
    isPinBlacklisted
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