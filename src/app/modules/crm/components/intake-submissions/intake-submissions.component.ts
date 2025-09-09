import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { CrmService } from '../../services/crm.service';
import Swal from 'sweetalert2';

export interface IntakeSubmissionDTO {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  practiceArea: string;
  status: string;
  urgency?: string;
  leadScore: number;
  submittedAt: string;
  updatedAt: string;
  description?: string;
  source: string;
  assignedTo?: number;
  assignedToName?: string;
  followUpDate?: string;
  notes?: string;
}

@Component({
  selector: 'app-intake-submissions',
  templateUrl: './intake-submissions.component.html',
  styleUrls: ['./intake-submissions.component.scss']
})
export class IntakeSubmissionsComponent implements OnInit {
  submissions: IntakeSubmissionDTO[] = [];
  filteredSubmissions: IntakeSubmissionDTO[] = [];
  isLoading = true;
  error: string = '';
  
  // Filter properties
  selectedStatus = '';
  selectedPracticeArea = '';
  selectedUrgency = '';
  searchTerm = '';
  
  // Status options
  statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'REVIEWED', label: 'Reviewed' },
    { value: 'CONVERTED_TO_LEAD', label: 'Converted to Lead' },
    { value: 'REJECTED', label: 'Rejected' },
    { value: 'SPAM', label: 'Spam' }
  ];
  
  // Practice area options
  practiceAreaOptions = [
    { value: '', label: 'All Practice Areas' },
    { value: 'Personal Injury', label: 'Personal Injury' },
    { value: 'Family Law', label: 'Family Law' },
    { value: 'Criminal Defense', label: 'Criminal Defense' },
    { value: 'Business Law', label: 'Business Law' },
    { value: 'Real Estate Law', label: 'Real Estate Law' },
    { value: 'Immigration Law', label: 'Immigration Law' }
  ];
  
  // Urgency options
  urgencyOptions = [
    { value: '', label: 'All Urgency Levels' },
    { value: 'LOW', label: 'Low' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'HIGH', label: 'High' },
    { value: 'URGENT', label: 'Urgent' }
  ];
  
  // Pagination
  currentPage = 0;
  pageSize = 10;
  totalElements = 0;
  totalPages = 0;
  
  // Selected submissions for bulk actions
  selectedSubmissions = new Set<number>();
  selectAll = false;
  
  // Make Math available in template
  Math = Math;

  constructor(
    private crmService: CrmService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    console.log('🚀 COMPONENT LOADED - IntakeSubmissionsComponent ngOnInit called');
    console.log('🚀 Component initialized, about to load submissions...');
    this.loadSubmissions();
  }

  loadSubmissions(): void {
    this.isLoading = true;
    this.error = '';
    this.cdr.detectChanges();
    
    // Load all submissions at once (like activities page)
    const params: any = {
      page: 0,
      size: 100 // Load more submissions at once
    };
    
    console.log('📤 Loading all submissions for client-side pagination');
    
    this.crmService.getIntakeSubmissions$(params).subscribe({
      next: (response: any) => {
        console.log('📊 Raw Backend Response:', response);
        
        // Handle different response structures
        let dataArray: any[] = [];
        
        if (response && response.content && Array.isArray(response.content)) {
          dataArray = response.content;
          this.totalElements = response.totalElements || response.content.length;
        } else if (Array.isArray(response)) {
          dataArray = response;
          this.totalElements = response.length;
        } else if (response && typeof response === 'object') {
          const possibleArrays = ['data', 'items', 'results', 'submissions'];
          for (const key of possibleArrays) {
            if (response[key] && Array.isArray(response[key])) {
              dataArray = response[key];
              break;
            }
          }
          if (dataArray.length === 0) {
            const responseKeys = Object.keys(response);
            if (responseKeys.some(key => response[key] && typeof response[key] === 'object' && response[key].id)) {
              dataArray = Object.values(response).filter((item: any) => item && typeof item === 'object' && item.id);
            }
          }
          this.totalElements = dataArray.length;
        } else {
          console.warn('⚠️ No valid data structure found');
        }
        
        if (dataArray.length > 0) {
          console.log('🔄 Processing', dataArray.length, 'submissions');
          this.submissions = this.mapSubmissions(dataArray);
          // Apply filters after loading all data
          this.applyFilters();
          console.log('✅ Successfully processed', this.submissions.length, 'submissions');
        } else {
          this.submissions = [];
          this.filteredSubmissions = [];
          this.totalElements = 0;
          console.log('⚠️ No submissions found in response');
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('❌ Error loading submissions:', error);
        
        if (error.status === 401) {
          this.error = 'Authentication required. Please log in to access intake submissions.';
        } else if (error.status === 404) {
          this.error = 'API endpoint not found. Please check backend configuration.';
        } else if (error.status === 500) {
          this.error = 'Server error. Please check backend logs.';
        } else if (error.status === 0) {
          this.error = 'Cannot connect to backend. Please ensure the backend is running on port 8085.';
        } else {
          this.error = `Failed to load submissions. Error: ${error.message || 'Unknown error'}`;
        }
        
        this.isLoading = false;
        this.submissions = [];
        this.filteredSubmissions = [];
        this.totalElements = 0;
        this.cdr.detectChanges();
      }
    });
  }

  private mapSubmissions(backendSubmissions: any[]): IntakeSubmissionDTO[] {
    return backendSubmissions.map(submission => {
      console.log('🔍 Mapping submission:', submission.id, submission);
      
      // Parse submissionData if it's a string
      let parsedSubmissionData = submission.submissionData;
      if (typeof submission.submissionData === 'string') {
        try {
          parsedSubmissionData = JSON.parse(submission.submissionData);
        } catch (e) {
          console.warn('Could not parse submissionData for submission', submission.id);
          parsedSubmissionData = {};
        }
      }
      
      // Extract name parts from clientName or submissionData
      const clientName = submission.clientName || (parsedSubmissionData?.firstName + ' ' + parsedSubmissionData?.lastName)?.trim() || '';
      const nameParts = clientName.split(' ').filter(part => part.length > 0);
      const firstName = parsedSubmissionData?.firstName || parsedSubmissionData?.first_name || nameParts[0] || 'Unknown';
      const lastName = parsedSubmissionData?.lastName || parsedSubmissionData?.last_name || nameParts.slice(1).join(' ') || 'User';
      
      const mappedSubmission = {
        id: submission.id,
        firstName: firstName,
        lastName: lastName,
        email: submission.clientEmail || parsedSubmissionData?.email || '',
        phone: submission.clientPhone || parsedSubmissionData?.phone || '',
        practiceArea: submission.practiceArea || submission.formTitle?.replace(' Intake Form', '') || 'General',
        status: submission.status || 'PENDING',
        urgency: submission.urgency || '',
        leadScore: submission.priorityScore || 50,
        submittedAt: submission.createdAt || submission.submittedAt,
        updatedAt: submission.updatedAt,
        description: parsedSubmissionData?.description || parsedSubmissionData?.incidentDescription || parsedSubmissionData?.incident_description || '',
        source: submission.source || 'Website Form',
        assignedTo: submission.reviewedBy,
        assignedToName: submission.reviewerName,
        followUpDate: submission.followUpDate,
        notes: submission.notes
      };
      
      console.log('✅ Mapped submission:', mappedSubmission);
      return mappedSubmission;
    });
  }

  applyFilters(): void {
    let filtered = [...this.submissions];
    
    if (this.selectedStatus) {
      filtered = filtered.filter(s => s.status === this.selectedStatus);
    }
    
    if (this.selectedPracticeArea) {
      filtered = filtered.filter(s => s.practiceArea === this.selectedPracticeArea);
    }
    
    if (this.selectedUrgency) {
      filtered = filtered.filter(s => s.urgency === this.selectedUrgency);
    }
    
    if (this.searchTerm && this.searchTerm.trim()) {
      const search = this.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(s => 
        s.firstName.toLowerCase().includes(search) ||
        s.lastName.toLowerCase().includes(search) ||
        s.email.toLowerCase().includes(search) ||
        s.phone.includes(search) ||
        (s.description && s.description.toLowerCase().includes(search))
      );
    }
    
    this.filteredSubmissions = filtered;
    this.totalPages = Math.ceil(this.filteredSubmissions.length / this.pageSize);
    // Reset to first page when filters change
    this.currentPage = 0;
  }

  onFilterChange(): void {
    this.applyFilters();
    this.cdr.detectChanges();
  }

  onSearch(): void {
    this.applyFilters();
    this.cdr.detectChanges();
  }

  clearFilters(): void {
    this.selectedStatus = '';
    this.selectedPracticeArea = '';
    this.selectedUrgency = '';
    this.searchTerm = '';
    this.applyFilters();
    this.cdr.detectChanges();
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'PENDING': return 'badge bg-warning-subtle text-warning';
      case 'REVIEWED': return 'badge bg-info-subtle text-info';
      case 'CONVERTED_TO_LEAD': return 'badge bg-success-subtle text-success';
      case 'REJECTED': return 'badge bg-danger-subtle text-danger';
      case 'SPAM': return 'badge bg-secondary-subtle text-secondary';
      default: return 'badge bg-light text-dark';
    }
  }

  getUrgencyBadgeClass(urgency?: string): string {
    if (!urgency) return 'badge bg-light text-dark';
    
    switch (urgency) {
      case 'LOW': return 'badge bg-success-subtle text-success';
      case 'MEDIUM': return 'badge bg-warning-subtle text-warning';
      case 'HIGH': return 'badge bg-danger-subtle text-danger';
      case 'URGENT': return 'badge bg-danger text-white';
      default: return 'badge bg-light text-dark';
    }
  }

  getLeadScoreClass(score: number): string {
    if (score >= 80) return 'text-success fw-bold';
    if (score >= 60) return 'text-warning fw-bold';
    return 'text-danger fw-bold';
  }

  onSubmissionAction(submissionId: number, action: string): void {
    const submission = this.submissions.find(s => s.id === submissionId);
    if (!submission) return;

    switch (action) {
      case 'review':
        this.reviewSubmission(submission);
        break;
      case 'approve':
        this.approveSubmission(submission);
        break;
      case 'reject':
        this.rejectSubmission(submission);
        break;
      case 'assign':
        this.assignSubmission(submission);
        break;
      case 'spam':
        this.markAsSpam(submission);
        break;
      default:
        console.log(`Action ${action} on submission ${submissionId}`);
    }
  }

  onBulkAction(action: string): void {
    if (this.selectedSubmissions.size === 0) {
      Swal.fire({
        title: 'No Selection',
        text: 'Please select at least one submission to perform bulk actions.',
        icon: 'warning',
        confirmButtonText: 'OK',
        confirmButtonColor: '#ffc107'
      });
      return;
    }

    const selectedSubmissionsList = this.submissions.filter(s => 
      this.selectedSubmissions.has(s.id)
    );

    switch (action) {
      case 'approve':
        this.bulkApproveSubmissions(selectedSubmissionsList);
        break;
      case 'reject':
        this.bulkRejectSubmissions(selectedSubmissionsList);
        break;
      case 'assign':
        this.bulkAssignSubmissions(selectedSubmissionsList);
        break;
      case 'spam':
        this.bulkMarkAsSpam(selectedSubmissionsList);
        break;
      default:
        console.log(`Bulk action ${action} on submissions:`, Array.from(this.selectedSubmissions));
    }
  }

  private reviewSubmission(submission: IntakeSubmissionDTO): void {
    Swal.fire({
      title: 'Review Submission',
      text: `Review submission from ${submission.firstName} ${submission.lastName}?`,
      input: 'textarea',
      inputPlaceholder: 'Add review notes (optional)...',
      showCancelButton: true,
      confirmButtonText: 'Review',
      confirmButtonColor: '#28a745',
      cancelButtonColor: '#6c757d',
      showLoaderOnConfirm: true,
      preConfirm: (notes) => {
        return this.crmService.reviewSubmission(submission.id, notes || '').toPromise()
          .then((updatedSubmission: any) => {
            return updatedSubmission;
          })
          .catch(error => {
            Swal.showValidationMessage(`Request failed: ${error.message}`);
          });
      },
      allowOutsideClick: () => !Swal.isLoading()
    }).then((result) => {
      if (result.isConfirmed) {
        submission.status = 'REVIEWED';
        submission.updatedAt = new Date().toISOString();
        this.cdr.detectChanges();
        Swal.fire('Reviewed!', 'Submission has been marked as reviewed.', 'success');
      }
    });
  }

  private approveSubmission(submission: IntakeSubmissionDTO): void {
    Swal.fire({
      title: 'Convert to Lead',
      text: `Convert ${submission.firstName} ${submission.lastName} to a lead?`,
      input: 'textarea',
      inputPlaceholder: 'Add conversion notes (optional)...',
      showCancelButton: true,
      confirmButtonText: 'Convert',
      confirmButtonColor: '#007bff',
      cancelButtonColor: '#6c757d',
      showLoaderOnConfirm: true,
      preConfirm: (notes) => {
        return this.crmService.convertToLead(submission.id, 1, notes || '').toPromise()
          .then((result: any) => {
            return result;
          })
          .catch(error => {
            Swal.showValidationMessage(`Request failed: ${error.message}`);
          });
      },
      allowOutsideClick: () => !Swal.isLoading()
    }).then((result) => {
      if (result.isConfirmed) {
        submission.status = 'CONVERTED_TO_LEAD';
        submission.updatedAt = new Date().toISOString();
        this.cdr.detectChanges();
        Swal.fire('Converted!', 'Submission has been converted to a lead.', 'success');
      }
    });
  }

  private rejectSubmission(submission: IntakeSubmissionDTO): void {
    Swal.fire({
      title: 'Reject Submission',
      text: `Are you sure you want to reject the submission from ${submission.firstName} ${submission.lastName}?`,
      input: 'textarea',
      inputPlaceholder: 'Reason for rejection...',
      inputValidator: (value) => {
        if (!value) {
          return 'You need to provide a reason for rejection!';
        }
        return null;
      },
      showCancelButton: true,
      confirmButtonText: 'Reject',
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      showLoaderOnConfirm: true,
      preConfirm: (reason) => {
        return this.crmService.rejectSubmission(submission.id, reason).toPromise()
          .then((updatedSubmission: any) => {
            return updatedSubmission;
          })
          .catch(error => {
            Swal.showValidationMessage(`Request failed: ${error.message}`);
          });
      },
      allowOutsideClick: () => !Swal.isLoading()
    }).then((result) => {
      if (result.isConfirmed) {
        submission.status = 'REJECTED';
        submission.updatedAt = new Date().toISOString();
        this.cdr.detectChanges();
        Swal.fire('Rejected!', 'Submission has been rejected.', 'success');
      }
    });
  }

  private assignSubmission(submission: IntakeSubmissionDTO): void {
    // Mock assignment - in real app, would show assignment modal
    submission.assignedTo = 1;
    submission.assignedToName = 'John Attorney';
    submission.updatedAt = new Date().toISOString();
    this.cdr.detectChanges();
    console.log('Submission assigned:', submission.id);
  }

  private markAsSpam(submission: IntakeSubmissionDTO): void {
    Swal.fire({
      title: 'Mark as Spam',
      text: `Are you sure you want to mark the submission from ${submission.firstName} ${submission.lastName} as spam?`,
      input: 'textarea',
      inputPlaceholder: 'Reason for marking as spam...',
      inputValidator: (value) => {
        if (!value) {
          return 'You need to provide a reason for marking as spam!';
        }
        return null;
      },
      showCancelButton: true,
      confirmButtonText: 'Mark as Spam',
      confirmButtonColor: '#ffc107',
      cancelButtonColor: '#6c757d',
      showLoaderOnConfirm: true,
      preConfirm: (reason) => {
        return this.crmService.markAsSpam(submission.id, reason).toPromise()
          .then((updatedSubmission: any) => {
            return updatedSubmission;
          })
          .catch(error => {
            Swal.showValidationMessage(`Request failed: ${error.message}`);
          });
      },
      allowOutsideClick: () => !Swal.isLoading()
    }).then((result) => {
      if (result.isConfirmed) {
        submission.status = 'SPAM';
        submission.updatedAt = new Date().toISOString();
        this.cdr.detectChanges();
        Swal.fire('Marked as Spam!', 'Submission has been marked as spam.', 'success');
      }
    });
  }

  private bulkApproveSubmissions(submissions: IntakeSubmissionDTO[]): void {
    Swal.fire({
      title: 'Bulk Convert to Leads',
      text: `Convert ${submissions.length} submissions to leads?`,
      input: 'textarea',
      inputPlaceholder: 'Add conversion notes (optional)...',
      showCancelButton: true,
      confirmButtonText: `Convert ${submissions.length} Submissions`,
      confirmButtonColor: '#007bff',
      cancelButtonColor: '#6c757d',
      showLoaderOnConfirm: true,
      preConfirm: (notes) => {
        const submissionIds = submissions.map(s => s.id);
        return this.crmService.bulkConvertToLead(submissionIds, 1, notes || '').toPromise()
          .then((results: any[]) => {
            return results;
          })
          .catch(error => {
            Swal.showValidationMessage(`Request failed: ${error.message}`);
          });
      },
      allowOutsideClick: () => !Swal.isLoading()
    }).then((result) => {
      if (result.isConfirmed) {
        submissions.forEach(submission => {
          submission.status = 'CONVERTED_TO_LEAD';
          submission.updatedAt = new Date().toISOString();
        });
        this.selectedSubmissions.clear();
        this.selectAll = false;
        this.cdr.detectChanges();
        Swal.fire('Converted!', `${submissions.length} submissions have been converted to leads.`, 'success');
      }
    });
  }

  private bulkRejectSubmissions(submissions: IntakeSubmissionDTO[]): void {
    Swal.fire({
      title: 'Bulk Reject Submissions',
      text: `Are you sure you want to reject ${submissions.length} submissions?`,
      input: 'textarea',
      inputPlaceholder: 'Reason for bulk rejection...',
      inputValidator: (value) => {
        if (!value) {
          return 'You need to provide a reason for bulk rejection!';
        }
        return null;
      },
      showCancelButton: true,
      confirmButtonText: `Reject ${submissions.length} Submissions`,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      showLoaderOnConfirm: true,
      preConfirm: (reason) => {
        const submissionIds = submissions.map(s => s.id);
        return this.crmService.bulkReject(submissionIds, reason).toPromise()
          .then((results: any[]) => {
            return results;
          })
          .catch(error => {
            Swal.showValidationMessage(`Request failed: ${error.message}`);
          });
      },
      allowOutsideClick: () => !Swal.isLoading()
    }).then((result) => {
      if (result.isConfirmed) {
        submissions.forEach(submission => {
          submission.status = 'REJECTED';
          submission.updatedAt = new Date().toISOString();
        });
        this.selectedSubmissions.clear();
        this.selectAll = false;
        this.cdr.detectChanges();
        Swal.fire('Rejected!', `${submissions.length} submissions have been rejected.`, 'success');
      }
    });
  }

  private bulkAssignSubmissions(submissions: IntakeSubmissionDTO[]): void {
    // Mock assignment - in real app, would show assignment modal
    submissions.forEach(submission => {
      submission.assignedTo = 1;
      submission.assignedToName = 'John Attorney';
      submission.updatedAt = new Date().toISOString();
    });
    this.selectedSubmissions.clear();
    this.selectAll = false;
    this.cdr.detectChanges();
    console.log('Bulk assigned submissions:', submissions.length);
  }

  private bulkMarkAsSpam(submissions: IntakeSubmissionDTO[]): void {
    Swal.fire({
      title: 'Bulk Mark as Spam',
      text: `Are you sure you want to mark ${submissions.length} submissions as spam?`,
      input: 'textarea',
      inputPlaceholder: 'Reason for marking as spam...',
      inputValidator: (value) => {
        if (!value) {
          return 'You need to provide a reason for marking as spam!';
        }
        return null;
      },
      showCancelButton: true,
      confirmButtonText: `Mark ${submissions.length} as Spam`,
      confirmButtonColor: '#ffc107',
      cancelButtonColor: '#6c757d',
      showLoaderOnConfirm: true,
      preConfirm: (reason) => {
        const submissionIds = submissions.map(s => s.id);
        return this.crmService.bulkMarkAsSpam(submissionIds, reason).toPromise()
          .then((results: any[]) => {
            return results;
          })
          .catch(error => {
            Swal.showValidationMessage(`Request failed: ${error.message}`);
          });
      },
      allowOutsideClick: () => !Swal.isLoading()
    }).then((result) => {
      if (result.isConfirmed) {
        submissions.forEach(submission => {
          submission.status = 'SPAM';
          submission.updatedAt = new Date().toISOString();
        });
        this.selectedSubmissions.clear();
        this.selectAll = false;
        this.cdr.detectChanges();
        Swal.fire('Marked as Spam!', `${submissions.length} submissions have been marked as spam.`, 'success');
      }
    });
  }

  toggleSelection(submissionId: number): void {
    if (this.selectedSubmissions.has(submissionId)) {
      this.selectedSubmissions.delete(submissionId);
    } else {
      this.selectedSubmissions.add(submissionId);
    }
    this.updateSelectAllState();
  }

  toggleSelectAll(): void {
    if (this.selectAll) {
      this.selectedSubmissions.clear();
    } else {
      this.filteredSubmissions.forEach(s => this.selectedSubmissions.add(s.id));
    }
    this.selectAll = !this.selectAll;
  }

  private updateSelectAllState(): void {
    const visibleIds = this.filteredSubmissions.map(s => s.id);
    this.selectAll = visibleIds.every(id => this.selectedSubmissions.has(id));
  }

  formatDateTime(dateString: string): string {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString();
  }

  getPendingCount(): number {
    return this.submissions.filter(s => s.status === 'PENDING').length;
  }

  getReviewedCount(): number {
    return this.submissions.filter(s => s.status === 'REVIEWED').length;
  }

  getConvertedCount(): number {
    return this.submissions.filter(s => s.status === 'CONVERTED_TO_LEAD').length;
  }

  getHighUrgencyCount(): number {
    return this.submissions.filter(s => s.urgency === 'HIGH' || s.urgency === 'URGENT').length;
  }

  getConversionRate(): number {
    if (this.submissions.length === 0) return 0;
    return Math.round((this.getConvertedCount() / this.submissions.length) * 100);
  }

  // Business logic for contextual action buttons
  canReview(submission: IntakeSubmissionDTO): boolean {
    return submission.status === 'PENDING';
  }

  canConvertToLead(submission: IntakeSubmissionDTO): boolean {
    return submission.status === 'PENDING' || submission.status === 'REVIEWED';
  }

  canReject(submission: IntakeSubmissionDTO): boolean {
    return submission.status === 'PENDING' || submission.status === 'REVIEWED';
  }

  canMarkAsSpam(submission: IntakeSubmissionDTO): boolean {
    return submission.status !== 'SPAM' && submission.status !== 'CONVERTED_TO_LEAD';
  }

  isSubmissionFinal(submission: IntakeSubmissionDTO): boolean {
    const finalStatuses = ['SPAM', 'REJECTED', 'CONVERTED_TO_LEAD'];
    return finalStatuses.includes(submission.status);
  }

  getAvailableActionsCount(submission: IntakeSubmissionDTO): number {
    let count = 1; // View Details is always available
    
    if (this.canReview(submission)) count++;
    if (this.canConvertToLead(submission)) count++;
    if (this.canReject(submission)) count++;
    if (this.canMarkAsSpam(submission)) count++;
    
    return count;
  }

  // Bulk action contextual logic
  canBulkApprove(): boolean {
    const selectedSubmissionsList = this.submissions.filter(s => 
      this.selectedSubmissions.has(s.id)
    );
    return selectedSubmissionsList.some(s => this.canConvertToLead(s));
  }

  canBulkReject(): boolean {
    const selectedSubmissionsList = this.submissions.filter(s => 
      this.selectedSubmissions.has(s.id)
    );
    return selectedSubmissionsList.some(s => this.canReject(s));
  }

  canBulkMarkAsSpam(): boolean {
    const selectedSubmissionsList = this.submissions.filter(s => 
      this.selectedSubmissions.has(s.id)
    );
    return selectedSubmissionsList.some(s => this.canMarkAsSpam(s));
  }

  getBulkEligibleCount(action: string): number {
    const selectedSubmissionsList = this.submissions.filter(s => 
      this.selectedSubmissions.has(s.id)
    );
    
    switch (action) {
      case 'approve':
        return selectedSubmissionsList.filter(s => this.canConvertToLead(s)).length;
      case 'reject':
        return selectedSubmissionsList.filter(s => this.canReject(s)).length;
      case 'spam':
        return selectedSubmissionsList.filter(s => this.canMarkAsSpam(s)).length;
      default:
        return 0;
    }
  }

  viewSubmissionDetails(submissionId: number): void {
    const submission = this.submissions.find(s => s.id === submissionId);
    if (!submission) return;
    
    const details = `
    <div class="text-start">
      <p><strong>Name:</strong> ${submission.firstName} ${submission.lastName}</p>
      <p><strong>Email:</strong> ${submission.email}</p>
      <p><strong>Phone:</strong> ${submission.phone}</p>
      <p><strong>Practice Area:</strong> ${submission.practiceArea}</p>
      <p><strong>Status:</strong> <span class="badge ${this.getStatusBadgeClass(submission.status)}">${submission.status.replace('_', ' ')}</span></p>
      <p><strong>Urgency:</strong> <span class="badge ${this.getUrgencyBadgeClass(submission.urgency)}">${submission.urgency || 'Not specified'}</span></p>
      <p><strong>Lead Score:</strong> ${submission.leadScore}%</p>
      <p><strong>Source:</strong> ${submission.source}</p>
      <p><strong>Description:</strong> ${submission.description || 'N/A'}</p>
      <p><strong>Submitted:</strong> ${this.formatDateTime(submission.submittedAt)}</p>
      <p><strong>Assigned To:</strong> ${submission.assignedToName || 'Unassigned'}</p>
    </div>
    `;
    
    Swal.fire({
      title: `<i class="ri-file-text-line me-2"></i>Submission Details`,
      html: details,
      width: '600px',
      confirmButtonText: 'Close',
      confirmButtonColor: '#6c757d',
      showCancelButton: false
    });
  }

  convertToLead(submissionId: number): void {
    const submission = this.submissions.find(s => s.id === submissionId);
    if (!submission) return;
    
    Swal.fire({
      title: 'Convert to Lead',
      text: `Convert submission from ${submission.firstName} ${submission.lastName} to a lead?`,
      input: 'textarea',
      inputPlaceholder: 'Add conversion notes (optional)...',
      showCancelButton: true,
      confirmButtonText: 'Convert to Lead',
      confirmButtonColor: '#007bff',
      cancelButtonColor: '#6c757d',
      showLoaderOnConfirm: true,
      preConfirm: (notes) => {
        return this.crmService.convertToLead(submission.id, 1, notes || '').toPromise()
          .then((result: any) => {
            return result;
          })
          .catch(error => {
            Swal.showValidationMessage(`Request failed: ${error.message}`);
          });
      },
      allowOutsideClick: () => !Swal.isLoading()
    }).then((result) => {
      if (result.isConfirmed) {
        submission.status = 'CONVERTED_TO_LEAD';
        submission.updatedAt = new Date().toISOString();
        this.cdr.detectChanges();
        
        Swal.fire({
          title: 'Converted!',
          text: 'Submission has been converted to a lead.',
          icon: 'success',
          confirmButtonText: 'Go to Leads',
          showCancelButton: true,
          cancelButtonText: 'Stay Here'
        }).then((navResult) => {
          if (navResult.isConfirmed) {
            this.router.navigate(['/crm/leads']);
          }
        });
      }
    });
  }

  // Client-side pagination methods (like activities page)
  previousPage(): void {
    if (this.currentPage > 0) {
      this.currentPage--;
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages - 1) {
      this.currentPage++;
    }
  }

  goToPage(page: number): void {
    this.currentPage = page;
  }

  // Pagination helpers (like activities page)
  get paginatedSubmissions(): IntakeSubmissionDTO[] {
    const startIndex = this.currentPage * this.pageSize;
    return this.filteredSubmissions.slice(startIndex, startIndex + this.pageSize);
  }

  get hasPreviousPage(): boolean {
    return this.currentPage > 0;
  }

  get hasNextPage(): boolean {
    return (this.currentPage + 1) * this.pageSize < this.filteredSubmissions.length;
  }

  get pageInfo(): string {
    const start = this.currentPage * this.pageSize + 1;
    const end = Math.min((this.currentPage + 1) * this.pageSize, this.filteredSubmissions.length);
    return `${start}-${end} of ${this.filteredSubmissions.length}`;
  }

  // Get visible page numbers for pagination
  getVisiblePages(): number[] {
    const pages: number[] = [];
    const maxVisible = 5;
    
    if (this.totalPages <= maxVisible) {
      // Show all pages if total pages is less than or equal to max visible
      for (let i = 0; i < this.totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show a subset of pages around current page
      const startPage = Math.max(0, this.currentPage - Math.floor(maxVisible / 2));
      const endPage = Math.min(this.totalPages - 1, startPage + maxVisible - 1);
      
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
    }
    return pages;
  }


  getItemRangeText(): string {
    if (this.totalElements === 0) return 'No entries';
    
    const start = this.currentPage * this.pageSize + 1;
    const end = Math.min((this.currentPage + 1) * this.pageSize, this.totalElements);
    
    return `${start} to ${end} of ${this.totalElements}`;
  }
}