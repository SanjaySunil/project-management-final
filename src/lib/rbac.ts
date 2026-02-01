export type Role = string;

export interface Permission {
  action: string;
  resource: string;
}

export interface RoleData {
  label: string;
  description: string;
  permissions: string[];
  is_system?: boolean;
}

export const ROLES: Record<string, RoleData> = {
  admin: {
    label: 'Admin',
    description: 'Full access to all resources and settings.',
    permissions: ['*'],
    is_system: true,
  },
  manager: {
    label: 'Manager',
    description: 'Can manage projects, clients, and team members (except admins).',
    permissions: [
      'projects:read', 'projects:write', 'projects:delete',
      'clients:read', 'clients:write', 'clients:delete',
      'team:read', 'team:write',
      'proposals:read', 'proposals:write',
      'credentials:read', 'credentials:write',
    ],
    is_system: true,
  },
  developer: {
    label: 'Developer',
    description: 'Can view and edit projects and tasks.',
    permissions: [
      'projects:read', 'projects:write',
      'clients:read',
      'team:read',
      'proposals:read',
      'credentials:read', 'credentials:write',
    ],
    is_system: true,
  },
  viewer: {
    label: 'Viewer',
    description: 'Can only view resources.',
    permissions: [
      'projects:read',
      'clients:read',
      'team:read',
      'proposals:read',
    ],
    is_system: true,
  },
};

export const RESOURCES = [
  { id: 'projects', label: 'Projects' },
  { id: 'clients', label: 'Clients' },
  { id: 'team', label: 'Team' },
  { id: 'proposals', label: 'Proposals' },
  { id: 'credentials', label: 'Credentials' },
  { id: 'audit_logs', label: 'Audit Logs' },
  { id: 'organizations', label: 'Organization' },
];

export const ACTIONS = [
  { id: 'read', label: 'Read' },
  { id: 'write', label: 'Write' },
  { id: 'delete', label: 'Delete' },
  { id: '*', label: 'All' },
];

export function hasPermission(
  userRole: string | null, 
  action: string, 
  resource: string, 
  customRoles?: Record<string, RoleData>
): boolean {
  if (!userRole) return false;
  
  const rolesMap = customRoles || ROLES;
  const roleData = rolesMap[userRole];
  
  if (!roleData) {
    // If not in custom roles, check if it's in built-in roles
    const systemRoleData = ROLES[userRole];
    if (!systemRoleData) return false;
    return checkPermissions(systemRoleData.permissions, action, resource);
  }

  return checkPermissions(roleData.permissions, action, resource);
}

function checkPermissions(permissions: string[], action: string, resource: string): boolean {
  if (permissions.includes('*')) return true;
  
  const permission = `${resource}:${action}`;
  return permissions.includes(permission) || permissions.includes(`${resource}:*`);
}

export function canManageRole(currentUserRole: string | null, targetRole: string | null): boolean {
  if (currentUserRole === 'admin') return true;
  if (currentUserRole === 'manager' && targetRole !== 'admin') return true;
  return false;
}
