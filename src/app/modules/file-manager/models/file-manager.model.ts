export interface FolderModel {
  id: number;
  name: string;
  path: string;
  parentId?: number;
  parentName?: string;
  size: number;
  fileCount: number;
  folderCount: number;
  createdById: number;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
  children?: FolderModel[];
  files?: FileItemModel[];
  hasChildren: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canShare: boolean;
}

export interface FileItemModel {
  id: number;
  name: string;
  originalName: string;
  size: number;
  formattedSize?: string;
  mimeType: string;
  extension: string;
  icon: string;
  iconColor: string;
  fileType?: string;
  folderId?: number;
  folderName?: string;
  folderPath?: string;
  createdById?: number;
  createdByName?: string;
  createdBy?: any;
  createdAt: Date;
  updatedAt: Date;
  starred?: boolean;
  deleted?: boolean;
  downloadUrl: string;
  previewUrl?: string;
  metadata?: { [key: string]: string };
  canEdit?: boolean;
  canDelete?: boolean;
  canShare?: boolean;
  canDownload?: boolean;
  tags?: FileTag[];
  recentComments?: FileComment[];
  commentCount?: number;
  // Additional properties for compatibility
  description?: string;
  version?: number;
  // Phase 4 properties
  encrypted?: boolean;
  encryptionMetadata?: string;
  documentCategory?: string;
  documentStatus?: string;
  practiceArea?: string;
  caseId?: number;
  caseName?: string;
  clientAccessExpires?: Date;
  permissions?: FilePermission[];
}

export interface CreateFolderRequest {
  name: string;
  parentId?: number;
}

export interface FileUploadResponse {
  id?: number;
  name?: string;
  originalName?: string;
  size?: number;
  formattedSize?: string;
  mimeType?: string;
  extension?: string;
  icon?: string;
  iconColor?: string;
  downloadUrl?: string;
  message: string;
  success: boolean;
}

export interface FileManagerStats {
  totalFiles: number;
  totalFolders: number;
  totalSize: number;
  formattedTotalSize: string;
  usedSpace: number;
  availableSpace: number;
  usagePercentage: number;
  storageByType: { [key: string]: StorageTypeStats };
  recentFiles: FileItemModel[];
  starredFiles: FileItemModel[];
}

export interface StorageTypeStats {
  type: string;
  size: number;
  formattedSize: string;
  count: number;
  percentage: number;
  color: string;
}

export interface FileVersion {
  id: number;
  fileId: number;
  versionNumber: string;
  fileName: string;
  size: number;
  formattedSize: string;
  mimeType: string;
  uploadedById: number;
  uploadedByName: string;
  uploadedAt: Date;
  comment?: string;
  current: boolean;
  isCurrent?: boolean; // Alias for compatibility
  downloadUrl: string;
}

export interface FileVersionRequest {
  fileId: number;
  comment?: string;
}

export interface FileComment {
  id: number;
  fileId: number;
  userId: number;
  userName: string;
  userAvatar?: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  canEdit: boolean;
  canDelete: boolean;
}

export interface FileTag {
  id: number;
  name: string;
  color: string;
  fileCount?: number;
}

export interface CreateCommentRequest {
  content: string;
}

export interface CreateTagRequest {
  name: string;
  color?: string;
}

// Phase 4 Interfaces
export interface FilePermission {
  id: number;
  fileId: number;
  userId: number;
  userName?: string;
  userEmail?: string;
  permissionType: PermissionType;
  grantedAt: Date;
  grantedById: number;
  grantedByName?: string;
  expiresAt?: Date;
  notes?: string;
}

export enum PermissionType {
  VIEW = 'VIEW',
  DOWNLOAD = 'DOWNLOAD',
  EDIT = 'EDIT',
  DELETE = 'DELETE',
  SHARE = 'SHARE',
  ADMIN = 'ADMIN'
}

export interface BulkPermissionRequest {
  fileIds: number[];
  userIds: number[];
  permissions: PermissionType[];
  expiresAt?: Date;
  notes?: string;
}

export interface DocumentCategory {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  icon?: string;
  count?: number;
}

export interface DocumentStatus {
  id: string;
  name: string;
  description?: string;
  color?: string;
}

export interface PracticeArea {
  id: string;
  name: string;
  description?: string;
}

// Phase 1: Document Templates System
export interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  practiceArea: string;
  jurisdiction?: string;
  templateType: DocumentTemplateType;
  fileUrl: string;
  previewUrl?: string;
  fields: TemplateField[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  usage: number;
  tags: string[];
  version: string;
}

