import { Component, OnInit } from '@angular/core';
import { AuditLogService, AuditLogEntry, AuditLogFilter } from '../../../../core/services/audit-log.service';
import { RbacService } from '../../../../core/services/rbac.service';
import { FormBuilder, FormGroup } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-audit-logs',
  templateUrl: './audit-logs.component.html',
  styleUrls: ['./audit-logs.component.scss']
})
export class AuditLogsComponent implements OnInit {
  auditLogs: AuditLogEntry[] = [];
  recentActivities: AuditLogEntry[] = [];
  loading = false;
  filterForm: FormGroup;
  
  // Filter options
  actionTypes = [
    'CASE_CREATE', 'CASE_DELETE', 'CASE_UPDATE',
    'DOCUMENT_DELETE', 'DOCUMENT_DOWNLOAD',
    'USER_LOGIN', 'USER_LOGOUT',
    'ROLE_ASSIGN', 'ROLE_REMOVE',
    'BILLING_VIEW', 'CLIENT_INFO_ACCESS'
  ];
  
  resourceTypes = ['CASE', 'DOCUMENT', 'USER', 'BILLING', 'CALENDAR'];
  
  // Pagination
  currentPage = 0;
  pageSize = 20;
  totalPages = 0;
  totalElements = 0;

  constructor(
    private auditLogService: AuditLogService,
    private rbacService: RbacService,
    private fb: FormBuilder,
    private snackBar: MatSnackBar
  ) {
    this.initializeFilterForm();
  }

  ngOnInit(): void {
    // Check if user has permission to view audit logs
    if (!this.rbacService.hasPermissionSync('SYSTEM', 'VIEW')) {
      this.snackBar.open('You do not have permission to view audit logs', 'Close', { duration: 3000 });
      return;
    }
    
    this.loadAuditLogs();
    this.loadRecentActivities();
  }

  private initializeFilterForm(): void {
    this.filterForm = this.fb.group({
      userId: [''],
      action: [''],
      resource: [''],
      dateFrom: [''],
      dateTo: [''],
      success: ['']
    });
  }

  loadAuditLogs(): void {
    this.loading = true;
    
    const filter: AuditLogFilter = {
      ...this.filterForm.value,
      page: this.currentPage,
      size: this.pageSize
    };
    
    // Convert date strings to Date objects
    if (filter.dateFrom) filter.dateFrom = new Date(filter.dateFrom);
    if (filter.dateTo) filter.dateTo = new Date(filter.dateTo);
    
    this.auditLogService.getAuditLogs(filter).subscribe({
      next: (response) => {
        this.auditLogs = response.data?.content || [];
        this.totalPages = response.data?.totalPages || 0;
        this.totalElements = response.data?.totalElements || 0;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading audit logs:', error);
        this.snackBar.open('Failed to load audit logs', 'Close', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  loadRecentActivities(): void {
    this.auditLogService.getRecentActivities(10).subscribe({
      next: (activities) => {
        this.recentActivities = activities;
      },
      error: (error) => {
        console.error('Error loading recent activities:', error);
      }
    });
  }

  applyFilters(): void {
    this.currentPage = 0;
    this.loadAuditLogs();
  }

  clearFilters(): void {
    this.filterForm.reset();
    this.currentPage = 0;
    this.loadAuditLogs();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadAuditLogs();
  }

  exportAuditLogs(): void {
    if (!this.rbacService.hasPermissionSync('SYSTEM', 'ADMIN')) {
      this.snackBar.open('You do not have permission to export audit logs', 'Close', { duration: 3000 });
      return;
    }
    
    // Log the export action
    this.auditLogService.logAction('DATA_EXPORT', 'AUDIT_LOG', '', { 
      exportType: 'audit_logs',
      filters: this.filterForm.value 
    }).subscribe();
    
    // TODO: Implement actual export functionality
    this.snackBar.open('Export functionality will be implemented', 'Close', { duration: 3000 });
  }

  getActionIcon(action: string): string {
    const iconMap: { [key: string]: string } = {
      'CASE_CREATE': 'ri-add-circle-line',
      'CASE_DELETE': 'ri-delete-bin-line',
      'CASE_UPDATE': 'ri-edit-line',
      'DOCUMENT_DELETE': 'ri-file-reduce-line',
      'DOCUMENT_DOWNLOAD': 'ri-download-line',
      'USER_LOGIN': 'ri-login-circle-line',
      'USER_LOGOUT': 'ri-logout-circle-line',
      'ROLE_ASSIGN': 'ri-user-add-line',
      'ROLE_REMOVE': 'ri-user-unfollow-line',
      'BILLING_VIEW': 'ri-money-dollar-circle-line',
      'CLIENT_INFO_ACCESS': 'ri-user-search-line'
    };
    
    return iconMap[action] || 'ri-information-line';
  }

  getActionColor(action: string): string {
    if (action.includes('DELETE') || action.includes('REMOVE')) return 'text-danger';
    if (action.includes('CREATE') || action.includes('ASSIGN')) return 'text-success';
    if (action.includes('UPDATE') || action.includes('EDIT')) return 'text-warning';
    return 'text-info';
  }

  formatTimestamp(timestamp: Date): string {
    return new Date(timestamp).toLocaleString();
  }
} 