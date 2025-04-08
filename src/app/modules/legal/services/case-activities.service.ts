import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { environment } from 'src/environments/environment';
import { CaseActivity, ActivityType } from '../interfaces/case.interface';
import { User } from 'src/app/interface/user';

@Injectable({
  providedIn: 'root'
})
export class CaseActivitiesService {
  private apiUrl = `${environment.apiUrl}/case-activities`;

  constructor(private http: HttpClient) {}

  getActivities(caseId: string): Observable<CaseActivity[]> {
    return this.http.get<CaseActivity[]>(`${this.apiUrl}/case/${caseId}`);
  }

  logActivity(activity: Partial<CaseActivity>): Observable<CaseActivity> {
    return this.http.post<CaseActivity>(this.apiUrl, activity);
  }

  // Helper method to create activity description based on type and metadata
  createActivityDescription(type: ActivityType, metadata: any): string {
    switch (type) {
      case ActivityType.CASE_CREATED:
        return 'Case was created';
      case ActivityType.CASE_UPDATED:
        return `Case was updated: ${metadata.changes?.join(', ')}`;
      case ActivityType.DOCUMENT_UPLOADED:
        return `Document "${metadata.documentTitle}" was uploaded`;
      case ActivityType.DOCUMENT_DOWNLOADED:
        return `Document "${metadata.documentTitle}" was downloaded`;
      case ActivityType.DOCUMENT_VERSION_ADDED:
        return `New version of "${metadata.documentTitle}" was added`;
      case ActivityType.NOTE_ADDED:
        return 'A new note was added';
      case ActivityType.NOTE_UPDATED:
        return 'A note was updated';
      case ActivityType.NOTE_DELETED:
        return 'A note was deleted';
      case ActivityType.STATUS_CHANGED:
        return `Case status changed from ${metadata.oldStatus} to ${metadata.newStatus}`;
      case ActivityType.ASSIGNMENT_CHANGED:
        return `Case was ${metadata.action} to ${metadata.assigneeName}`;
      case ActivityType.DEADLINE_SET:
        return `Deadline set for ${metadata.deadlineType}: ${metadata.deadlineDate}`;
      case ActivityType.DEADLINE_UPDATED:
        return `Deadline for ${metadata.deadlineType} was updated to ${metadata.deadlineDate}`;
      case ActivityType.DEADLINE_MET:
        return `Deadline for ${metadata.deadlineType} was met`;
      case ActivityType.DEADLINE_MISSED:
        return `Deadline for ${metadata.deadlineType} was missed`;
      case ActivityType.PAYMENT_RECEIVED:
        return `Payment of ${metadata.amount} was received`;
      case ActivityType.PAYMENT_SCHEDULED:
        return `Payment of ${metadata.amount} was scheduled for ${metadata.dueDate}`;
      case ActivityType.PAYMENT_MISSED:
        return `Payment of ${metadata.amount} was missed`;
      case ActivityType.HEARING_SCHEDULED:
        return `Hearing was scheduled for ${metadata.hearingDate}`;
      case ActivityType.HEARING_COMPLETED:
        return 'Hearing was completed';
      case ActivityType.HEARING_CANCELLED:
        return 'Hearing was cancelled';
      default:
        return 'An activity occurred';
    }
  }

  // For development/testing - returns dummy data
  getDummyActivities(caseId: string): Observable<CaseActivity[]> {
    const dummyUser1: User = {
      id: 1,
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      enabled: true,
      notLocked: true,
      usingMFA: false,
      roleName: 'LAWYER',
      permissions: 'READ,WRITE'
    };

    const dummyUser2: User = {
      id: 2,
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@example.com',
      enabled: true,
      notLocked: true,
      usingMFA: false,
      roleName: 'PARALEGAL',
      permissions: 'READ'
    };

    const dummyActivities: CaseActivity[] = [
      {
        id: '1',
        caseId,
        type: ActivityType.CASE_CREATED,
        description: 'Case was created',
        timestamp: new Date('2024-03-15T10:00:00'),
        userId: '1',
        user: dummyUser1
      },
      {
        id: '2',
        caseId,
        type: ActivityType.DOCUMENT_UPLOADED,
        description: 'Document "Initial Complaint" was uploaded',
        timestamp: new Date('2024-03-15T11:30:00'),
        userId: '1',
        user: dummyUser1,
        metadata: {
          documentTitle: 'Initial Complaint',
          documentId: 'doc1'
        }
      },
      {
        id: '3',
        caseId,
        type: ActivityType.STATUS_CHANGED,
        description: 'Case status changed from PENDING to ACTIVE',
        timestamp: new Date('2024-03-16T09:15:00'),
        userId: '1',
        user: dummyUser1,
        metadata: {
          oldStatus: 'PENDING',
          newStatus: 'ACTIVE'
        }
      },
      {
        id: '4',
        caseId,
        type: ActivityType.NOTE_ADDED,
        description: 'A new note was added',
        timestamp: new Date('2024-03-16T14:20:00'),
        userId: '2',
        user: dummyUser2,
        metadata: {
          noteId: 'note1',
          noteTitle: 'Initial Client Meeting'
        }
      },
      {
        id: '5',
        caseId,
        type: ActivityType.HEARING_SCHEDULED,
        description: 'Hearing was scheduled for 2024-04-15T10:00:00',
        timestamp: new Date('2024-03-17T11:00:00'),
        userId: '1',
        user: dummyUser1,
        metadata: {
          hearingDate: '2024-04-15T10:00:00',
          hearingType: 'PRELIMINARY'
        }
      }
    ];

    return of(dummyActivities);
  }
} 