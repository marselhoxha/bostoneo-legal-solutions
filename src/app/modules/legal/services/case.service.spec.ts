import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { CaseService } from './case.service';
import { CaseStatus } from '../enums/case-status.enum';
import { CasePriority } from '../enums/case-priority.enum';
import { Case } from '../interfaces/case.interface';

describe('CaseService', () => {
  let service: CaseService;
  let httpMock: HttpTestingController;
  const apiUrl = '/api/cases';

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

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [CaseService]
    });

    service = TestBed.inject(CaseService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should get all cases', () => {
    const mockCases = [mockCase];

    service.getCases().subscribe(cases => {
      expect(cases).toEqual(mockCases);
    });

    const req = httpMock.expectOne(apiUrl);
    expect(req.request.method).toBe('GET');
    req.flush(mockCases);
  });

  it('should get case by id', () => {
    service.getCaseById('1').subscribe(caseData => {
      expect(caseData).toEqual(mockCase);
    });

    const req = httpMock.expectOne(`${apiUrl}/1`);
    expect(req.request.method).toBe('GET');
    req.flush(mockCase);
  });

  it('should create case', () => {
    const newCase = { ...mockCase, id: undefined };

    service.createCase(newCase).subscribe(response => {
      expect(response).toEqual(mockCase);
    });

    const req = httpMock.expectOne(apiUrl);
    expect(req.request.method).toBe('POST');
    req.flush(mockCase);
  });

  it('should update case', () => {
    const updatedCase = { ...mockCase, title: 'Updated Title' };

    service.updateCase('1', updatedCase).subscribe(response => {
      expect(response).toEqual(updatedCase);
    });

    const req = httpMock.expectOne(`${apiUrl}/1`);
    expect(req.request.method).toBe('PUT');
    req.flush(updatedCase);
  });

  it('should delete case', () => {
    service.deleteCase('1').subscribe(response => {
      expect(response).toBeUndefined();
    });

    const req = httpMock.expectOne(`${apiUrl}/1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('should handle error when getting cases fails', () => {
    service.getCases().subscribe({
      error: error => {
        expect(error.status).toBe(500);
      }
    });

    const req = httpMock.expectOne(apiUrl);
    req.flush('Server error', { status: 500, statusText: 'Internal Server Error' });
  });

  it('should handle error when getting case by id fails', () => {
    service.getCaseById('1').subscribe({
      error: error => {
        expect(error.status).toBe(404);
      }
    });

    const req = httpMock.expectOne(`${apiUrl}/1`);
    req.flush('Not found', { status: 404, statusText: 'Not Found' });
  });

  it('should handle error when creating case fails', () => {
    const newCase = { ...mockCase, id: undefined };

    service.createCase(newCase).subscribe({
      error: error => {
        expect(error.status).toBe(400);
      }
    });

    const req = httpMock.expectOne(apiUrl);
    req.flush('Bad request', { status: 400, statusText: 'Bad Request' });
  });

  it('should handle error when updating case fails', () => {
    const updatedCase = { ...mockCase, title: 'Updated Title' };

    service.updateCase('1', updatedCase).subscribe({
      error: error => {
        expect(error.status).toBe(404);
      }
    });

    const req = httpMock.expectOne(`${apiUrl}/1`);
    req.flush('Not found', { status: 404, statusText: 'Not Found' });
  });

  it('should handle error when deleting case fails', () => {
    service.deleteCase('1').subscribe({
      error: error => {
        expect(error.status).toBe(404);
      }
    });

    const req = httpMock.expectOne(`${apiUrl}/1`);
    req.flush('Not found', { status: 404, statusText: 'Not Found' });
  });
}); 