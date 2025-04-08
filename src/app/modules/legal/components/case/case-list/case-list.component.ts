import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { LegalCase, CaseStatus, CasePriority, PaymentStatus } from '../../../interfaces/case.interface';
import { CaseService } from '../../../services/case.service';

@Component({
  selector: 'app-case-list',
  templateUrl: './case-list.component.html',
  styleUrls: ['./case-list.component.scss']
})
export class CaseListComponent implements OnInit {
  cases: LegalCase[] = [];
  isLoading = false;
  error: string | null = null;
  
  // Dummy data for demonstration
  dummyCases: LegalCase[] = [
    {
      id: '1',
      caseNumber: 'CASE-2024-001',
      title: 'Smith vs. Johnson',
      clientName: 'John Smith',
      status: CaseStatus.OPEN,
      priority: CasePriority.HIGH,
      type: 'CIVIL_LITIGATION',
      description: 'Contract dispute between parties',
      courtInfo: {
        courtName: 'Superior Court of California',
        judgeName: 'Hon. Sarah Wilson',
        courtroom: 'Courtroom 3B'
      },
      importantDates: {
        filingDate: new Date('2024-01-15'),
        nextHearing: new Date('2024-05-20'),
        trialDate: new Date('2024-08-10')
      },
      documents: [],
      notes: [],
      billingInfo: {
        hourlyRate: 250,
        totalHours: 45,
        totalAmount: 11250,
        paymentStatus: PaymentStatus.PENDING
      },
      createdAt: new Date('2024-01-10'),
      updatedAt: new Date('2024-04-05')
    },
    {
      id: '2',
      caseNumber: 'CASE-2024-002',
      title: 'Brown Estate Planning',
      clientName: 'Mary Brown',
      status: CaseStatus.IN_PROGRESS,
      priority: CasePriority.MEDIUM,
      type: 'ESTATE_PLANNING',
      description: 'Estate planning and trust formation',
      courtInfo: {
        courtName: 'Probate Court',
        judgeName: 'Hon. Robert Chen',
        courtroom: 'Courtroom 2A'
      },
      importantDates: {
        filingDate: new Date('2024-02-01'),
        nextHearing: new Date('2024-05-15'),
        trialDate: new Date('2024-07-30')
      },
      documents: [],
      notes: [],
      billingInfo: {
        hourlyRate: 300,
        totalHours: 25,
        totalAmount: 7500,
        paymentStatus: PaymentStatus.PAID
      },
      createdAt: new Date('2024-01-25'),
      updatedAt: new Date('2024-04-03')
    },
    {
      id: '3',
      caseNumber: 'CASE-2024-003',
      title: 'Davis Corporate Merger',
      clientName: 'Robert Davis',
      status: CaseStatus.PENDING,
      priority: CasePriority.LOW,
      type: 'CORPORATE_MERGER',
      description: 'Corporate merger and acquisition',
      courtInfo: {
        courtName: 'Business Court',
        judgeName: 'Hon. Michael Thompson',
        courtroom: 'Courtroom 4C'
      },
      importantDates: {
        filingDate: new Date('2024-02-15'),
        nextHearing: new Date('2024-06-01'),
        trialDate: new Date('2024-09-15')
      },
      documents: [],
      notes: [],
      billingInfo: {
        hourlyRate: 400,
        totalHours: 60,
        totalAmount: 24000,
        paymentStatus: PaymentStatus.OVERDUE
      },
      createdAt: new Date('2024-02-10'),
      updatedAt: new Date('2024-04-01')
    },
    {
      id: '4',
      caseNumber: 'CASE-2024-004',
      title: 'Wilson Employment Dispute',
      clientName: 'Sarah Wilson',
      status: CaseStatus.CLOSED,
      priority: CasePriority.MEDIUM,
      type: 'EMPLOYMENT_LITIGATION',
      description: 'Employment discrimination case',
      courtInfo: {
        courtName: 'Employment Court',
        judgeName: 'Hon. Lisa Martinez',
        courtroom: 'Courtroom 1D'
      },
      importantDates: {
        filingDate: new Date('2024-01-20'),
        nextHearing: new Date('2024-04-10'),
        trialDate: new Date('2024-07-20')
      },
      documents: [],
      notes: [],
      billingInfo: {
        hourlyRate: 275,
        totalHours: 80,
        totalAmount: 22000,
        paymentStatus: PaymentStatus.PAID
      },
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date('2024-03-25')
    },
    {
      id: '5',
      caseNumber: 'CASE-2024-005',
      title: 'Taylor Immigration Case',
      clientName: 'James Taylor',
      status: CaseStatus.OPEN,
      priority: CasePriority.URGENT,
      type: 'IMMIGRATION',
      description: 'Immigration visa application',
      courtInfo: {
        courtName: 'Immigration Court',
        judgeName: 'Hon. David Kim',
        courtroom: 'Courtroom 5E'
      },
      importantDates: {
        filingDate: new Date('2024-03-01'),
        nextHearing: new Date('2024-05-25'),
        trialDate: new Date('2024-08-15')
      },
      documents: [],
      notes: [],
      billingInfo: {
        hourlyRate: 350,
        totalHours: 30,
        totalAmount: 10500,
        paymentStatus: PaymentStatus.PENDING
      },
      createdAt: new Date('2024-02-25'),
      updatedAt: new Date('2024-04-02')
    },
    {
      id: '6',
      caseNumber: 'CASE-2024-006',
      title: 'Anderson Patent Dispute',
      clientName: 'Patricia Anderson',
      status: CaseStatus.ARCHIVED,
      priority: CasePriority.LOW,
      type: 'INTELLECTUAL_PROPERTY',
      description: 'Patent infringement lawsuit',
      courtInfo: {
        courtName: 'Federal Court',
        judgeName: 'Hon. William Harris',
        courtroom: 'Courtroom 6F'
      },
      importantDates: {
        filingDate: new Date('2024-02-05'),
        nextHearing: new Date('2024-05-30'),
        trialDate: new Date('2024-09-01')
      },
      documents: [],
      notes: [],
      billingInfo: {
        hourlyRate: 450,
        totalHours: 100,
        totalAmount: 45000,
        paymentStatus: PaymentStatus.PAID
      },
      createdAt: new Date('2024-01-30'),
      updatedAt: new Date('2024-03-20')
    }
  ];

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
    
    // Use dummy data instead of service call
    setTimeout(() => {
      try {
        this.cases = [...this.dummyCases]; // Create a new array to trigger change detection
        this.isLoading = false;
        this.cdr.detectChanges();
      } catch (err) {
        console.error('Error loading cases:', err);
        this.error = 'Failed to load cases. Please try again later.';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    }, 500);
    
    // Commented out actual service call
    /*
    this.caseService.getCases().subscribe({
      next: (cases) => {
        this.cases = cases;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading cases:', err);
        this.error = 'Failed to load cases. Please try again later.';
        this.isLoading = false;
      }
    });
    */
  }

  viewCase(id: string): void {
    this.router.navigate(['/legal/cases', id]);
  }

  editCase(id: string): void {
    this.router.navigate(['/legal/cases', id, 'edit']);
  }

  createCase(): void {
    this.router.navigate(['/legal/cases/new']);
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