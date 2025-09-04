import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { CrmService } from '../../services/crm.service';

export interface ConflictMatchDTO {
  entityType: string;
  entityId: number;
  entityName: string;
  matchType: string;
  matchScore: number;
  matchReason: string;
  matchDetails: any;
  riskLevel: string;
  status: string;
  lastUpdated: string;
  recommendedAction: string;
}

export interface ConflictCheckDTO {
  id: number;
  entityType: string;
  entityId: number;
  checkType: string;
  searchTerms: string[];
  searchParameters: any;
  results: ConflictMatchDTO[];
  status: string;
  confidenceScore: number;
  autoChecked: boolean;
  checkedBy?: number;
  checkedByName?: string;
  checkedAt?: string;
  resolution?: string;
  resolutionNotes?: string;
  waiverDocumentPath?: string;
  resolvedBy?: number;
  resolvedByName?: string;
  resolvedAt?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

@Component({
  selector: 'app-conflict-check',
  templateUrl: './conflict-check.component.html',
  styleUrls: ['./conflict-check.component.scss']
})
export class ConflictCheckComponent implements OnInit {
  @Input() leadId: number | null = null;
  @Input() clientData: any = null;
  @Input() matterData: any = null;
  @Input() conversionType: string = '';
  @Input() showModal: boolean = false;
  
  @Output() conflictCheckComplete = new EventEmitter<any>();
  @Output() modalClosed = new EventEmitter<void>();

  public conflictCheck: ConflictCheckDTO | null = null;
  public loading: boolean = false;
  public error: string | null = null;
  
  public checkingComplete: boolean = false;
  public canProceed: boolean = false;
  public hasConflicts: boolean = false;
  
  reviewForm = {
    resolution: '',
    notes: ''
  };

  constructor(private crmService: CrmService) {}

  ngOnInit() {
    if (this.leadId && this.conversionType) {
      this.performConflictCheck();
    }
  }

  performConflictCheck() {
    if (!this.leadId) return;
    
    this.loading = true;
    this.error = null;
    
    let conflictCheckRequest;
    
    switch (this.conversionType) {
      case 'CLIENT_ONLY':
        conflictCheckRequest = this.crmService.performClientConflictCheck(this.leadId, this.clientData);
        break;
      case 'MATTER_ONLY':
        conflictCheckRequest = this.crmService.performMatterConflictCheck(this.leadId, this.matterData);
        break;
      case 'CLIENT_AND_MATTER':
        const conversionData = {
          clientData: this.clientData,
          matterData: this.matterData
        };
        conflictCheckRequest = this.crmService.performFullConflictCheck(this.leadId, conversionData);
        break;
      default:
        this.error = 'Invalid conversion type';
        this.loading = false;
        return;
    }
    
    conflictCheckRequest.subscribe({
      next: (result: ConflictCheckDTO) => {
        this.conflictCheck = result;
        this.checkingComplete = true;
        this.loading = false;
        
        // Determine if conversion can proceed
        this.hasConflicts = result.results && result.results.length > 0;
        this.canProceed = this.determineCanProceed(result);
        
        this.conflictCheckComplete.emit({
          conflictCheck: result,
          canProceed: this.canProceed,
          hasConflicts: this.hasConflicts
        });
      },
      error: (error) => {
        this.error = 'Failed to perform conflict check. Please try again.';
        this.loading = false;
        console.error('Conflict check error:', error);
      }
    });
  }

  determineCanProceed(conflictCheck: ConflictCheckDTO): boolean {
    if (conflictCheck.status === 'CLEAR' || conflictCheck.status === 'LOW_RISK') {
      return true;
    }
    
    if (conflictCheck.status === 'APPROVED' || conflictCheck.status === 'RESOLVED') {
      return true;
    }
    
    return false;
  }

  submitReview() {
    if (!this.conflictCheck || !this.reviewForm.resolution) return;
    
    this.loading = true;
    
    this.crmService.reviewConflictCheck(this.conflictCheck.id, this.reviewForm).subscribe({
      next: (updatedCheck: ConflictCheckDTO) => {
        this.conflictCheck = updatedCheck;
        this.canProceed = this.determineCanProceed(updatedCheck);
        this.loading = false;
        
        this.conflictCheckComplete.emit({
          conflictCheck: updatedCheck,
          canProceed: this.canProceed,
          hasConflicts: this.hasConflicts
        });
      },
      error: (error) => {
        this.error = 'Failed to submit review. Please try again.';
        this.loading = false;
        console.error('Review submission error:', error);
      }
    });
  }

  resolveConflict() {
    if (!this.conflictCheck) return;
    
    this.loading = true;
    
    const resolutionData = {
      resolution: 'WAIVER_APPROVED',
      resolutionNotes: this.reviewForm.notes,
      waiverDocumentPath: ''
    };
    
    this.crmService.resolveConflict(this.conflictCheck.id, resolutionData).subscribe({
      next: (resolvedCheck: ConflictCheckDTO) => {
        this.conflictCheck = resolvedCheck;
        this.canProceed = true;
        this.loading = false;
        
        this.conflictCheckComplete.emit({
          conflictCheck: resolvedCheck,
          canProceed: this.canProceed,
          hasConflicts: this.hasConflicts
        });
      },
      error: (error) => {
        this.error = 'Failed to resolve conflict. Please try again.';
        this.loading = false;
        console.error('Conflict resolution error:', error);
      }
    });
  }

  getStatusBadgeClass(status: string): string {
    const statusClasses: { [key: string]: string } = {
      'PENDING': 'badge-soft-warning',
      'CLEAR': 'badge-soft-success',
      'CONFLICT_FOUND': 'badge-soft-danger',
      'POTENTIAL_CONFLICT': 'badge-soft-warning',
      'LOW_RISK': 'badge-soft-info',
      'APPROVED': 'badge-soft-success',
      'REJECTED': 'badge-soft-danger',
      'WAIVER_REQUIRED': 'badge-soft-warning',
      'RESOLVED': 'badge-soft-success'
    };
    return statusClasses[status] || 'badge-soft-secondary';
  }

  getRiskBadgeClass(riskLevel: string): string {
    const riskClasses: { [key: string]: string } = {
      'LOW': 'badge-soft-success',
      'MEDIUM': 'badge-soft-warning',
      'HIGH': 'badge-soft-danger'
    };
    return riskClasses[riskLevel] || 'badge-soft-secondary';
  }

  public closeModal(): void {
    this.modalClosed.emit();
  }

  proceedWithConversion() {
    this.conflictCheckComplete.emit({
      conflictCheck: this.conflictCheck,
      canProceed: true,
      hasConflicts: this.hasConflicts,
      proceed: true
    });
    this.closeModal();
  }

  cancelConversion() {
    this.conflictCheckComplete.emit({
      conflictCheck: this.conflictCheck,
      canProceed: false,
      hasConflicts: this.hasConflicts,
      proceed: false
    });
    this.closeModal();
  }

  formatConversionType(type: string): string {
    if (!type) return '';
    return type.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  }

  formatDateTime(dateString: string): string {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString();
  }
}