import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { LegalCaseService } from './legal-case.service';
import { LegalCase, CaseStatus, CasePriority } from '../interfaces/case.interface';

describe('LegalCaseService', () => {
  let service: LegalCaseService;
  let httpMock: HttpTestingController;
  const apiUrl = 'http://localhost:8080/api/legal-cases';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [LegalCaseService]
    });
    service = TestBed.inject(LegalCaseService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('getAllCases', () => {
    it('should fetch all legal cases successfully', (done) => {
      const mockCases: LegalCase[] = [
        {
          id: '1',
          caseNumber: 'CASE-2024-001',
          title: 'Test Case 1',
          description: 'Test description',
          clientName: 'John Doe',
          clientEmail: 'john@example.com',
          status: CaseStatus.OPEN,
          priority: CasePriority.HIGH,
          type: 'Civil',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: '2',
          caseNumber: 'CASE-2024-002',
          title: 'Test Case 2',
          description: 'Test description 2',
          clientName: 'Jane Smith',
          clientEmail: 'jane@example.com',
          status: CaseStatus.IN_PROGRESS,
          priority: CasePriority.MEDIUM,
          type: 'Criminal',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      service.getAllCases(0, 10).subscribe(response => {
        expect(response.content).toEqual(mockCases);
        expect(response.totalElements).toBe(2);
        done();
      });

      const req = httpMock.expectOne(`${apiUrl}?page=0&size=10`);
      expect(req.request.method).toBe('GET');
      req.flush({
        content: mockCases,
        totalElements: 2,
        totalPages: 1,
        number: 0
      });
    });

    it('should handle error when fetching cases fails', (done) => {
      service.getAllCases(0, 10).subscribe({
        error: (error) => {
          expect(error.status).toBe(500);
          done();
        }
      });

      const req = httpMock.expectOne(`${apiUrl}?page=0&size=10`);
      req.flush('Server error', { status: 500, statusText: 'Server Error' });
    });
  });

  describe('getCaseById', () => {
    it('should fetch a single case successfully', (done) => {
      const mockCase: LegalCase = {
        id: '1',
        caseNumber: 'CASE-2024-001',
        title: 'Test Case',
        description: 'Test description',
        clientName: 'John Doe',
        clientEmail: 'john@example.com',
        status: CaseStatus.OPEN,
        priority: CasePriority.HIGH,
        type: 'Civil',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      service.getCaseById('1').subscribe(legalCase => {
        expect(legalCase).toEqual(mockCase);
        done();
      });

      const req = httpMock.expectOne(`${apiUrl}/1`);
      expect(req.request.method).toBe('GET');
      req.flush(mockCase);
    });

    it('should handle 404 error when case not found', (done) => {
      service.getCaseById('999').subscribe({
        error: (error) => {
          expect(error.status).toBe(404);
          done();
        }
      });

      const req = httpMock.expectOne(`${apiUrl}/999`);
      req.flush('Case not found', { status: 404, statusText: 'Not Found' });
    });
  });

  describe('createCase', () => {
    it('should create a new case successfully', (done) => {
      const newCase: Partial<LegalCase> = {
        caseNumber: 'CASE-2024-003',
        title: 'New Test Case',
        description: 'New case description',
        clientName: 'Bob Johnson',
        clientEmail: 'bob@example.com',
        status: CaseStatus.OPEN,
        priority: CasePriority.LOW,
        type: 'Family'
      };

      const createdCase: LegalCase = {
        ...newCase,
        id: '3',
        createdAt: new Date(),
        updatedAt: new Date()
      } as LegalCase;

      service.createCase(newCase).subscribe(legalCase => {
        expect(legalCase).toEqual(createdCase);
        expect(legalCase.id).toBe('3');
        done();
      });

      const req = httpMock.expectOne(apiUrl);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(newCase);
      req.flush(createdCase);
    });

    it('should handle validation error when creating case', (done) => {
      const invalidCase: Partial<LegalCase> = {
        title: '' // Missing required fields
      };

      service.createCase(invalidCase).subscribe({
        error: (error) => {
          expect(error.status).toBe(400);
          done();
        }
      });

      const req = httpMock.expectOne(apiUrl);
      req.flush({ message: 'Validation failed' }, { status: 400, statusText: 'Bad Request' });
    });
  });

  describe('updateCase', () => {
    it('should update a case successfully', (done) => {
      const updatedCase: LegalCase = {
        id: '1',
        caseNumber: 'CASE-2024-001',
        title: 'Updated Test Case',
        description: 'Updated description',
        clientName: 'John Doe',
        clientEmail: 'john@example.com',
        status: CaseStatus.CLOSED,
        priority: CasePriority.HIGH,
        type: 'Civil',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      service.updateCase('1', updatedCase).subscribe(legalCase => {
        expect(legalCase.title).toBe('Updated Test Case');
        expect(legalCase.status).toBe(CaseStatus.CLOSED);
        done();
      });

      const req = httpMock.expectOne(`${apiUrl}/1`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(updatedCase);
      req.flush(updatedCase);
    });
  });

  describe('deleteCase', () => {
    it('should delete a case successfully', (done) => {
      service.deleteCase('1').subscribe(() => {
        expect(true).toBe(true); // Just verify the call completes
        done();
      });

      const req = httpMock.expectOne(`${apiUrl}/1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });

    it('should handle error when deleting case with dependencies', (done) => {
      service.deleteCase('1').subscribe({
        error: (error) => {
          expect(error.status).toBe(409);
          done();
        }
      });

      const req = httpMock.expectOne(`${apiUrl}/1`);
      req.flush({ message: 'Cannot delete case with active documents' }, 
        { status: 409, statusText: 'Conflict' });
    });
  });

  describe('searchCases', () => {
    it('should search cases by keyword successfully', (done) => {
      const searchResults: LegalCase[] = [
        {
          id: '1',
          caseNumber: 'CASE-2024-001',
          title: 'Smith vs Jones',
          description: 'Case involving Smith',
          clientName: 'John Smith',
          clientEmail: 'smith@example.com',
          status: CaseStatus.OPEN,
          priority: CasePriority.HIGH,
          type: 'Civil',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      service.searchCases('Smith').subscribe(response => {
        expect(response.content).toEqual(searchResults);
        expect(response.content[0].title).toContain('Smith');
        done();
      });

      const req = httpMock.expectOne(`${apiUrl}/search?keyword=Smith&page=0&size=10`);
      expect(req.request.method).toBe('GET');
      req.flush({
        content: searchResults,
        totalElements: 1,
        totalPages: 1,
        number: 0
      });
    });
  });

  describe('getCasesByStatus', () => {
    it('should fetch cases by status successfully', (done) => {
      const openCases: LegalCase[] = [
        {
          id: '1',
          caseNumber: 'CASE-2024-001',
          title: 'Open Case 1',
          description: 'An open case',
          clientName: 'Client 1',
          clientEmail: 'client1@example.com',
          status: CaseStatus.OPEN,
          priority: CasePriority.HIGH,
          type: 'Civil',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      service.getCasesByStatus(CaseStatus.OPEN).subscribe(cases => {
        expect(cases).toEqual(openCases);
        expect(cases.every(c => c.status === CaseStatus.OPEN)).toBe(true);
        done();
      });

      const req = httpMock.expectOne(`${apiUrl}/status/${CaseStatus.OPEN}`);
      expect(req.request.method).toBe('GET');
      req.flush(openCases);
    });
  });

  describe('updateCaseStatus', () => {
    it('should update case status successfully', (done) => {
      const updatedCase: LegalCase = {
        id: '1',
        caseNumber: 'CASE-2024-001',
        title: 'Test Case',
        description: 'Test case description',
        clientName: 'John Doe',
        clientEmail: 'john@example.com',
        status: CaseStatus.CLOSED,
        priority: CasePriority.HIGH,
        type: 'Civil',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      service.updateCaseStatus('1', CaseStatus.CLOSED).subscribe(legalCase => {
        expect(legalCase.status).toBe(CaseStatus.CLOSED);
        done();
      });

      const req = httpMock.expectOne(`${apiUrl}/1/status`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ status: CaseStatus.CLOSED });
      req.flush(updatedCase);
    });
  });

  describe('getCasesByClient', () => {
    it('should fetch cases by client email successfully', (done) => {
      const clientCases: LegalCase[] = [
        {
          id: '1',
          caseNumber: 'CASE-2024-001',
          title: 'Client Case 1',
          description: 'Case for John Doe',
          clientName: 'John Doe',
          clientEmail: 'john@example.com',
          status: CaseStatus.OPEN,
          priority: CasePriority.HIGH,
          type: 'Civil',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      service.getCasesByClient('john@example.com').subscribe(cases => {
        expect(cases).toEqual(clientCases);
        expect(cases.every(c => c.clientEmail === 'john@example.com')).toBe(true);
        done();
      });

      const req = httpMock.expectOne(`${apiUrl}/client/john@example.com`);
      expect(req.request.method).toBe('GET');
      req.flush(clientCases);
    });
  });
});