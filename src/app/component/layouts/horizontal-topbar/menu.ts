import { MenuItem, UserRole, RoleMenuConfig } from './menu.model';

// ============================================================================
// CLIENT MENU (ROLE_USER) - Simple portal access
// ============================================================================
export const CLIENT_MENU: MenuItem[] = [
  {
    id: 'client-dashboard',
    label: 'Dashboard',
    icon: 'ri-dashboard-2-line',
    link: '/client/dashboard'
  },
  {
    id: 'client-cases',
    label: 'My Cases',
    icon: 'ri-briefcase-line',
    link: '/client/cases'
  },
  {
    id: 'client-documents',
    label: 'Documents',
    icon: 'ri-file-text-line',
    link: '/client/documents'
  },
  {
    id: 'client-appointments',
    label: 'Appointments',
    icon: 'ri-calendar-check-line',
    link: '/client/appointments'
  },
  {
    id: 'client-messages',
    label: 'Messages',
    icon: 'ri-message-2-line',
    link: '/client/messages'
  },
  {
    id: 'client-invoices',
    label: 'Invoices',
    icon: 'ri-bill-line',
    link: '/client/invoices'
  },
  {
    id: 'client-profile',
    label: 'Profile',
    icon: 'ri-user-settings-line',
    link: '/client/profile'
  }
];

// ============================================================================
// SECRETARY MENU (ROLE_SECRETARY) - Administrative support
// ============================================================================
export const SECRETARY_MENU: MenuItem[] = [
  {
    id: 'sec-dashboard',
    label: 'Dashboard',
    icon: 'ri-dashboard-2-line',
    link: '/home'
  },
  {
    id: 'sec-calendar',
    label: 'Calendar',
    icon: 'ri-calendar-line',
    link: '/legal/calendar'
  },
  {
    id: 'sec-clients',
    label: 'Clients',
    icon: 'ri-user-3-line',
    link: '/clients'
  },
  {
    id: 'sec-crm',
    label: 'CRM',
    icon: 'ri-customer-service-2-line',
    link: '/crm/dashboard',
    subItems: [
      { id: 'sec-crm-dashboard', label: 'Dashboard', link: '/crm/dashboard', parentId: 'sec-crm' },
      { id: 'sec-crm-intake', label: 'Intake Submissions', link: '/crm/intake-submissions', parentId: 'sec-crm' },
      { id: 'sec-crm-conflicts', label: 'Conflict Checks', link: '/crm/conflict-checks', parentId: 'sec-crm' }
    ]
  },
  {
    id: 'sec-documents',
    label: 'Documents',
    icon: 'ri-folder-2-line',
    link: '/file-manager'
  },
  {
    id: 'sec-tasks',
    label: 'Tasks',
    icon: 'ri-task-line',
    link: '/case-management/tasks'
  }
];

// ============================================================================
// PARALEGAL MENU - Legal support staff
// ============================================================================
export const PARALEGAL_MENU: MenuItem[] = [
  {
    id: 'para-dashboard',
    label: 'Dashboard',
    icon: 'ri-dashboard-2-line',
    link: '/home'
  },
  {
    id: 'para-case-mgmt',
    label: 'Case Management',
    icon: 'ri-briefcase-4-line',
    link: '/legal/cases',
    subItems: [
      { id: 'para-case-cases', label: 'Cases', link: '/legal/cases', parentId: 'para-case-mgmt' },
      { id: 'para-case-calendar', label: 'Calendar', link: '/legal/calendar', parentId: 'para-case-mgmt' },
      { id: 'para-case-tasks', label: 'Tasks', link: '/case-management/tasks', parentId: 'para-case-mgmt' },
      { id: 'para-case-assignments', label: 'Assignments', link: '/case-management/assignments', parentId: 'para-case-mgmt' }
    ]
  },
  {
    id: 'para-time',
    label: 'Time Tracking',
    icon: 'ri-time-line',
    link: '/time-tracking/dashboard',
    subItems: [
      { id: 'para-time-dashboard', label: 'Dashboard', link: '/time-tracking/dashboard', parentId: 'para-time' },
      { id: 'para-time-entry', label: 'Log Time', link: '/time-tracking/entry', parentId: 'para-time' },
      { id: 'para-time-timesheet', label: 'Timesheet', link: '/time-tracking/timesheet', parentId: 'para-time' }
    ]
  },
  {
    id: 'para-files',
    label: 'File Manager',
    icon: 'ri-folder-2-line',
    link: '/file-manager'
  }
];

