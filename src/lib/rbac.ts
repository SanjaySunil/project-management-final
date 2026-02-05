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
      'dashboard:read',
      'projects:*',
      'tasks:*',
      'deliverables:*',
      'proposals:*',
      'clients:*',
      'finances:*',
      'team:read', 'team:create', 'team:update',
      'chat:*',
      'credentials:*',
      'audit_logs:read',
    ],
    is_system: true,
  },
  developer: {
    label: 'Developer',
    description: 'Can view and edit projects and tasks.',
    permissions: [
      'dashboard:read',
      'projects:read', 'projects:update',
      'tasks:*',
      'deliverables:read', 'deliverables:update',
      'proposals:read',
      'clients:read',
      'finances:read',
      'team:read',
      'chat:*',
      'credentials:read', 'credentials:create', 'credentials:update',
    ],
    is_system: true,
  },
  viewer: {
    label: 'Viewer',
    description: 'Can only view resources.',
    permissions: [
      'dashboard:read',
      'projects:read',
      'tasks:read',
      'deliverables:read',
      'proposals:read',
      'clients:read',
      'finances:read',
      'team:read',
      'chat:read',
    ],
    is_system: true,
  },
};

export const RESOURCES = [
  { id: 'dashboard', label: 'Dashboard', group: 'General' },
  { id: 'projects', label: 'Projects', group: 'Project Management' },
  { id: 'tasks', label: 'Tasks', group: 'Project Management' },
  { id: 'deliverables', label: 'Deliverables', group: 'Project Management' },
  { id: 'proposals', label: 'Proposals', group: 'Project Management' },
  { id: 'clients', label: 'Clients', group: 'CRM' },
  { id: 'finances', label: 'Finances', group: 'Business' },
  { id: 'team', label: 'Team Members', group: 'User Management' },
  { id: 'roles', label: 'Roles & Permissions', group: 'User Management' },
  { id: 'chat', label: 'Chat & Messaging', group: 'Communication' },
  { id: 'credentials', label: 'Credentials', group: 'Security' },
  { id: 'audit_logs', label: 'Audit Logs', group: 'Security' },
  { id: 'organizations', label: 'Organization Settings', group: 'Settings' },
] as const;

export type ResourceId = typeof RESOURCES[number]['id'];

export const ACTIONS = [
  { id: 'read', label: 'Read', description: 'Can view the resource' },
  { id: 'create', label: 'Create', description: 'Can create new entries' },
  { id: 'update', label: 'Update', description: 'Can edit existing entries' },
  { id: 'delete', label: 'Delete', description: 'Can remove entries' },
  { id: '*', label: 'All', description: 'Full access to this resource' },
] as const;

export type ActionId = typeof ACTIONS[number]['id'];

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
  if (permissions.includes(`${resource}:*`)) return true;
  
  const permission = `${resource}:${action}`;
  if (permissions.includes(permission)) return true;

  // Backward compatibility: 'write' covers 'create' and 'update'
  if ((action === 'create' || action === 'update') && permissions.includes(`${resource}:write`)) {
    return true;
  }
  
  return false;
}

export function canManageRole(currentUserRole: string | null, targetRole: string | null): boolean {
  if (currentUserRole === 'admin') return true;
  if (currentUserRole === 'manager' && targetRole !== 'admin') return true;
  return false;
}
