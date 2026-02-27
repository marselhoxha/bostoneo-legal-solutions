export interface PlatformStats {
  totalOrganizations: number;
  activeOrganizations: number;
  suspendedOrganizations: number;
  totalUsers: number;
  activeUsersLast7Days: number;
  activeUsersLast30Days: number;
  totalCases: number;
  activeCases: number;
  closedCases: number;
  totalClients: number;
  totalInvoices: number;
  totalRevenue: number;
  revenueThisMonth?: number;
  systemHealth: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  totalStorageUsedBytes?: number;
  totalStorageLimitBytes?: number;
  recentActivity: RecentActivity[];
  alerts: Alert[];
  newSignups?: NewSignup[];
}

export interface NewSignup {
  id: number;
  name: string;
  planType: string;
  status: string;
  userCount: number;
  adminEmail: string;
  createdAt: string;
}

export interface RecentActivity {
  id: number;
  action: string;
  entityType: string;
  entityName: string;
  userName: string;
  userEmail?: string;
  organizationName?: string;
  description?: string;
  timestamp: string;
}

export interface Alert {
  type: 'WARNING' | 'ERROR' | 'INFO';
  message: string;
  organizationName?: string;
  timestamp: string;
}

export interface OrganizationWithStats {
  id: number;
  name: string;
  slug: string;
  planType: string;
  status: string;
  email: string;
  phone: string;
  userCount: number;
  caseCount: number;
  clientCount: number;
  invoiceCount: number;
  storageUsedBytes?: number;
  createdAt: string;
  lastActivityAt?: string;
  userQuotaPercent?: number;
  caseQuotaPercent?: number;
  storageQuotaPercent?: number;
}

export interface OrganizationDetail {
  id: number;
  name: string;
  slug: string;
  email: string;
  phone: string;
  address?: string;
  website?: string;
  logoUrl?: string;
  planType: string;
  status: string;
  planStartDate?: string;
  planEndDate?: string;
  smsEnabled?: boolean;
  whatsappEnabled?: boolean;
  emailEnabled?: boolean;
  twilioEnabled?: boolean;
  createdAt: string;
  updatedAt?: string;
  lastActivityAt?: string;
  stats: OrganizationStatsInfo;
  recentUsers: UserSummary[];
  recentActivity: RecentActivity[];
}

export interface OrganizationStatsInfo {
  userCount: number;
  activeUserCount?: number;
  caseCount: number;
  activeCaseCount?: number;
  clientCount: number;
  invoiceCount: number;
  documentCount?: number;
  storageUsedBytes?: number;
  totalRevenue?: number;
  revenueThisMonth?: number;
  maxUsers?: number;
  maxCases?: number;
  maxStorageBytes?: number;
  userQuotaPercent?: number;
  caseQuotaPercent?: number;
  storageQuotaPercent?: number;
}

export interface UserSummary {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  title?: string;
  imageUrl?: string;
  enabled: boolean;
  notLocked: boolean;
  usingMFA: boolean;
  createdAt: string;
  roleName: string;
  organizationId?: number;
}

export interface PageResponse<T> {
  content: T[];
  page: {
    number: number;
    size: number;
    totalElements: number;
    totalPages: number;
  };
}

// System Health
export interface SystemHealth {
  overallStatus: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  checkedAt: string;
  database: ComponentHealth;
  application: ComponentHealth;
  memory: MemoryInfo;
  disk?: DiskInfo;
  errorCountLastHour: number;
  errorCountLast24Hours: number;
  activeSessions: number;
  apiMetrics?: ApiMetrics;
}

export interface ComponentHealth {
  status: 'UP' | 'DOWN' | 'DEGRADED';
  message: string;
  responseTimeMs: number;
}

export interface MemoryInfo {
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  usagePercent: number;
}

export interface DiskInfo {
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  usagePercent: number;
}

export interface ApiMetrics {
  totalRequestsLastHour: number;
  avgResponseTimeMs: number;
  p95ResponseTimeMs: number;
  p99ResponseTimeMs: number;
  requestsByEndpoint?: { [key: string]: number };
}