// ============================================================================
// FINANCE MENU (ROLE_FINANCE) - Financial management focus
// ============================================================================
export const FINANCE_MENU: MenuItem[] = [
  {
    id: 'fin-dashboard',
    label: 'Dashboard',
    icon: 'ri-dashboard-2-line',
    link: '/home'
  },
  {
    id: 'fin-financial',
    label: 'Financial',
    icon: 'ri-money-dollar-circle-line',
    link: '/billing-dashboard',
    subItems: [
      { id: 'fin-billing-dash', label: 'Billing Dashboard', link: '/billing-dashboard', parentId: 'fin-financial' },
      {
        id: 'fin-invoices',
        label: 'Invoices',
        link: '/invoices',
        parentId: 'fin-financial',
        subItems: [
          { id: 'fin-inv-list', label: 'All Invoices', link: '/invoices', parentId: 'fin-invoices' },
          { id: 'fin-inv-payments', label: 'Payments', link: '/invoices/payments', parentId: 'fin-invoices' },
          { id: 'fin-inv-templates', label: 'Templates', link: '/invoices/templates', parentId: 'fin-invoices' },
          { id: 'fin-inv-workflows', label: 'Workflows', link: '/invoices/workflows', parentId: 'fin-invoices' }
        ]
      },
      {
        id: 'fin-expenses',
        label: 'Expenses',
        link: '/expenses',
        parentId: 'fin-financial',
        subItems: [
          { id: 'fin-exp-list', label: 'All Expenses', link: '/expenses', parentId: 'fin-expenses' },
          { id: 'fin-exp-categories', label: 'Categories', link: '/expenses/categories', parentId: 'fin-expenses' },
          { id: 'fin-exp-vendors', label: 'Vendors', link: '/expenses/vendors', parentId: 'fin-expenses' }
        ]
      },
      { id: 'fin-analytics', label: 'Analytics', link: '/time-tracking/billing/analytics', parentId: 'fin-financial' }
    ]
  },
  {
    id: 'fin-time-billing',
    label: 'Time & Billing',
    icon: 'ri-time-line',
    link: '/time-tracking/dashboard',
    subItems: [
      { id: 'fin-time-dashboard', label: 'Dashboard', link: '/time-tracking/dashboard', parentId: 'fin-time-billing' },
      { id: 'fin-time-approval', label: 'Approval', link: '/time-tracking/approval', parentId: 'fin-time-billing' },
      { id: 'fin-time-rates', label: 'Billing Rates', link: '/time-tracking/rates', parentId: 'fin-time-billing' },
      { id: 'fin-time-rate-mgmt', label: 'Rate Management', link: '/time-tracking/rate-management', parentId: 'fin-time-billing' },
      { id: 'fin-time-invoice-gen', label: 'Invoice Generation', link: '/time-tracking/billing/invoice-generation', parentId: 'fin-time-billing' }
    ]
  },
  {
    id: 'fin-clients',
    label: 'Clients',
    icon: 'ri-user-3-line',
    link: '/clients'
  }
];

