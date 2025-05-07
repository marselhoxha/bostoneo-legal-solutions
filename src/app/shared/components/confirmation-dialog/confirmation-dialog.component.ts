import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';

export interface ConfirmationDialogData {
  title: string;
  message: string;
  confirmButtonText?: string;
  cancelButtonText?: string;
  isDestructive?: boolean;
}

@Component({
  selector: 'app-confirmation-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule],
  template: `
    <div class="confirmation-dialog">
      <h2 mat-dialog-title>{{ data.title }}</h2>
      <mat-dialog-content>
        <p [innerHTML]="data.message"></p>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button class="btn btn-secondary" (click)="onCancel()">
          {{ data.cancelButtonText || 'Cancel' }}
        </button>
        <button 
          class="btn" 
          [ngClass]="data.isDestructive ? 'btn-danger' : 'btn-primary'" 
          (click)="onConfirm()">
          {{ data.confirmButtonText || 'Confirm' }}
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .confirmation-dialog {
      padding: 1rem;
    }
    mat-dialog-content {
      margin-bottom: 1rem;
    }
    mat-dialog-actions {
      margin-top: 0.5rem;
    }
    button {
      margin-left: 0.5rem;
    }
  `]
})
export class ConfirmationDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ConfirmationDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmationDialogData
  ) {}

  onConfirm(): void {
    this.dialogRef.close(true);
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
} 