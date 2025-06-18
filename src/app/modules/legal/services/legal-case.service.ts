import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, map, throwError, catchError } from 'rxjs';
import { environment } from 'src/environments/environment';
import { LegalCase } from '../interfaces/case.interface';
import { CaseNote } from '../models/case-note.model';
import { Key } from 'src/app/enum/key.enum';

@Injectable({
  providedIn: 'root'
})
export class LegalCaseService {
  private apiBaseUrl = `${environment.apiUrl}`;
  private legacyCaseApiUrl = `${this.apiBaseUrl}/legal-case`;
  private caseApiUrl = `${this.apiBaseUrl}/api/legal/cases`;

  constructor(private http: HttpClient) { }

  // Helper method to get auth headers
  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem(Key.TOKEN);
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  /**
   * Get all legal cases
   * @param page Page number (optional)
   * @param size Page size (optional)
   * @returns Observable of legal cases page
   */
  getAllCases(page = 0, size = 10): Observable<any> {
    return this.http.get<any>(`${this.legacyCaseApiUrl}/list?page=${page}&size=${size}`, {
      headers: this.getAuthHeaders()
    });
  }

  /**
   * Get a specific legal case by ID
   * @param id Case ID
   * @returns Observable of legal case
   */
  getCaseById(id: string): Observable<LegalCase> {
    return this.http.get<any>(`${this.legacyCaseApiUrl}/get/${id}`, {
      headers: this.getAuthHeaders()
    })
      .pipe(
        map(response => {
          if (response && response.data && response.data.case) {
            return response.data.case;
          }
          return response;
        })
      );
  }

  /**
   * Create a new legal case
   * @param caseData Legal case data
   * @returns Observable of created legal case
   */
  createCase(caseData: any): Observable<LegalCase> {
    return this.http.post<any>(`${this.legacyCaseApiUrl}/create`, caseData, {
      headers: this.getAuthHeaders()
    })
      .pipe(
        map(response => {
          if (response && response.data && response.data.case) {
            return response.data.case;
          }
          return response;
        })
      );
  }

  /**
   * Update a legal case
   * @param id Case ID
   * @param caseData Updated case data
   * @returns Observable of updated legal case
   */
  updateCase(id: string, caseData: any): Observable<LegalCase> {
    return this.http.put<any>(`${this.legacyCaseApiUrl}/update/${id}`, caseData, {
      headers: this.getAuthHeaders()
    })
      .pipe(
        map(response => {
          if (response && response.data && response.data.case) {
            return response.data.case;
          }
          return response;
        })
      );
  }

  /**
   * Delete a legal case
   * @param id Case ID
   * @returns Observable of void
   */
  deleteCase(id: string): Observable<void> {
    return this.http.delete<void>(`${this.legacyCaseApiUrl}/delete/${id}`, {
      headers: this.getAuthHeaders()
    });
  }