// ============================================================================
// ATTORNEY MENU (ROLE_ATTORNEY) - Full legal practice management
// ============================================================================
export const ATTORNEY_MENU: MenuItem[] = [
  {
    id: 'att-dashboard',
    label: 'Dashboard',
    icon: 'ri-dashboard-2-line',
    link: '/home'
  },
  {
    id: 'att-case-mgmt',
    label: 'Case Management',
    icon: 'ri-briefcase-4-line',
    link: '/legal/cases',
    subItems: [
      { id: 'att-case-cases', label: 'Cases', link: '/legal/cases', parentId: 'att-case-mgmt' },
      { id: 'att-case-calendar', label: 'Calendar', link: '/legal/calendar', parentId: 'att-case-mgmt' },
      { id: 'att-case-tasks', label: 'Tasks', link: '/case-management/tasks', parentId: 'att-case-mgmt' },
      { id: 'att-case-assignments', label: 'Assignments', link: '/case-management/assignments', parentId: 'att-case-mgmt' }
    ]
  },
  {
    id: 'att-ai-workspace',
    label: 'AI Workspace',
    icon: 'ri-robot-line',
    link: '/legal/ai-assistant/ai-workspace'
  },
  {
    id: 'att-clients',
    label: 'Clients',
    icon: 'ri-user-3-line',
    link: '/clients'
  },
  {
    id: 'att-time-billing',
    label: 'Time & Billing',
    icon: 'ri-time-line',
    link: '/time-tracking/dashboard',
    subItems: [
      { id: 'att-time-dashboard', label: 'Dashboard', link: '/time-tracking/dashboard', parentId: 'att-time-billing' },
      { id: 'att-time-entry', label: 'Log Time', link: '/time-tracking/entry', parentId: 'att-time-billing' },
      { id: 'att-time-timesheet', label: 'Timesheet', link: '/time-tracking/timesheet', parentId: 'att-time-billing' },
      { id: 'att-time-approval', label: 'Approval', link: '/time-tracking/approval', parentId: 'att-time-billing' },
      { id: 'att-time-rates', label: 'Billing Rates', link: '/time-tracking/rates', parentId: 'att-time-billing' }
    ]
  },
  {
    id: 'att-financial',
    label: 'Financial',
    icon: 'ri-money-dollar-circle-line',
    link: '/invoices',
    subItems: [
      {
        id: 'att-invoices',
        label: 'Invoices',
        link: '/invoices',
        parentId: 'att-financial',
        subItems: [
          { id: 'att-inv-list', label: 'All Invoices', link: '/invoices', parentId: 'att-invoices' },
          { id: 'att-inv-payments', label: 'Payments', link: '/invoices/payments', parentId: 'att-invoices' },
          { id: 'att-inv-templates', label: 'Templates', link: '/invoices/templates', parentId: 'att-invoices' },
          { id: 'att-inv-workflows', label: 'Workflows', link: '/invoices/workflows', parentId: 'att-invoices' }
        ]
      },
      {
        id: 'att-expenses',
        label: 'Expenses',
        link: '/expenses',
        parentId: 'att-financial',
        subItems: [
          { id: 'att-exp-list', label: 'All Expenses', link: '/expenses', parentId: 'att-expenses' },
          { id: 'att-exp-categories', label: 'Categories', link: '/expenses/categories', parentId: 'att-expenses' },
          { id: 'att-exp-vendors', label: 'Vendors', link: '/expenses/vendors', parentId: 'att-expenses' }
        ]
      }
    ]
  },
  {
    id: 'att-crm',
    label: 'CRM',
    icon: 'ri-customer-service-2-line',
    link: '/crm/dashboard',
    subItems: [
      { id: 'att-crm-dashboard', label: 'Dashboard', link: '/crm/dashboard', parentId: 'att-crm' },
      { id: 'att-crm-leads', label: 'Leads', link: '/crm/leads', parentId: 'att-crm' },
      { id: 'att-crm-intake', label: 'Intake Submissions', link: '/crm/intake-submissions', parentId: 'att-crm' },
      { id: 'att-crm-conflicts', label: 'Conflict Checks', link: '/crm/conflict-checks', parentId: 'att-crm' }
    ]
  },
  {
    id: 'att-signatures',
    label: 'E-Signatures',
    icon: 'ri-quill-pen-line',
    link: '/signatures'
  },
  {
    id: 'att-files',
    label: 'File Manager',
    icon: 'ri-folder-2-line',
    link: '/file-manager',
    subItems: [
      { id: 'att-files-main', label: 'My Documents', link: '/file-manager', parentId: 'att-files' },
      { id: 'att-files-templates', label: 'Templates', link: '/file-manager/templates', parentId: 'att-files' }
    ]
  }
];

