import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { Case } from '../interfaces/case.interface';
import { CaseStatus } from '../enums/case-status.enum';
import { CasePriority } from '../enums/case-priority.enum';

@Injectable({
  providedIn: 'root'
})
export class CaseService {
  private apiUrl = '/api/cases'; // Replace with your actual API endpoint
  private casesSubject = new BehaviorSubject<Case[]>([]);
  public cases$ = this.casesSubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadCases();
  }

  /**
   * Load all cases from the API
   */
  loadCases(): void {
    // For now, we'll use mock data
    // In a real application, you would call your API
    const mockCases: Case[] = [
      {
        id: '1',
        caseNumber: 'CASE-2023-001',
        title: 'Smith vs. Johnson',
        description: 'Contract dispute between parties',
        status: CaseStatus.Active,
        priority: CasePriority.High,
        clientId: 'client1',
        clientName: 'John Smith',
        assignedTo: ['user1'],
        createdAt: new Date('2023-01-15'),
        updatedAt: new Date('2023-02-20'),
        nextHearingDate: new Date('2023-05-10')
      },
      {
        id: '2',
        caseNumber: 'CASE-2023-002',
        title: 'Williams Estate',
        description: 'Estate planning and distribution',
        status: CaseStatus.Pending,
        priority: CasePriority.Medium,
        clientId: 'client2',
        clientName: 'Sarah Williams',
        assignedTo: ['user2'],
        createdAt: new Date('2023-02-01'),
        updatedAt: new Date('2023-02-01')
      },
      {
        id: '3',
        caseNumber: 'CASE-2023-003',
        title: 'Davis Corporation Merger',
        description: 'Corporate merger and acquisition',
        status: CaseStatus.Closed,
        priority: CasePriority.Urgent,
        clientId: 'client3',
        clientName: 'Davis Corporation',
        assignedTo: ['user1', 'user2'],
        createdAt: new Date('2023-01-10'),
        updatedAt: new Date('2023-03-05'),
        nextHearingDate: new Date('2023-04-15')
      }
    ];

    this.casesSubject.next(mockCases);
  }

  /**
   * Get all cases
   */
  getCases(): Observable<Case[]> {
    // For demo purposes, return mock data
    // In a real application, this would make an HTTP request to your backend
    return of([
      {
        id: '1',
        caseNumber: 'CASE-001',
        title: 'Smith vs. Johnson',
        clientName: 'John Smith',
        clientId: 'CLIENT-001',
        status: CaseStatus.Active,
        priority: CasePriority.High,
        filingDate: '2023-01-15',
        description: 'Contract dispute between two parties',
        notes: 'Initial hearing scheduled for next month',
        assignedTo: ['John Doe'],
        createdAt: new Date('2023-01-15'),
        updatedAt: new Date('2023-01-15')
      },
      {
        id: '2',
        caseNumber: 'CASE-002',
        title: 'Brown Estate',
        clientName: 'Sarah Brown',
        clientId: 'CLIENT-002',
        status: CaseStatus.Pending,
        priority: CasePriority.Medium,
        filingDate: '2023-02-20',
        description: 'Estate settlement proceedings',
        notes: 'Waiting for court approval',
        assignedTo: ['Jane Smith'],
        createdAt: new Date('2023-02-20'),
        updatedAt: new Date('2023-02-20')
      },
      {
        id: '3',
        caseNumber: 'CASE-003',
        title: 'Wilson Property Dispute',
        clientName: 'Michael Wilson',
        clientId: 'CLIENT-003',
        status: CaseStatus.Closed,
        priority: CasePriority.Low,
        filingDate: '2022-12-10',
        description: 'Property boundary dispute',
        notes: 'Case settled out of court',
        assignedTo: ['Bob Johnson'],
        createdAt: new Date('2022-12-10'),
        updatedAt: new Date('2023-01-05')
      }
    ]);
  }

  /**
   * Get a case by ID
   */
  getCaseById(id: string): Observable<Case | undefined> {
    return this.cases$.pipe(
      map(cases => cases.find(c => c.id === id))
    );
  }

  /**
   * Create a new case
   */
  createCase(caseData: Case): Observable<Case> {
    // For demo purposes, return mock data
    // In a real application, this would make an HTTP POST request to your backend
    const newCase = {
      ...caseData,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    return of(newCase);
  }

  /**
   * Update an existing case
   */
  updateCase(id: string, caseData: Case): Observable<Case> {
    // For demo purposes, return mock data
    // In a real application, this would make an HTTP PUT request to your backend
    const updatedCase = {
      ...caseData,
      id: id,
      updatedAt: new Date()
    };
    return of(updatedCase);
  }

  /**
   * Delete a case
   */
  deleteCase(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
} 