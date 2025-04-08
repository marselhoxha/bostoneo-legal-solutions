import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { CaseListComponent } from './case-list.component';
import { Router } from '@angular/router';
import { CaseService } from '../../../services/case.service';
import { of, throwError } from 'rxjs';
import { CaseStatus } from '../../../enums/case-status.enum';
import { CasePriority } from '../../../enums/case-priority.enum';
import { Case } from '../../../interfaces/case.interface';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { FormsModule } from '@angular/forms';

describe('CaseListComponent', () => {
  let component: CaseListComponent;
  let fixture: ComponentFixture<CaseListComponent>;
  let caseServiceSpy: jasmine.SpyObj<CaseService>;
  let routerSpy: jasmine.SpyObj<Router>;

  const mockCases: Case[] = [
    {
      id: '1',
      caseNumber: 'CASE-2023-001',
      title: 'Test Case 1',
      description: 'Test Description 1',
      status: CaseStatus.Active,
      priority: CasePriority.High,
      clientId: 'client1',
      clientName: 'Test Client 1',
      assignedTo: ['user1'],
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: '2',
      caseNumber: 'CASE-2023-002',
      title: 'Test Case 2',
      description: 'Test Description 2',
      status: CaseStatus.Pending,
      priority: CasePriority.Medium,
      clientId: 'client2',
      clientName: 'Test Client 2',
      assignedTo: ['user2'],
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  beforeEach(async () => {
    caseServiceSpy = jasmine.createSpyObj('CaseService', ['getCases', 'deleteCase']);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      declarations: [CaseListComponent],
      imports: [FormsModule],
      providers: [
        { provide: CaseService, useValue: caseServiceSpy },
        { provide: Router, useValue: routerSpy }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(CaseListComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load cases on init', fakeAsync(() => {
    caseServiceSpy.getCases.and.returnValue(of(mockCases));
    fixture.detectChanges();
    tick();

    expect(caseServiceSpy.getCases).toHaveBeenCalled();
    expect(component.cases).toEqual(mockCases);
  }));

  it('should handle error when loading cases fails', fakeAsync(() => {
    caseServiceSpy.getCases.and.returnValue(throwError(() => new Error('Error loading cases')));
    fixture.detectChanges();
    tick();

    expect(component.error).toBe('Failed to load cases. Please try again later.');
  }));

  it('should filter cases by search term', fakeAsync(() => {
    caseServiceSpy.getCases.and.returnValue(of(mockCases));
    fixture.detectChanges();
    tick();

    component.searchTerm = 'Test Case 1';
    component.filterCases();
    tick();

    expect(component.filteredCases.length).toBe(1);
    expect(component.filteredCases[0].title).toBe('Test Case 1');
  }));

  it('should filter cases by status', fakeAsync(() => {
    caseServiceSpy.getCases.and.returnValue(of(mockCases));
    fixture.detectChanges();
    tick();

    component.selectedStatus = CaseStatus.Active;
    component.filterCases();
    tick();

    expect(component.filteredCases.length).toBe(1);
    expect(component.filteredCases[0].status).toBe(CaseStatus.Active);
  }));

  it('should filter cases by priority', fakeAsync(() => {
    caseServiceSpy.getCases.and.returnValue(of(mockCases));
    fixture.detectChanges();
    tick();

    component.selectedPriority = CasePriority.High;
    component.filterCases();
    tick();

    expect(component.filteredCases.length).toBe(1);
    expect(component.filteredCases[0].priority).toBe(CasePriority.High);
  }));

  it('should navigate to case detail when view case is clicked', () => {
    component.viewCase('1');
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/legal/cases', '1']);
  });

  it('should navigate to new case form when create case is clicked', () => {
    component.createCase();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/legal/cases/new']);
  });

  it('should delete case when confirmed', fakeAsync(() => {
    caseServiceSpy.deleteCase.and.returnValue(of(void 0));
    caseServiceSpy.getCases.and.returnValue(of(mockCases));
    
    fixture.detectChanges();
    tick();
    
    component.deleteCase('1');
    tick();

    expect(caseServiceSpy.deleteCase).toHaveBeenCalledWith('1');
    expect(caseServiceSpy.getCases).toHaveBeenCalled();
  }));

  it('should handle error when deleting case fails', fakeAsync(() => {
    caseServiceSpy.deleteCase.and.returnValue(throwError(() => new Error('Error deleting case')));
    caseServiceSpy.getCases.and.returnValue(of(mockCases));
    
    fixture.detectChanges();
    tick();
    
    component.deleteCase('1');
    tick();

    expect(component.error).toBe('Failed to delete case. Please try again later.');
  }));

  it('should return correct CSS class for status', () => {
    expect(component.getStatusClass(CaseStatus.Active)).toBe('badge bg-success');
    expect(component.getStatusClass(CaseStatus.Pending)).toBe('badge bg-warning');
    expect(component.getStatusClass(CaseStatus.Closed)).toBe('badge bg-secondary');
  });

  it('should return correct CSS class for priority', () => {
    expect(component.getPriorityClass(CasePriority.High)).toBe('badge bg-danger');
    expect(component.getPriorityClass(CasePriority.Medium)).toBe('badge bg-warning');
    expect(component.getPriorityClass(CasePriority.Low)).toBe('badge bg-info');
    expect(component.getPriorityClass(CasePriority.Urgent)).toBe('badge bg-danger');
  });
}); 