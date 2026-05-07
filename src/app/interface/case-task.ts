import { BillingType } from 'src/app/modules/legal/interfaces/case.interface';

export interface CaseTask {
  id: number;
  caseId: number;
  caseNumber: string;
  caseTitle: string;
  // V77: parent case's billing arrangement. Drives time-log UI visibility on this task.
  // Read-only: set on the case, projected here for the frontend.
  // Undefined when the task isn't linked to a case yet — treat as "fall back to safe default".
  caseBillingType?: BillingType;
  title: string;
  description?: string;
  taskType: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  assignedToId?: number;
  assignedToName?: string;
  // V78 — multi-assignee. assignees is the canonical full set (includes
  // the primary). assignedToId stays as the legacy "primary" pointer for
  // notifications + the "Mine" filter chip; the row aside renders the
  // avatar stack from this list.
  assignees?: TaskAssigneeRef[];
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
  // List-view-friendly counts populated by the backend so the D2 row's
  // "⊞ done/total" + progress bar render without lazy-loading subtasks.
  subtaskTotal?: number;
  subtaskDoneCount?: number;
  attachments?: TaskAttachment[];
  // Wave 1 Phase 1 — drawer surfaces these whenever status === BLOCKED
  blockerReason?: string;
  autoUnblockDate?: string | Date;
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
  dueDate?: Date | string | null;
  /**
   * Explicit-clear flag for `dueDate`. JSON null is indistinguishable from
   * "field omitted" on the backend (Jackson deserializes both to a Java
   * null on a `LocalDateTime`), so we send `clearDueDate: true` to mean
   * "unset the existing value." Without this, sending `dueDate: null` is
   * a no-op (backend's `if (request.getDueDate() != null)` guard).
   */
  clearDueDate?: boolean;
  estimatedHours?: number;
  actualHours?: number;
  tags?: string[];
  reminderDate?: Date;
  // Wave 1 Phase 1 — backend supports these (UpdateTaskRequest.java),
  // surfaced when transitioning a task to BLOCKED via the drawer.
  blockerReason?: string;
  autoUnblockDate?: string | Date;
}

/**
 * Lightweight projection of an attorney for the multi-assignee picker.
 * Mirrors backend TaskAssigneeRef. Stays small so the row's avatar stack
 * doesn't drag full User objects through the cache.
 */
export interface TaskAssigneeRef {
  id: number;
  firstName?: string;
  lastName?: string;
  email?: string;
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