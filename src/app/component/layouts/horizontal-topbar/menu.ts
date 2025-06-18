import { MenuItem } from './menu.model';

export const MENU: MenuItem[] = [
  // ===== CORE NAVIGATION (Available to all users) =====
  {
    id: 1,
    label: 'Dashboard',
    icon: 'ri-dashboard-2-line',
    link: '/home'
  },
  
  // ===== CLIENT MANAGEMENT =====
  {
    id: 2,
    label: 'Clients',
    icon: 'ri-user-3-line',
    link: '/clients',
    requiredPermission: { resource: 'CLIENT', action: 'VIEW' }
  },
  
  // ===== LEGAL MODULE =====
  {
    id: 3,
    label: 'Legal',
    icon: 'ri-scales-3-line',
    link: '/legal/cases',
    requiredPermission: { resource: 'CASE', action: 'VIEW' },
    subItems: [
      {
        id: 'cases',
        label: 'Cases',
        link: '/legal/cases',
        parentId: 3,
        requiredPermission: { resource: 'CASE', action: 'VIEW' }
      },
      {
        id: 'documents',
        label: 'Documents',
        link: '/legal/documents',
        parentId: 3,
        requiredPermission: { resource: 'DOCUMENT', action: 'VIEW' }
      },
      {
        id: 'calendar',
        label: 'Calendar',
        link: '/legal/calendar',
        parentId: 3,
        requiredPermission: { resource: 'CALENDAR', action: 'VIEW' }
      }
    ]
  },
  
  // ===== TIME TRACKING & BILLING =====
  {
    id: 4,
    label: 'Time & Billing',
    icon: 'ri-time-line',
    link: '/time-tracking/dashboard',
    requiredPermission: { resource: 'TIME_TRACKING', action: 'VIEW_OWN' },
    subItems: [
      {
        id: 'time-dashboard',
        label: 'Dashboard',
        link: '/time-tracking/dashboard',
        parentId: 4,
        requiredPermission: { resource: 'TIME_TRACKING', action: 'VIEW_OWN' }
      },
      {
        id: 'timesheet',
        label: 'Timesheet',
        link: '/time-tracking/entry',
        parentId: 4,
        requiredPermission: { resource: 'TIME_TRACKING', action: 'VIEW_OWN' }
      },
      {
        id: 'new-entry',
        label: 'New Entry',
        link: '/time-tracking/entry/new',
        parentId: 4,
        requiredPermission: { resource: 'TIME_TRACKING', action: 'CREATE' }
      },
      {
        id: 'approval',
        label: 'Approval',
        link: '/time-tracking/approval',
        parentId: 4,
        requiredPermission: { resource: 'TIME_TRACKING', action: 'APPROVE' }
      },
      {
        id: 'billing-rates',
        label: 'Billing Rates',
        link: '/time-tracking/rates',
        parentId: 4,
        requiredPermission: { resource: 'BILLING', action: 'VIEW' }
      },
      {
        id: 'invoice-generation',
        label: 'Invoice Generation',
        link: '/time-tracking/billing/invoice-generation',
        parentId: 4,
        requiredPermission: { resource: 'BILLING', action: 'CREATE' }
      },
      {
        id: 'time-reports',
        label: 'Reports',
        link: '/time-tracking/reports',
        parentId: 4,
        requiredPermission: { resource: 'TIME_TRACKING', action: 'VIEW_OWN' }
      },
      {
        id: 'billing-analytics',
        label: 'Analytics',
        link: '/time-tracking/billing/analytics',
        parentId: 4,
        requiredPermission: { resource: 'BILLING', action: 'EDIT' }
      }
    ]
  },
  
  // ===== FINANCIAL MODULE =====
  {
    id: 5,
    label: 'Financial',
    icon: 'ri-money-dollar-circle-line',
    link: '/invoices',
    requiredPermission: { resource: 'BILLING', action: 'VIEW' },
    subItems: [
      {
        id: 'billing-dashboard',
        label: 'Billing Dashboard',
        link: '/billing-dashboard',
        parentId: 5,
        requiredPermission: { resource: 'BILLING', action: 'VIEW' }
      },
      {
        id: 'invoices',
        label: 'Invoices',
        link: '/invoices',
        parentId: 5,
        requiredPermission: { resource: 'BILLING', action: 'VIEW' },
        subItems: [
          {
            id: 'invoice-list',
            label: 'All Invoices',
            link: '/invoices',
            parentId: 'invoices'
          },
          {
            id: 'invoice-templates',
            label: 'Templates',
            link: '/invoices/templates',
            parentId: 'invoices'
          },
          {
            id: 'invoice-workflows',
            label: 'Workflows',
            link: '/invoices/workflows',
            parentId: 'invoices'
          }
        ]
      },
      {
        id: 'expenses',
        label: 'Expenses',
        link: '/expenses',
        parentId: 5,
        requiredPermission: { resource: 'EXPENSE', action: 'VIEW' },
        subItems: [
          {
            id: 'expense-list',
            label: 'All Expenses',
            link: '/expenses',
            parentId: 'expenses'
          },
          {
            id: 'expense-categories',
            label: 'Categories',
            link: '/expenses/categories',
            parentId: 'expenses'
          },
          {
            id: 'expense-vendors',
            label: 'Vendors',
            link: '/expenses/vendors',
            parentId: 'expenses'
          }
        ]
      },
      {
        id: 'analytics',
        label: 'Analytics',
        link: '/analytics',
        parentId: 5,
        requiredPermission: { resource: 'BILLING', action: 'EDIT' }
      }
    ]
  },
  
  // ===== ADMINISTRATION (Admin/Manager only) =====
  {
    id: 6,
    label: 'Administration',
    icon: 'ri-admin-line',
    link: '/admin',
    requiredPermission: { resource: 'SYSTEM', action: 'VIEW' },
    subItems: [
      {
        id: 'role-hierarchy',
        label: 'Role Hierarchy',
        link: '/admin/role-hierarchy',
        parentId: 6,
        requiredPermission: { resource: 'SYSTEM', action: 'VIEW' }
      },
      {
        id: 'roles',
        label: 'Role Management',
        link: '/admin/roles',
        parentId: 6,
        requiredPermission: { resource: 'SYSTEM', action: 'VIEW' }
      },
      {
        id: 'user-roles',
        label: 'User Assignments',
        link: '/admin/user-roles',
        parentId: 6,
        requiredPermission: { resource: 'SYSTEM', action: 'EDIT' }
      },
      {
        id: 'audit-logs',
        label: 'Audit Logs',
        link: '/admin/audit-logs',
        parentId: 6,
        requiredPermission: { resource: 'SYSTEM', action: 'VIEW' }
      }
    ]
  },
  
  // ===== USER PROFILE & SUPPORT =====
  {
    id: 7,
    label: 'Profile',
    icon: 'ri-user-settings-line',
    link: '/profile'
  },
  
  {
    id: 8,
    label: 'Help & FAQ',
    icon: 'ri-question-answer-line',
    link: '/faq'
  }
];
