import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { CaseDetailComponent } from './case-detail.component';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { CaseService } from '../../../services/case.service';
import { of, throwError } from 'rxjs';
import { CaseStatus } from '../../../enums/case-status.enum';
import { CasePriority } from '../../../enums/case-priority.enum';
import { Case } from '../../../interfaces/case.interface';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('CaseDetailComponent', () => {
  let component: CaseDetailComponent;
  let fixture: ComponentFixture<CaseDetailComponent>;
  let caseServiceSpy: jasmine.SpyObj<CaseService>;
  let routerSpy: jasmine.SpyObj<Router>;

  const mockCase: Case = {
    id: '1',
    caseNumber: 'CASE-2023-001',
    title: 'Test Case',
    description: 'Test Description',
    status: CaseStatus.Active,
    priority: CasePriority.High,
    clientId: 'client1',
    clientName: 'Test Client',
    assignedTo: ['user1'],
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(async () => {
    caseServiceSpy = jasmine.createSpyObj('CaseService', ['getCaseById', 'createCase', 'updateCase']);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      declarations: [CaseDetailComponent],
      imports: [ReactiveFormsModule],
      providers: [
        FormBuilder,
        { provide: CaseService, useValue: caseServiceSpy },
        { provide: Router, useValue: routerSpy },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => '1' } } }
        }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(CaseDetailComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize form with default values', () => {
    fixture.detectChanges();
    expect(component.caseForm.get('status')?.value).toBe(CaseStatus.Active);
    expect(component.caseForm.get('priority')?.value).toBe(CasePriority.Medium);
  });

  it('should load case data when id is provided', fakeAsync(() => {
    caseServiceSpy.getCaseById.and.returnValue(of(mockCase));
    fixture.detectChanges();
    tick();

    expect(caseServiceSpy.getCaseById).toHaveBeenCalledWith('1');
    expect(component.caseForm.get('title')?.value).toBe(mockCase.title);
    expect(component.caseForm.get('status')?.value).toBe(mockCase.status);
  }));

  it('should handle error when loading case fails', fakeAsync(() => {
    caseServiceSpy.getCaseById.and.returnValue(throwError(() => new Error('Error loading case')));
    fixture.detectChanges();
    tick();

    expect(component.error).toBe('Failed to load case. Please try again later.');
  }));

  it('should create new case when form is submitted and isNewCase is true', fakeAsync(() => {
    const newCase = { ...mockCase, id: undefined };
    caseServiceSpy.createCase.and.returnValue(of({ ...newCase, id: '2' }));
    
    component.isNewCase = true;
    component.caseForm.patchValue(newCase);
    component.onSubmit();
    tick();

    expect(caseServiceSpy.createCase).toHaveBeenCalled();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/legal/cases', '2']);
  }));

  it('should update existing case when form is submitted and isNewCase is false', fakeAsync(() => {
    caseServiceSpy.updateCase.and.returnValue(of(mockCase));
    
    component.isNewCase = false;
    component.caseId = '1';
    component.caseForm.patchValue(mockCase);
    component.onSubmit();
    tick();

    expect(caseServiceSpy.updateCase).toHaveBeenCalledWith('1', jasmine.any(Object));
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/legal/cases']);
  }));

  it('should handle error when creating case fails', fakeAsync(() => {
    caseServiceSpy.createCase.and.returnValue(throwError(() => new Error('Error creating case')));
    
    component.isNewCase = true;
    component.caseForm.patchValue(mockCase);
    component.onSubmit();
    tick();

    expect(component.error).toBe('Failed to create case. Please try again later.');
  }));

  it('should handle error when updating case fails', fakeAsync(() => {
    caseServiceSpy.updateCase.and.returnValue(throwError(() => new Error('Error updating case')));
    
    component.isNewCase = false;
    component.caseId = '1';
    component.caseForm.patchValue(mockCase);
    component.onSubmit();
    tick();

    expect(component.error).toBe('Failed to update case. Please try again later.');
  }));

  it('should not submit form if it is invalid', () => {
    component.caseForm.get('title')?.setValue('');
    component.onSubmit();
    
    expect(caseServiceSpy.createCase).not.toHaveBeenCalled();
    expect(caseServiceSpy.updateCase).not.toHaveBeenCalled();
  });

  it('should navigate back to cases list when cancel is called', () => {
    component.cancel();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/legal/cases']);
  });
}); 