import { Component, OnInit, Input, OnChanges, SimpleChanges, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { CaseNote, CreateCaseNoteRequest, UpdateCaseNoteRequest } from '../../../models/case-note.model';
import { LegalCaseService } from '../../../services/legal-case.service';
import { CaseNotesService } from '../../../services/case-notes.service';
import { CaseActivitiesService } from '../../../services/case-activities.service';
import { CreateActivityRequest, ActivityType } from '../../../models/case-activity.model';
import { ConfirmationDialogComponent, ConfirmationDialogData } from '../../../../../shared/components/confirmation-dialog/confirmation-dialog.component';
import { finalize, catchError, of } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../../../../../services/auth.service';
import Swal from 'sweetalert2';
import { NoSanitizePipe } from '../../../../../shared/pipes/no-sanitize.pipe';

@Component({
  selector: 'app-case-notes',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, NoSanitizePipe],
  templateUrl: './case-notes.component.html',
  styleUrls: ['./case-notes.component.scss']
})
export class CaseNotesComponent implements OnInit, OnChanges {
  @Input() caseId!: string;
  @ViewChild('confirmDeleteModal') confirmDeleteModal!: ElementRef;
  
  notes: CaseNote[] = [];
  isLoading = false;
  error: string | null = null;
  
  // New note form
  showAddNoteForm = false;
  newNote: CaseNote = {
    id: '',
    caseId: '',
    title: '',
    content: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: {
      id: '',
      name: ''
    },
    isPrivate: false
  };
  
  // Edit note state
  editNoteId: string | null = null;
  editedNote: CaseNote | null = null;
  
  // Delete note state
  noteToDelete: CaseNote | null = null;
  isDeleting = false;
  
  // Current modal reference
  private modalRef: NgbModalRef | null = null;
  