export enum DocumentTemplateType {
  PLEADING = 'PLEADING',
  MOTION = 'MOTION',
  BRIEF = 'BRIEF',
  CONTRACT = 'CONTRACT',
  CORRESPONDENCE = 'CORRESPONDENCE',
  DISCOVERY = 'DISCOVERY',
  SETTLEMENT = 'SETTLEMENT',
  COURT_FILING = 'COURT_FILING',
  INTERNAL_MEMO = 'INTERNAL_MEMO',
  CLIENT_LETTER = 'CLIENT_LETTER'
}

export interface TemplateField {
  id: string;
  name: string;
  label: string;
  type: TemplateFieldType;
  required: boolean;
  defaultValue?: string;
  options?: string[];
  placeholder?: string;
  validation?: string;
  order: number;
}

export enum TemplateFieldType {
  TEXT = 'TEXT',
  TEXTAREA = 'TEXTAREA',
  DATE = 'DATE',
  SELECT = 'SELECT',
  CHECKBOX = 'CHECKBOX',
  RADIO = 'RADIO',
  NUMBER = 'NUMBER',
  EMAIL = 'EMAIL',
  PHONE = 'PHONE',
  CURRENCY = 'CURRENCY'
}

export interface TemplateCategory {
  id: string;
  name: string;
  displayName: string;
  description: string;
  icon: string;
  templates: DocumentTemplate[];
  practiceAreas: string[];
}

export interface CreateDocumentFromTemplateRequest {
  templateId: string;
  fileName: string;
  caseId?: number;
  folderId?: number;
  fields: { [key: string]: any };
  documentCategory?: string;
  documentStatus?: string;
}

// Phase 1: Approval Workflow System
export interface ApprovalWorkflow {
  id: string;
  name: string;
  description: string;
  steps: ApprovalStep[];
  isActive: boolean;
  documentTypes: string[];
  practiceAreas: string[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApprovalStep {
  id: string;
  order: number;
  name: string;
  description: string;
  approverRole: string;
  approverUsers?: string[];
  isRequired: boolean;
  allowParallelApproval: boolean;
  timeLimit?: number; // in hours
  escalationRules?: EscalationRule[];
  conditions?: ApprovalCondition[];
}

export interface ApprovalCondition {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than';
  value: string;
}

export interface EscalationRule {
  afterHours: number;
  escalateTo: string;
  notificationMessage: string;
}

export interface DocumentApproval {
  id: string;
  documentId: number;
  workflowId: string;
  currentStepId: string;
  status: ApprovalStatus;
  submittedBy: string;
  submittedAt: Date;
  completedAt?: Date;
  steps: ApprovalStepInstance[];
  comments: ApprovalComment[];
  metadata: { [key: string]: any };
}

export enum ApprovalStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  ESCALATED = 'ESCALATED'
}

export interface ApprovalStepInstance {
  id: string;
  stepId: string;
  assignedTo: string;
  status: ApprovalStepStatus;
  assignedAt: Date;
  completedAt?: Date;
  comments?: string;
  decision?: ApprovalDecision;
  timeSpent?: number; // in minutes
}

export enum ApprovalStepStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  SKIPPED = 'SKIPPED',
  ESCALATED = 'ESCALATED'
}

export enum ApprovalDecision {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  REQUEST_CHANGES = 'REQUEST_CHANGES'
}

export interface ApprovalComment {
  id: string;
  approvalId: string;
  stepId: string;
  userId: string;
  userName: string;
  comment: string;
  createdAt: Date;
  attachments?: string[];
}

// Phase 1: Deadline Tracking System
export interface DocumentDeadline {
  id: string;
  documentId: number;
  type: DeadlineType;
  title: string;
  description: string;
  dueDate: Date;
  reminderDates: Date[];
  isRecurring: boolean;
  recurrenceRule?: RecurrenceRule;
  priority: DeadlinePriority;
  assignedTo: string[];
  status: DeadlineStatus;
  completedAt?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  metadata: { [key: string]: any };
}

export enum DeadlineType {
  COURT_FILING = 'COURT_FILING',
  DISCOVERY = 'DISCOVERY',
  MOTION_RESPONSE = 'MOTION_RESPONSE',
  APPEAL_DEADLINE = 'APPEAL_DEADLINE',
  STATUTE_OF_LIMITATIONS = 'STATUTE_OF_LIMITATIONS',
  CONTRACT_DEADLINE = 'CONTRACT_DEADLINE',
  INTERNAL_REVIEW = 'INTERNAL_REVIEW',
  CLIENT_DELIVERY = 'CLIENT_DELIVERY',
  SETTLEMENT_DEADLINE = 'SETTLEMENT_DEADLINE'
}

export enum DeadlinePriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export enum DeadlineStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED'
}

export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  endDate?: Date;
  count?: number;
}

