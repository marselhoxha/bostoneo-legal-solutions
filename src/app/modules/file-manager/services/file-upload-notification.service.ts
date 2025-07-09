import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class FileUploadNotificationService {
  private documentUploadedSubject = new Subject<{caseId: number, fileInfo: any}>();

  // Observable that other components can subscribe to
  documentUploaded$ = this.documentUploadedSubject.asObservable();

  /**
   * Notify that a document has been uploaded for a specific case
   */
  notifyDocumentUploaded(caseId: number, fileInfo: any): void {
    this.documentUploadedSubject.next({caseId, fileInfo});
  }
}