  constructor(
    private legalCaseService: LegalCaseService,
    private notesService: CaseNotesService,
    private activitiesService: CaseActivitiesService,
    private modalService: NgbModal,
    private toastr: ToastrService,
    private authService: AuthService,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadNotes();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['caseId'] && !changes['caseId'].firstChange) {
      this.loadNotes();
    }
  }

  loadNotes(): void {
    if (!this.caseId) {
      this.error = 'No case ID provided';
      this.cdr.detectChanges();
      return;
    }
    
    this.isLoading = true;
    this.error = null;
    this.cdr.detectChanges();
    
    this.notesService.getNotesByCaseId(this.caseId)
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (response) => {
          // Check if response has the expected structure
          if (response && response.data && response.data.notes) {
            this.notes = response.data.notes;
          } else if (Array.isArray(response)) {
            this.notes = response;
          } else {
            this.notes = [];
          }

          this.error = null;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error loading notes:', err);
          this.error = 'Failed to load notes. Please try again.';
          this.notes = [];
          this.cdr.detectChanges();
        }
      });
  }
  
  toggleAddNoteForm(): void {
    this.showAddNoteForm = !this.showAddNoteForm;
    if (this.showAddNoteForm) {
      // Reset the new note form
      this.newNote = {
        id: '',
        caseId: this.caseId,
        title: '',
        content: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        isPrivate: false,
        createdBy: {
          id: this.authService.getCurrentUserId() || '',
          name: this.getCurrentUserName()
        }
      };
    }
    this.cdr.detectChanges();
  }
  
  toggleNotePrivacy(): void {
    if (this.editedNote) {
      this.editedNote.isPrivate = !this.editedNote.isPrivate;
    } else {
      this.newNote.isPrivate = !this.newNote.isPrivate;
    }
    this.cdr.detectChanges();
  }
  
  private getCurrentUserName(): string {
    const user = this.authService.getCurrentUser();
    if (!user) return 'Unknown User';
    return `${user.firstName} ${user.lastName}`.trim() || user.username || 'Unknown User';
  }
  
  saveNewNote(): void {
    if (!this.newNote.title.trim() || !this.newNote.content.trim()) {
      this.toastr.warning('Please provide both title and content for the note.');
      return;
    }
    
    this.isLoading = true;
    this.cdr.detectChanges();
    
    // Create a clean request object with only the fields needed
    const noteRequest: CreateCaseNoteRequest = {
      caseId: this.caseId,
      title: this.newNote.title.trim(),
      content: this.newNote.content.trim(),
      isPrivate: this.newNote.isPrivate
    };
    
    this.notesService.createNote(noteRequest)
      .pipe(finalize(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (createdNote) => {
          // Reset the form
          this.newNote = {
            id: '',
            caseId: this.caseId,
            title: '',
            content: '',
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: {
              id: '',
              name: ''
            },
            isPrivate: false
          };
          
          // Hide the form
          this.showAddNoteForm = false;
          
          // Show success message with SweetAlert
          Swal.fire({
            title: 'Success!',
            text: 'Note has been added successfully.',
            icon: 'success',
            timer: 1500,
            showConfirmButton: false
          });
          
          // Refresh notes list
          this.loadNotes();
          
          this.cdr.detectChanges();
          
          // No need to log activity here since it's already done in the backend
          // Just notify the timeline to refresh
          const numericCaseId = Number(this.caseId);
          if (!isNaN(numericCaseId)) {
            this.activitiesService.notifyRefresh(numericCaseId);
          }
        },
        error: (err) => {
          console.error('Error creating note:', err);
          Swal.fire({
            title: 'Error!',
            text: 'Failed to create note. Please try again.',
            icon: 'error'
          });
        }
      });
  }
  
  startEditingNote(note: CaseNote): void {
    try {
      // Ensure note ID is treated as a string for consistent comparison
      const noteId = String(note.id);
      this.editNoteId = noteId;

      // Create a deep copy with all required properties
      this.editedNote = {
        id: note.id,
        caseId: note.caseId,
        title: note.title || '',
        content: note.content || '',
        createdAt: note.createdAt,
        updatedAt: new Date(),
        isPrivate: note.isPrivate || false,
        // Copy other properties if they exist
        userId: note.userId,
        user: note.user,
        createdBy: note.createdBy,
        updatedBy: note.updatedBy
      };

      setTimeout(() => this.cdr.detectChanges(), 0);
    } catch (error) {
      console.error('Error when starting to edit note:', error);
      this.toastr.error('An error occurred while preparing to edit the note');
    }
  }
  
  cancelEditingNote(): void {
    this.editNoteId = null;
    this.editedNote = null;
    this.cdr.detectChanges();
  }
  
  saveEditedNote(): void {
    if (!this.editedNote || !this.editNoteId) {
      this.toastr.warning('No note to save');
      return;
    }
    
    if (!this.editedNote.title.trim() || !this.editedNote.content.trim()) {
      this.toastr.warning('Please provide both title and content for the note.');
      return;
    }
    
    this.isLoading = true;
    this.cdr.detectChanges();
    
    // Create a clean update object with only the fields we want to update
    const updateData: UpdateCaseNoteRequest = {
      title: this.editedNote.title.trim(),
      content: this.editedNote.content.trim(),
      isPrivate: this.editedNote.isPrivate
    };
    
    this.notesService.updateNote(this.caseId, this.editNoteId, updateData)
      .pipe(finalize(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (updatedNote) => {
          // Reset edit state
          this.editNoteId = null;
          this.editedNote = null;
          
          // Show success message with SweetAlert
          Swal.fire({
            title: 'Updated!',
            text: 'Note has been updated successfully.',
            icon: 'success',
            timer: 1500,
            showConfirmButton: false
          });
          
          // Reload all notes to ensure we have the latest data
          this.loadNotes();
          
          this.cdr.detectChanges();
          
          // No need to log activity here since it's already done in the backend
          // Just notify the timeline to refresh
          const numericCaseId = Number(this.caseId);
          if (!isNaN(numericCaseId)) {
            this.activitiesService.notifyRefresh(numericCaseId);
          }
        },
        error: (err) => {
          console.error('Error updating note:', err);
          Swal.fire({
            title: 'Error!',
            text: 'Failed to update note. Please try again.',
            icon: 'error'
          });
        }
      });
  }
  
  confirmDeleteNote(note: CaseNote): void {
    this.noteToDelete = note;
    
    Swal.fire({
      title: 'Delete Note',
      text: `Are you sure you want to delete the note "${note.title}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        this.deleteNote();
      } else {
        this.noteToDelete = null;
      }
      this.cdr.detectChanges();
    });
  }
  
  deleteNote(): void {
    if (!this.noteToDelete) return;
    
    this.isDeleting = true;
    this.cdr.detectChanges();
    
    const caseId = this.caseId;
    const noteId = String(this.noteToDelete.id);
    
    this.notesService.deleteNote(caseId, noteId)
      .pipe(finalize(() => {
        this.isDeleting = false;
        this.noteToDelete = null;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: () => {
          // Remove from list
          this.notes = this.notes.filter(n => String(n.id) !== noteId);
          
          // Show success message with SweetAlert
          Swal.fire({
            title: 'Deleted!',
            text: 'Note has been deleted successfully.',
            icon: 'success',
            timer: 1500,
            showConfirmButton: false
          });
          
          this.cdr.detectChanges();
          
          // Notify that activity timeline should be refreshed
          // We don't need to log the activity here because it's already logged on the backend
          const numericCaseId = Number(this.caseId);
          if (!isNaN(numericCaseId)) {
            this.activitiesService.notifyRefresh(numericCaseId);
          }
        },
        error: (err) => {
          console.error('Error deleting note:', err);
          Swal.fire({
            title: 'Error!',
            text: 'Failed to delete note. Please try again.',
            icon: 'error'
          });
        }
      });
  }
  
  private logNoteActivity(noteId: number, title: string, type: 'NOTE_ADDED' | 'NOTE_UPDATED' | 'NOTE_DELETED'): void {
    const caseId = Number(this.caseId);
    
    if (isNaN(caseId) || isNaN(noteId)) {
      console.warn('Invalid case ID or note ID for activity logging');
      return;
    }
    
    // Use the full activity type string - database now uses VARCHAR(50)
    let activityType: string = type;
    
    const actionText = type === 'NOTE_ADDED' ? 'added' : 
                      type === 'NOTE_UPDATED' ? 'updated' : 'deleted';
    
    const data = {
      caseId: caseId,
      activityType: activityType,
      referenceId: noteId,
      referenceType: 'note',
      description: `Note "${title}" ${actionText}`,
      metadata: {
        noteId: noteId,
        noteTitle: title
      }
    };
    
    this.activitiesService.createActivity(data)
      .pipe(
        catchError(error => {
          console.error(`Failed to log ${type} activity:`, error);
          return of(null);
        })
      )
      .subscribe(result => {
        if (result) {
          // Notify that activities should be refreshed
          this.activitiesService.notifyRefresh(caseId);
        }
      });
  }
  
  // Helper method to convert any value to string for template use
  toString(value: any): string {
    return String(value);
  }
  
  formatDate(date: Date | string): string {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString();
  }
} 