// ============================================================================
// ADMIN MENU (ROLE_ADMIN) - Full system access
// ============================================================================
export const ADMIN_MENU: MenuItem[] = [
  {
    id: 'admin-dashboard',
    label: 'Dashboard',
    icon: 'ri-dashboard-2-line',
    link: '/home'
  },
  {
    id: 'admin-case-mgmt',
    label: 'Case Management',
    icon: 'ri-briefcase-4-line',
    link: '/legal/cases',
    subItems: [
      { id: 'admin-case-cases', label: 'Cases', link: '/legal/cases', parentId: 'admin-case-mgmt' },
      { id: 'admin-case-calendar', label: 'Calendar', link: '/legal/calendar', parentId: 'admin-case-mgmt' },
      { id: 'admin-case-tasks', label: 'Tasks', link: '/case-management/tasks', parentId: 'admin-case-mgmt' },
      { id: 'admin-case-assignments', label: 'Assignments', link: '/case-management/assignments', parentId: 'admin-case-mgmt' }
    ]
  },
  {
    id: 'admin-ai-workspace',
    label: 'AI Workspace',
    icon: 'ri-robot-line',
    link: '/legal/ai-assistant/ai-workspace'
  },
  {
    id: 'admin-clients',
    label: 'Clients',
    icon: 'ri-user-3-line',
    link: '/clients'
  },
  {
    id: 'admin-time-billing',
    label: 'Time & Billing',
    icon: 'ri-time-line',
    link: '/time-tracking/dashboard',
    subItems: [
      { id: 'admin-time-dashboard', label: 'Dashboard', link: '/time-tracking/dashboard', parentId: 'admin-time-billing' },
      { id: 'admin-time-entry', label: 'Log Time', link: '/time-tracking/entry', parentId: 'admin-time-billing' },
      { id: 'admin-time-timesheet', label: 'Timesheet', link: '/time-tracking/timesheet', parentId: 'admin-time-billing' },
      { id: 'admin-time-approval', label: 'Approval', link: '/time-tracking/approval', parentId: 'admin-time-billing' },
      { id: 'admin-time-rates', label: 'Billing Rates', link: '/time-tracking/rates', parentId: 'admin-time-billing' },
      { id: 'admin-time-rate-mgmt', label: 'Rate Management', link: '/time-tracking/rate-management', parentId: 'admin-time-billing' },
      { id: 'admin-time-invoice-gen', label: 'Invoice Generation', link: '/time-tracking/billing/invoice-generation', parentId: 'admin-time-billing' },
      { id: 'admin-time-analytics', label: 'Analytics', link: '/time-tracking/billing/analytics', parentId: 'admin-time-billing' }
    ]
  },
  {
    id: 'admin-financial',
    label: 'Financial',
    icon: 'ri-money-dollar-circle-line',
    link: '/billing-dashboard',
    subItems: [
      { id: 'admin-billing-dash', label: 'Billing Dashboard', link: '/billing-dashboard', parentId: 'admin-financial' },
      {
        id: 'admin-invoices',
        label: 'Invoices',
        link: '/invoices',
        parentId: 'admin-financial',
        subItems: [
          { id: 'admin-inv-list', label: 'All Invoices', link: '/invoices', parentId: 'admin-invoices' },
          { id: 'admin-inv-payments', label: 'Payments', link: '/invoices/payments', parentId: 'admin-invoices' },
          { id: 'admin-inv-templates', label: 'Templates', link: '/invoices/templates', parentId: 'admin-invoices' },
          { id: 'admin-inv-workflows', label: 'Workflows', link: '/invoices/workflows', parentId: 'admin-invoices' }
        ]
      },
      {
        id: 'admin-expenses',
        label: 'Expenses',
        link: '/expenses',
        parentId: 'admin-financial',
        subItems: [
          { id: 'admin-exp-list', label: 'All Expenses', link: '/expenses', parentId: 'admin-expenses' },
          { id: 'admin-exp-categories', label: 'Categories', link: '/expenses/categories', parentId: 'admin-expenses' },
          { id: 'admin-exp-vendors', label: 'Vendors', link: '/expenses/vendors', parentId: 'admin-expenses' }
        ]
      }
    ]
  },
  {
    id: 'admin-crm',
    label: 'CRM',
    icon: 'ri-customer-service-2-line',
    link: '/crm/dashboard',
    subItems: [
      { id: 'admin-crm-dashboard', label: 'Dashboard', link: '/crm/dashboard', parentId: 'admin-crm' },
      { id: 'admin-crm-leads', label: 'Leads', link: '/crm/leads', parentId: 'admin-crm' },
      { id: 'admin-crm-intake', label: 'Intake Submissions', link: '/crm/intake-submissions', parentId: 'admin-crm' },
      { id: 'admin-crm-conflicts', label: 'Conflict Checks', link: '/crm/conflict-checks', parentId: 'admin-crm' }
    ]
  },
  {
    id: 'admin-signatures',
    label: 'E-Signatures',
    icon: 'ri-quill-pen-line',
    link: '/signatures'
  },
  {
    id: 'admin-files',
    label: 'File Manager',
    icon: 'ri-folder-2-line',
    link: '/file-manager',
    subItems: [
      { id: 'admin-files-main', label: 'My Documents', link: '/file-manager', parentId: 'admin-files' },
      { id: 'admin-files-deleted', label: 'Deleted Files', link: '/file-manager/deleted', parentId: 'admin-files' },
      { id: 'admin-files-templates', label: 'Templates', link: '/file-manager/templates', parentId: 'admin-files' },
      { id: 'admin-files-firm', label: 'Firm Templates', link: '/file-manager/firm-templates', parentId: 'admin-files' },
      { id: 'admin-files-permissions', label: 'Permissions', link: '/file-manager/permissions', parentId: 'admin-files' }
    ]
  },
  {
    id: 'admin-admin',
    label: 'Admin',
    icon: 'ri-admin-line',
    link: '/admin/roles',
    subItems: [
      { id: 'admin-admin-users', label: 'Users', link: '/users', parentId: 'admin-admin' },
      { id: 'admin-admin-roles', label: 'Role Management', link: '/admin/roles', parentId: 'admin-admin' },
      { id: 'admin-admin-user-roles', label: 'User Roles', link: '/admin/user-roles', parentId: 'admin-admin' },
      { id: 'admin-admin-hierarchy', label: 'Role Hierarchy', link: '/admin/hierarchy', parentId: 'admin-admin' },
      { id: 'admin-admin-audit', label: 'Audit Logs', link: '/admin/audit-logs', parentId: 'admin-admin' }
    ]
  }
];

