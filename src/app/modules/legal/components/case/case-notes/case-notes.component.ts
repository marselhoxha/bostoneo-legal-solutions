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
      <div class="card-header border-bottom-dashed">
        <div class="d-flex align-items-center">
          <h5 class="card-title mb-0 flex-grow-1">Case Notes</h5>
          <div class="flex-shrink-0">
            <button 
              class="btn btn-soft-primary btn-sm" 
              (click)="toggleAddNote()"
            >
              <i class="ri-add-line align-bottom me-1"></i>
              Add Note
            </button>
          </div>
        </div>
      </div>
      <div class="card-body">
        <!-- Add Note Form -->
        @if(isAddingNote) {
          <div class="mb-4">
            <textarea 
              class="form-control" 
              rows="3" 
              placeholder="Add a note..."
              [(ngModel)]="newNoteContent"
              (keyup.enter)="addNote()"
            ></textarea>
            <div class="mt-2 d-flex justify-content-end gap-2">
              <button 
                class="btn btn-soft-light btn-sm" 
                (click)="toggleAddNote()"
              >
                Cancel
              </button>
              <button 
                class="btn btn-soft-primary btn-sm" 
                (click)="addNote()"
                [disabled]="!newNoteContent.trim()"
              >
                Save Note
              </button>
            </div>
          </div>
        }

        <!-- Notes List -->
        <div class="notes-list">
          @for(note of notes; track note.id) {
            <div class="note-item mb-3 p-3 border rounded bg-light">
              @if(editingNoteId === note.id) {
                <div class="edit-form">
                  <textarea 
                    class="form-control mb-2" 
                    [(ngModel)]="editingContent"
                    rows="3"
                  ></textarea>
                  <div class="d-flex justify-content-end gap-2">
                    <button 
                      class="btn btn-soft-light btn-sm" 
                      (click)="cancelEdit()"
                    >
                      Cancel
                    </button>
                    <button 
                      class="btn btn-soft-primary btn-sm" 
                      (click)="saveEdit(note)"
                      [disabled]="!editingContent.trim()"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              } @else {
                <div class="note-content mb-2">{{ note.content }}</div>
                <div class="note-meta d-flex justify-content-between align-items-center">
                  <div class="text-muted small">
                    <i class="ri-user-line align-middle me-1"></i>
                    {{ note.createdBy.name }}
                    <span class="mx-1">•</span>
                    <i class="ri-time-line align-middle me-1"></i>
                    {{ note.createdAt | date:'medium' }}
                    @if(note.updatedAt > note.createdAt) {
                      <span class="mx-1">•</span>
                      <i class="ri-edit-line align-middle me-1"></i>
                      Edited by {{ note.updatedBy?.name }} on {{ note.updatedAt | date:'medium' }}
                    }
                  </div>
                  <div class="btn-group">
                    <button 
                      class="btn btn-soft-primary btn-sm" 
                      (click)="startEdit(note)"
                    >
                      <i class="ri-edit-line align-bottom me-1"></i>
                      Edit
                    </button>
                    <button 
                      class="btn btn-soft-danger btn-sm" 
                      (click)="deleteNote(note)"
                    >
                      <i class="ri-delete-bin-line align-bottom me-1"></i>
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
      transition: all 0.3s ease;
    }
    .note-item:hover {
      box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
    }
    .note-content {
      white-space: pre-wrap;
      color: #495057;
    }
    .btn-soft-primary {
      color: #405189;
      background-color: rgba(64, 81, 137, 0.18);
      border-color: transparent;
    }
    .btn-soft-primary:hover {
      color: #fff;
      background-color: #405189;
      border-color: #405189;
    }
    .btn-soft-danger {
      color: #f06548;
      background-color: rgba(240, 101, 72, 0.18);
      border-color: transparent;
    }
    .btn-soft-danger:hover {
      color: #fff;
      background-color: #f06548;
      border-color: #f06548;
    }
    .btn-soft-light {
      color: #878a99;
      background-color: rgba(135, 138, 153, 0.18);
      border-color: transparent;
    }
    .btn-soft-light:hover {
      color: #878a99;
      background-color: rgba(135, 138, 153, 0.25);
      border-color: transparent;
    }
  `]
})
export class CaseNotesComponent implements OnInit {
  @Input() caseId!: string;
  notes: Note[] = [];
  newNoteContent: string = '';
  editingNoteId: string | null = null;
  editingContent: string = '';
  isAddingNote: boolean = false;

  constructor(private notesService: CaseNotesService) {}

  ngOnInit(): void {
    this.loadNotes();
  }

  loadNotes(): void {
    this.notesService.getNotes(this.caseId).subscribe(notes => {
      this.notes = notes;
    });
  }

  toggleAddNote(): void {
    this.isAddingNote = !this.isAddingNote;
    if (!this.isAddingNote) {
      this.newNoteContent = '';
    }
  }

  addNote(): void {
    if (this.newNoteContent.trim()) {
      this.notesService.addNote(this.caseId, this.newNoteContent.trim()).subscribe(newNote => {
        this.notes = [newNote, ...this.notes];
        this.newNoteContent = '';
        this.isAddingNote = false;
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