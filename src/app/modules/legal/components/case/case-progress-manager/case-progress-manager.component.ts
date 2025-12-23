import { Component, Input, OnInit, OnChanges, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../../environments/environment';
import Swal from 'sweetalert2';

export interface TimelinePhase {
  id: number;
  phaseOrder: number;
  phaseName: string;
  phaseDescription: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
  icon: string;
  color: string;
  estimatedDurationDays: number;
  startedAt: string;
  completedAt: string;
  estimatedCompletionDate: string;
  notes: string;
  isCurrent: boolean;
}

export interface CaseTimeline {
  caseId: number;
  caseNumber: string;
  caseTitle: string;
  caseType: string;
  caseStatus: string;
  currentPhase: number;
  totalPhases: number;
  completedPhases: number;
  skippedPhases: number;
  progressPercentage: number;
  phases: TimelinePhase[];
}

@Component({
  selector: 'app-case-progress-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="case-progress-manager">
      <!-- Header -->
      <div class="progress-manager-header">
        <div class="header-content">
          <h5 class="header-title">
            <i class="ri-route-line"></i>
            Case Progress Manager
          </h5>
          <p class="header-subtitle" *ngIf="timeline">
            {{ timeline.caseType }} • <span *ngIf="timeline.caseStatus !== 'CLOSED'">Phase {{ timeline.currentPhase }} of {{ timeline.totalPhases }}</span><span *ngIf="timeline.caseStatus === 'CLOSED'" class="text-success fw-semibold">Case Closed</span>
          </p>
        </div>
        <div class="header-actions">
          <span class="progress-badge" *ngIf="timeline">
            {{ timeline.progressPercentage | number:'1.0-0' }}% Complete
          </span>
          <button class="btn btn-sm btn-soft-primary" (click)="loadTimeline()" [disabled]="loading">
            <i class="ri-refresh-line" [class.spin]="loading"></i>
          </button>
        </div>
      </div>

      <!-- Loading State -->
      <div *ngIf="loading" class="loading-state">
        <div class="spinner-border text-primary" role="status"></div>
        <p>Loading timeline...</p>
      </div>

      <!-- Error State -->
      <div *ngIf="error && !loading" class="error-state">
        <i class="ri-error-warning-line"></i>
        <p>{{ error }}</p>
        <button class="btn btn-sm btn-primary" (click)="loadTimeline()">Retry</button>
      </div>

      <!-- Timeline Content -->
      <div *ngIf="timeline && !loading && !error" class="timeline-content">

        <!-- Progress Bar -->
        <div class="progress-bar-section">
          <div class="progress-track">
            <div class="progress-fill" [style.width.%]="timeline.progressPercentage"></div>
          </div>
          <div class="progress-labels">
            <span>{{ timeline.completedPhases + (timeline.skippedPhases || 0) }} completed</span>
            <span *ngIf="timeline.caseStatus !== 'CLOSED'">{{ timeline.totalPhases - timeline.completedPhases - (timeline.skippedPhases || 0) }} remaining</span>
            <span *ngIf="timeline.caseStatus === 'CLOSED'" class="text-success">Case Closed</span>
          </div>
        </div>

        <!-- Phases List -->
        <div class="phases-list">
          <div *ngFor="let phase of timeline.phases; let i = index; let last = last"
               class="phase-item"
               [class.completed]="phase.status === 'COMPLETED'"
               [class.current]="phase.isCurrent"
               [class.pending]="phase.status === 'PENDING' && !phase.isCurrent"
               [class.skipped]="phase.status === 'SKIPPED'">

            <!-- Phase Indicator -->
            <div class="phase-indicator">
              <div class="indicator-circle" [style.borderColor]="phase.color">
                <i *ngIf="phase.status === 'COMPLETED'" class="ri-check-line"></i>
                <i *ngIf="phase.status === 'SKIPPED'" class="ri-skip-forward-line"></i>
                <span *ngIf="phase.status !== 'COMPLETED' && phase.status !== 'SKIPPED'">{{ phase.phaseOrder }}</span>
              </div>
              <div class="indicator-line" *ngIf="!last" [class.filled]="phase.status === 'COMPLETED'"></div>
            </div>

            <!-- Phase Content -->
            <div class="phase-content">
              <div class="phase-header">
                <div class="phase-icon" [style.backgroundColor]="phase.color + '20'" [style.color]="phase.color">
                  <i [class]="phase.icon"></i>
                </div>
                <div class="phase-info">
                  <h6 class="phase-name">{{ phase.phaseName }}</h6>
                  <p class="phase-description">{{ phase.phaseDescription }}</p>
                </div>
                <div class="phase-status-badge">
                  <span *ngIf="phase.status === 'COMPLETED'" class="badge badge-success">
                    <i class="ri-check-line"></i> Completed
                  </span>
                  <span *ngIf="phase.isCurrent && timeline.caseStatus !== 'CLOSED'" class="badge badge-primary">
                    <i class="status-dot"></i> Current Phase
                  </span>
                  <span *ngIf="timeline.caseStatus === 'CLOSED' && last && phase.status !== 'COMPLETED' && phase.status !== 'SKIPPED'" class="badge badge-closed">
                    <i class="ri-lock-line"></i> Closed
                  </span>
                  <span *ngIf="phase.status === 'PENDING' && !phase.isCurrent && timeline.caseStatus !== 'CLOSED'" class="badge badge-secondary">
                    Pending
                  </span>
                  <span *ngIf="phase.status === 'PENDING' && timeline.caseStatus === 'CLOSED' && !last" class="badge badge-secondary">
                    Not Reached
                  </span>
                  <span *ngIf="phase.status === 'SKIPPED'" class="badge badge-warning">
                    <i class="ri-skip-forward-line"></i> Skipped
                  </span>
                </div>
              </div>

              <!-- Phase Meta -->
              <div class="phase-meta" *ngIf="phase.completedAt || phase.startedAt || phase.notes">
                <span *ngIf="phase.completedAt" class="meta-item">
                  <i class="ri-calendar-check-line"></i> Completed: {{ formatDate(phase.completedAt) }}
                </span>
                <span *ngIf="phase.isCurrent && phase.startedAt" class="meta-item">
                  <i class="ri-calendar-line"></i> Started: {{ formatDate(phase.startedAt) }}
                </span>
                <span *ngIf="phase.notes" class="meta-item notes">
                  <i class="ri-sticky-note-line"></i> {{ phase.notes }}
                </span>
              </div>

              <!-- Phase Actions (only for current or actionable phases, hide when case is closed) -->
              <div class="phase-actions" *ngIf="phase.isCurrent && timeline.caseStatus !== 'CLOSED'">
                <button class="btn btn-success btn-sm" (click)="completePhase(phase)" [disabled]="actionLoading">
                  <i class="ri-check-double-line"></i> Complete & Next
                </button>
                <button class="btn btn-warning btn-sm" (click)="skipPhase(phase)" [disabled]="actionLoading">
                  <i class="ri-skip-forward-line"></i> Skip Phase
                </button>
              </div>

              <!-- Set as Current (for non-current phases, hide when case is closed) -->
              <div class="phase-actions" *ngIf="!phase.isCurrent && phase.status !== 'COMPLETED' && timeline.caseStatus !== 'CLOSED'">
                <button class="btn btn-outline-primary btn-sm" (click)="setCurrentPhase(phase)" [disabled]="actionLoading">
                  <i class="ri-focus-3-line"></i> Set as Current
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div *ngIf="!timeline && !loading && !error" class="empty-state">
        <i class="ri-route-line"></i>
        <h6>No Timeline Available</h6>
        <p>Timeline will be initialized automatically when viewing this case.</p>
      </div>
    </div>
  `,
  styles: [`
    .case-progress-manager {
      background: var(--vz-card-bg);
      border-radius: 0.5rem;
      border: 1px solid var(--vz-border-color);
      margin-bottom: 1.5rem;
    }

    .progress-manager-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.25rem;
      border-bottom: 1px solid var(--vz-border-color);
      background: var(--vz-light);
      border-radius: 0.5rem 0.5rem 0 0;
    }

    .header-title {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 0.5rem;

      i {
        color: #405189;
      }
    }

    .header-subtitle {
      margin: 0.25rem 0 0 0;
      font-size: 0.8125rem;
      color: var(--vz-secondary-color);
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .progress-badge {
      background: linear-gradient(135deg, #405189 0%, #3577f1 100%);
      color: #fff;
      padding: 0.375rem 0.75rem;
      border-radius: 2rem;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .loading-state, .error-state, .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 3rem 2rem;
      text-align: center;

      i {
        font-size: 2.5rem;
        color: var(--vz-secondary-color);
        margin-bottom: 1rem;
      }

      p {
        color: var(--vz-secondary-color);
        margin: 0.5rem 0;
      }
    }

    .error-state i {
      color: #f06548;
    }

    .timeline-content {
      padding: 1.25rem;
    }

    .progress-bar-section {
      margin-bottom: 1.5rem;

      .progress-track {
        height: 8px;
        background: var(--vz-light);
        border-radius: 4px;
        overflow: hidden;
      }

      .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #0ab39c 0%, #3577f1 100%);
        border-radius: 4px;
        transition: width 0.4s ease;
      }

      .progress-labels {
        display: flex;
        justify-content: space-between;
        margin-top: 0.5rem;
        font-size: 0.75rem;
        color: var(--vz-secondary-color);
      }
    }

    .phases-list {
      display: flex;
      flex-direction: column;
    }

    .phase-item {
      display: flex;
      gap: 1rem;
      padding: 1rem 0;

      &:not(:last-child) {
        border-bottom: 1px solid var(--vz-border-color);
      }
    }

    .phase-indicator {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 40px;
      flex-shrink: 0;

      .indicator-circle {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border: 2px solid var(--vz-border-color);
        background: var(--vz-card-bg);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--vz-secondary-color);
        transition: all 0.3s ease;

        i {
          font-size: 1rem;
        }
      }

      .indicator-line {
        flex: 1;
        width: 2px;
        background: var(--vz-border-color);
        margin: 0.5rem 0;
        min-height: 20px;

        &.filled {
          background: #0ab39c;
        }
      }
    }

    .phase-item.completed {
      .indicator-circle {
        background: #0ab39c;
        border-color: #0ab39c;
        color: #fff;
      }
    }

    .phase-item.current {
      .indicator-circle {
        background: #405189;
        border-color: #405189;
        color: #fff;
        box-shadow: 0 0 0 4px rgba(64, 81, 137, 0.2);
      }
    }

    .phase-item.skipped {
      opacity: 0.7;

      .indicator-circle {
        background: #f7b84b;
        border-color: #f7b84b;
        color: #fff;
      }
    }

    .phase-content {
      flex: 1;
    }

    .phase-header {
      display: flex;
      align-items: flex-start;
      gap: 1rem;
      margin-bottom: 0.75rem;
    }

    .phase-icon {
      width: 40px;
      height: 40px;
      border-radius: 0.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      i {
        font-size: 1.25rem;
      }
    }

    .phase-info {
      flex: 1;
      min-width: 0;
    }

    .phase-name {
      margin: 0 0 0.25rem 0;
      font-size: 0.9375rem;
      font-weight: 600;
    }

    .phase-description {
      margin: 0;
      font-size: 0.8125rem;
      color: var(--vz-secondary-color);
      line-height: 1.4;
    }

    .phase-status-badge {
      flex-shrink: 0;

      .badge {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        padding: 0.375rem 0.75rem;
        border-radius: 2rem;
        font-size: 0.75rem;
        font-weight: 500;
      }

      .badge-success {
        background: rgba(10, 179, 156, 0.15);
        color: #0ab39c;
      }

      .badge-primary {
        background: rgba(64, 81, 137, 0.15);
        color: #405189;
      }

      .badge-secondary {
        background: var(--vz-light);
        color: var(--vz-secondary-color);
      }

      .badge-warning {
        background: rgba(247, 184, 75, 0.15);
        color: #f7b84b;
      }

      .badge-closed {
        background: rgba(10, 179, 156, 0.15);
        color: #0ab39c;
      }

      .status-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: currentColor;
        animation: pulse 2s ease-in-out infinite;
      }
    }

    .phase-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      margin-bottom: 0.75rem;

      .meta-item {
        display: flex;
        align-items: center;
        gap: 0.375rem;
        font-size: 0.75rem;
        color: var(--vz-secondary-color);

        i {
          font-size: 0.875rem;
        }

        &.notes {
          flex-basis: 100%;
          font-style: italic;
        }
      }
    }

    .phase-actions {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;

      .btn {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        font-size: 0.8125rem;
      }
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .spin {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    /* Dark mode */
    [data-layout-mode="dark"] {
      .case-progress-manager {
        background: var(--vz-card-bg);
        border-color: var(--vz-border-color);
      }

      .progress-manager-header {
        background: var(--vz-tertiary-bg);
      }
    }

    /* Responsive */
    @media (max-width: 768px) {
      .phase-header {
        flex-wrap: wrap;
      }

      .phase-status-badge {
        width: 100%;
        margin-top: 0.5rem;
      }

      .progress-manager-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.75rem;
      }

      .header-actions {
        width: 100%;
        justify-content: space-between;
      }
    }
  `]
})
export class CaseProgressManagerComponent implements OnInit, OnChanges {
  @Input() caseId!: string;

  timeline: CaseTimeline | null = null;
  loading = false;
  actionLoading = false;
  error: string | null = null;

  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    if (this.caseId) {
      this.loadTimeline();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['caseId'] && !changes['caseId'].firstChange && changes['caseId'].currentValue) {
      this.loadTimeline();
    }
  }

  loadTimeline(): void {
    if (!this.caseId) return;

    this.loading = true;
    this.error = null;
    this.cdr.detectChanges();

    this.http.get<any>(`${this.apiUrl}/api/case-timeline/cases/${this.caseId}`)
      .subscribe({
        next: (response) => {
          this.timeline = response.data?.timeline || null;
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error loading timeline:', err);
          this.error = 'Failed to load case timeline';
          this.loading = false;
          this.cdr.detectChanges();
        }
      });
  }

  async completePhase(phase: TimelinePhase): Promise<void> {
    const result = await Swal.fire({
      title: 'Complete Phase',
      html: `
        <p>Mark <strong>${phase.phaseName}</strong> as completed and move to the next phase?</p>
        <div class="mt-3">
          <label class="form-label text-start d-block">Notes (optional):</label>
          <textarea id="phase-notes" class="form-control" rows="2" placeholder="Add any notes about this phase..."></textarea>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Complete Phase',
      confirmButtonColor: '#0ab39c',
      cancelButtonText: 'Cancel',
      preConfirm: () => {
        return (document.getElementById('phase-notes') as HTMLTextAreaElement)?.value || '';
      }
    });

    if (result.isConfirmed) {
      this.actionLoading = true;
      this.cdr.detectChanges();

      const body = result.value ? { notes: result.value } : {};

      this.http.post<any>(`${this.apiUrl}/api/case-timeline/cases/${this.caseId}/phase/${phase.phaseOrder}/complete`, body)
        .subscribe({
          next: (response) => {
            this.timeline = response.data?.timeline || this.timeline;
            this.actionLoading = false;
            this.cdr.detectChanges();

            Swal.fire({
              title: 'Phase Completed',
              text: 'The phase has been marked as completed.',
              icon: 'success',
              timer: 2000,
              showConfirmButton: false
            });
          },
          error: (err) => {
            console.error('Error completing phase:', err);
            this.actionLoading = false;
            this.cdr.detectChanges();

            Swal.fire({
              title: 'Error',
              text: 'Failed to complete the phase. Please try again.',
              icon: 'error'
            });
          }
        });
    }
  }

  async skipPhase(phase: TimelinePhase): Promise<void> {
    const result = await Swal.fire({
      title: 'Skip Phase',
      html: `
        <p>Are you sure you want to skip <strong>${phase.phaseName}</strong>?</p>
        <div class="mt-3">
          <label class="form-label text-start d-block">Reason for skipping:</label>
          <textarea id="skip-reason" class="form-control" rows="2" placeholder="Enter reason for skipping this phase..." required></textarea>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Skip Phase',
      confirmButtonColor: '#f7b84b',
      cancelButtonText: 'Cancel',
      preConfirm: () => {
        const reason = (document.getElementById('skip-reason') as HTMLTextAreaElement)?.value;
        if (!reason?.trim()) {
          Swal.showValidationMessage('Please provide a reason for skipping');
          return false;
        }
        return reason;
      }
    });

    if (result.isConfirmed && result.value) {
      this.actionLoading = true;
      this.cdr.detectChanges();

      this.http.post<any>(`${this.apiUrl}/api/case-timeline/cases/${this.caseId}/phase/${phase.phaseOrder}/skip`, { reason: result.value })
        .subscribe({
          next: (response) => {
            this.timeline = response.data?.timeline || this.timeline;
            this.actionLoading = false;
            this.cdr.detectChanges();

            Swal.fire({
              title: 'Phase Skipped',
              text: 'The phase has been skipped.',
              icon: 'success',
              timer: 2000,
              showConfirmButton: false
            });
          },
          error: (err) => {
            console.error('Error skipping phase:', err);
            this.actionLoading = false;
            this.cdr.detectChanges();

            Swal.fire({
              title: 'Error',
              text: 'Failed to skip the phase. Please try again.',
              icon: 'error'
            });
          }
        });
    }
  }

  async setCurrentPhase(phase: TimelinePhase): Promise<void> {
    const result = await Swal.fire({
      title: 'Set Current Phase',
      html: `
        <p>Set <strong>${phase.phaseName}</strong> as the current phase?</p>
        <p class="text-muted small">This will mark all previous phases as completed.</p>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Set as Current',
      confirmButtonColor: '#405189',
      cancelButtonText: 'Cancel'
    });

    if (result.isConfirmed) {
      this.actionLoading = true;
      this.cdr.detectChanges();

      this.http.put<any>(`${this.apiUrl}/api/case-timeline/cases/${this.caseId}/phase/${phase.phaseOrder}`, {})
        .subscribe({
          next: (response) => {
            this.timeline = response.data?.timeline || this.timeline;
            this.actionLoading = false;
            this.cdr.detectChanges();

            Swal.fire({
              title: 'Phase Updated',
              text: `${phase.phaseName} is now the current phase.`,
              icon: 'success',
              timer: 2000,
              showConfirmButton: false
            });
          },
          error: (err) => {
            console.error('Error setting current phase:', err);
            this.actionLoading = false;
            this.cdr.detectChanges();

            Swal.fire({
              title: 'Error',
              text: 'Failed to update the phase. Please try again.',
              icon: 'error'
            });
          }
        });
    }
  }

  formatDate(dateString: string | null): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}
