export interface CaseTask {
  id: number;
  caseId: number;
  caseNumber: string;
  caseTitle: string;
  title: string;
  description?: string;
  taskType: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  assignedToId?: number;
  assignedToName?: string;
  createdById: number;
  createdByName: string;
  dueDate?: Date;
  completedAt?: Date;
  estimatedHours?: number;
  actualHours?: number;
  parentTaskId?: number;
  dependencies?: number[];
  tags?: string[];
  reminderDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  comments?: TaskComment[];
  subtasks?: CaseTask[];
  attachments?: TaskAttachment[];
}

export interface TaskCreateRequest {
  caseId: number;
  title: string;
  description?: string;
  taskType: TaskType;
  priority: TaskPriority;
  assignedToId?: number;
  dueDate?: Date;
  estimatedHours?: number;
  parentTaskId?: number;
  tags?: string[];
  reminderDate?: Date;
}

export interface TaskUpdateRequest {
  title?: string;
  description?: string;
  taskType?: TaskType;
  priority?: TaskPriority;
  status?: TaskStatus;
  assignedToId?: number;
  dueDate?: Date;
  estimatedHours?: number;
  actualHours?: number;
  tags?: string[];
  reminderDate?: Date;
}

export interface TaskComment {
  id: number;
  taskId: number;
  userId: number;
  userName: string;
  comment: string;
  createdAt: Date;
}

export interface TaskAttachment {
  id: number;
  taskId: number;
  fileName: string;
  fileSize: number;
  fileType: string;
  uploadedById: number;
  uploadedByName: string;
  uploadedAt: Date;
  url: string;
}

export interface TaskStatistics {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  overdueTasks: number;
  tasksByStatus: { [key: string]: number };
  tasksByPriority: { [key: string]: number };
  averageCompletionTime?: number;
  completionRate: number;
}

export interface TaskFilter {
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string;
  assignedToId?: number;
  createdById?: number;
  tags?: string[];
  page?: number;
  size?: number;
  sort?: string;
}

export interface TaskTemplate {
  id: number;
  templateName: string;
  caseType?: string;
  tasks: TaskTemplateItem[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskTemplateItem {
  title: string;
  description?: string;
  taskType: TaskType;
  priority: TaskPriority;
  estimatedHours?: number;
  daysFromCaseStart?: number;
  dependencies?: string[];
  tags?: string[];
}

// Enumerations - Must match backend enum values exactly
export enum TaskType {
  RESEARCH = 'RESEARCH',
  REVIEW = 'REVIEW',
  DOCUMENT_PREP = 'DOCUMENT_PREP',
  CLIENT_MEETING = 'CLIENT_MEETING',
  COURT_APPEARANCE = 'COURT_APPEARANCE',
  FILING = 'FILING',
  CORRESPONDENCE = 'CORRESPONDENCE',
  OTHER = 'OTHER'
}

export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT'
}

export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  REVIEW = 'REVIEW',
  BLOCKED = 'BLOCKED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}