// Platform Analytics
export interface PlatformAnalytics {
  organizationGrowth: TimeSeriesData[];
  userGrowth: TimeSeriesData[];
  caseGrowth: TimeSeriesData[];
  revenueGrowth?: TimeSeriesData[];
  topOrgsByUsers: OrgMetric[];
  topOrgsByCases: OrgMetric[];
  topOrgsByRevenue?: OrgMetric[];
  casesByType?: { [key: string]: number };
  usersByRole?: { [key: string]: number };
  casesByStatus?: { [key: string]: number };
  dailyActiveUsers: number;
  weeklyActiveUsers: number;
  monthlyActiveUsers: number;
  organizationsByPlan?: { [key: string]: number };
}

export interface TimeSeriesData {
  date: string;
  value: number;
  label?: string;
}

export interface OrgMetric {
  organizationId: number;
  organizationName: string;
  value: number;
  metric?: string;
}

// User Detail
export interface UserDetail {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  imageUrl?: string;
  roleName: string;
  roleDescription?: string;
  organizationId?: number;
  organizationName?: string;
  organizationSlug?: string;
  enabled: boolean;
  accountNonLocked: boolean;
  usingMfa: boolean;
  createdAt: string;
  lastLogin?: string;
  casesAssigned: number;
  tasksCompleted?: number;
  documentsUploaded?: number;
  recentActivity: UserActivityItem[];
  loginHistory?: LoginRecord[];
}

export interface UserActivityItem {
  action: string;
  entityType: string;
  description: string;
  timestamp: string;
}

export interface LoginRecord {
  loginTime: string;
  ipAddress?: string;
  userAgent?: string;
  successful: boolean;
}

// Audit Log
export interface AuditLogEntry {
  id: number;
  action: string;
  entityType: string;
  entityId?: number;
  entityName?: string;
  description: string;
  userId?: number;
  userEmail?: string;
  userName?: string;
  organizationId?: number;
  organizationName?: string;
  ipAddress?: string;
  userAgent?: string;
  oldValue?: string;
  newValue?: string;
  createdAt: string;
}

// Create/Update DTOs
export interface CreateOrganization {
  name: string;
  slug: string;
  planType?: string;
  adminFirstName: string;
  adminLastName: string;
  adminEmail: string;
  phone?: string;
  address?: string;
  website?: string;
  timezone?: string;
  maxUsers?: number;
  maxCases?: number;
  maxStorageBytes?: number;
}

export interface UpdateOrganization {
  name?: string;
  slug?: string;
  planType?: string;
  status?: string;
  phone?: string;
  address?: string;
  website?: string;
  timezone?: string;
  maxUsers?: number;
  maxCases?: number;
  maxStorageBytes?: number;
}

// Announcement (for creating/sending)
export interface Announcement {
  title: string;
  message: string;
  type?: 'INFO' | 'WARNING' | 'MAINTENANCE' | 'UPDATE';
  sendToAll: boolean;
  targetOrganizationIds?: number[];
  targetUserIds?: number[];
  sendImmediately?: boolean;
  scheduledAt?: string;
}

// Announcement Summary (for listing)
export interface AnnouncementSummary {
  id: number;
  title: string;
  message: string;
  type: 'INFO' | 'WARNING' | 'MAINTENANCE' | 'UPDATE';
  sendToAll: boolean;
  targetOrganizationIds?: number[];
  targetUserIds?: number[];
  recipientsCount: number;
  scheduledAt?: string;
  sentAt?: string;
  createdBy?: number;
  createdByName?: string;
  createdAt: string;
}

// Integration Status (for Phase 1.2)
export interface IntegrationStatus {
  organizationId: number;
  organizationName: string;
  twilioEnabled: boolean;
  twilioPhoneNumber?: string;
  twilioLastActivity?: string;
  boldSignEnabled: boolean;
  boldSignApiConfigured: boolean;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  emailEnabled: boolean;
  hasIssues: boolean;
  issueDescription?: string;
}

// Security Overview (for Phase 1.3)
export interface SecurityOverview {
  totalFailedLogins: number;
  failedLoginsLast24h: number;
  failedLoginsLast7d: number;
  failedLoginsLast30d: number;
  accountLockouts: number;
  suspiciousActivityCount: number;
  recentSecurityEvents: SecurityEvent[];
}

