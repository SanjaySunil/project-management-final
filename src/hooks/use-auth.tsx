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
  customRoles: Record<string, RoleData>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [customRoles, setCustomRoles] = useState<Record<string, RoleData>>({})
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async (userId: string) => {
    console.log('AuthProvider: Background fetching profile/roles for', userId)
    try {
      const [profileRes, rolesRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('role, organization_id')
          .eq('id', userId)
          .single(),
        supabase
          .from('custom_roles')
          .select('*')
      ])

      if (profileRes.data) {
        setRole(profileRes.data.role ?? null)
        setOrganizationId(profileRes.data.organization_id ?? null)
      }

      if (rolesRes.data) {
        const rolesMap: Record<string, RoleData> = {}
        rolesRes.data.forEach(r => {
          rolesMap[r.slug] = {
            label: r.name,
            description: r.description || "",
            permissions: r.permissions || [],
            is_system: r.is_system || false
          }
        })
        setCustomRoles(rolesMap)
      }
      console.log('AuthProvider: Profile/roles fetched successfully')
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
        setCustomRoles({})
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
    return hasPermission(role, action, resource, customRoles)
  }, [role, customRoles])

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
    customRoles,
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