// Phase 1: Document Routing System
export interface DocumentRoute {
  id: string;
  documentId: number;
  routeType: RouteType;
  fromUserId: string;
  toUserId: string;
  status: RouteStatus;
  instructions: string;
  priority: RoutePriority;
  dueDate?: Date;
  routedAt: Date;
  completedAt?: Date;
  comments?: string;
  metadata: { [key: string]: any };
}

export enum RouteType {
  REVIEW = 'REVIEW',
  APPROVAL = 'APPROVAL',
  FORMATTING = 'FORMATTING',
  FILING = 'FILING',
  CLIENT_REVIEW = 'CLIENT_REVIEW',
  SIGNATURE = 'SIGNATURE',
  EDITING = 'EDITING',
  RESEARCH = 'RESEARCH'
}

export enum RouteStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED'
}

export enum RoutePriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT'
}

// Phase 2: Enhanced Case Organization
export interface LegalFolderTemplate {
  id: string;
  name: string;
  description: string;
  practiceArea: string;
  structure: FolderStructureNode[];
  isDefault: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  usage: number;
}

export interface FolderStructureNode {
  id: string;
  name: string;
  description: string;
  folderType: LegalFolderType;
  isRequired: boolean;
  order: number;
  children?: FolderStructureNode[];
  documentTypes: string[];
  permissions?: FolderPermissionRule[];
}

export enum LegalFolderType {
  PLEADINGS = 'PLEADINGS',
  DISCOVERY = 'DISCOVERY',
  MOTIONS = 'MOTIONS',
  CORRESPONDENCE = 'CORRESPONDENCE',
  EVIDENCE = 'EVIDENCE',
  EXPERT_REPORTS = 'EXPERT_REPORTS',
  MEDICAL_RECORDS = 'MEDICAL_RECORDS',
  FINANCIAL_RECORDS = 'FINANCIAL_RECORDS',
  CONTRACTS = 'CONTRACTS',
  RESEARCH = 'RESEARCH',
  SETTLEMENT = 'SETTLEMENT',
  TRIAL_MATERIALS = 'TRIAL_MATERIALS',
  APPEAL_MATERIALS = 'APPEAL_MATERIALS',
  ADMINISTRATIVE = 'ADMINISTRATIVE',
  CLIENT_COMMUNICATIONS = 'CLIENT_COMMUNICATIONS',
  WORK_PRODUCT = 'WORK_PRODUCT'
}

export interface FolderPermissionRule {
  role: string;
  permissions: string[];
  conditions?: { [key: string]: any };
}

export interface CaseFolderStructure {
  id: string;
  caseId: number;
  templateId: string;
  rootFolderId: number;
  structure: CreatedFolderNode[];
  createdAt: Date;
  updatedAt: Date;
  metadata: { [key: string]: any };
}

export interface CreatedFolderNode {
  id: string;
  folderId: number;
  templateNodeId: string;
  name: string;
  folderType: LegalFolderType;
  parentId?: number;
  documentCount: number;
  children?: CreatedFolderNode[];
  lastActivity?: Date;
}

// Phase 2: Matter Phases
export interface MatterPhase {
  id: string;
  name: string;
  description: string;
  order: number;
  practiceArea: string;
  isActive: boolean;
  estimatedDuration?: number; // in days
  requiredDocuments: string[];
  typicalTasks: MatterTask[];
  milestones: MatterMilestone[];
  nextPhases: string[];
  icon: string;
  color: string;
}

export enum MatterPhaseType {
  CASE_OPENING = 'CASE_OPENING',
  INVESTIGATION = 'INVESTIGATION',
  PLEADINGS = 'PLEADINGS',
  DISCOVERY = 'DISCOVERY',
  MOTION_PRACTICE = 'MOTION_PRACTICE',
  MEDIATION = 'MEDIATION',
  SETTLEMENT_NEGOTIATIONS = 'SETTLEMENT_NEGOTIATIONS',
  TRIAL_PREPARATION = 'TRIAL_PREPARATION',
  TRIAL = 'TRIAL',
  POST_TRIAL = 'POST_TRIAL',
  APPEAL = 'APPEAL',
  CASE_CLOSURE = 'CASE_CLOSURE'
}

export interface MatterTask {
  id: string;
  name: string;
  description: string;
  assignedRole: string;
  estimatedHours: number;
  dependencies: string[];
  isRequired: boolean;
  documentTemplates?: string[];
}

export interface MatterMilestone {
  id: string;
  name: string;
  description: string;
  targetDays: number; // days from phase start
  isRequired: boolean;
  completionCriteria: string[];
}

export interface CaseMatterPhase {
  id: string;
  caseId: number;
  phaseId: string;
  status: MatterPhaseStatus;
  startDate: Date;
  targetEndDate: Date;
  actualEndDate?: Date;
  completedTasks: string[];
  completedMilestones: string[];
  notes: string;
  assignedTeam: string[];
  progress: number; // 0-100
  metadata: { [key: string]: any };
}

