import React, { useEffect, useState, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { RESOURCES, ACTIONS, type RoleData } from "@/lib/rbac"
import { Edit2, Trash2 } from "lucide-react"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { DataTable } from "@/components/data-table"
import type { ColumnDef } from "@tanstack/react-table"
import { IconDotsVertical } from "@tabler/icons-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface CustomRole extends RoleData {
  id: string
  slug: string
}

export function RolesManager() {
  const [roles, setRoles] = useState<CustomRole[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null)
  const [roleToDelete, setRoleToDelete] = useState<CustomRole | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    permissions: [] as string[]
  })

  useEffect(() => {
    fetchRoles()
  }, [])

  async function fetchRoles() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('custom_roles')
        .select('*')
        .order('is_system', { ascending: false })
        .order('name')

      if (error) throw error
      const mappedRoles = (data || []).map(r => ({
        ...r,
        label: r.name,
        description: r.description || "",
        permissions: r.permissions || [],
        is_system: r.is_system ?? false
      }))
      setRoles(mappedRoles)
    } catch (error: any) {
      toast.error("Error fetching roles: " + error.message)
    } finally {
      setLoading(false)
    }
  }

  function handleOpenDialog(role?: CustomRole) {
    if (role) {
      setEditingRole(role)
      setFormData({
        name: role.label,
        slug: role.slug,
        description: role.description || '',
        permissions: role.permissions
      })
    } else {
      setEditingRole(null)
      setFormData({
        name: '',
        slug: '',
        description: '',
        permissions: []
      })
    }
    setIsDialogOpen(true)
  }

  async function handleSubmit() {
    if (!formData.name || !formData.slug) {
      toast.error("Name and Slug are required")
      return
    }

    const payload = {
      name: formData.name,
      slug: formData.slug.toLowerCase().replace(/\s+/g, '-'),
      description: formData.description,
      permissions: formData.permissions,
      label: formData.name // We use label for RoleData
    }

    try {
      if (editingRole) {
        const { error } = await supabase
          .from('custom_roles')
          .update(payload)
          .eq('id', editingRole.id)

        if (error) throw error
        toast.success("Role updated successfully")
      } else {
        const { error } = await supabase
          .from('custom_roles')
          .insert([payload])

        if (error) throw error
        toast.success("Role created successfully")
      }
      setIsDialogOpen(false)
      fetchRoles()
    } catch (error: any) {
      toast.error("Error saving role: " + error.message)
    }
  }

  function togglePermission(resource: string, action: string) {
    const permission = action === '*' ? `${resource}:*` : `${resource}:${action}`
    const allResourcePermission = `${resource}:*`
    const starPermission = '*'

    setFormData(prev => {
      let newPermissions = [...prev.permissions]
      
      if (newPermissions.includes(starPermission) && permission !== starPermission) {
        toast.info("This role has full access (*). Remove '*' to manage individual permissions.")
        return prev
      }

      if (permission === '*') {
        if (newPermissions.includes('*')) {
          newPermissions = []
        } else {
          newPermissions = ['*']
        }
      } else if (action === '*') {
        if (newPermissions.includes(allResourcePermission)) {
          newPermissions = newPermissions.filter(p => !p.startsWith(`${resource}:`))
        } else {
          newPermissions = newPermissions.filter(p => !p.startsWith(`${resource}:`))
          newPermissions.push(allResourcePermission)
        }
      } else {
        if (newPermissions.includes(permission)) {
          newPermissions = newPermissions.filter(p => p !== permission)
        } else {
          if (newPermissions.includes(allResourcePermission)) {
            newPermissions = newPermissions.filter(p => p !== allResourcePermission)
          }
          newPermissions.push(permission)
        }
      }

      return { ...prev, permissions: newPermissions }
    })
  }

  function hasPermission(resource: string, action: string) {
    if (formData.permissions.includes('*')) return true
    const permission = action === '*' ? `${resource}:*` : `${resource}:${action}`
    
    if (formData.permissions.includes(permission) || formData.permissions.includes(`${resource}:*`)) {
      return true
    }

    // Backward compatibility: 'write' covers 'create' and 'update'
    if ((action === 'create' || action === 'update') && formData.permissions.includes(`${resource}:write`)) {
      return true
    }

    return false
  }

  async function confirmDelete() {
    if (!roleToDelete) return

    try {
      const { error } = await supabase
        .from('custom_roles')
        .delete()
        .eq('id', roleToDelete.id)

      if (error) throw error
      toast.success("Role deleted successfully")
      fetchRoles()
    } catch (error: any) {
      toast.error("Error deleting role: " + error.message)
    } finally {
      setIsDeleteDialogOpen(false)
      setRoleToDelete(null)
    }
  }

  // Group resources
  const groupedResources = useMemo(() => {
    const groups: Record<string, typeof RESOURCES[number][]> = {}
    RESOURCES.forEach(r => {
      const group = (r as any).group || 'Other'
      if (!groups[group]) groups[group] = []
      groups[group].push(r)
    })
    return groups
  }, [])

  const columns = useMemo<ColumnDef<CustomRole>[]>(() => [
    {
      accessorKey: "label",
      header: "Role Name",
      cell: ({ row }) => (
        <div className="font-medium">{row.original.label}</div>
      ),
    },
    {
      accessorKey: "slug",
      header: "Slug",
      cell: ({ row }) => (
        <Badge variant="outline">{row.original.slug}</Badge>
      ),
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => (
        <div className="max-w-[300px] truncate text-muted-foreground">
          {row.original.description}
        </div>
      ),
    },
    {
      accessorKey: "is_system",
      header: "Type",
      cell: ({ row }) => (
        row.original.is_system ? (
          <Badge variant="secondary">System</Badge>
        ) : (
          <Badge variant="default">Custom</Badge>
        )
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="data-[state=open]:bg-muted text-muted-foreground flex size-8 p-0"
              size="icon"
            >
              <IconDotsVertical className="size-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-32">
            <DropdownMenuItem onClick={() => handleOpenDialog(row.original)}>
              <Edit2 className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            {!row.original.is_system && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  variant="destructive"
                  onClick={() => {
                    setRoleToDelete(row.original)
                    setIsDeleteDialogOpen(true)
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ], [])

  return (
    <div className="flex flex-col gap-4">
      <DataTable
        columns={columns}
        data={roles}
        isLoading={loading}
        addLabel="Create Role"
        onAdd={() => handleOpenDialog()}
        searchPlaceholder="Filter roles..."
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRole ? 'Edit Role' : 'Create New Role'}</DialogTitle>
            <DialogDescription>
              Define the role name, slug, and set the permissions for different resources.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Role Name</Label>
                <Input 
                  id="name" 
                  value={formData.name} 
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Content Editor"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input 
                  id="slug" 
                  value={formData.slug} 
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="e.g. content-editor"
                  disabled={editingRole?.is_system}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input 
                id="description" 
                value={formData.description} 
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="What can this role do?"
              />
            </div>

            <div className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-semibold">Permissions</Label>
                  <p className="text-sm text-muted-foreground">Define what this role can do across the system.</p>
                </div>
                <div className="flex items-center gap-2 bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20">
                  <Checkbox 
                    id="perm-all" 
                    checked={formData.permissions.includes('*')}
                    onCheckedChange={() => togglePermission('', '*')}
                  />
                  <Label htmlFor="perm-all" className="text-sm font-bold text-primary cursor-pointer">Full Admin Access (*)</Label>
                </div>
              </div>

              <div className="border rounded-md overflow-hidden bg-background">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="w-[240px]">Resource</TableHead>
                      {ACTIONS.map(action => (
                        <TableHead key={action.id} className="text-center py-3">
                          <div className="flex flex-col items-center">
                            <span className="text-xs font-bold uppercase tracking-wider">{action.label}</span>
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(groupedResources).map(([group, resources]) => (
                      <React.Fragment key={group}>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableCell colSpan={ACTIONS.length + 1} className="py-2 px-4 font-bold text-xs uppercase tracking-tight text-muted-foreground">
                            {group}
                          </TableCell>
                        </TableRow>
                        {resources.map(resource => (
                          <TableRow key={resource.id} className="hover:bg-muted/5">
                            <TableCell className="font-medium pl-6">
                              {resource.label}
                            </TableCell>
                            {ACTIONS.map(action => (
                              <TableCell key={action.id} className="text-center">
                                <Checkbox 
                                  checked={hasPermission(resource.id, action.id)}
                                  onCheckedChange={() => togglePermission(resource.id, action.id)}
                                  disabled={formData.permissions.includes('*') && action.id !== '*'}
                                />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit}>Save Role</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={confirmDelete}
        title="Delete Role"
        description={`Are you sure you want to delete the role "${roleToDelete?.label}"? Users with this role might lose access.`}
      />
    </div>
  )
}