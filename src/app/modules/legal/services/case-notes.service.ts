import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { Note } from '../interfaces/case.interface';

@Injectable({
  providedIn: 'root'
})
export class CaseNotesService {
  // TODO: Replace with actual API endpoint
  private apiUrl = '/api/cases';

  constructor(private http: HttpClient) {}

  getNotes(caseId: string): Observable<Note[]> {
    // TODO: Replace with actual API call
    // For now, return empty array
    return of([]);
  }

  addNote(caseId: string, content: string): Observable<Note> {
    const newNote: Note = {
      id: Date.now().toString(),
      content,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // TODO: Replace with actual API call
    return of(newNote);
  }

  updateNote(caseId: string, noteId: string, content: string): Observable<Note> {
    const updatedNote: Note = {
      id: noteId,
      content,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // TODO: Replace with actual API call
    return of(updatedNote);
  }

  deleteNote(caseId: string, noteId: string): Observable<void> {
    // TODO: Replace with actual API call
    return of(void 0);
  }
} 