import { useEffect, useState, useCallback } from "react"
import { useSearchParams } from "react-router-dom"
import { PageContainer } from "@/components/page-container"
import { SEO } from "@/components/seo"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, RefreshCw, Plus } from "lucide-react"
import { UsersTable } from "@/components/users-table"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RolesManager } from "@/components/roles-manager"
import { usePresence } from "@/hooks/use-presence"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { UserForm, type UserFormValues } from "@/components/user-form"
import { UserDetailsModal } from "@/components/user-details-modal"
import { createClient } from "@supabase/supabase-js"

import { ROLES, type RoleData, canManageRole } from "@/lib/rbac"

interface Profile {
  id: string
  full_name: string | null
  username: string | null
  avatar_url: string | null
  role: string | null
  email: string | null
  updated_at: string | null
}

export default function TeamPage() {
  const { user, role, checkPermission, organizationId } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get("tab") || "members"
  const { isOnline } = usePresence()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [customRoles, setCustomRoles] = useState<Record<string, RoleData>>({})
  const [loading, setLoading] = useState(true)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [profileToDelete, setProfileToDelete] = useState<Profile | null>(null)
  const [addMemberOpen, setAddMemberOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null)
  const [detailsModalOpen, setDetailsModalOpen] = useState(false)

  const handleUserClick = (profile: Profile) => {
    setSelectedUser(profile)
    setDetailsModalOpen(true)
  }

  const canViewTeam = checkPermission("read", "team")
  const canCreateMember = checkPermission("create", "team")
  const canManageRoles = checkPermission("read", "roles")

  const fetchProfiles = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('role', { ascending: false })

    if (error) throw error
    setProfiles((data as Profile[]) || [])
  }, [])

  const fetchCustomRoles = useCallback(async () => {
    const { data, error } = await supabase
      .from('custom_roles')
      .select('*')

    if (error) throw error
    
    const rolesMap: Record<string, RoleData> = {}
    data?.forEach(r => {
      rolesMap[r.slug] = {
        label: r.name || r.slug,
        description: r.description || "",
        permissions: r.permissions || [],
        is_system: r.is_system ?? false
      }
    })
    setCustomRoles(rolesMap)
  }, [])

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      await Promise.all([
        fetchProfiles(),
        fetchCustomRoles()
      ])
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "An unknown error occurred"
      toast.error("Error fetching data: " + message)
    } finally {
      setLoading(false)
    }
  }, [fetchProfiles, fetchCustomRoles])

  useEffect(() => {
    if (user && canViewTeam) {
      fetchData()
    }
  }, [user, canViewTeam, fetchData])

  async function handleAddMember(values: UserFormValues) {
    try {
      setIsCreating(true)
      
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      // Create a temporary client that doesn't persist session to avoid logging out the current admin
      const tempSupabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false
        }
      })

      const { data, error: signUpError } = await tempSupabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: {
            full_name: values.full_name,
            role: values.role,
            organization_id: organizationId
          }
        }
      })

      if (signUpError) throw signUpError

      if (data.user) {
        toast.success("Team member created successfully")
        setAddMemberOpen(false)
        fetchProfiles()
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "An unknown error occurred"
      toast.error("Error creating team member: " + message)
    } finally {
      setIsCreating(false)
    }
  }

  async function changeRole(profile: Profile, newRole: string) {
    if (!canManageRole(role, profile.role)) {
      toast.error("You don't have permission to change this user's role")
      return
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', profile.id)
        .select()

      if (error) throw error
      
      if (!data || data.length === 0) {
        throw new Error("No profile was updated. You might not have permission or the user does not exist.")
      }
      
      setProfiles(profiles.map(p => p.id === profile.id ? { ...p, role: newRole } : p))
      const roleLabel = customRoles[newRole]?.label || ROLES[newRole]?.label || newRole
      toast.success(`User role updated to ${roleLabel}`)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "An unknown error occurred"
      toast.error("Error updating role: " + message)
    }
  }

  function handleDelete(profile: Profile) {
    if (!canManageRole(role, profile.role)) {
      toast.error("You don't have permission to delete this user")
      return
    }

    if (profile.id === user?.id) {
      toast.error("You cannot delete your own account")
      return
    }

    setProfileToDelete(profile)
    setDeleteConfirmOpen(true)
  }

  async function confirmDelete() {
    if (!profileToDelete) return

    try {
      const { data, error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', profileToDelete.id)
        .select()

      if (error) throw error
      
      if (!data || data.length === 0) {
        throw new Error("No profile was deleted. You might not have permission.")
      }
      
      setProfiles(profiles.filter(p => p.id !== profileToDelete.id))
      toast.success("User profile deleted")
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "An unknown error occurred"
      toast.error("Error deleting profile: " + message)
    } finally {
      setDeleteConfirmOpen(false)
      setProfileToDelete(null)
    }
  }

  if (!canViewTeam && role !== null) {
    return (
      <PageContainer>
        <div className="p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Access Denied</AlertTitle>
            <AlertDescription>
              You do not have permission to view this page. This page is restricted.
            </AlertDescription>
          </Alert>
        </div>
      </PageContainer>
    )
  }

  const allRoles = { ...ROLES, ...customRoles }

  return (
    <PageContainer>
      <SEO title="Team Management" description="Manage your team members, roles, and access permissions." />
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Team Management</h1>
            <p className="text-sm text-muted-foreground">Manage team members, roles and permissions</p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={fetchData} variant="outline" size="sm">
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {canCreateMember && (
              <Button onClick={() => setAddMemberOpen(true)} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Member
              </Button>
            )}
          </div>
        </div>

        <Tabs 
          value={activeTab} 
          onValueChange={(val) => setSearchParams({ tab: val })} 
          className="w-full"
        >
          <div>
            <TabsList>
              <TabsTrigger value="members">Team Members</TabsTrigger>
              {canManageRoles && <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>}
            </TabsList>
          </div>

          <TabsContent value="members" className="mt-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
                    <Skeleton className="h-5 w-20 mb-2" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                ))
              ) : (
                (Object.entries(allRoles) as [string, RoleData][]).map(([key, roleInfo]) => (
                  <div key={key} className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={key === 'admin' ? 'default' : key === 'manager' ? 'secondary' : 'outline'} className="capitalize">
                        {roleInfo.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{roleInfo.description}</p>
                  </div>
                ))
              )}
            </div>

            <UsersTable 
              data={profiles} 
              onChangeRole={changeRole} 
              onDelete={handleDelete}
              onRowClick={handleUserClick}
              currentUserRole={role}
              availableRoles={allRoles}
              isOnline={isOnline}
              isLoading={loading}
            />
          </TabsContent>

          {canManageRoles && (
            <TabsContent value="roles" className="mt-6">
              <RolesManager />
            </TabsContent>
          )}
        </Tabs>
      </div>

      <UserDetailsModal 
        user={selectedUser}
        open={detailsModalOpen}
        onOpenChange={setDetailsModalOpen}
        availableRoles={allRoles}
        isOnline={isOnline}
      />

      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
            <DialogDescription>
              Create a new team member and assign them a role. They will be able to login with their email and password.
            </DialogDescription>
          </DialogHeader>
          <UserForm 
            onSubmit={handleAddMember} 
            onCancel={() => setAddMemberOpen(false)} 
            isLoading={isCreating}
            availableRoles={allRoles}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        onConfirm={confirmDelete}
        title="Delete User Profile"
        description={`Are you sure you want to delete user ${profileToDelete?.full_name || profileToDelete?.id}? This will only remove their profile record.`}
      />
    </PageContainer>
  )
}

