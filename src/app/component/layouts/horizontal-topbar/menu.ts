import { MenuItem, UserRole, FirmType, RoleMenuConfig, resolveMenuTier } from './menu.model';

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
// No Documents/File Manager link
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
      { id: 'sec-crm-dashboard', label: 'Dashboard', icon: 'ri-dashboard-line', link: '/crm/dashboard', parentId: 'sec-crm' },
      { id: 'sec-crm-intake', label: 'Intake Submissions', icon: 'ri-inbox-line', link: '/crm/intake-submissions', parentId: 'sec-crm' },
      { id: 'sec-crm-conflicts', label: 'Conflict Checks', icon: 'ri-shield-check-line', link: '/crm/conflict-checks', parentId: 'sec-crm' }
    ]
  },
  {
    id: 'sec-tasks',
    label: 'Tasks',
    icon: 'ri-task-line',
    link: '/case-management/tasks'
  }
];

// ============================================================================
// PARALEGAL MENU - Calendar & Tasks top-level, no File Manager
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
      { id: 'para-case-assignments', label: 'Assignments', link: '/case-management/assignments', parentId: 'para-case-mgmt' }
    ]
  },
  {
    id: 'para-calendar',
    label: 'Calendar',
    icon: 'ri-calendar-line',
    link: '/legal/calendar'
  },
  {
    id: 'para-tasks',
    label: 'Tasks',
    icon: 'ri-task-line',
    link: '/case-management/tasks'
  },
  {
    id: 'para-time',
    label: 'Time Tracking',
    icon: 'ri-time-line',
    link: '/time-tracking/dashboard',
    subItems: [
      { id: 'para-time-dashboard', label: 'Dashboard', link: '/time-tracking/dashboard', parentId: 'para-time' },
      { id: 'para-time-entry', label: 'Log Time', link: '/time-tracking/entry', parentId: 'para-time' }
    ]
  }
];

