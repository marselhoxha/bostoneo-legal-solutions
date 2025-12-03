import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ClientPortalService, ClientProfile } from '../../services/client-portal.service';

@Component({
  selector: 'app-client-profile',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './client-profile.component.html',
  styleUrls: ['./client-profile.component.scss']
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

  constructor(private clientPortalService: ClientPortalService) {}

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

    this.clientPortalService.getProfile()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (profile) => {
          this.profile = profile;
          this.loading = false;
        },
        error: (err) => {
          console.error('Error loading profile:', err);
          this.error = 'Failed to load profile. Please try again.';
          this.loading = false;
        }
      });
  }

  startEditing(): void {
    if (this.profile) {
      this.editForm = { ...this.profile };
      this.isEditing = true;
    }
  }

  cancelEditing(): void {
    this.isEditing = false;
    this.editForm = {};
  }

  saveProfile(): void {
    if (!this.editForm) return;

    this.saving = true;
    this.error = null;

    this.clientPortalService.updateProfile(this.editForm)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (profile) => {
          this.profile = profile;
          this.isEditing = false;
          this.editForm = {};
          this.saving = false;
          this.successMessage = 'Profile updated successfully!';
          setTimeout(() => this.successMessage = null, 3000);
        },
        error: (err) => {
          console.error('Error saving profile:', err);
          this.error = 'Failed to save profile. Please try again.';
          this.saving = false;
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
