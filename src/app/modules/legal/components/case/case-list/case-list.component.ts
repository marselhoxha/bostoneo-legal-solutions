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
        if (response && response.data && response.data.page) {
          this.cases = response.data.page.content || [];
          // Update state for pagination
          this.state = { 
            dataState: DataState.LOADED, 
            appData: response 
          };
        } else if (Array.isArray(response)) {
          this.cases = response;
        } else {
          console.warn('Unexpected response format:', response);
          this.cases = [];
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading cases:', err);
        this.error = 'Failed to load cases. Please try again later.';
        this.isLoading = false;
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
            Swal.fire({
              title: 'Error!',
              text: 'Failed to delete case: ' + (error.error?.message || 'Please try again later.'),
              icon: 'error',
              confirmButtonColor: '#3085d6'
            });
            this.cdr.detectChanges();
          }
        });
      }
    });
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
} 