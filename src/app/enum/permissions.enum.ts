/**
 * Permissions enum that matches the database permissions exactly
 * Format: RESOURCE:ACTION
 */
export enum Permission {
  // Billing Permissions
  BILLING_ADMIN = 'BILLING:ADMIN',
  BILLING_CREATE = 'BILLING:CREATE',
  BILLING_EDIT = 'BILLING:EDIT',
  BILLING_VIEW = 'BILLING:VIEW',

  // Calendar Permissions
  CALENDAR_ADMIN = 'CALENDAR:ADMIN',
  CALENDAR_CREATE = 'CALENDAR:CREATE',
  CALENDAR_DELETE = 'CALENDAR:DELETE',
  CALENDAR_EDIT = 'CALENDAR:EDIT',
  CALENDAR_VIEW = 'CALENDAR:VIEW',

  // Case Permissions
  CASE_ADMIN = 'CASE:ADMIN',
  CASE_ASSIGN = 'CASE:ASSIGN',
  CASE_CREATE = 'CASE:CREATE',
  CASE_DELETE = 'CASE:DELETE',
  CASE_EDIT = 'CASE:EDIT',
  CASE_VIEW = 'CASE:VIEW',

  // Client Permissions
  CLIENT_ADMIN = 'CLIENT:ADMIN',
  CLIENT_CREATE = 'CLIENT:CREATE',
  CLIENT_DELETE = 'CLIENT:DELETE',
  CLIENT_EDIT = 'CLIENT:EDIT',
  CLIENT_VIEW = 'CLIENT:VIEW',

  // Document Permissions
  DOCUMENT_ADMIN = 'DOCUMENT:ADMIN',
  DOCUMENT_CREATE = 'DOCUMENT:CREATE',
  DOCUMENT_DELETE = 'DOCUMENT:DELETE',
  DOCUMENT_EDIT = 'DOCUMENT:EDIT',
  DOCUMENT_VIEW = 'DOCUMENT:VIEW',

  // Expense Permissions
  EXPENSE_ADMIN = 'EXPENSE:ADMIN',
  EXPENSE_CREATE = 'EXPENSE:CREATE',
  EXPENSE_EDIT = 'EXPENSE:EDIT',
  EXPENSE_VIEW = 'EXPENSE:VIEW',

  // Report Permissions
  REPORT_ADMIN = 'REPORT:ADMIN',
  REPORT_CREATE = 'REPORT:CREATE',
  REPORT_VIEW_ALL = 'REPORT:VIEW_ALL',
  REPORT_VIEW_OWN = 'REPORT:VIEW_OWN',
  REPORT_VIEW_TEAM = 'REPORT:VIEW_TEAM',

  // Role Permissions
  ROLE_ADMIN = 'ROLE:ADMIN',
  ROLE_ASSIGN = 'ROLE:ASSIGN',
  ROLE_CREATE = 'ROLE:CREATE',
  ROLE_EDIT = 'ROLE:EDIT',
  ROLE_VIEW = 'ROLE:VIEW',

  // System Permissions
  SYSTEM_ADMIN = 'SYSTEM:ADMIN',
  SYSTEM_VIEW = 'SYSTEM:VIEW',

  // Task Permissions
  TASK_ADMIN = 'TASK:ADMIN',
  TASK_ASSIGN = 'TASK:ASSIGN',
  TASK_CREATE = 'TASK:CREATE',
  TASK_VIEW_ALL = 'TASK:VIEW_ALL',
  TASK_VIEW_OWN = 'TASK:VIEW_OWN',
  TASK_VIEW_TEAM = 'TASK:VIEW_TEAM',

  // Time Tracking Permissions
  TIME_TRACKING_APPROVE = 'TIME_TRACKING:APPROVE',
  TIME_TRACKING_CREATE = 'TIME_TRACKING:CREATE',
  TIME_TRACKING_EDIT = 'TIME_TRACKING:EDIT',
  TIME_TRACKING_EDIT_OWN = 'TIME_TRACKING:EDIT_OWN',
  TIME_TRACKING_MANAGE = 'TIME_TRACKING:MANAGE',
  TIME_TRACKING_VIEW_ALL = 'TIME_TRACKING:VIEW_ALL',
  TIME_TRACKING_VIEW_OWN = 'TIME_TRACKING:VIEW_OWN',
  TIME_TRACKING_VIEW_TEAM = 'TIME_TRACKING:VIEW_TEAM',

  // User Permissions
  USER_ADMIN = 'USER:ADMIN',
  USER_CREATE = 'USER:CREATE',
  USER_EDIT = 'USER:EDIT',
  USER_VIEW = 'USER:VIEW'
}

/**
 * Helper functions for permission checking
 */
export class PermissionHelper {
  /**
   * Extract resource and action from permission string
   */
  static parsePermission(permission: string): { resource: string; action: string } {
    const [resource, action] = permission.split(':');
    return { resource, action };
  }

  /**
   * Create permission string from resource and action
   */
  static createPermission(resource: string, action: string): string {
    return `${resource}:${action}`;
  }

  /**
   * Check if permission string is valid
   */
  static isValidPermission(permission: string): boolean {
    return Object.values(Permission).includes(permission as Permission);
  }

  /**
   * Get all permissions for a resource
   */
  static getResourcePermissions(resource: string): Permission[] {
    return Object.values(Permission).filter(p => p.startsWith(`${resource}:`));
  }
}

/**
 * Resource types for easier reference
 */
export enum ResourceType {
  BILLING = 'BILLING',
  CALENDAR = 'CALENDAR',
  CASE = 'CASE',
  CLIENT = 'CLIENT',
  DOCUMENT = 'DOCUMENT',
  EXPENSE = 'EXPENSE',
  REPORT = 'REPORT',
  ROLE = 'ROLE',
  SYSTEM = 'SYSTEM',
  TASK = 'TASK',
  TIME_TRACKING = 'TIME_TRACKING',
  USER = 'USER'
}

/**
 * Action types for easier reference
 */
export enum ActionType {
  ADMIN = 'ADMIN',
  APPROVE = 'APPROVE',
  ASSIGN = 'ASSIGN',
  CREATE = 'CREATE',
  DELETE = 'DELETE',
  EDIT = 'EDIT',
  EDIT_OWN = 'EDIT_OWN',
  MANAGE = 'MANAGE',
  VIEW = 'VIEW',
  VIEW_ALL = 'VIEW_ALL',
  VIEW_OWN = 'VIEW_OWN',
  VIEW_TEAM = 'VIEW_TEAM'
} 
 
 