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
  console.log(`Checking permission: role=${userRole}, action=${action}, resource=${resource}`);
  if (!userRole) {
    console.log('Permission denied: No user role provided');
    return false;
  }
  
  // Normalize role
  const role = (userRole.toLowerCase() === 'admin' ? 'admin' : 'employee') as Role;
  const roleData = ROLES[role];
  
  if (!roleData) {
    console.log(`Permission denied: No role data found for role=${role}`);
    return false;
  }

  const { permissions } = roleData;
  
  if (permissions.includes('*')) {
    console.log('Permission granted: Global wildcard (*) found');
    return true;
  }
  if (permissions.includes(`${resource}:*`)) {
    console.log(`Permission granted: Resource wildcard (${resource}:*) found`);
    return true;
  }
  
  const permission = `${resource}:${action}`;
  if (permissions.includes(permission)) {
    console.log(`Permission granted: Explicit permission (${permission}) found`);
    return true;
  }

  console.log(`Permission denied: No matching permission found for ${resource}:${action}`);
  return false;
}

export function canManageUsers(userRole: string | null): boolean {
  return userRole?.toLowerCase() === 'admin';
}