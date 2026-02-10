import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'

interface Organization {
  id?: string
  name: string
  website: string | null
  email: string | null
  billing_email: string | null
  logo: string | null
  sidebar_settings?: Record<string, boolean>
}

interface OrganizationContextType {
  organization: Organization
  updateOrganization: (updates: Partial<Organization>) => Promise<void>
  loading: boolean
}

const DEFAULT_ORG: Organization = {
  name: "Organization",
  website: "",
  email: "",
  billing_email: "",
  logo: "",
  sidebar_settings: {},
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined)

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const { organizationId, loading: authLoading } = useAuth()
  const [organization, setOrganization] = useState<Organization>(DEFAULT_ORG)
  const [loading, setLoading] = useState(true)
  const fetchedRef = useRef<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function fetchOrganization() {
      if (authLoading) {
        console.log('OrganizationProvider: Auth still loading, skipping fetch')
        return
      }
      
      const fetchKey = organizationId || 'global'
      if (fetchedRef.current === fetchKey && !loading) return
      fetchedRef.current = fetchKey

      console.log('OrganizationProvider: Fetching org', fetchKey)
      
      try {
        let query = supabase.from('organizations').select('*')
        
        if (organizationId) {
          query = query.eq('id', organizationId)
        } else {
          query = query.order('created_at', { ascending: true }).limit(1)
        }

        console.log('OrganizationProvider: Executing query...')
        const { data, error } = await query.maybeSingle()

        if (!mounted) return

        if (error) {
          console.error('OrganizationProvider: Error fetching organization:', error)
        } else if (data) {
          console.log('OrganizationProvider: Org data received')
          setOrganization(data as unknown as Organization)
        } else {
          console.warn('OrganizationProvider: No organization found')
        }
      } catch (err: any) {
        console.error('OrganizationProvider: Unexpected error:', err)
      } finally {
        if (mounted) {
          console.log('OrganizationProvider: Setting loading to false')
          setLoading(false)
        }
      }
    }

    fetchOrganization()

    // Safety timeout for organization loading
    const timeout = setTimeout(() => {
      if (mounted && loading) {
        console.warn('OrganizationProvider: Loading timeout reached')
        setLoading(false)
      }
    }, 3000)

    return () => {
      mounted = false
      clearTimeout(timeout)
    }
  }, [organizationId, authLoading])

  const updateOrganization = async (updates: Partial<Organization>) => {
    if (!organizationId) {
      toast.error("No organization associated with your profile")
      return
    }

    try {
      const dataToUpdate = { ...updates }
      delete (dataToUpdate as any).id
      const { data, error } = await supabase
        .from('organizations')
        .update(dataToUpdate)
        .eq('id', organizationId)
        .select()
        .single()

      if (error) throw error
      if (data) {
        setOrganization(data as unknown as Organization)
        toast.success("Organization updated successfully")
      }
    } catch (err: any) {
      console.error('Error updating organization:', err)
      toast.error(err.message || "Failed to update organization")
    }
  }

  return (
    <OrganizationContext.Provider value={{ organization, updateOrganization, loading }}>
      {children}
    </OrganizationContext.Provider>
  )
}

export const useOrganization = () => {
  const context = useContext(OrganizationContext)
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider')
  }
  return context
}