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
    childItem?: any;
  }