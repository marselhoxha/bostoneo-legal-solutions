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
      description: 'Contract dispute regarding software development services',
      courtInfo: {
        courtName: 'District Court',
        judgeName: 'Judge Williams',
        courtroom: 'Room 101'
      },
      importantDates: {
        filingDate: new Date('2024-01-15'),
        nextHearing: new Date('2024-06-10'),
        trialDate: new Date('2024-08-20')
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
      title: 'Acme Corp vs. TechStart',
      clientName: 'Acme Corporation',
      status: CaseStatus.IN_PROGRESS,
      priority: CasePriority.MEDIUM,
      description: 'Intellectual property infringement case',
      courtInfo: {
        courtName: 'Federal Court',
        judgeName: 'Judge Rodriguez',
        courtroom: 'Room 205'
      },
      importantDates: {
        filingDate: new Date('2024-02-05'),
        nextHearing: new Date('2024-05-15'),
        trialDate: new Date('2024-07-30')
      },
      documents: [],
      notes: [],
      billingInfo: {
        hourlyRate: 300,
        totalHours: 75,
        totalAmount: 22500,
        paymentStatus: PaymentStatus.PAID
      },
      createdAt: new Date('2024-02-01'),
      updatedAt: new Date('2024-04-08')
    },
    {
      id: '3',
      caseNumber: 'CASE-2024-003',
      title: 'Williams Estate',
      clientName: 'Sarah Williams',
      status: CaseStatus.PENDING,
      priority: CasePriority.LOW,
      description: 'Estate planning and distribution',
      courtInfo: {
        courtName: 'Probate Court',
        judgeName: 'Judge Thompson',
        courtroom: 'Room 103'
      },
      importantDates: {
        filingDate: new Date('2024-03-10'),
        nextHearing: new Date('2024-04-25'),
        trialDate: new Date('2024-05-15')
      },
      documents: [],
      notes: [],
      billingInfo: {
        hourlyRate: 200,
        totalHours: 30,
        totalAmount: 6000,
        paymentStatus: PaymentStatus.PENDING
      },
      createdAt: new Date('2024-03-05'),
      updatedAt: new Date('2024-04-10')
    },
    {
      id: '4',
      caseNumber: 'CASE-2024-004',
      title: 'Johnson Divorce',
      clientName: 'Michael Johnson',
      status: CaseStatus.CLOSED,
      priority: CasePriority.MEDIUM,
      description: 'Divorce proceedings and asset division',
      courtInfo: {
        courtName: 'Family Court',
        judgeName: 'Judge Martinez',
        courtroom: 'Room 302'
      },
      importantDates: {
        filingDate: new Date('2023-11-20'),
        nextHearing: new Date('2024-01-15'),
        trialDate: new Date('2024-02-10')
      },
      documents: [],
      notes: [],
      billingInfo: {
        hourlyRate: 275,
        totalHours: 60,
        totalAmount: 16500,
        paymentStatus: PaymentStatus.PAID
      },
      createdAt: new Date('2023-11-15'),
      updatedAt: new Date('2024-02-15')
    },
    {
      id: '5',
      caseNumber: 'CASE-2024-005',
      title: 'TechStart Patent',
      clientName: 'TechStart Inc.',
      status: CaseStatus.OPEN,
      priority: CasePriority.URGENT,
      description: 'Patent infringement lawsuit',
      courtInfo: {
        courtName: 'Federal Court',
        judgeName: 'Judge Anderson',
        courtroom: 'Room 401'
      },
      importantDates: {
        filingDate: new Date('2024-03-25'),
        nextHearing: new Date('2024-04-30'),
        trialDate: new Date('2024-06-15')
      },
      documents: [],
      notes: [],
      billingInfo: {
        hourlyRate: 350,
        totalHours: 120,
        totalAmount: 42000,
        paymentStatus: PaymentStatus.PENDING
      },
      createdAt: new Date('2024-03-20'),
      updatedAt: new Date('2024-04-12')
    },
    {
      id: '6',
      caseNumber: 'CASE-2023-012',
      title: 'Brown Bankruptcy',
      clientName: 'Robert Brown',
      status: CaseStatus.ARCHIVED,
      priority: CasePriority.LOW,
      description: 'Chapter 7 bankruptcy filing',
      courtInfo: {
        courtName: 'Bankruptcy Court',
        judgeName: 'Judge Wilson',
        courtroom: 'Room 201'
      },
      importantDates: {
        filingDate: new Date('2023-09-10'),
        nextHearing: new Date('2023-10-05'),
        trialDate: new Date('2023-11-20')
      },
      documents: [],
      notes: [],
      billingInfo: {
        hourlyRate: 225,
        totalHours: 40,
        totalAmount: 9000,
        paymentStatus: PaymentStatus.PAID
      },
      createdAt: new Date('2023-09-05'),
      updatedAt: new Date('2023-12-01')
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