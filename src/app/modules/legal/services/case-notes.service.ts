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
  
  // Dummy user for demonstration
  private currentUser = {
    id: '1',
    name: 'John Doe',
    email: 'john.doe@example.com'
  };

  // Dummy notes for demonstration
  private dummyNotes: Note[] = [
    {
      id: '1',
      content: 'Initial client consultation completed. Client provided all necessary documentation.',
      createdAt: new Date('2024-04-01T10:30:00'),
      updatedAt: new Date('2024-04-01T10:30:00'),
      createdBy: {
        id: '1',
        name: 'John Doe',
        email: 'john.doe@example.com'
      },
      updatedBy: {
        id: '1',
        name: 'John Doe',
        email: 'john.doe@example.com'
      }
    },
    {
      id: '2',
      content: 'Filed initial motion with the court. Awaiting response from opposing counsel.',
      createdAt: new Date('2024-04-05T14:15:00'),
      updatedAt: new Date('2024-04-05T14:15:00'),
      createdBy: {
        id: '1',
        name: 'John Doe',
        email: 'john.doe@example.com'
      },
      updatedBy: {
        id: '1',
        name: 'John Doe',
        email: 'john.doe@example.com'
      }
    },
    {
      id: '3',
      content: 'Received response from opposing counsel. They are requesting additional documentation.',
      createdAt: new Date('2024-04-10T09:45:00'),
      updatedAt: new Date('2024-04-10T11:20:00'),
      createdBy: {
        id: '1',
        name: 'John Doe',
        email: 'john.doe@example.com'
      },
      updatedBy: {
        id: '2',
        name: 'Jane Smith',
        email: 'jane.smith@example.com'
      }
    }
  ];

  constructor(private http: HttpClient) {}

  getNotes(caseId: string): Observable<Note[]> {
    // TODO: Replace with actual API call
    // For now, return dummy data
    return of(this.dummyNotes);
  }

  addNote(caseId: string, content: string): Observable<Note> {
    const newNote: Note = {
      id: Date.now().toString(),
      content,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: this.currentUser,
      updatedBy: this.currentUser
    };
    
    // Add to dummy data
    this.dummyNotes = [newNote, ...this.dummyNotes];
    
    // TODO: Replace with actual API call
    return of(newNote);
  }

  updateNote(caseId: string, noteId: string, content: string): Observable<Note> {
    const updatedNote: Note = {
      id: noteId,
      content,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: this.currentUser,
      updatedBy: this.currentUser
    };
    
    // Update dummy data
    this.dummyNotes = this.dummyNotes.map(note => 
      note.id === noteId ? updatedNote : note
    );
    
    // TODO: Replace with actual API call
    return of(updatedNote);
  }

  deleteNote(caseId: string, noteId: string): Observable<void> {
    // Remove from dummy data
    this.dummyNotes = this.dummyNotes.filter(note => note.id !== noteId);
    
    // TODO: Replace with actual API call
    return of(void 0);
  }
} 