export interface FolderTemplate {
  id: string;
  name: string;
  description: string;
  practiceArea: PracticeArea;
  folders: TemplateFolderStructure[];
  permissions?: TemplatePermission[];
  isDefault: boolean;
  isCustom: boolean;
  firmId?: string;
  firmName?: string;
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TemplateFolderStructure {
  name: string;
  description?: string;
  permissions?: string[];
  subFolders?: TemplateFolderStructure[];
  documentTypes?: string[];
  isRequired: boolean;
}

export interface TemplatePermission {
  roleId: string;
  roleName: string;
  permissions: string[]; // ['read', 'write', 'delete', 'share']
}

export enum PracticeArea {
  LITIGATION = 'litigation',
  CORPORATE = 'corporate',
  FAMILY = 'family',
  REAL_ESTATE = 'real_estate',
  CRIMINAL = 'criminal',
  INTELLECTUAL_PROPERTY = 'intellectual_property',
  EMPLOYMENT = 'employment',
  BANKRUPTCY = 'bankruptcy',
  IMMIGRATION = 'immigration',
  PERSONAL_INJURY = 'personal_injury'
}

export interface CreateTemplateRequest {
  name: string;
  description: string;
  practiceArea: PracticeArea;
  folders: TemplateFolderStructure[];
  permissions?: TemplatePermission[];
}

export interface ApplyTemplateRequest {
  templateId: string;
  caseId: number;
  parentFolderId?: number;
  customFolderName?: string;
}

export interface FirmTemplateCustomization {
  id: string;
  firmId: string;
  firmName: string;
  baseTemplateId: string;
  customizedTemplate: FolderTemplate;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFirmTemplateRequest {
  firmId: string;
  baseTemplateId: string;
  customizations: TemplateCustomization[];
  name?: string;
  description?: string;
}

export interface TemplateCustomization {
  type: 'add' | 'remove' | 'modify' | 'reorder';
  folderPath: string; // e.g., "01-Pleadings/Initial Pleadings"
  action: {
    name?: string;
    description?: string;
    permissions?: string[];
    documentTypes?: string[];
    isRequired?: boolean;
    newPosition?: number;
  };
}