  /**
   * Get cases by client ID
   * @param clientId Client ID
   * @param page Page number (optional)
   * @param size Page size (optional)
   * @returns Observable of legal cases for the client
   */
  getCasesByClient(clientId: number, page = 0, size = 100): Observable<any> {
    const params = new HttpParams()
      .set('clientId', clientId.toString())
      .set('page', page.toString())
      .set('size', size.toString());
    
    return this.http.get<any>(`${this.legacyCaseApiUrl}/client/${clientId}`, {
      headers: this.getAuthHeaders(),
      params
    }).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error(`Error fetching cases for client ${clientId}:`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get all notes for a specific case
   * @param caseId The ID of the legal case
   * @returns An observable of CaseNote array
   */
  getCaseNotes(caseId: string | number): Observable<CaseNote[]> {
    console.log(`Fetching notes for case ID: ${caseId} from ${this.caseApiUrl}/${caseId}/notes`);
    return this.http.get<any>(`${this.caseApiUrl}/${caseId}/notes`, {
      headers: this.getAuthHeaders()
    })
      .pipe(
        map(response => {
          console.log('Raw notes API response:', response);
          
          // Extract notes from the response
          if (response && response.data && response.data.notes) {
            console.log(`Found ${response.data.notes.length} notes in the response data`);
            return response.data.notes;
          }
          
          // If API returns a direct array
          if (Array.isArray(response)) {
            console.log(`Found ${response.length} notes in direct response array`);
            return response;
          }
          
          console.log('Unexpected response format, returning empty array');
          return [];
        }),
        catchError((error: HttpErrorResponse) => {
          console.error(`Error fetching notes for case ${caseId}:`, error);
          
          // Log the specific error body for debugging
          if (error.error) {
            console.error('Error details:', error.error);
          }
          
          return throwError(() => error);
        })
      );
  }

  /**
   * Get a specific note by ID
   * @param caseId The ID of the legal case
   * @param noteId The ID of the note
   * @returns An observable of CaseNote
   */
  getCaseNoteById(caseId: string | number, noteId: string | number): Observable<CaseNote> {
    return this.http.get<any>(`${this.caseApiUrl}/${caseId}/notes/${noteId}`, {
      headers: this.getAuthHeaders()
    })
      .pipe(
        map(response => {
          console.log('Get note by ID response:', response);
          if (response && response.data && response.data.note) {
            return response.data.note;
          }
          return response;
        }),
        catchError((error: HttpErrorResponse) => {
          console.error(`Error fetching note ${noteId} for case ${caseId}:`, error);
          
          // Log the specific error body for debugging
          if (error.error) {
            console.error('Error details:', error.error);
          }
          
          return throwError(() => error);
        })
      );
  }

  /**
   * Create a new note for a case
   * @param caseId The ID of the legal case
   * @param noteData The note data to create
   * @returns An observable of the created CaseNote
   */
  createCaseNote(caseId: string | number, noteData: Partial<CaseNote>): Observable<CaseNote> {
    // Only include fields expected by the backend CreateCaseNoteRequest DTO
    const createNoteRequest = {
      caseId: Number(caseId),
      title: noteData.title,
      content: noteData.content,
      isPrivate: noteData.isPrivate || false  // This matches the @JsonProperty in the backend
    };
    
    console.log('Sending create note request:', createNoteRequest);
    
    return this.http.post<any>(`${this.caseApiUrl}/${caseId}/notes`, createNoteRequest, {
      headers: this.getAuthHeaders()
    })
      .pipe(
        map(response => {
          console.log('Create note response:', response);
          if (response && response.data && response.data.note) {
            return response.data.note;
          }
          return response;
        }),
        catchError((error: HttpErrorResponse) => {
          console.error(`Error creating note for case ${caseId}:`, error);
          
          // Log the specific error body for debugging
          if (error.error) {
            console.error('Error details:', error.error);
          }
          
          return throwError(() => error);
        })
      );
  }

  /**
   * Update an existing note
   * @param caseId The ID of the legal case
   * @param noteId The ID of the note to update
   * @param noteData The note data to update
   * @returns An observable of the updated CaseNote
   */
  updateCaseNote(caseId: string | number, noteId: string | number, noteData: Partial<CaseNote>): Observable<CaseNote> {
    // Only include fields expected by the backend UpdateCaseNoteRequest DTO
    const updateNoteRequest = {
      title: noteData.title,
      content: noteData.content,
      isPrivate: noteData.isPrivate
    };
    
    console.log(`Sending update request for note ${noteId}:`, updateNoteRequest);
    
    return this.http.put<any>(`${this.caseApiUrl}/${caseId}/notes/${noteId}`, updateNoteRequest, {
      headers: this.getAuthHeaders()
    })
      .pipe(
        map(response => {
          console.log('Update note response:', response);
          if (response && response.data && response.data.note) {
            return response.data.note;
          }
          return response;
        }),
        catchError((error: HttpErrorResponse) => {
          console.error(`Error updating note ${noteId} for case ${caseId}:`, error);
          
          // Log the specific error body for debugging
          if (error.error) {
            console.error('Error details:', error.error);
          }
          
          return throwError(() => error);
        })
      );
  }

  /**
   * Delete a note
   * @param caseId The ID of the legal case
   * @param noteId The ID of the note to delete
   * @returns An observable of the operation result
   */
  deleteCaseNote(caseId: string | number, noteId: string | number): Observable<void> {
    return this.http.delete<void>(`${this.caseApiUrl}/${caseId}/notes/${noteId}`, {
      headers: this.getAuthHeaders()
    });
  }
  
  /**
   * Get all activities for a specific case
   * @param caseId The ID of the legal case
   * @returns An observable of activities array
   */
  getCaseActivities(caseId: string | number): Observable<any[]> {
    console.log(`Fetching activities for case ID: ${caseId}`);
    return this.http.get<any>(`${this.caseApiUrl}/${caseId}/activities`, {
      headers: this.getAuthHeaders()
    })
      .pipe(
        map(response => {
          console.log('Raw activities API response:', response);
          
          // Extract activities from the response
          if (response && response.data && response.data.activities) {
            return response.data.activities;
          }
          
          // If API returns a direct array
          if (Array.isArray(response)) {
            return response;
          }
          
          return [];
        }),
        catchError((error: HttpErrorResponse) => {
          console.error(`Error fetching activities for case ${caseId}:`, error);
          if (error.error) {
            console.error('Error details:', error.error);
          }
          return throwError(() => error);
        })
      );
  }

  /**
   * Create a new activity for a case
   * @param caseId The ID of the legal case
   * @param activityData The activity data to create
   * @returns An observable of the created activity
   */
  createCaseActivity(caseId: string | number, activityData: any): Observable<any> {
    return this.http.post<any>(`${this.caseApiUrl}/${caseId}/activities`, activityData, {
      headers: this.getAuthHeaders()
    })
      .pipe(
        map(response => {
          console.log('Create activity response:', response);
          if (response && response.data && response.data.activity) {
            return response.data.activity;
          }
          return response;
        }),
        catchError((error: HttpErrorResponse) => {
          console.error(`Error creating activity for case ${caseId}:`, error);
          if (error.error) {
            console.error('Error details:', error.error);
          }
          return throwError(() => error);
        })
      );
  }
} 