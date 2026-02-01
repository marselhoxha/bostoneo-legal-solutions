import { Component, OnInit, Input, OnDestroy } from '@angular/core';
import { CalendarService } from '../../../services/calendar.service';
import { CalendarEvent } from '../interfaces/calendar-event.interface';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { EventModalComponent } from '../event-modal/event-modal.component';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';
import { CommonModule, DatePipe } from '@angular/common';
import { DeadlineAnalyticsComponent } from '../deadline-analytics/deadline-analytics.component';

@Component({
  selector: 'app-deadline-dashboard',
  templateUrl: './deadline-dashboard.component.html',
  styleUrls: ['./deadline-dashboard.component.scss'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DatePipe, DeadlineAnalyticsComponent]
})
export class DeadlineDashboardComponent implements OnInit, OnDestroy {
  @Input() caseId?: number;
  
  deadlines: CalendarEvent[] = [];
  filteredDeadlines: CalendarEvent[] = [];
  isLoading = true;
  error: string | null = null;
  
  filterForm: FormGroup;
  
  private subscriptions: Subscription[] = [];
  
  // Deadline status options
  statuses = [
    { value: 'all', label: 'All Statuses' },
    { value: 'SCHEDULED', label: 'Scheduled' },
    { value: 'COMPLETED', label: 'Completed' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'CANCELLED', label: 'Cancelled' }
  ];
  
  // Priority options
  priorities = [
    { value: 'all', label: 'All Priorities' },
    { value: 'high', label: 'High Priority' },
    { value: 'normal', label: 'Normal Priority' }
  ];
  
  // Time frame options
  timeFrames = [
    { value: 'all', label: 'All Deadlines' },
    { value: '7', label: 'Next 7 Days' },
    { value: '30', label: 'Next 30 Days' },
    { value: '90', label: 'Next 90 Days' }
  ];
  
  constructor(
    private calendarService: CalendarService,
    private fb: FormBuilder,
    private modalService: NgbModal
  ) {
    this.filterForm = this.fb.group({
      status: ['all'],
      priority: ['all'],
      timeFrame: ['all'],
      search: ['']
    });
  }

  ngOnInit(): void {
    this.loadDeadlines();
    
    // Subscribe to filter changes
    this.subscriptions.push(
      this.filterForm.valueChanges.subscribe(() => {
        this.applyFilters();
      })
    );
  }
  
  ngOnDestroy(): void {
    // Unsubscribe from all subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
  
  loadDeadlines(): void {
    this.isLoading = true;
    
    // Determine which API call to make based on whether caseId is provided
    const deadlinesObs = this.caseId 
      ? this.calendarService.getEventsByCaseId(this.caseId)
      : this.calendarService.getEvents();
    
    this.subscriptions.push(
      deadlinesObs.subscribe({
        next: (events) => {
          // Filter only deadline events
          this.deadlines = events.filter(event => event.eventType === 'DEADLINE');
          
          // Sort by date (earliest first)
          this.deadlines.sort((a, b) => {
            return new Date(a.start).getTime() - new Date(b.start).getTime();
          });
          
          this.applyFilters();
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Error loading deadlines:', err);
          this.error = 'Failed to load deadlines. Please try again.';
          this.isLoading = false;
        }
      })
    );
  }
  
  applyFilters(): void {
    const filters = this.filterForm.value;
    
    // Start with all deadlines
    let result = [...this.deadlines];
    
    // Apply status filter
    if (filters.status !== 'all') {
      result = result.filter(d => d.status === filters.status);
    }
    
    // Apply priority filter
    if (filters.priority === 'high') {
      result = result.filter(d => d.highPriority);
    } else if (filters.priority === 'normal') {
      result = result.filter(d => !d.highPriority);
    }
    
    // Apply time frame filter
    if (filters.timeFrame !== 'all') {
      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(today.getDate() + parseInt(filters.timeFrame));
      
      result = result.filter(d => {
        const deadlineDate = new Date(d.start);
        return deadlineDate >= today && deadlineDate <= futureDate;
      });
    }
    
    // Apply search filter
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      result = result.filter(d => 
        d.title.toLowerCase().includes(searchTerm) || 
        d.description?.toLowerCase().includes(searchTerm) ||
        d.location?.toLowerCase().includes(searchTerm) ||
        d.caseTitle?.toLowerCase().includes(searchTerm) ||
        d.caseNumber?.toString().toLowerCase().includes(searchTerm)
      );
    }
    
    this.filteredDeadlines = result;
  }
  
  resetFilters(): void {
    this.filterForm.patchValue({
      status: 'all',
      priority: 'all',
      timeFrame: 'all',
      search: ''
    });
  }
  