// ============================================================================
// FINANCE MENU (ROLE_FINANCE) - Financial management focus (unchanged)
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
      { id: 'fin-billing-dash', label: 'Billing Dashboard', icon: 'ri-pie-chart-line', link: '/billing-dashboard', parentId: 'fin-financial' },
      {
        id: 'fin-invoices',
        label: 'Invoices',
        icon: 'ri-file-list-3-line',
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
        icon: 'ri-wallet-3-line',
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
// SOLO ATTORNEY MENU - Solo practitioner (no team features, no CRM)
// 7 top-level items + E-Signatures
// ============================================================================
export const SOLO_ATTORNEY_MENU: MenuItem[] = [
  {
    id: 'solo-att-dashboard',
    label: 'Dashboard',
    icon: 'ri-dashboard-2-line',
    link: '/home'
  },
  {
    id: 'solo-att-cases',
    label: 'Cases',
    icon: 'ri-briefcase-4-line',
    link: '/legal/cases'
  },
  {
    id: 'solo-att-calendar',
    label: 'Calendar',
    icon: 'ri-calendar-line',
    link: '/legal/calendar'
  },
  {
    id: 'solo-att-tasks',
    label: 'Tasks',
    icon: 'ri-task-line',
    link: '/case-management/tasks'
  },
  {
    id: 'solo-att-ai-tools',
    label: 'LegiTools',
    icon: 'ri-robot-line',
    link: '/legal/ai-assistant/legispace',
    subItems: [
      { id: 'solo-att-ai-workspace', label: 'LegiSpace', icon: 'ri-rocket-2-line', link: '/legal/ai-assistant/legispace', parentId: 'solo-att-ai-tools' },
      { id: 'solo-att-ai-pi', label: 'LegiPI', icon: 'ri-first-aid-kit-line', link: '/legal/ai-assistant/legipi', parentId: 'solo-att-ai-tools' }
    ]
  },
  {
    id: 'solo-att-clients',
    label: 'Clients',
    icon: 'ri-user-3-line',
    link: '/clients'
  },
  {
    id: 'solo-att-billing',
    label: 'Billing',
    icon: 'ri-money-dollar-circle-line',
    link: '/time-tracking/dashboard',
    subItems: [
      { id: 'solo-att-time-dashboard', label: 'Time Dashboard', link: '/time-tracking/dashboard', parentId: 'solo-att-billing' },
      { id: 'solo-att-time-entry', label: 'Log Time', link: '/time-tracking/entry', parentId: 'solo-att-billing' },
      { id: 'solo-att-time-rates', label: 'Billing Rates', link: '/time-tracking/rates', parentId: 'solo-att-billing' },
      {
        id: 'solo-att-invoices',
        label: 'Invoices',
        icon: 'ri-file-list-3-line',
        link: '/invoices',
        parentId: 'solo-att-billing',
        subItems: [
          { id: 'solo-att-inv-list', label: 'All Invoices', link: '/invoices', parentId: 'solo-att-invoices' },
          { id: 'solo-att-inv-workflows', label: 'Workflows', link: '/invoices/workflows', parentId: 'solo-att-invoices' }
        ]
      },
      {
        id: 'solo-att-expenses',
        label: 'Expenses',
        icon: 'ri-wallet-3-line',
        link: '/expenses',
        parentId: 'solo-att-billing',
        subItems: [
          { id: 'solo-att-exp-list', label: 'All Expenses', link: '/expenses', parentId: 'solo-att-expenses' },
          { id: 'solo-att-exp-categories', label: 'Categories', link: '/expenses/categories', parentId: 'solo-att-expenses' },
          { id: 'solo-att-exp-vendors', label: 'Vendors', link: '/expenses/vendors', parentId: 'solo-att-expenses' }
        ]
      }
    ]
  },
  {
    id: 'solo-att-signatures',
    label: 'E-Signatures',
    icon: 'ri-quill-pen-line',
    link: '/signatures'
  }
];

// ============================================================================
// SOLO ADMIN MENU - Solo practitioner with admin (+ Org Settings & Audit Logs)
// 8 top-level items
// ============================================================================
export const SOLO_ADMIN_MENU: MenuItem[] = [
  {
    id: 'solo-adm-dashboard',
    label: 'Dashboard',
    icon: 'ri-dashboard-2-line',
    link: '/home'
  },
  {
    id: 'solo-adm-cases',
    label: 'Cases',
    icon: 'ri-briefcase-4-line',
    link: '/legal/cases'
  },
  {
    id: 'solo-adm-calendar',
    label: 'Calendar',
    icon: 'ri-calendar-line',
    link: '/legal/calendar'
  },
  {
    id: 'solo-adm-tasks',
    label: 'Tasks',
    icon: 'ri-task-line',
    link: '/case-management/tasks'
  },
  {
    id: 'solo-adm-ai-tools',
    label: 'LegiTools',
    icon: 'ri-robot-line',
    link: '/legal/ai-assistant/legispace',
    subItems: [
      { id: 'solo-adm-ai-workspace', label: 'LegiSpace', icon: 'ri-rocket-2-line', link: '/legal/ai-assistant/legispace', parentId: 'solo-adm-ai-tools' },
      { id: 'solo-adm-ai-pi', label: 'LegiPI', icon: 'ri-first-aid-kit-line', link: '/legal/ai-assistant/legipi', parentId: 'solo-adm-ai-tools' }
    ]
  },
  {
    id: 'solo-adm-clients',
    label: 'Clients',
    icon: 'ri-user-3-line',
    link: '/clients'
  },
  {
    id: 'solo-adm-billing',
    label: 'Billing',
    icon: 'ri-money-dollar-circle-line',
    link: '/time-tracking/dashboard',
    subItems: [
      { id: 'solo-adm-time-dashboard', label: 'Time Dashboard', link: '/time-tracking/dashboard', parentId: 'solo-adm-billing' },
      { id: 'solo-adm-time-entry', label: 'Log Time', link: '/time-tracking/entry', parentId: 'solo-adm-billing' },
      { id: 'solo-adm-time-rates', label: 'Billing Rates', link: '/time-tracking/rates', parentId: 'solo-adm-billing' },
      {
        id: 'solo-adm-invoices',
        label: 'Invoices',
        icon: 'ri-file-list-3-line',
        link: '/invoices',
        parentId: 'solo-adm-billing',
        subItems: [
          { id: 'solo-adm-inv-list', label: 'All Invoices', link: '/invoices', parentId: 'solo-adm-invoices' },
          { id: 'solo-adm-inv-workflows', label: 'Workflows', link: '/invoices/workflows', parentId: 'solo-adm-invoices' }
        ]
      },
      {
        id: 'solo-adm-expenses',
        label: 'Expenses',
        icon: 'ri-wallet-3-line',
        link: '/expenses',
        parentId: 'solo-adm-billing',
        subItems: [
          { id: 'solo-adm-exp-list', label: 'All Expenses', link: '/expenses', parentId: 'solo-adm-expenses' },
          { id: 'solo-adm-exp-categories', label: 'Categories', link: '/expenses/categories', parentId: 'solo-adm-expenses' },
          { id: 'solo-adm-exp-vendors', label: 'Vendors', link: '/expenses/vendors', parentId: 'solo-adm-expenses' }
        ]
      }
    ]
  },
  {
    id: 'solo-adm-signatures',
    label: 'E-Signatures',
    icon: 'ri-quill-pen-line',
    link: '/signatures'
  },
];

// ============================================================================
// ATTORNEY MENU (ROLE_ATTORNEY) - Full legal practice management
// Calendar & Tasks top-level, Billing merged, no File Manager
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
      { id: 'att-case-cases', label: 'Cases', icon: 'ri-folder-open-line', link: '/legal/cases', parentId: 'att-case-mgmt' },
      { id: 'att-case-assignments', label: 'Assignments', icon: 'ri-user-add-line', link: '/case-management/assignments', parentId: 'att-case-mgmt' }
    ]
  },
  {
    id: 'att-calendar',
    label: 'Calendar',
    icon: 'ri-calendar-line',
    link: '/legal/calendar'
  },
  {
    id: 'att-tasks',
    label: 'Tasks',
    icon: 'ri-task-line',
    link: '/case-management/tasks'
  },
  {
    id: 'att-ai-tools',
    label: 'LegiTools',
    icon: 'ri-robot-line',
    link: '/legal/ai-assistant/legispace',
    subItems: [
      { id: 'att-ai-workspace', label: 'LegiSpace', icon: 'ri-rocket-2-line', link: '/legal/ai-assistant/legispace', parentId: 'att-ai-tools' },
      { id: 'att-ai-personal-injury', label: 'LegiPI', icon: 'ri-first-aid-kit-line', link: '/legal/ai-assistant/legipi', parentId: 'att-ai-tools' }
    ]
  },
  {
    id: 'att-clients',
    label: 'Clients',
    icon: 'ri-user-3-line',
    link: '/clients'
  },
  {
    id: 'att-billing',
    label: 'Billing',
    icon: 'ri-money-dollar-circle-line',
    link: '/time-tracking/dashboard',
    subItems: [
      { id: 'att-time-dashboard', label: 'Time Dashboard', icon: 'ri-dashboard-line', link: '/time-tracking/dashboard', parentId: 'att-billing' },
      { id: 'att-time-entry', label: 'Log Time', icon: 'ri-timer-line', link: '/time-tracking/entry', parentId: 'att-billing' },
      { id: 'att-time-approval', label: 'Approval', icon: 'ri-checkbox-circle-line', link: '/time-tracking/approval', parentId: 'att-billing' },
      { id: 'att-time-rates', label: 'Billing Rates', icon: 'ri-price-tag-3-line', link: '/time-tracking/rates', parentId: 'att-billing' },
      {
        id: 'att-invoices',
        label: 'Invoices',
        icon: 'ri-file-list-3-line',
        link: '/invoices',
        parentId: 'att-billing',
        subItems: [
          { id: 'att-inv-list', label: 'All Invoices', link: '/invoices', parentId: 'att-invoices' },
          { id: 'att-inv-workflows', label: 'Workflows', link: '/invoices/workflows', parentId: 'att-invoices' }
        ]
      },
      {
        id: 'att-expenses',
        label: 'Expenses',
        icon: 'ri-wallet-3-line',
        link: '/expenses',
        parentId: 'att-billing',
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
      { id: 'att-crm-dashboard', label: 'Dashboard', icon: 'ri-dashboard-line', link: '/crm/dashboard', parentId: 'att-crm' },
      { id: 'att-crm-leads', label: 'Leads', icon: 'ri-user-add-line', link: '/crm/leads', parentId: 'att-crm' },
      { id: 'att-crm-intake', label: 'Intake Submissions', icon: 'ri-inbox-line', link: '/crm/intake-submissions', parentId: 'att-crm' },
      { id: 'att-crm-conflicts', label: 'Conflict Checks', icon: 'ri-shield-check-line', link: '/crm/conflict-checks', parentId: 'att-crm' }
    ]
  },
  {
    id: 'att-signatures',
    label: 'E-Signatures',
    icon: 'ri-quill-pen-line',
    link: '/signatures'
  }
];

