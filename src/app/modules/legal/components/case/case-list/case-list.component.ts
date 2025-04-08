import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ChangeDetectionStrategy } from '@angular/core';
import { Case } from '../../../interfaces/case.interface';
import { CaseService } from '../../../services/case.service';
import { Observable } from 'rxjs';
import { Router } from '@angular/router';
import { CaseStatus } from '../../../enums/case-status.enum';
import { CasePriority } from '../../../enums/case-priority.enum';

@Component({
  selector: 'app-case-list',
  templateUrl: './case-list.component.html',
  styleUrls: ['./case-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CaseListComponent implements OnInit {
  cases: Case[] = [];
  filteredCases: Case[] = [];
  loading = false;
  error: string | null = null;
  searchTerm = '';
  selectedStatus: CaseStatus | '' = '';
  selectedPriority: CasePriority | '' = '';
  caseStatuses = Object.values(CaseStatus);
  casePriorities = Object.values(CasePriority);

  constructor(
    private caseService: CaseService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadCases();
  }

  loadCases(): void {
    this.loading = true;
    this.error = null;
    this.caseService.getCases().subscribe({
      next: (cases) => {
        this.cases = cases;
        this.filterCases();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = 'Failed to load cases. Please try again later.';
        this.loading = false;
        this.cdr.detectChanges();
        console.error('Error loading cases:', err);
      }
    });
  }

  filterCases(): void {
    this.filteredCases = this.cases.filter(caseItem => {
      const matchesSearch = !this.searchTerm || 
        caseItem.title.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        caseItem.caseNumber.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        caseItem.clientName.toLowerCase().includes(this.searchTerm.toLowerCase());

      const matchesStatus = !this.selectedStatus || caseItem.status === this.selectedStatus;
      const matchesPriority = !this.selectedPriority || caseItem.priority === this.selectedPriority;

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }

  viewCase(id: string): void {
    this.router.navigate(['/legal/cases', id]);
  }

  createCase(): void {
    this.router.navigate(['/legal/cases/new']);
  }

  deleteCase(id: string): void {
    if (confirm('Are you sure you want to delete this case?')) {
      this.caseService.deleteCase(id).subscribe({
        next: () => {
          this.loadCases();
        },
        error: (err) => {
          this.error = 'Failed to delete case. Please try again later.';
          console.error('Error deleting case:', err);
        }
      });
    }
  }

  getStatusClass(status: CaseStatus): string {
    switch (status) {
      case CaseStatus.Active:
        return 'badge bg-success';
      case CaseStatus.Pending:
        return 'badge bg-warning';
      case CaseStatus.Closed:
        return 'badge bg-secondary';
      default:
        return 'badge bg-secondary';
    }
  }

  getPriorityClass(priority: CasePriority): string {
    switch (priority) {
      case CasePriority.High:
        return 'badge bg-danger';
      case CasePriority.Medium:
        return 'badge bg-warning';
      case CasePriority.Low:
        return 'badge bg-info';
      case CasePriority.Urgent:
        return 'badge bg-danger';
      default:
        return 'badge bg-secondary';
    }
  }
} 