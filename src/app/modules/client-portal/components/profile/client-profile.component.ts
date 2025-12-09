import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { ClientPortalService, ClientProfile } from '../../services/client-portal.service';

@Component({
  selector: 'app-client-profile',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './client-profile.component.html',
  styleUrls: ['./client-profile.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClientProfileComponent implements OnInit, OnDestroy {
  profile: ClientProfile | null = null;
  loading = true;
  saving = false;
  error: string | null = null;
  successMessage: string | null = null;

  // Edit mode
  isEditing = false;
  editForm: Partial<ClientProfile> = {};

  private destroy$ = new Subject<void>();

  constructor(
    private clientPortalService: ClientPortalService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadProfile();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadProfile(): void {
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();

    this.clientPortalService.getProfile()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (profile) => {
          this.profile = profile;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error loading profile:', err);
          this.error = 'Failed to load profile. Please try again.';
          this.cdr.markForCheck();
        }
      });
  }

  startEditing(): void {
    if (this.profile) {
      this.editForm = { ...this.profile };
      this.isEditing = true;
      this.cdr.markForCheck();
    }
  }

  cancelEditing(): void {
    this.isEditing = false;
    this.editForm = {};
    this.cdr.markForCheck();
  }

  dismissError(): void {
    this.error = null;
    this.cdr.markForCheck();
  }

  dismissSuccess(): void {
    this.successMessage = null;
    this.cdr.markForCheck();
  }

  saveProfile(): void {
    if (!this.editForm) return;

    this.saving = true;
    this.error = null;
    this.cdr.markForCheck();

    this.clientPortalService.updateProfile(this.editForm)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.saving = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (profile) => {
          this.profile = profile;
          this.isEditing = false;
          this.editForm = {};
          this.successMessage = 'Profile updated successfully!';
          this.cdr.markForCheck();
          setTimeout(() => {
            this.successMessage = null;
            this.cdr.markForCheck();
          }, 3000);
        },
        error: (err) => {
          console.error('Error saving profile:', err);
          this.error = 'Failed to save profile. Please try again.';
          this.cdr.markForCheck();
        }
      });
  }

  getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name[0].toUpperCase();
  }

  getStatusBadgeClass(status: string): string {
    const statusMap: { [key: string]: string } = {
      'ACTIVE': 'bg-success',
      'INACTIVE': 'bg-secondary',
      'PENDING': 'bg-warning',
      'SUSPENDED': 'bg-danger'
    };
    return statusMap[status] || 'bg-secondary';
  }

  formatStatus(status: string): string {
    if (!status) return '-';
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
}