  // Get deadline status based on date and status
  getDeadlineStatus(deadline: CalendarEvent): string {
    if (deadline.status === 'COMPLETED') {
      return 'completed';
    }
    
    if (deadline.status === 'CANCELLED') {
      return 'cancelled';
    }
    
    const deadlineDate = new Date(deadline.start);
    const today = new Date();
    const timeDiff = deadlineDate.getTime() - today.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
    
    if (daysDiff < 0) {
      return 'overdue';
    }
    
    if (daysDiff <= 3) {
      return 'approaching';
    }
    
    return 'upcoming';
  }
  
  getDaysRemaining(deadline: CalendarEvent): string {
    const deadlineDate = new Date(deadline.start);
    const today = new Date();
    const timeDiff = deadlineDate.getTime() - today.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
    
    if (daysDiff < 0) {
      return `${Math.abs(daysDiff)} days overdue`;
    }
    
    if (daysDiff === 0) {
      return 'Due today';
    }
    
    if (daysDiff === 1) {
      return 'Due tomorrow';
    }
    
    return `${daysDiff} days remaining`;
  }
  
  getStatusClass(deadline: CalendarEvent): string {
    const status = this.getDeadlineStatus(deadline);
    
    switch(status) {
      case 'completed': return 'bg-success-subtle text-success';
      case 'cancelled': return 'bg-secondary-subtle text-secondary';
      case 'overdue': return 'bg-danger-subtle text-danger';
      case 'approaching': return 'bg-warning-subtle text-warning';
      default: return 'bg-info-subtle text-info';
    }
  }
  
  // Event operations
  viewDeadline(deadline: CalendarEvent): void {
    const modalRef = this.modalService.open(EventModalComponent, {
      size: 'lg',
      backdrop: 'static',
      centered: true
    });
    
    modalRef.componentInstance.event = deadline;
    modalRef.componentInstance.title = 'Deadline Details';
    modalRef.componentInstance.viewMode = true;
    
    modalRef.result.then(
      (result) => {
        if (result) {
          this.loadDeadlines();
        }
      },
      () => {}
    );
  }
  
  editDeadline(deadline: CalendarEvent): void {
    const modalRef = this.modalService.open(EventModalComponent, {
      size: 'lg',
      backdrop: 'static',
      centered: true
    });
    
    modalRef.componentInstance.event = deadline;
    modalRef.componentInstance.title = 'Edit Deadline';
    modalRef.componentInstance.viewMode = false;
    
    modalRef.result.then(
      (result) => {
        if (result) {
          this.loadDeadlines();
        }
      },
      () => {}
    );
  }
  
  markAsComplete(deadline: CalendarEvent): void {
    if (!deadline.id) return;
    
    Swal.fire({
      title: 'Mark as Complete?',
      text: 'Are you sure you want to mark this deadline as completed?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Complete It',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#0ab39c',
      cancelButtonColor: '#d33'
    }).then((result) => {
      if (result.isConfirmed) {
        // Create minimal update payload with only required fields
        const updatePayload = {
          id: deadline.id,
          title: deadline.title,
          startTime: deadline.startTime || deadline.start,
          eventType: deadline.eventType,
          status: 'COMPLETED' as 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED' | 'PENDING'
        };

        this.calendarService.updateEvent(deadline.id.toString(), updatePayload).subscribe({
          next: () => {
            Swal.fire('Completed!', 'Deadline has been marked as completed.', 'success');
            this.loadDeadlines();
          },
          error: (err) => {
            console.error('Error updating deadline:', err);
            Swal.fire('Error!', 'Could not update deadline status.', 'error');
          }
        });
      }
    });
  }
  
  deleteDeadline(deadline: CalendarEvent): void {
    if (!deadline.id) return;
    
    Swal.fire({
      title: 'Delete Deadline?',
      text: 'Are you sure you want to delete this deadline? This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Delete It',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6'
    }).then((result) => {
      if (result.isConfirmed) {
        this.calendarService.deleteEvent(deadline.id.toString()).subscribe({
          next: () => {
            Swal.fire('Deleted!', 'Deadline has been deleted.', 'success');
            this.loadDeadlines();
          },
          error: (err) => {
            console.error('Error deleting deadline:', err);
            Swal.fire('Error!', 'Could not delete deadline.', 'error');
          }
        });
      }
    });
  }
  
  createDeadline(): void {
    const modalRef = this.modalService.open(EventModalComponent, {
      size: 'lg',
      backdrop: 'static',
      centered: true
    });
    
    // Pre-set the event type to DEADLINE
    const newEvent: Partial<CalendarEvent> = {
      eventType: 'DEADLINE',
      status: 'SCHEDULED',
      start: new Date(),
      end: new Date(new Date().getTime() + 3600000) // 1 hour later
    };
    
    // If a case ID is provided, associate with that case
    if (this.caseId) {
      newEvent.caseId = this.caseId;
    }
    
    modalRef.componentInstance.event = newEvent;
    modalRef.componentInstance.title = 'Create New Deadline';
    modalRef.componentInstance.viewMode = false;
    
    modalRef.result.then(
      (result) => {
        if (result) {
          this.loadDeadlines();
        }
      },
      () => {}
    );
  }
} 
 