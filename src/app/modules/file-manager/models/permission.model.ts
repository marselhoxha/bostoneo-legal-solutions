export interface Permission {
  id: string;
  name: string;
  description: string;
  type: PermissionType;
  scope: PermissionScope;
}

export enum PermissionType {
  READ = 'read',
  WRITE = 'write',
  DELETE = 'delete',
  SHARE = 'share',
  DOWNLOAD = 'download',
  UPLOAD = 'upload',
  CREATE_FOLDER = 'create_folder',
  RENAME = 'rename',
  MOVE = 'move',
  COPY = 'copy',
  COMMENT = 'comment',
  VIEW_METADATA = 'view_metadata',
  EDIT_METADATA = 'edit_metadata',
  MANAGE_PERMISSIONS = 'manage_permissions'
}

export enum PermissionScope {
  GLOBAL = 'global',
  CASE = 'case',
  FOLDER = 'folder',
  FILE = 'file'
}

export interface PermissionSet {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface InheritanceRule {
  id: string;
  name: string;
  description: string;
  sourceType: InheritanceSourceType;
  targetType: InheritanceTargetType;
  permissionMapping: PermissionMapping[];
  isActive: boolean;
  priority: number;
  conditions?: InheritanceCondition[];
}

export enum InheritanceSourceType {
  PARENT_FOLDER = 'parent_folder',
  CASE = 'case',
  USER_ROLE = 'user_role',
  TEMPLATE = 'template',
  FIRM = 'firm'
}

export enum InheritanceTargetType {
  FOLDER = 'folder',
  FILE = 'file',
  SUBFOLDER = 'subfolder'
}

export interface PermissionMapping {
  sourcePermission: PermissionType;
  targetPermission: PermissionType;
  override: boolean;
}

export interface InheritanceCondition {
  type: ConditionType;
  field: string;
  operator: ConditionOperator;
  value: any;
}

export enum ConditionType {
  FILE_TYPE = 'file_type',
  FOLDER_NAME = 'folder_name',
  CASE_TYPE = 'case_type',
  USER_ROLE = 'user_role',
  PRACTICE_AREA = 'practice_area'
}

export enum ConditionOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  CONTAINS = 'contains',
  STARTS_WITH = 'starts_with',
  ENDS_WITH = 'ends_with',
  IN = 'in',
  NOT_IN = 'not_in'
}

export interface PermissionInheritanceConfig {
  id: string;
  firmId: string;
  inheritanceRules: InheritanceRule[];
  defaultPermissionSets: {
    folder: PermissionSet;
    file: PermissionSet;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AppliedPermission {
  id: string;
  resourceId: string;
  resourceType: 'file' | 'folder';
  userId: string;
  permissions: PermissionType[];
  inheritedFrom: InheritanceSource;
  isExplicit: boolean;
  createdAt: Date;
}

export interface InheritanceSource {
  type: InheritanceSourceType;
  id: string;
  name: string;
  path?: string;
}

export interface CreatePermissionSetRequest {
  name: string;
  description: string;
  permissions: PermissionType[];
}

export interface CreateInheritanceRuleRequest {
  name: string;
  description: string;
  sourceType: InheritanceSourceType;
  targetType: InheritanceTargetType;
  permissionMapping: PermissionMapping[];
  conditions?: InheritanceCondition[];
  priority: number;
}

export interface UpdatePermissionRequest {
  resourceId: string;
  resourceType: 'file' | 'folder';
  permissions: PermissionType[];
  inheritFromParent: boolean;
  applyToChildren: boolean;
}