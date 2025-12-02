export interface MenuItem {
    id?: number;
    label?: any;
    icon?: string;
    link?: string;
    subItems?: any;
    isTitle?: boolean;
    badge?: any;
    parentId?: number | string;
    isLayout?: boolean;
    requiredPermission?: {
      resource: string;
      action: string;
    };
    // Simplified roles: ROLE_ADMIN, ROLE_ATTORNEY, ROLE_FINANCE, PARALEGAL, ROLE_SECRETARY, ROLE_USER
    requiredRoles?: string[];
    childItem?: any;
  }