// ============================================================================
// ROLE MENU CONFIGURATIONS
// ============================================================================
export const ROLE_MENU_CONFIGS: { [key in UserRole]: RoleMenuConfig } = {
  'ROLE_USER': {
    role: 'ROLE_USER',
    defaultRedirect: '/client/dashboard',
    menu: CLIENT_MENU
  },
  'ROLE_SECRETARY': {
    role: 'ROLE_SECRETARY',
    defaultRedirect: '/home',
    menu: SECRETARY_MENU
  },
  'PARALEGAL': {
    role: 'PARALEGAL',
    defaultRedirect: '/home',
    menu: PARALEGAL_MENU
  },
  'ROLE_FINANCE': {
    role: 'ROLE_FINANCE',
    defaultRedirect: '/home',
    menu: FINANCE_MENU
  },
  'ROLE_ATTORNEY': {
    role: 'ROLE_ATTORNEY',
    defaultRedirect: '/home',
    menu: ATTORNEY_MENU
  },
  'ROLE_ADMIN': {
    role: 'ROLE_ADMIN',
    defaultRedirect: '/home',
    menu: ADMIN_MENU
  }
};

// ============================================================================
// HELPER FUNCTION: Get menu for user role
// ============================================================================
export function getMenuForRole(role: string): MenuItem[] {
  const normalizedRole = role?.toUpperCase() as UserRole;
  const config = ROLE_MENU_CONFIGS[normalizedRole];

  if (config) {
    return config.menu;
  }

  // Default to client menu if role not recognized
  console.warn(`Unknown role: ${role}, defaulting to client menu`);
  return CLIENT_MENU;
}

// ============================================================================
// HELPER FUNCTION: Get default redirect for role
// ============================================================================
export function getDefaultRedirectForRole(role: string): string {
  const normalizedRole = role?.toUpperCase() as UserRole;
  const config = ROLE_MENU_CONFIGS[normalizedRole];

  if (config) {
    return config.defaultRedirect;
  }

  return '/client/dashboard';
}

// ============================================================================
// LEGACY MENU (for backward compatibility during transition)
// ============================================================================
export const MENU: MenuItem[] = ADMIN_MENU;
