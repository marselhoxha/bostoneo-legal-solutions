import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Note } from '../../../interfaces/case.interface';
import { CaseNotesService } from '../../../services/case-notes.service';

@Component({
  selector: 'app-case-notes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="card">
      <div class="card-header">
        <h5 class="card-title mb-0">Case Notes</h5>
      </div>
      <div class="card-body">
        <!-- Add Note Form -->
        <div class="mb-3">
          <textarea 
            class="form-control" 
            rows="3" 
            placeholder="Add a note..."
            [(ngModel)]="newNoteContent"
            (keyup.enter)="addNote()"
          ></textarea>
          <div class="mt-2">
            <button 
              class="btn btn-primary" 
              (click)="addNote()"
              [disabled]="!newNoteContent.trim()"
            >
              Add Note
            </button>
          </div>
        </div>

        <!-- Notes List -->
        <div class="notes-list">
          @for(note of notes; track note.id) {
            <div class="note-item mb-3 p-3 border rounded">
              @if(editingNoteId === note.id) {
                <div class="edit-form">
                  <textarea 
                    class="form-control mb-2" 
                    [(ngModel)]="editingContent"
                    rows="3"
                  ></textarea>
                  <div class="btn-group">
                    <button 
                      class="btn btn-sm btn-success" 
                      (click)="saveEdit(note)"
                      [disabled]="!editingContent.trim()"
                    >
                      Save
                    </button>
                    <button 
                      class="btn btn-sm btn-secondary" 
                      (click)="cancelEdit()"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              } @else {
                <div class="note-content">{{ note.content }}</div>
                <div class="note-meta text-muted small mt-2 d-flex justify-content-between align-items-center">
                  <span>
                    Added by {{ note.createdBy.name }} on {{ note.createdAt | date:'medium' }}
                    @if(note.updatedAt > note.createdAt) {
                      (Edited by {{ note.updatedBy?.name }} on {{ note.updatedAt | date:'medium' }})
                    }
                  </span>
                  <div class="btn-group">
                    <button 
                      class="btn btn-sm btn-outline-primary" 
                      (click)="startEdit(note)"
                    >
                      Edit
                    </button>
                    <button 
                      class="btn btn-sm btn-outline-danger" 
                      (click)="deleteNote(note)"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .note-item {
      background-color: #f8f9fa;
    }
    .note-content {
      white-space: pre-wrap;
    }
  `]
})
export class CaseNotesComponent implements OnInit {
  @Input() caseId!: string;
  notes: Note[] = [];
  newNoteContent: string = '';
  editingNoteId: string | null = null;
  editingContent: string = '';

  constructor(private notesService: CaseNotesService) {}

  ngOnInit(): void {
    this.loadNotes();
  }

  loadNotes(): void {
    this.notesService.getNotes(this.caseId).subscribe(notes => {
      this.notes = notes;
    });
  }

  addNote(): void {
    if (this.newNoteContent.trim()) {
      this.notesService.addNote(this.caseId, this.newNoteContent.trim()).subscribe(newNote => {
        this.notes = [newNote, ...this.notes];
        this.newNoteContent = '';
      });
    }
  }

  startEdit(note: Note): void {
    this.editingNoteId = note.id;
    this.editingContent = note.content;
  }

  cancelEdit(): void {
    this.editingNoteId = null;
    this.editingContent = '';
  }

  saveEdit(note: Note): void {
    if (this.editingContent.trim()) {
      this.notesService.updateNote(this.caseId, note.id, this.editingContent.trim()).subscribe(updatedNote => {
        this.notes = this.notes.map(n => n.id === updatedNote.id ? updatedNote : n);
        this.cancelEdit();
      });
    }
  }

  deleteNote(note: Note): void {
    if (confirm('Are you sure you want to delete this note?')) {
      this.notesService.deleteNote(this.caseId, note.id).subscribe(() => {
        this.notes = this.notes.filter(n => n.id !== note.id);
      });
    }
  }
} 