// ============================================================================
// ADMIN MENU (ROLE_ADMIN) - Full system access
// Calendar & Tasks top-level, Billing merged, Admin dropdown, no File Manager
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
      { id: 'admin-case-cases', label: 'Cases', icon: 'ri-folder-open-line', link: '/legal/cases', parentId: 'admin-case-mgmt' },
      { id: 'admin-case-assignments', label: 'Assignments', icon: 'ri-user-add-line', link: '/case-management/assignments', parentId: 'admin-case-mgmt' }
    ]
  },
  {
    id: 'admin-calendar',
    label: 'Calendar',
    icon: 'ri-calendar-line',
    link: '/legal/calendar'
  },
  {
    id: 'admin-tasks',
    label: 'Tasks',
    icon: 'ri-task-line',
    link: '/case-management/tasks'
  },
  {
    id: 'admin-ai-tools',
    label: 'LegiTools',
    icon: 'ri-robot-line',
    link: '/legal/ai-assistant/legispace',
    subItems: [
      { id: 'admin-ai-workspace', label: 'LegiSpace', icon: 'ri-rocket-2-line', link: '/legal/ai-assistant/legispace', parentId: 'admin-ai-tools' },
      { id: 'admin-ai-personal-injury', label: 'LegiPI', icon: 'ri-first-aid-kit-line', link: '/legal/ai-assistant/legipi', parentId: 'admin-ai-tools' }
    ]
  },
  {
    id: 'admin-clients',
    label: 'Clients',
    icon: 'ri-user-3-line',
    link: '/clients'
  },
  {
    id: 'admin-billing',
    label: 'Billing',
    icon: 'ri-money-dollar-circle-line',
    link: '/billing-dashboard',
    subItems: [
      { id: 'admin-billing-dash', label: 'Billing Dashboard', icon: 'ri-pie-chart-line', link: '/billing-dashboard', parentId: 'admin-billing' },
      { id: 'admin-time-dashboard', label: 'Time Dashboard', icon: 'ri-dashboard-line', link: '/time-tracking/dashboard', parentId: 'admin-billing' },
      { id: 'admin-time-entry', label: 'Log Time', icon: 'ri-timer-line', link: '/time-tracking/entry', parentId: 'admin-billing' },
      { id: 'admin-time-approval', label: 'Approval', icon: 'ri-checkbox-circle-line', link: '/time-tracking/approval', parentId: 'admin-billing' },
      { id: 'admin-time-rates', label: 'Billing Rates', icon: 'ri-price-tag-3-line', link: '/time-tracking/rates', parentId: 'admin-billing' },
      { id: 'admin-time-invoice-gen', label: 'Invoice Generation', icon: 'ri-bill-line', link: '/time-tracking/billing/invoice-generation', parentId: 'admin-billing' },
      {
        id: 'admin-invoices',
        label: 'Invoices',
        icon: 'ri-file-list-3-line',
        link: '/invoices',
        parentId: 'admin-billing',
        subItems: [
          { id: 'admin-inv-list', label: 'All Invoices', link: '/invoices', parentId: 'admin-invoices' },
          { id: 'admin-inv-workflows', label: 'Workflows', link: '/invoices/workflows', parentId: 'admin-invoices' }
        ]
      },
      {
        id: 'admin-expenses',
        label: 'Expenses',
        icon: 'ri-wallet-3-line',
        link: '/expenses',
        parentId: 'admin-billing',
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
      { id: 'admin-crm-dashboard', label: 'Dashboard', icon: 'ri-dashboard-line', link: '/crm/dashboard', parentId: 'admin-crm' },
      { id: 'admin-crm-leads', label: 'Leads', icon: 'ri-user-add-line', link: '/crm/leads', parentId: 'admin-crm' },
      { id: 'admin-crm-intake', label: 'Intake Submissions', icon: 'ri-inbox-line', link: '/crm/intake-submissions', parentId: 'admin-crm' },
      { id: 'admin-crm-conflicts', label: 'Conflict Checks', icon: 'ri-shield-check-line', link: '/crm/conflict-checks', parentId: 'admin-crm' }
    ]
  },
  {
    id: 'admin-signatures',
    label: 'E-Signatures',
    icon: 'ri-quill-pen-line',
    link: '/signatures'
  },
];

