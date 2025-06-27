export interface CaseAssignment {
  id: number;
  caseId: number;
  caseNumber: string;
  caseTitle: string;
  userId: number;
  userName: string;
  userEmail: string;
  roleType: CaseRoleType;
  assignmentType: AssignmentType;
  assignedAt: Date;
  effectiveFrom: Date;
  effectiveTo?: Date;
  active: boolean;
  workloadWeight: number;
  expertiseMatchScore?: number;
  notes?: string;
  assignedByName?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CaseAssignmentRequest {
  caseId: number;
  userId: number;
  roleType: CaseRoleType;
  effectiveFrom?: Date;
  effectiveTo?: Date;
  workloadWeight?: number;
  notes?: string;
}

export interface CaseTransferRequest {
  caseId: number;
  fromUserId: number;
  toUserId: number;
  reason: string;
  urgency: TransferUrgency;
}

export interface CaseTransferRequestDTO {
  id: number;
  caseId: number;
  caseNumber: string;
  caseTitle: string;
  fromUserId: number;
  fromUserName: string;
  toUserId: number;
  toUserName: string;
  requestedByName: string;
  reason: string;
  urgency: TransferUrgency;
  status: TransferStatus;
  approvedByName?: string;
  approvalNotes?: string;
  requestedAt: Date;
  processedAt?: Date;
}

export interface UserWorkload {
  userId: number;
  userName: string;
  userEmail: string;
  calculationDate: Date;
  activeCasesCount: number;
  totalWorkloadPoints: number;
  capacityPercentage: number;
  maxCapacityPoints: number;
  workloadStatus: WorkloadStatus;
  overdueTasksCount: number;
  upcomingDeadlinesCount: number;
  billableHoursWeek?: number;
  nonBillableHoursWeek?: number;
  averageResponseTimeHours?: number;
  lastCalculatedAt: Date;
  caseBreakdown?: CaseWorkloadBreakdown[];
}

export interface CaseWorkloadBreakdown {
  caseId: number;
  caseNumber: string;
  caseTitle: string;
  caseType: string;
  priority: string;
  workloadPoints: number;
  roleType: string;
}

export interface WorkloadAnalytics {
  totalAttorneys: number;
  overloadedAttorneys: number;
  availableAttorneys: number;
  averageWorkload: number;
  workloadDistribution: WorkloadDistribution[];
  trendData: WorkloadTrend[];
}

export interface WorkloadDistribution {
  range: string;
  count: number;
  percentage: number;
}

export interface WorkloadTrend {
  date: Date;
  averageCapacity: number;
  overloadedCount: number;
}

export interface AssignmentRule {
  id?: number;
  ruleName: string;
  ruleType: RuleType;
  caseType?: string;
  priorityOrder: number;
  active: boolean;
  maxWorkloadPercentage?: number;
  minExpertiseScore?: number;
  preferPreviousAttorney: boolean;
  ruleConditions?: any;
  ruleActions?: any;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AssignmentHistory {
  id: number;
  caseAssignmentId: number;
  caseId: number;
  userId: number;
  action: AssignmentAction;
  previousUserName?: string;
  newUserName?: string;
  reason?: string;
  performedByName: string;
  performedAt: Date;
  metadata?: any;
}

export interface AssignmentRecommendation {
  caseId: number;
  recommendedUsers: UserRecommendation[];
  workloadWeight: number;
  matchScore: number;
  reasoning: string[];
}

export interface UserRecommendation {
  userId: number;
  userName: string;
  score: number;
  factors: ScoreFactor[];
}

export interface ScoreFactor {
  factorName: string;
  score: number;
  weight: number;
  details: string;
}

// Enumerations
export enum CaseRoleType {
  LEAD_ATTORNEY = 'LEAD_ATTORNEY',
  CO_COUNSEL = 'CO_COUNSEL',
  ASSOCIATE = 'ASSOCIATE',
  PARALEGAL = 'PARALEGAL',
  LEGAL_ASSISTANT = 'LEGAL_ASSISTANT',
  CONSULTANT = 'CONSULTANT'
}

export enum AssignmentType {
  MANUAL = 'MANUAL',
  AUTO_ASSIGNED = 'AUTO_ASSIGNED',
  TRANSFERRED = 'TRANSFERRED',
  TEMPORARY = 'TEMPORARY',
  EMERGENCY = 'EMERGENCY'
}

export enum TransferUrgency {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT'
}

export enum TransferStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED'
}

export enum WorkloadStatus {
  UNDER_CAPACITY = 'UNDER_CAPACITY',
  OPTIMAL = 'OPTIMAL',
  NEAR_CAPACITY = 'NEAR_CAPACITY',
  AT_CAPACITY = 'AT_CAPACITY',
  OVER_CAPACITY = 'OVER_CAPACITY'
}

export enum RuleType {
  CASE_TYPE_BASED = 'CASE_TYPE_BASED',
  WORKLOAD_BASED = 'WORKLOAD_BASED',
  EXPERTISE_BASED = 'EXPERTISE_BASED',
  ROUND_ROBIN = 'ROUND_ROBIN',
  CUSTOM = 'CUSTOM'
}

export enum AssignmentAction {
  CREATED = 'CREATED',
  TRANSFERRED = 'TRANSFERRED',
  ROLE_CHANGED = 'ROLE_CHANGED',
  DEACTIVATED = 'DEACTIVATED',
  REACTIVATED = 'REACTIVATED'
}