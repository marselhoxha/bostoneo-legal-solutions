import { Component, Input, OnInit, OnChanges, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';

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
  selector: 'app-case-timeline',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './case-timeline.component.html',
  styleUrls: ['./case-timeline.component.scss']
})
export class CaseTimelineComponent implements OnInit, OnChanges {
  @Input() caseId!: number;
  @Input() isClientView: boolean = true;

  timeline: CaseTimeline | null = null;
  loading: boolean = false;
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
    if (changes['caseId'] && !changes['caseId'].firstChange) {
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
          this.error = 'Unable to load case timeline';
          this.loading = false;
          this.cdr.detectChanges();
        }
      });
  }

  getPhaseStatusClass(phase: TimelinePhase): string {
    if (phase.status === 'COMPLETED') return 'completed';
    if (phase.status === 'IN_PROGRESS' || phase.isCurrent) return 'current';
    if (phase.status === 'SKIPPED') return 'skipped';
    return 'pending';
  }

  getProgressWidth(): string {
    if (!this.timeline || this.timeline.totalPhases === 0) return '0%';
    return `${this.timeline.progressPercentage}%`;
  }

  formatDate(dateString: string | null): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  getEstimatedCompletion(): string {
    if (!this.timeline?.phases) return '';
    const currentPhase = this.timeline.phases.find(p => p.isCurrent);
    if (currentPhase?.estimatedCompletionDate) {
      return this.formatDate(currentPhase.estimatedCompletionDate);
    }
    return '';
  }
}
