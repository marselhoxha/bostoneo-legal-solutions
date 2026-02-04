import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { SuperAdminService } from '../../services/superadmin.service';
import { AnnouncementSummary, Announcement, OrganizationWithStats } from '../../models/superadmin.models';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-announcement-manager',
  templateUrl: './announcement-manager.component.html',
  styleUrls: ['./announcement-manager.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnnouncementManagerComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  announcements: AnnouncementSummary[] = [];
  organizations: OrganizationWithStats[] = [];
  isLoading = true;
  isSending = false;
  error: string | null = null;

  // Pagination
  currentPage = 0;
  pageSize = 10;
  totalElements = 0;
  totalPages = 0;

  // Create announcement form
  showCreateForm = false;
  newAnnouncement: Announcement = {
    title: '',
    message: '',
    type: 'INFO',
    sendToAll: true,
    targetOrganizationIds: [],
    sendImmediately: true
  };

  announcementTypes = [
    { value: 'INFO', label: 'Info', icon: 'ri-information-line', class: 'bg-info-subtle text-info' },
    { value: 'WARNING', label: 'Warning', icon: 'ri-alert-line', class: 'bg-warning-subtle text-warning' },
    { value: 'MAINTENANCE', label: 'Maintenance', icon: 'ri-tools-line', class: 'bg-secondary-subtle text-secondary' },
    { value: 'UPDATE', label: 'Update', icon: 'ri-refresh-line', class: 'bg-success-subtle text-success' }
  ];

  constructor(
    private superAdminService: SuperAdminService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadAnnouncements();
    this.loadOrganizations();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadOrganizations(): void {
    this.superAdminService.getOrganizations(0, 100)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.organizations = response.content;
          this.cdr.markForCheck();
        }
      });
  }

  loadAnnouncements(): void {
    this.isLoading = true;
    this.error = null;
    this.cdr.markForCheck();

    this.superAdminService.getAnnouncements(this.currentPage, this.pageSize)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.announcements = response.content;
          this.totalElements = response.page.totalElements;
          this.totalPages = response.page.totalPages;
          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.error = 'Failed to load announcements';
          this.isLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  toggleCreateForm(): void {
    this.showCreateForm = !this.showCreateForm;
    if (this.showCreateForm) {
      this.resetForm();
    }
    this.cdr.markForCheck();
  }

  resetForm(): void {
    this.newAnnouncement = {
      title: '',
      message: '',
      type: 'INFO',
      sendToAll: true,
      targetOrganizationIds: [],
      sendImmediately: true
    };
  }

  async sendAnnouncement(): Promise<void> {
    if (!this.newAnnouncement.title.trim() || !this.newAnnouncement.message.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Missing Information',
        text: 'Please provide both title and message for the announcement.',
        confirmButtonColor: '#405189'
      });
      return;
    }

    const result = await Swal.fire({
      icon: 'question',
      title: 'Send Announcement?',
      text: this.newAnnouncement.sendToAll
        ? 'This will send the announcement to all users.'
        : `This will send to ${this.newAnnouncement.targetOrganizationIds?.length || 0} organization(s).`,
      showCancelButton: true,
      confirmButtonText: 'Send',
      confirmButtonColor: '#405189',
      cancelButtonColor: '#878a99'
    });

    if (!result.isConfirmed) return;

    this.isSending = true;
    this.cdr.markForCheck();

    this.superAdminService.sendAnnouncement(this.newAnnouncement)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          Swal.fire({
            icon: 'success',
            title: 'Sent!',
            text: 'Announcement has been sent successfully.',
            timer: 2000,
            showConfirmButton: false
          });
          this.isSending = false;
          this.showCreateForm = false;
          this.resetForm();
          this.loadAnnouncements();
        },
        error: () => {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Failed to send announcement. Please try again.',
            confirmButtonColor: '#405189'
          });
          this.isSending = false;
          this.cdr.markForCheck();
        }
      });
  }

  async deleteAnnouncement(announcement: AnnouncementSummary): Promise<void> {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Delete Announcement?',
      text: `Are you sure you want to delete "${announcement.title}"?`,
      showCancelButton: true,
      confirmButtonText: 'Delete',
      confirmButtonColor: '#f06548',
      cancelButtonColor: '#878a99'
    });

    if (!result.isConfirmed) return;

    this.superAdminService.deleteAnnouncement(announcement.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          Swal.fire({
            icon: 'success',
            title: 'Deleted!',
            text: 'Announcement has been deleted.',
            timer: 2000,
            showConfirmButton: false
          });
          this.loadAnnouncements();
        },
        error: () => {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Failed to delete announcement. Please try again.',
            confirmButtonColor: '#405189'
          });
        }
      });
  }

  goToPage(page: number): void {
    if (page >= 0 && page < this.totalPages) {
      this.currentPage = page;
      this.loadAnnouncements();
    }
  }

  getTypeBadge(type: string): { icon: string; class: string } {
    const found = this.announcementTypes.find(t => t.value === type);
    return found || { icon: 'ri-information-line', class: 'bg-secondary-subtle text-secondary' };
  }

  formatDate(dateString: string): string {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  get pageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(0, this.currentPage - Math.floor(maxVisible / 2));
    const end = Math.min(this.totalPages, start + maxVisible);
    if (end - start < maxVisible) start = Math.max(0, end - maxVisible);
    for (let i = start; i < end; i++) pages.push(i);
    return pages;
  }

  onTargetOrgChange(orgId: number, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (!this.newAnnouncement.targetOrganizationIds) {
      this.newAnnouncement.targetOrganizationIds = [];
    }
    if (checked) {
      this.newAnnouncement.targetOrganizationIds.push(orgId);
    } else {
      const idx = this.newAnnouncement.targetOrganizationIds.indexOf(orgId);
      if (idx > -1) {
        this.newAnnouncement.targetOrganizationIds.splice(idx, 1);
      }
    }
  }

  isOrgSelected(orgId: number): boolean {
    return this.newAnnouncement.targetOrganizationIds?.includes(orgId) || false;
  }
}
