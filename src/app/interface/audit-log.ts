export interface AuditEntry {
  id: string;
  timestamp: Date;
  userId: number;
  userName: string;
  action: string;
  entityType: string;
  entityId: number;
  entityName?: string;
  oldValue?: any;
  newValue?: any;
  changes?: AuditChange[];
  ipAddress: string;
  userAgent: string;
  sessionId: string;
  component: string;
  metadata?: { [key: string]: any };
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category: 'SECURITY' | 'DATA_CHANGE' | 'CONFIGURATION' | 'USER_ACTION' | 'SYSTEM';
}

export interface AuditChange {
  field: string;
  oldValue: any;
  newValue: any;
  dataType: 'string' | 'number' | 'boolean' | 'object' | 'array';
}

export interface AuditQuery {
  userId?: number;
  entityType?: string;
  entityId?: number;
  action?: string;
  startDate?: Date;
  endDate?: Date;
  severity?: string[];
  category?: string[];
  page?: number;
  size?: number;
  sortBy?: string;
  sortDirection?: 'ASC' | 'DESC';
}

export interface AuditReport {
  id: string;
  name: string;
  description: string;
  query: AuditQuery;
  totalEntries: number;
  entries: AuditEntry[];
  generatedAt: Date;
  generatedBy: number;
  format: 'JSON' | 'CSV' | 'PDF';
}

export interface ComplianceAlert {
  id: string;
  type: 'UNAUTHORIZED_ACCESS' | 'DATA_BREACH' | 'POLICY_VIOLATION' | 'SUSPICIOUS_ACTIVITY';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  relatedEntries: string[];
  detectedAt: Date;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: number;
  actions: string[];
}