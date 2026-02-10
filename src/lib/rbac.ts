export type Role = 'admin' | 'employee' | 'client';

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
      'projects:*',
      'tasks:*',
      'deliverables:*',
      'phases:*',
      'clients:*',
      'team:read',
      'chat:*',
      'credentials:*',
      'organizations:read',
    ],
  },
  client: {
    label: 'Client',
    description: 'Access to their own projects, tasks, and phases.',
    permissions: [
      'projects:read',
      'tasks:read',
      'deliverables:read',
      'phases:read',
      'chat:*',
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
  let role: Role | null = null;
  const lowerRole = userRole.toLowerCase();
  if (lowerRole === 'admin') role = 'admin';
  else if (lowerRole === 'employee') role = 'employee';
  else if (lowerRole === 'client') role = 'client';
  
  if (!role) {
    console.log(`Permission denied: Unrecognized role=${userRole}`);
    return false;
  }
  
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