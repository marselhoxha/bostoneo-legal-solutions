export interface MenuItem {
  id?: number | string;
  label?: string;
  icon?: string;
  link?: string;
  subItems?: MenuItem[];
  isTitle?: boolean;
  badge?: {
    text: string;
    variant: string;
  };
  parentId?: number | string;
  isLayout?: boolean;
  requiredPermission?: {
    resource: string;
    action: string;
  };
  // Simplified roles: ROLE_ADMIN, ROLE_ATTORNEY, ROLE_FINANCE, PARALEGAL, ROLE_SECRETARY, ROLE_USER
  requiredRoles?: string[];
  childItem?: MenuItem[];
}

// Role types for menu selection
export type UserRole =
  | 'ROLE_ADMIN'
  | 'ROLE_ATTORNEY'
  | 'ROLE_FINANCE'
  | 'PARALEGAL'
  | 'ROLE_SECRETARY'
  | 'ROLE_USER';

// Role hierarchy levels
export const ROLE_HIERARCHY: { [key in UserRole]: number } = {
  'ROLE_ADMIN': 100,
  'ROLE_ATTORNEY': 70,
  'ROLE_FINANCE': 65,
  'PARALEGAL': 40,
  'ROLE_SECRETARY': 20,
  'ROLE_USER': 10
};

// Role display names
export const ROLE_DISPLAY_NAMES: { [key in UserRole]: string } = {
  'ROLE_ADMIN': 'Administrator',
  'ROLE_ATTORNEY': 'Attorney',
  'ROLE_FINANCE': 'Finance',
  'PARALEGAL': 'Paralegal',
  'ROLE_SECRETARY': 'Secretary',
  'ROLE_USER': 'Client'
};

// Role-based menu configuration interface
export interface RoleMenuConfig {
  role: UserRole;
  defaultRedirect: string;
  menu: MenuItem[];
}
