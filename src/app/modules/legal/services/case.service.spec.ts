import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { CaseService } from './case.service';
import { LegalCase, CaseStatus, CasePriority } from '../interfaces/case.interface';
import { environment } from '../../../../environments/environment';

describe('CaseService', () => {
  let service: CaseService;
  let httpMock: HttpTestingController;
  const apiUrl = `${environment.apiUrl}/legal-case`;

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

  it('should create a case', () => {
    const mockCase: Partial<LegalCase> = {
      title: 'Test Case',
      caseNumber: 'TEST-2023-001',
      description: 'This is a test case',
      status: CaseStatus.PENDING,
      priority: CasePriority.MEDIUM,
      type: 'CIVIL',
      clientName: 'John Doe',
      clientEmail: 'john.doe@example.com',
      clientPhone: '+1234567890',
      clientAddress: '123 Test St, Test City, 12345',
      courtInfo: {
        courtName: 'Test Court',
        judgeName: 'Judge Test',
        courtroom: 'Courtroom 1'
      },
      importantDates: {
        filingDate: new Date(),
        nextHearing: new Date(),
        trialDate: new Date()
      }
    };

    const mockResponse = {
      timeStamp: new Date().toISOString(),
      data: {
        case: {
          id: '1',
          ...mockCase,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      },
      message: 'Legal case created successfully',
      status: 201,
      statusCode: 201
    };

    service.createCase(mockCase).subscribe(response => {
      expect(response).toBeTruthy();
      expect(response.id).toBe('1');
      expect(response.title).toBe(mockCase.title);
      expect(response.caseNumber).toBe(mockCase.caseNumber);
      expect(response.clientName).toBe(mockCase.clientName);
    });

    const req = httpMock.expectOne(`${apiUrl}/create`);
    expect(req.request.method).toBe('POST');
    req.flush(mockResponse);
  });

  it('should get a case by id', () => {
    const mockCase: LegalCase = {
      id: '1',
      title: 'Test Case',
      caseNumber: 'TEST-2023-001',
      description: 'This is a test case',
      status: CaseStatus.PENDING,
      priority: CasePriority.MEDIUM,
      type: 'CIVIL',
      clientName: 'John Doe',
      clientEmail: 'john.doe@example.com',
      clientPhone: '+1234567890',
      clientAddress: '123 Test St, Test City, 12345',
      courtInfo: {
        courtName: 'Test Court',
        judgeName: 'Judge Test',
        courtroom: 'Courtroom 1'
      },
      importantDates: {
        filingDate: new Date(),
        nextHearing: new Date(),
        trialDate: new Date()
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const mockResponse = {
      timeStamp: new Date().toISOString(),
      data: {
        case: mockCase
      },
      message: 'Legal case retrieved successfully',
      status: 200,
      statusCode: 200
    };

    service.getCaseById('1').subscribe(response => {
      expect(response).toBeTruthy();
      expect(response.id).toBe('1');
      expect(response.title).toBe(mockCase.title);
      expect(response.caseNumber).toBe(mockCase.caseNumber);
      expect(response.clientName).toBe(mockCase.clientName);
    });

    const req = httpMock.expectOne(`${apiUrl}/get/1`);
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);
  });
}); 