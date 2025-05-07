import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from 'src/environments/environment';
import { CaseNote, CreateCaseNoteRequest, UpdateCaseNoteRequest } from '../models/case-note.model';

@Injectable({
  providedIn: 'root'
})
export class CaseNotesService {
  private apiUrl = `${environment.apiUrl}/api/legal`;

  constructor(private http: HttpClient) { }

  /**
   * Get all notes for a specific case
   * @param caseId The ID of the legal case
   * @returns An observable of CaseNote array
   */
  getNotesByCaseId(caseId: string | number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/cases/${caseId}/notes`)
      .pipe(
        map(response => {
          console.log('Raw notes API response:', response);
          return response;
        })
      );
  }

  /**
   * Get a specific note by ID
   * @param caseId The ID of the legal case
   * @param noteId The ID of the note
   * @returns An observable of CaseNote
   */
  getNoteById(caseId: string | number, noteId: string | number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/cases/${caseId}/notes/${noteId}`)
      .pipe(
        map(response => {
          if (response && response.data && response.data.note) {
            return response.data.note;
          }
          return response;
        })
      );
  }

  /**
   * Create a new note for a case
   * @param data The note data to create
   * @returns An observable of the created CaseNote
   */
  createNote(data: CreateCaseNoteRequest): Observable<any> {
    console.log('Creating note with data:', data);
    return this.http.post<any>(`${this.apiUrl}/cases/${data.caseId}/notes`, data)
      .pipe(
        map(response => {
          if (response && response.data && response.data.note) {
            return response.data.note;
          }
          return response;
        })
      );
  }

  /**
   * Update an existing note
   * @param caseId The ID of the legal case
   * @param noteId The ID of the note to update
   * @param data The note data to update
   * @returns An observable of the updated CaseNote
   */
  updateNote(caseId: string | number, noteId: string | number, data: UpdateCaseNoteRequest): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/cases/${caseId}/notes/${noteId}`, data)
      .pipe(
        map(response => {
          if (response && response.data && response.data.note) {
            return response.data.note;
          }
          return response;
        })
      );
  }

  /**
   * Delete a note
   * @param caseId The ID of the legal case
   * @param noteId The ID of the note to delete
   * @returns An observable of the operation result
   */
  deleteNote(caseId: string | number, noteId: string | number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/cases/${caseId}/notes/${noteId}`);
  }
} 