export enum MatterPhaseStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  ON_HOLD = 'ON_HOLD',
  COMPLETED = 'COMPLETED',
  SKIPPED = 'SKIPPED'
}

// Phase 2: Chronological Organization
export interface ChronologicalIndex {
  id: string;
  documentId: number;
  caseId: number;
  eventDate: Date;
  eventType: ChronologicalEventType;
  description: string;
  importance: ChronologicalImportance;
  relatedDocuments: number[];
  tags: string[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum ChronologicalEventType {
  FILING = 'FILING',
  CORRESPONDENCE_RECEIVED = 'CORRESPONDENCE_RECEIVED',
  CORRESPONDENCE_SENT = 'CORRESPONDENCE_SENT',
  COURT_HEARING = 'COURT_HEARING',
  DEPOSITION = 'DEPOSITION',
  DISCOVERY_REQUEST = 'DISCOVERY_REQUEST',
  DISCOVERY_RESPONSE = 'DISCOVERY_RESPONSE',
  EXPERT_REPORT = 'EXPERT_REPORT',
  SETTLEMENT_OFFER = 'SETTLEMENT_OFFER',
  MOTION_FILED = 'MOTION_FILED',
  ORDER_RECEIVED = 'ORDER_RECEIVED',
  CONTRACT_EXECUTION = 'CONTRACT_EXECUTION',
  INCIDENT_DATE = 'INCIDENT_DATE',
  DEADLINE = 'DEADLINE',
  OTHER = 'OTHER'
}

export enum ChronologicalImportance {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface ChronologicalFilter {
  startDate?: Date;
  endDate?: Date;
  eventTypes?: ChronologicalEventType[];
  importance?: ChronologicalImportance[];
  tags?: string[];
  documentTypes?: string[];
}

// Phase 2: Court Filing Integration
export interface CourtFilingSystem {
  id: string;
  name: string;
  jurisdiction: string;
  courtType: CourtType;
  filingMethods: FilingMethod[];
  supportedDocumentTypes: string[];
  requiredFields: FilingField[];
  apiEndpoint?: string;
  isActive: boolean;
  configuration: { [key: string]: any };
}

export enum CourtType {
  FEDERAL_DISTRICT = 'FEDERAL_DISTRICT',
  FEDERAL_APPEALS = 'FEDERAL_APPEALS',
  FEDERAL_SUPREME = 'FEDERAL_SUPREME',
  STATE_TRIAL = 'STATE_TRIAL',
  STATE_APPEALS = 'STATE_APPEALS',
  STATE_SUPREME = 'STATE_SUPREME',
  MUNICIPAL = 'MUNICIPAL',
  ADMINISTRATIVE = 'ADMINISTRATIVE',
  BANKRUPTCY = 'BANKRUPTCY',
  TAX = 'TAX'
}

export enum FilingMethod {
  ELECTRONIC = 'ELECTRONIC',
  PHYSICAL = 'PHYSICAL',
  EMAIL = 'EMAIL',
  FAX = 'FAX'
}

export interface FilingField {
  id: string;
  name: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
  validation?: string;
  description?: string;
}

export interface CourtFiling {
  id: string;
  documentId: number;
  caseId: number;
  courtSystemId: string;
  filingType: string;
  filingMethod: FilingMethod;
  status: FilingStatus;
  submittedAt?: Date;
  confirmedAt?: Date;
  filingNumber?: string;
  confirmationNumber?: string;
  filingFee?: number;
  errors?: string[];
  metadata: { [key: string]: any };
  filingData: { [key: string]: any };
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum FilingStatus {
  DRAFT = 'DRAFT',
  PENDING_REVIEW = 'PENDING_REVIEW',
  READY_TO_FILE = 'READY_TO_FILE',
  FILING_IN_PROGRESS = 'FILING_IN_PROGRESS',
  FILED_SUCCESSFULLY = 'FILED_SUCCESSFULLY',
  FILING_REJECTED = 'FILING_REJECTED',
  FILING_ERROR = 'FILING_ERROR',
  CANCELLED = 'CANCELLED'
}

export interface FilingReceipt {
  id: string;
  filingId: string;
  receiptNumber: string;
  filingDate: Date;
  filingTime: string;
  courtStamp?: string;
  clerk: string;
  fees: FilingFee[];
  documents: FiledDocument[];
  nextSteps?: string[];
  downloadUrl?: string;
}

export interface FilingFee {
  description: string;
  amount: number;
  currency: string;
  paymentMethod?: string;
  transactionId?: string;
}

export interface FiledDocument {
  originalName: string;
  filedName: string;
  documentType: string;
  pages: number;
  fileSize: number;
  checksum?: string;
}