export interface SecurityEvent {
  id: number;
  eventType: 'FAILED_LOGIN' | 'ACCOUNT_LOCKOUT' | 'SUSPICIOUS_ACTIVITY' | 'PASSWORD_RESET';
  userEmail?: string;
  organizationName?: string;
  ipAddress?: string;
  description: string;
  timestamp: string;
}

export interface FailedLogin {
  id: number;
  userEmail: string;
  organizationName?: string;
  ipAddress?: string;
  userAgent?: string;
  failureReason?: string;
  attemptCount: number;
  timestamp: string;
}

// Organization Features (for Phase 1.4)
export interface OrganizationFeatures {
  organizationId: number;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  emailEnabled: boolean;
  twilioEnabled: boolean;
  boldSignEnabled: boolean;
  maxUsers: number;
  maxCases: number;
  maxStorageBytes: number;
  planType: string;
}

// Role summary for user creation dropdown
export interface RoleSummary {
  id: number;
  name: string;
  displayName: string;
  hierarchyLevel: number;
  isSystemRole: boolean;
}

// Login session for session management
export interface LoginSession {
  device: string;
  ip_address: string;
  login_time: string;
  event_type: string;
}

// Create user for organization
export interface CreateUserForOrg {
  firstName: string;
  lastName: string;
  email: string;
  roleName: string;
}

// === Dashboard Drill-Down Models ===

export interface OrgActiveUsers {
  organizationId: number;
  organizationName: string;
  activeUsers24h: number;
  totalUsers: number;
  activityPercent: number;
}

export interface DrillDownUserActivity {
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  lastLogin: string;
  loginCount24h: number;
  lastDevice: string;
  lastIpAddress: string;
}

export interface UserSessionItem {
  loginTime: string;
  device: string;
  ipAddress: string;
  eventType: 'SUCCESS' | 'FAILURE';
}

export interface OrgApiRequests {
  organizationId: number | null;
  organizationName: string;
  requestCount: number;
  topAction: string;
}

export interface EndpointBreakdown {
  action: string;
  entityType: string;
  count: number;
  lastHit: string;
}

export interface OrgStorage {
  organizationId: number;
  organizationName: string;
  storageUsedBytes: number;
  documentCount: number;
  dbRows: number;
  quotaPercent: number | null;
}

export interface OrgErrors {
  organizationId: number | null;
  organizationName: string;
  errorCount24h: number;
  lastError: string;
  lastErrorType: string;
}

export interface OrgSecurity {
  organizationId: number;
  organizationName: string;
  failedLogins: number;
  accountLockouts: number;
  suspiciousIps: number;
}

export interface EngagementMetrics {
  dau: number;
  wau: number;
  mau: number;
  dauWauRatio: number;
  avgLoginsPerUserPerDay: number;
  byOrganization: OrgEngagement[];
}

export interface OrgEngagement {
  organizationId: number;
  organizationName: string;
  dau: number;
  wau: number;
  mau: number;
}

export interface DataGrowth {
  casesThisWeek: number;
  casesLastWeek: number;
  documentsThisWeek: number;
  documentsLastWeek: number;
  clientsThisWeek: number;
  clientsLastWeek: number;
  byOrganization: OrgDataGrowth[];
}

export interface OrgDataGrowth {
  organizationId: number;
  organizationName: string;
  casesThisWeek: number;
  documentsThisWeek: number;
  clientsThisWeek: number;
}

export interface FeatureAdoption {
  totalOrganizations: number;
  smsEnabled: number;
  whatsappEnabled: number;
  emailEnabled: number;
  boldSignEnabled: number;
  twilioEnabled: number;
}

// System Health — Active Sessions & Login Events

export interface ActiveSession {
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  organizationId: number | null;
  organizationName: string;
  device: string;
  ipAddress: string;
  loginTime: string;
}

export interface LoginEvent {
  id: number;
  userId: number;
  userEmail: string;
  userName: string;
  organizationId: number | null;
  organizationName: string;
  device: string;
  ipAddress: string;
  eventType: 'LOGIN_ATTEMPT_SUCCESS' | 'LOGIN_ATTEMPT_FAILURE';
  timestamp: string;
}
