import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { hasPermission, type RoleData } from '@/lib/rbac'

interface AuthContextType {
  session: Session | null
  user: User | null
  role: string | null
  organizationId: string | null
  loading: boolean
  signOut: () => Promise<void>
  checkPermission: (action: string, resource: string) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async (userId: string) => {
    console.log('AuthProvider: Background fetching profile for', userId)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role, organization_id')
        .eq('id', userId)
        .single()

      if (data) {
        setRole(data.role ?? null)
        setOrganizationId(data.organization_id ?? null)
      }
      console.log('AuthProvider: Profile fetched successfully')
    } catch (error) {
      console.error('AuthProvider: Error fetching supplemental data:', error)
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
          // Trigger data fetch but DON'T await it if it's blocking the app
          fetchData(initialSession.user.id)
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

  const value = {
    session,
    user,
    role,
    organizationId,
    loading,
    signOut,
    checkPermission,
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