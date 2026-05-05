export interface MenuItem {
  id?: number | string;
  label?: string;
  icon?: string;
  /** Lucide icon name (preferred over Remix `icon` for the horizontal topbar). */
  lucideIcon?: string;
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

// Core menu tiers — each maps to a distinct menu layout
export type UserRole =
  | 'ROLE_SUPERADMIN'
  | 'ROLE_ADMIN'
  | 'ROLE_ATTORNEY'
  | 'ROLE_FINANCE'
  | 'PARALEGAL'
  | 'ROLE_SECRETARY'
  | 'ROLE_USER';

// Role hierarchy levels for the core tiers
export const ROLE_HIERARCHY: { [key in UserRole]: number } = {
  'ROLE_SUPERADMIN': 200,
  'ROLE_ADMIN': 100,
  'ROLE_ATTORNEY': 70,
  'ROLE_FINANCE': 65,
  'PARALEGAL': 40,
  'ROLE_SECRETARY': 20,
  'ROLE_USER': 10
};

// Extended hierarchy covering all DB roles (used for getHighestHierarchyRole)
export const EXTENDED_ROLE_HIERARCHY: { [key: string]: number } = {
  'ROLE_SUPERADMIN': 200,
  'MANAGING_PARTNER': 95,
  'SENIOR_PARTNER': 90,
  'EQUITY_PARTNER': 85,
  'COO': 82,
  'CFO': 80,
  'NON_EQUITY_PARTNER': 75,
  'OF_COUNSEL': 70,
  'ROLE_ADMIN': 65,
  'ADMIN': 65,
  'SENIOR_ASSOCIATE': 60,
  'ASSOCIATE': 55,
  'JUNIOR_ASSOCIATE': 50,
  'ROLE_ATTORNEY': 45,
  'ATTORNEY': 45,
  'SENIOR_PARALEGAL': 40,
  'PARALEGAL': 35,
  'LEGAL_ASSISTANT': 30,
  'LAW_CLERK': 28,
  'ROLE_FINANCE': 25,
  'FINANCE': 25,
  'MANAGER': 22,
  'ROLE_SECRETARY': 20,
  'SECRETARY': 20,
  'IT_ADMIN': 18,
  'HR': 15,
  'MARKETING': 12,
  'ROLE_USER': 10,
  'CLIENT': 10,
  'INTERN': 5
};

/**
 * Maps any role name to its core menu tier (UserRole).
 * Leadership/partner roles → ADMIN menu
 * Legal practitioner roles → ATTORNEY menu
 * Support staff → PARALEGAL menu
 * Finance → FINANCE menu
 * Administrative → SECRETARY menu
 * Everyone else → CLIENT menu
 */
export function resolveMenuTier(role: string): UserRole {
  const r = role?.toUpperCase() || '';

  // Exact matches to core tiers
  if (r === 'ROLE_SUPERADMIN') return 'ROLE_SUPERADMIN';
  if (r === 'ROLE_ADMIN' || r === 'ADMIN') return 'ROLE_ADMIN';
  if (r === 'ROLE_ATTORNEY' || r === 'ATTORNEY') return 'ROLE_ATTORNEY';
  if (r === 'ROLE_FINANCE' || r === 'FINANCE') return 'ROLE_FINANCE';
  if (r === 'PARALEGAL') return 'PARALEGAL';
  if (r === 'ROLE_SECRETARY' || r === 'SECRETARY') return 'ROLE_SECRETARY';
  if (r === 'ROLE_USER' || r === 'CLIENT') return 'ROLE_USER';

  // Leadership/Partner roles → ADMIN menu
  if (['MANAGING_PARTNER', 'SENIOR_PARTNER', 'EQUITY_PARTNER', 'COO', 'CFO',
       'IT_ADMIN', 'MANAGER'].includes(r)) {
    return 'ROLE_ADMIN';
  }

  // Legal practitioner roles → ATTORNEY menu
  if (['NON_EQUITY_PARTNER', 'OF_COUNSEL', 'SENIOR_ASSOCIATE', 'ASSOCIATE',
       'JUNIOR_ASSOCIATE'].includes(r)) {
    return 'ROLE_ATTORNEY';
  }

  // Legal support roles → PARALEGAL menu
  if (['SENIOR_PARALEGAL', 'LEGAL_ASSISTANT', 'LAW_CLERK', 'INTERN'].includes(r)) {
    return 'PARALEGAL';
  }

  // Administrative support → SECRETARY menu
  if (['HR', 'MARKETING'].includes(r)) {
    return 'ROLE_SECRETARY';
  }

  // Unknown role — default to client
  return 'ROLE_USER';
}

// Firm type — determines which menu variant to use
export type FirmType = 'SOLO_PRACTITIONER' | 'SMALL_FIRM' | 'MIDSIZE_FIRM' | 'LARGE_FIRM';

// Role display names
export const ROLE_DISPLAY_NAMES: { [key in UserRole]: string } = {
  'ROLE_SUPERADMIN': 'Super Admin',
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