// ============================================================================
// SUPERADMIN MENU (ROLE_SUPERADMIN) - Platform administration ONLY
// SUPERADMINs are platform-level administrators, NOT organization users.
// They should NOT access tenant-specific routes (cases, clients, etc.)
// ============================================================================
export const SUPERADMIN_MENU: MenuItem[] = [
  {
    id: 'sa-overview',
    label: 'Overview',
    icon: 'ri-dashboard-2-line',
    link: '/superadmin/dashboard'
  },
  {
    id: 'sa-organizations',
    label: 'Organizations',
    icon: 'ri-building-2-line',
    subItems: [
      { id: 'sa-org-list', label: 'All Organizations', link: '/superadmin/organizations', parentId: 'sa-organizations' },
      { id: 'sa-org-create', label: 'Create New', link: '/superadmin/organizations/new', parentId: 'sa-organizations' }
    ]
  },
  {
    id: 'sa-users',
    label: 'Users',
    icon: 'ri-group-line',
    link: '/superadmin/users'
  },
  {
    id: 'sa-analytics',
    label: 'Analytics',
    icon: 'ri-bar-chart-2-line',
    subItems: [
      { id: 'sa-analytics-platform', label: 'Platform Analytics', link: '/superadmin/analytics', parentId: 'sa-analytics' },
      { id: 'sa-analytics-security', label: 'Security', link: '/superadmin/security', parentId: 'sa-analytics' }
    ]
  },
  {
    id: 'sa-system',
    label: 'System',
    icon: 'ri-settings-3-line',
    subItems: [
      { id: 'sa-system-health', label: 'System Health', link: '/superadmin/system-health', parentId: 'sa-system' },
      { id: 'sa-system-audit', label: 'Audit Logs', link: '/superadmin/audit-logs', parentId: 'sa-system' },
      { id: 'sa-system-integrations', label: 'Integrations', link: '/superadmin/integrations', parentId: 'sa-system' },
      { id: 'sa-system-api-docs', label: 'API Docs', link: '/superadmin/api-docs', parentId: 'sa-system' }
    ]
  },
  {
    id: 'sa-announcements',
    label: 'Announcements',
    icon: 'ri-megaphone-line',
    link: '/superadmin/announcements'
  }
];

