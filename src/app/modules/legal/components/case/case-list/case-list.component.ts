import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { LegalCase, CaseStatus, CasePriority, PaymentStatus } from '../../../interfaces/case.interface';
import { CaseService } from '../../../services/case.service';
import Swal from 'sweetalert2';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, startWith } from 'rxjs/operators';
import { DataState } from 'src/app/enum/datastate.enum';
import { State } from 'src/app/interface/state';
import { CustomHttpResponse, Page } from 'src/app/interface/appstates';
import { User } from 'src/app/interface/user';

@Component({
  selector: 'app-case-list',
  templateUrl: './case-list.component.html',
  styleUrls: ['./case-list.component.scss']
})
export class CaseListComponent implements OnInit {
  cases: LegalCase[] = [];
  isLoading = false;
  error: string | null = null;

  // Stats
  activeCasesCount = 0;
  pendingCasesCount = 0;
  closedCasesCount = 0;
  highPriorityCount = 0;

  // Pagination-related variables
  state: { dataState: DataState, appData?: any } = { dataState: DataState.LOADING };
  readonly DataState = DataState;
  private currentPageSubject = new BehaviorSubject<number>(0);
  currentPage$ = this.currentPageSubject.asObservable();

  constructor(
    private caseService: CaseService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.loadCases();
  }

  loadCases(): void {
    this.isLoading = true;
    this.error = null;
    this.cdr.detectChanges();
    
    // Use real data from the API with pagination
    this.caseService.getCases(this.currentPageSubject.value).subscribe({
      next: (response) => {
        console.log('Cases response:', response);
        // The backend returns data in a wrapper object
        if (response && response.data) {
          // Handle both formats: data.page and data.cases
          if (response.data.page && response.data.page.content) {
            this.cases = response.data.page.content || [];
            // Update state for pagination
            this.state = { 
              dataState: DataState.LOADED, 
              appData: response 
            };
          } else if (response.data.cases) {
            this.cases = response.data.cases || [];
            this.state = { 
              dataState: DataState.LOADED, 
              appData: response 
            };
          } else if (Array.isArray(response.data)) {
            this.cases = response.data;
            this.state = { 
              dataState: DataState.LOADED, 
              appData: response 
            };
          } else {
            console.warn('Unexpected data format:', response.data);
            this.cases = [];
          }
        } else if (Array.isArray(response)) {
          this.cases = response;
        } else {
          console.warn('Unexpected response format:', response);
          this.cases = [];
        }
        this.calculateStats();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading cases:', err);
        this.error = 'Failed to load cases. Please try again later.';
        this.isLoading = false;
        this.cases = [];
        // Set sample data for development
        this.setSampleData();
        this.cdr.detectChanges();
      }
    });
  }

  // Pagination methods
  goToPage(pageNumber: number): void {
    this.currentPageSubject.next(pageNumber);
    this.loadCases();
  }

  goToNextOrPreviousPage(direction?: string): void {
    const newPage = direction === 'forward' 
      ? this.currentPageSubject.value + 1 
      : this.currentPageSubject.value - 1;
    this.goToPage(newPage);
  }

  viewCase(id: string): void {
    this.router.navigate(['/legal/cases', id]);
  }

  editCase(id: string): void {
    this.router.navigate(['/legal/cases/edit', id]);
  }

  createCase(): void {
    this.router.navigate(['/legal/cases/new']);
  }
  
