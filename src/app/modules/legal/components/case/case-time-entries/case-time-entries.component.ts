import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimeTrackingService, TimeEntry } from '../../../../time-tracking/services/time-tracking.service';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterModule } from '@angular/router';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatChipsModule } from '@angular/material/chips';

@Component({
  selector: 'app-case-time-entries',
  templateUrl: './case-time-entries.component.html',
  styleUrls: ['./case-time-entries.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    RouterModule,
    MatPaginatorModule,
    MatChipsModule
  ]
})
export class CaseTimeEntriesComponent implements OnInit {
  @Input() caseId: string | null = null;
  
  timeEntries: TimeEntry[] = [];
  isLoading = false;
  error: string | null = null;
  
  // Pagination
  totalElements = 0;
  pageSize = 10;
  pageIndex = 0;
  
  // Summary
  totalHours = 0;
  totalAmount = 0;
  
  displayedColumns: string[] = ['date', 'user', 'description', 'hours', 'rate', 'amount', 'status', 'actions'];

  constructor(private timeTrackingService: TimeTrackingService) {}

  ngOnInit() {
    if (this.caseId) {
      this.loadTimeEntries();
      this.loadSummary();
    }
  }

  loadTimeEntries() {
    if (!this.caseId) return;
    
    this.isLoading = true;
    this.error = null;
    
    this.timeTrackingService.getTimeEntriesByCase(Number(this.caseId), this.pageIndex, this.pageSize)
      .subscribe({
        next: (response) => {
          if (response && response.data) {
            this.timeEntries = response.data.timeEntries || response.data || [];
            this.totalElements = response.data.totalElements || 0;
          } else {
            this.timeEntries = [];
            this.totalElements = 0;
          }
          this.isLoading = false;
        },
        error: (error) => {
          this.error = 'Failed to load time entries';
          this.isLoading = false;
          this.timeEntries = [];
          this.totalElements = 0;
          console.error('Error loading time entries:', error);
        }
      });
  }
  
  loadSummary() {
    if (!this.caseId) return;
    
    this.timeTrackingService.getCaseTimeSummary(Number(this.caseId))
      .subscribe({
        next: (response) => {
          if (response && response.data) {
            this.totalHours = response.data.totalHours || response.totalHours || 0;
            this.totalAmount = response.data.totalAmount || response.totalAmount || 0;
          } else if (response) {
            this.totalHours = response.totalHours || 0;
            this.totalAmount = response.totalAmount || 0;
          } else {
            this.totalHours = 0;
            this.totalAmount = 0;
          }
        },
        error: (error) => {
          console.error('Error loading case summary:', error);
          this.totalHours = 0;
          this.totalAmount = 0;
        }
      });
  }
  
  onPageChange(event: PageEvent) {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadTimeEntries();
  }
  
  getStatusClass(status: string): string {
    const statusClasses: { [key: string]: string } = {
      'DRAFT': 'draft',
      'SUBMITTED': 'submitted',
      'APPROVED': 'approved',
      'REJECTED': 'rejected',
      'INVOICED': 'invoiced'
    };
    return statusClasses[status] || 'draft';
  }
  
  formatHours(hours: number): string {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
}