import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject, forkJoin } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ClientPortalService, ClientCase, ClientDocument, ClientAppointment, ClientActivity } from '../../services/client-portal.service';
import { ClientDocumentPreviewModalComponent } from '../document-preview-modal/client-document-preview-modal.component';
import { CaseTimelineComponent } from '../case-timeline/case-timeline.component';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-client-case-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, CaseTimelineComponent],
  templateUrl: './client-case-detail.component.html',
  styleUrls: ['./client-case-detail.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClientCaseDetailComponent implements OnInit, OnDestroy {
  caseData: ClientCase | null = null;
  documents: ClientDocument[] = [];
  activities: ClientActivity[] = [];
  loading = true;
  documentsLoading = false;
  error: string | null = null;
  caseId: number | null = null;
  activeTab: 'documents' | 'activity' = 'documents';
  timelineProgress: number = 0;

  private destroy$ = new Subject<void>();
  private apiUrl = environment.apiUrl;

  constructor(
    private route: ActivatedRoute,
    private clientPortalService: ClientPortalService,
    private cdr: ChangeDetectorRef,
    private modalService: NgbModal,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      if (params['id']) {
        this.caseId = +params['id'];
        this.loadCaseData();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadCaseData(): void {
    if (!this.caseId) return;

    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();

    this.clientPortalService.getCase(this.caseId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (data) => {
          this.caseData = data;
          this.loadDocuments();
          this.loadTimelineProgress();
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error loading case:', err);
          this.error = 'Failed to load case details. Please try again.';
          this.cdr.markForCheck();
        }
      });
  }

  loadTimelineProgress(): void {
    if (!this.caseId) return;

    this.http.get<any>(`${this.apiUrl}/api/case-timeline/cases/${this.caseId}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          const timeline = response.data?.timeline;
          if (timeline) {
            this.timelineProgress = timeline.progressPercentage || 0;
            this.cdr.markForCheck();
          }
        },
        error: (err) => {
          console.error('Error loading timeline progress:', err);
          // Keep using status-based progress as fallback
        }
      });
  }

  loadDocuments(): void {
    if (!this.caseId) return;

    this.documentsLoading = true;
    this.cdr.markForCheck();

    this.clientPortalService.getCaseDocuments(this.caseId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.documentsLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (docs) => {
          this.documents = docs || [];
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error loading documents:', err);
          this.cdr.markForCheck();
        }
      });
  }

  setActiveTab(tab: 'documents' | 'activity'): void {
    this.activeTab = tab;
    this.cdr.markForCheck();
  }

  getDaysOpen(): number {
    if (!this.caseData?.openDate) return 0;

    // Parse the date properly (handles ISO format from backend)
    const opened = new Date(this.caseData.openDate);
    if (isNaN(opened.getTime())) return 0;

    // Set to start of day to avoid timezone/time issues
    const openedDate = new Date(opened.getFullYear(), opened.getMonth(), opened.getDate());
    const today = new Date();
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    // Calculate difference in days
    const diffTime = todayDate.getTime() - openedDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    // Return 0 if date is in the future
    return diffDays > 0 ? diffDays : 0;
  }

  getProgressPercentage(): number {
    // Use timeline progress if available
    if (this.timelineProgress > 0) {
      return Math.round(this.timelineProgress);
    }
    // Fallback to status-based progress
    const statusProgress: { [key: string]: number } = {
      'OPEN': 10,
      'ACTIVE': 25,
      'IN_PROGRESS': 40,
      'DISCOVERY': 50,
      'PENDING': 60,
      'TRIAL': 75,
      'SETTLED': 100,
      'WON': 100,
      'LOST': 100,
      'CLOSED': 100
    };
    return statusProgress[this.caseData?.status || ''] || 0;
  }

  // Status helpers
  getStatusBadgeClass(status: string | undefined): string {
    const statusMap: { [key: string]: string } = {
      'OPEN': 'bg-primary',
      'ACTIVE': 'bg-primary',
      'IN_PROGRESS': 'bg-info',
      'DISCOVERY': 'bg-info',
      'PENDING': 'bg-warning',
      'CLOSED': 'bg-secondary',
      'SETTLED': 'bg-success',
      'WON': 'bg-success',
      'LOST': 'bg-danger'
    };
    return statusMap[status || ''] || 'bg-secondary';
  }

  formatStatus(status: string | undefined): string {
    if (!status) return 'Unknown';
    return status.replace(/_/g, ' ').toLowerCase()
      .replace(/\b\w/g, char => char.toUpperCase());
  }

  // Type helpers
  getTypeIcon(type: string | undefined): string {
    const iconMap: { [key: string]: string } = {
      'Criminal': 'ri-scales-3-line',
      'Civil': 'ri-file-list-3-line',
      'Family': 'ri-parent-line',
      'Corporate': 'ri-building-line',
      'Immigration': 'ri-global-line',
      'Real Estate': 'ri-home-line',
      'Personal Injury': 'ri-heart-pulse-line',
      'Bankruptcy': 'ri-bank-line'
    };
    return iconMap[type || ''] || 'ri-briefcase-line';
  }

  getTypeClass(type: string | undefined): string {
    const typeMap: { [key: string]: string } = {
      'Criminal': 'bg-danger-subtle text-danger',
      'Civil': 'bg-primary-subtle text-primary',
      'Family': 'bg-warning-subtle text-warning',
      'Corporate': 'bg-info-subtle text-info',
      'Immigration': 'bg-success-subtle text-success',
      'Real Estate': 'bg-secondary-subtle text-secondary',
      'Personal Injury': 'bg-danger-subtle text-danger',
      'Bankruptcy': 'bg-warning-subtle text-warning'
    };
    return typeMap[type || ''] || 'bg-primary-subtle text-primary';
  }

  // Format helpers
  formatDate(dateString: string | undefined): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  formatFileSize(bytes: number | undefined): string {
    if (!bytes) return '-';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  getFileIcon(fileType: string | undefined): string {
    const type = (fileType || '').toLowerCase();
    if (type.includes('pdf')) return 'ri-file-pdf-line text-danger';
    if (type.includes('word') || type.includes('doc')) return 'ri-file-word-line text-primary';
    if (type.includes('excel') || type.includes('xls')) return 'ri-file-excel-line text-success';
    if (type.includes('image') || type.includes('png') || type.includes('jpg')) return 'ri-image-line text-info';
    return 'ri-file-line text-secondary';
  }

  downloadDocument(doc: ClientDocument): void {
    if (!doc.id) return;

    const downloadUrl = `${this.apiUrl}/api/file-manager/files/${doc.id}/download`;

    this.http.get(downloadUrl, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = doc.fileName || doc.title || 'document';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      },
      error: (err) => {
        console.error('Error downloading document:', err);
      }
    });
  }

  previewDocument(doc: ClientDocument): void {
    if (!doc.id) return;

    const modalRef = this.modalService.open(ClientDocumentPreviewModalComponent, {
      size: 'xl',
      centered: true,
      backdrop: 'static',
      keyboard: true
    });
    modalRef.componentInstance.document = doc;
  }

  refreshData(): void {
    this.loadCaseData();
  }
}