  deleteCase(caseItem: LegalCase): void {
    Swal.fire({
      title: 'Are you sure?',
      text: `You are about to delete case "${caseItem.title}". This action cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        this.isLoading = true;
        this.cdr.detectChanges();
        
        this.caseService.deleteCase(caseItem.id).subscribe({
          next: () => {
            this.isLoading = false;
            Swal.fire({
              title: 'Deleted!',
              text: 'Case has been successfully deleted.',
              icon: 'success',
              confirmButtonColor: '#3085d6'
            }).then(() => {
              // Reload the cases list after deletion
              this.loadCases();
            });
          },
          error: (error) => {
            this.isLoading = false;
            console.error('Error deleting case:', error);
            
            // For status 400, always treat as dependency/foreign key error
            if (error.status === 400) {
              Swal.fire({
                title: 'Cannot Delete Case',
                html: `This case has related records (documents, notes, activities, etc.) that must be deleted first.<br><br>
                       Please remove all documents, notes, and other related items before deleting this case.`,
                icon: 'warning',
                confirmButtonColor: '#3085d6',
                confirmButtonText: 'I Understand'
              });
            } else {
              // Generic error handling for other types of errors
              Swal.fire({
                title: 'Error!',
                text: 'Failed to delete case: ' + (error.error?.reason || error.error?.message || 'Please try again later.'),
                icon: 'error',
                confirmButtonColor: '#3085d6'
              });
            }
            
            this.cdr.detectChanges();
          }
        });
      }
    });
  }

  private setSampleData(): void {
    // Add sample data for development
    this.cases = [
      {
        id: '1',
        caseNumber: 'CASE-2025-001',
        title: 'Smith vs. Johnson Contract Dispute',
        description: 'Contract breach litigation involving commercial property',
        status: CaseStatus.OPEN,
        priority: CasePriority.HIGH,
        type: 'Contract Litigation',
        clientName: 'John Smith',
        clientEmail: 'john.smith@example.com',
        clientPhone: '555-0123',
        clientAddress: '123 Main St, Boston, MA',
        createdAt: new Date(),
        updatedAt: new Date(),
        courtInfo: {
          courtName: 'Suffolk Superior Court',
          judgeName: 'Hon. Jane Doe',
          courtroom: 'Room 501'
        },
        importantDates: {
          filingDate: new Date(),
          nextHearing: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          trialDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
        },
        billingInfo: {
          hourlyRate: 350,
          totalHours: 45,
          totalAmount: 15750,
          paymentStatus: PaymentStatus.PENDING
        }
      },
      {
        id: '2',
        caseNumber: 'CASE-2025-002',
        title: 'Estate Planning - Williams Family',
        description: 'Comprehensive estate planning and trust formation',
        status: CaseStatus.IN_PROGRESS,
        priority: CasePriority.MEDIUM,
        type: 'Estate Planning',
        clientName: 'Sarah Williams',
        clientEmail: 'sarah.williams@example.com',
        clientPhone: '555-0124',
        clientAddress: '456 Oak Ave, Cambridge, MA',
        createdAt: new Date(),
        updatedAt: new Date(),
        billingInfo: {
          hourlyRate: 400,
          totalHours: 20,
          totalAmount: 8000,
          paymentStatus: PaymentStatus.PAID
        }
      }
    ];
    this.state = { 
      dataState: DataState.LOADED, 
      appData: { data: { cases: this.cases } } 
    };
  }

  /**
   * Checks if an error is related to a foreign key constraint violation
   * Note: This method is kept for backward compatibility but
   * we now handle all 400 errors as dependency errors directly
   */
  private isForeignKeyConstraintError(error: any): boolean {
    // All 400 status codes when deleting are treated as constraint errors
    if (error.status === 400) {
      return true;
    }
    
    // For additional safety, still check error messages
    const errorMsg = JSON.stringify(error || {}).toLowerCase();
    return errorMsg.includes('foreign key constraint') || 
           errorMsg.includes('constraint fails') || 
           errorMsg.includes('cannot delete') ||
           errorMsg.includes('referenced by') ||
           errorMsg.includes('bad request');
  }

  getStatusClass(status: CaseStatus): string {
    switch (status) {
      case CaseStatus.OPEN:
        return 'badge bg-success';
      case CaseStatus.IN_PROGRESS:
        return 'badge bg-warning';
      case CaseStatus.PENDING:
        return 'badge bg-info';
      case CaseStatus.CLOSED:
        return 'badge bg-danger';
      case CaseStatus.ARCHIVED:
        return 'badge bg-secondary';
      default:
        return 'badge';
    }
  }

  getPriorityClass(priority: CasePriority): string {
    switch (priority) {
      case CasePriority.LOW:
        return 'badge bg-success';
      case CasePriority.MEDIUM:
        return 'badge bg-warning';
      case CasePriority.HIGH:
        return 'badge bg-danger';
      case CasePriority.URGENT:
        return 'badge bg-danger';
      default:
        return 'badge';
    }
  }

  private calculateStats(): void {
    this.activeCasesCount = this.cases.filter(c =>
      c.status === CaseStatus.OPEN || c.status === CaseStatus.IN_PROGRESS
    ).length;
    this.pendingCasesCount = this.cases.filter(c =>
      c.status === CaseStatus.PENDING
    ).length;
    this.closedCasesCount = this.cases.filter(c =>
      c.status === CaseStatus.CLOSED || c.status === CaseStatus.ARCHIVED
    ).length;
    this.highPriorityCount = this.cases.filter(c =>
      c.priority === CasePriority.HIGH || c.priority === CasePriority.URGENT
    ).length;
  }
} 