// ============================================================================
// ROLE MENU CONFIGURATIONS
// ============================================================================
export const ROLE_MENU_CONFIGS: { [key in UserRole]: RoleMenuConfig } = {
  'ROLE_SUPERADMIN': {
    role: 'ROLE_SUPERADMIN',
    defaultRedirect: '/superadmin/dashboard',
    menu: SUPERADMIN_MENU
  },
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
// HELPER FUNCTION: Get menu for user role (firm-type-aware)
// ============================================================================
export function getMenuForRole(role: string, firmType?: string): MenuItem[] {
  // Solo practitioner gets a simplified menu
  if (firmType === 'SOLO_PRACTITIONER') {
    const menuTier = resolveMenuTier(role);
    if (menuTier === 'ROLE_ADMIN') return SOLO_ADMIN_MENU;
    if (menuTier === 'ROLE_ATTORNEY') return SOLO_ATTORNEY_MENU;
    // Other roles in solo firms fall through to standard menus
  }

  // First try exact match
  const normalizedRole = role?.toUpperCase() as UserRole;
  const config = ROLE_MENU_CONFIGS[normalizedRole];

  if (config) {
    return config.menu;
  }

  // Resolve to the appropriate menu tier (e.g. MANAGING_PARTNER → ROLE_ADMIN)
  const menuTier = resolveMenuTier(role);
  const tierConfig = ROLE_MENU_CONFIGS[menuTier];

  if (tierConfig) {
    return tierConfig.menu;
  }

  return CLIENT_MENU;
}

// ============================================================================
// HELPER FUNCTION: Get default redirect for role
// ============================================================================
export function getDefaultRedirectForRole(role: string): string {
  // First try exact match
  const normalizedRole = role?.toUpperCase() as UserRole;
  const config = ROLE_MENU_CONFIGS[normalizedRole];

  if (config) {
    return config.defaultRedirect;
  }

  // Resolve to the appropriate menu tier
  const menuTier = resolveMenuTier(role);
  const tierConfig = ROLE_MENU_CONFIGS[menuTier];

  if (tierConfig) {
    return tierConfig.defaultRedirect;
  }

  return '/client/dashboard';
}

// ============================================================================
// LEGACY MENU (for backward compatibility during transition)
// ============================================================================
export const MENU: MenuItem[] = ADMIN_MENU;
