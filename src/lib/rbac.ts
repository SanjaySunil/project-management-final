export type Role = 'admin' | 'employee';

export interface RoleData {
  label: string;
  description: string;
  permissions: string[];
}

export const ROLES: Record<Role, RoleData> = {
  admin: {
    label: 'Admin',
    description: 'Full access to all resources and settings.',
    permissions: ['*'],
  },
  employee: {
    label: 'Employee',
    description: 'Can manage projects, tasks, clients, and chat. Cannot manage users or organization settings.',
    permissions: [
      'dashboard:read',
      'projects:*',
      'tasks:*',
      'deliverables:*',
      'proposals:*',
      'clients:*',
      'team:read',
      'chat:*',
      'credentials:*',
      'organizations:read',
    ],
  },
};

export function hasPermission(
  userRole: string | null, 
  action: string, 
  resource: string
): boolean {
  if (!userRole) return false;
  
  // Normalize role
  const role = (userRole.toLowerCase() === 'admin' ? 'admin' : 'employee') as Role;
  const roleData = ROLES[role];
  
  if (!roleData) return false;

  const { permissions } = roleData;
  
  if (permissions.includes('*')) return true;
  if (permissions.includes(`${resource}:*`)) return true;
  
  const permission = `${resource}:${action}`;
  if (permissions.includes(permission)) return true;

  return false;
}

export function canManageUsers(userRole: string | null): boolean {
  return userRole?.toLowerCase() === 'admin';
}