import { Component, OnInit, ChangeDetectorRef, AfterViewInit, ElementRef, ViewChildren, QueryList } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { LegalCase, CaseStatus, CasePriority, PaymentStatus } from '../../../interfaces/case.interface';
import { CaseService } from '../../../services/case.service';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { FlatpickrModule } from 'angularx-flatpickr';
import flatpickr from 'flatpickr';
import { CaseNotesComponent } from '../case-notes/case-notes.component';
import { CaseDocumentsComponent } from '../case-documents/case-documents.component';
import { CaseTimelineComponent } from '../case-timeline/case-timeline.component';
import { CalendarService } from '../../../services/calendar.service';
import { CalendarEvent } from '../../../interfaces/calendar-event.interface';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { EventModalComponent } from '../../../components/calendar/event-modal/event-modal.component';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-case-detail',
  templateUrl: './case-detail.component.html',
  styleUrls: ['./case-detail.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    FlatpickrModule,
    CaseNotesComponent,
    CaseDocumentsComponent,
    CaseTimelineComponent
  ]
})
export class CaseDetailComponent implements OnInit, AfterViewInit {
  case: LegalCase | null = null;
  isLoading = false;
  error: string | null = null;
  isEditing = false;
  editForm: FormGroup;
  caseForm: FormGroup;
  
  // Events related properties
  caseEvents: CalendarEvent[] = [];
  isLoadingEvents = false;

  @ViewChildren('filingDate, nextHearing, trialDate') dateInputs: QueryList<ElementRef>;

  // Status and priority values for dropdowns
  caseStatuses = Object.values(CaseStatus);
  casePriorities = Object.values(CasePriority);
  paymentStatuses = Object.values(PaymentStatus);
  
  // Case types
  caseTypes = ['CIVIL', 'CRIMINAL', 'FAMILY', 'BUSINESS', 'REAL_ESTATE', 'IMMIGRATION', 'INTELLECTUAL_PROPERTY', 'OTHER'];
  
  private flatpickrInstances: any[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private caseService: CaseService,
    private calendarService: CalendarService,
    private modalService: NgbModal,
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) {
    this.editForm = this.fb.group({
      caseNumber: ['', Validators.required],
      title: ['', Validators.required],
      clientName: ['', Validators.required],
      clientEmail: [''],
      clientPhone: [''],
      clientAddress: [''],
      status: [CaseStatus.OPEN, Validators.required],
      priority: [CasePriority.MEDIUM, Validators.required],
      type: [''],
      description: ['', Validators.required],
      courtName: [''],
      judgeName: [''],
      courtroom: [''],
      filingDate: [null],
      nextHearing: [null],
      trialDate: [null],
      hourlyRate: [0],
      totalHours: [0],
      totalAmount: [0],
      paymentStatus: [PaymentStatus.PENDING]
    });

    this.caseForm = this.fb.group({
      caseNumber: [''],
      status: [''],
      filingDate: [''],
      nextHearing: [''],
      trialDate: [''],
      judge: [''],
      court: [''],
      jurisdiction: [''],
      description: ['']
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadCase(id);
    } else {
      this.error = 'Case ID not provided';
    }
  }

  ngAfterViewInit(): void {
    // Initialize flatpickr when in edit mode
    if (this.dateInputs && this.dateInputs.length > 0) {
      this.dateInputs.forEach(input => {
        this.initDatePicker(null, input.nativeElement.id);
      });
    }
  }

  // Method to initialize a single date picker
  initDatePicker(event: Event, controlName: string): void {
    const input = event.target as HTMLInputElement;
    if (input) {
      // Destroy any existing instance for this input
      const existingInstance = this.flatpickrInstances.find(instance => 
        instance.input === input
      );
      
      if (existingInstance) {
        existingInstance.destroy();
        this.flatpickrInstances = this.flatpickrInstances.filter(instance => 
          instance !== existingInstance
        );
      }
      
      // Create a new instance
      const instance = flatpickr(input, {
        dateFormat: 'Y-m-d',
        altInput: true,
        altFormat: 'F j, Y',
        allowInput: true,
        defaultDate: this.editForm.get(controlName)?.value || new Date(),
        onChange: (selectedDates) => {
          if (selectedDates.length > 0) {
            this.editForm.get(controlName)?.setValue(selectedDates[0]);
          }
        }
      });
      
      this.flatpickrInstances.push(instance);
      
      // Open the calendar immediately
      instance.open();
    }
  }

  private initializeFlatpickr(): void {
    // Destroy any existing instances first
    this.destroyFlatpickrInstances();
    
    // Wait for the DOM to be ready
    setTimeout(() => {
      // Initialize new instances
      this.dateInputs.forEach(input => {
        const controlName = input.nativeElement.id;
        const formControl = this.editForm.get(controlName);
        
        if (formControl) {
          // Get current value
          const currentValue = formControl.value;
          
          // Parse date if it's a string
          let defaultDate = null;
          if (currentValue) {
            defaultDate = typeof currentValue === 'string' ? new Date(currentValue) : currentValue;
          }
          
          console.log(`Initializing flatpickr for ${controlName}:`, { 
            currentValue, 
            defaultDate,
            element: input.nativeElement
          });
          
          // Create a new flatpickr instance
          const instance = flatpickr(input.nativeElement, {
            dateFormat: 'Y-m-d',
            altInput: true,
            altFormat: 'F j, Y',
            allowInput: true,
            defaultDate: defaultDate,
            onChange: (selectedDates) => {
              if (selectedDates.length > 0) {
                formControl.setValue(selectedDates[0]);
                console.log(`Date changed for ${controlName}:`, selectedDates[0]);
              }
            }
          });
          
          this.flatpickrInstances.push(instance);
        }
      });
    }, 100); // Short delay to ensure DOM is ready
  }

  private destroyFlatpickrInstances(): void {
    this.flatpickrInstances.forEach(instance => {
      if (instance && typeof instance.destroy === 'function') {
        instance.destroy();
      }
    });
    this.flatpickrInstances = [];
  }

  toggleEdit(): void {
    this.isEditing = !this.isEditing;
    if (this.isEditing) {
      this.updateFormWithCaseData();
      // Force change detection to update the view
      this.cdr.detectChanges();
      // Initialize Flatpickr after view updates with a longer timeout
      setTimeout(() => {
        this.initializeFlatpickr();
      }, 500);
    } else {
      // Clean up flatpickr instances when exiting edit mode
      this.destroyFlatpickrInstances();
    }
  }

  updateFormWithCaseData(): void {
    if (this.case) {
      // Extract values with proper null checks
      const filingDate = this.case.importantDates?.filingDate || (this.case as any).filingDate;
      const nextHearing = this.case.importantDates?.nextHearing || (this.case as any).nextHearing;
      const trialDate = this.case.importantDates?.trialDate || (this.case as any).trialDate;
      
      const courtName = this.case.courtInfo?.courtName || (this.case as any).courtName;
      const judgeName = this.case.courtInfo?.judgeName || (this.case as any).judgeName;
      const courtroom = this.case.courtInfo?.courtroom || (this.case as any).courtroom;
      
      const hourlyRate = this.case.billingInfo?.hourlyRate || (this.case as any).hourlyRate || 0;
      const totalHours = this.case.billingInfo?.totalHours || (this.case as any).totalHours || 0;
      const totalAmount = this.case.billingInfo?.totalAmount || (this.case as any).totalAmount || 0;
      const paymentStatus = this.case.billingInfo?.paymentStatus || (this.case as any).paymentStatus || 'PENDING';
      
      console.log('Billing info before form update:', {
        hourlyRate, totalHours, totalAmount, paymentStatus
      });

      this.editForm.patchValue({
        caseNumber: this.case.caseNumber,
        title: this.case.title,
        clientName: this.case.clientName,
        clientEmail: this.case.clientEmail,
        clientPhone: this.case.clientPhone,
        clientAddress: this.case.clientAddress,
        status: this.case.status,
        priority: this.case.priority,
        type: this.case.type,
        description: this.case.description,
        courtName,
        judgeName,
        courtroom,
        filingDate: filingDate ? new Date(filingDate) : null,
        nextHearing: nextHearing ? new Date(nextHearing) : null,
        trialDate: trialDate ? new Date(trialDate) : null,
        hourlyRate,
        totalHours,
        totalAmount,
        paymentStatus
      });

      this.caseForm.patchValue({
        caseNumber: this.case.caseNumber,
        status: this.case.status,
        filingDate: filingDate ? new Date(filingDate) : null,
        nextHearing: nextHearing ? new Date(nextHearing) : null,
        trialDate: trialDate ? new Date(trialDate) : null,
        judge: judgeName,
        court: courtName,
        jurisdiction: courtroom,
        description: this.case.description
      });
    }
  }

  loadCase(id: string): void {
    this.isLoading = true;
    this.error = null;
    this.cdr.detectChanges();
    
    // Show loading state to user
    this.snackBar.open('Loading case details...', '', { 
      duration: 2000,
    });
    
    // Use the service to get real data from the API
    this.caseService.getCaseById(id).subscribe({
      next: (response) => {
        console.log('Raw API response:', response);
        console.log('Case data structure:', response?.data?.case);
        
        try {
          // The backend returns data in a wrapper object
          if (response && response.data && response.data.case) {
            // Create the importantDates object if it doesn't exist
            const caseData = response.data.case;
            
            // Ensure importantDates exists
            if (!caseData.importantDates) {
              caseData.importantDates = {
                filingDate: caseData.filingDate || null,
                nextHearing: caseData.nextHearing || null,
                trialDate: caseData.trialDate || null
              };
            }
            
            // Ensure courtInfo exists
            if (!caseData.courtInfo) {
              caseData.courtInfo = {
                courtName: caseData.courtName || '',
                judgeName: caseData.judgeName || '',
                courtroom: caseData.courtroom || ''
              };
            }
            
            // Ensure billingInfo exists
            if (!caseData.billingInfo) {
              caseData.billingInfo = {
                hourlyRate: parseFloat(caseData.hourlyRate) || 0,
                totalHours: parseFloat(caseData.totalHours) || 0,
                totalAmount: parseFloat(caseData.totalAmount) || 0,
                paymentStatus: caseData.paymentStatus || 'PENDING'
              };
            }
            
            this.case = caseData;
          } else if (response && typeof response === 'object' && 'id' in response) {
            // Handle direct case object response
            const caseData = response as any;
            
            // Ensure importantDates exists
            if (!caseData.importantDates) {
              caseData.importantDates = {
                filingDate: caseData.filingDate || null,
                nextHearing: caseData.nextHearing || null,
                trialDate: caseData.trialDate || null
              };
            }
            
            // Ensure courtInfo exists
            if (!caseData.courtInfo) {
              caseData.courtInfo = {
                courtName: caseData.courtName || '',
                judgeName: caseData.judgeName || '',
                courtroom: caseData.courtroom || ''
              };
            }
            
            // Ensure billingInfo exists
            if (!caseData.billingInfo) {
              caseData.billingInfo = {
                hourlyRate: parseFloat(caseData.hourlyRate) || 0,
                totalHours: parseFloat(caseData.totalHours) || 0,
                totalAmount: parseFloat(caseData.totalAmount) || 0,
                paymentStatus: caseData.paymentStatus || 'PENDING'
              };
            }
            
            this.case = caseData;
          } else {
            this.error = 'Case data not found or in unexpected format';
            console.warn('Unexpected response format:', response);
            this.snackBar.open('Error: Case data format is unexpected', 'Close', {
              duration: 5000,
              panelClass: ['error-snackbar']
            });
          }
        } catch (e) {
          this.error = 'Error processing case data';
          console.error('Error processing case data:', e);
          this.snackBar.open('Error processing case data', 'Close', {
            duration: 5000,
            panelClass: ['error-snackbar']
          });
        }
        this.isLoading = false;
        this.cdr.detectChanges();
        
        // Load associated events after case is loaded
        if (this.case && this.case.id) {
          this.loadCaseEvents(this.case.id);
        }
      },
      error: (err) => {
        console.error('Error loading case:', err);
        if (err.status === 401) {
          this.error = 'Authentication required. Please log in to view case details.';
          this.snackBar.open('Authentication required. Please log in again.', 'Close', {
            duration: 5000,
            panelClass: ['error-snackbar']
          });
        } else if (err.status === 404) {
          this.error = 'Case not found.';
          this.snackBar.open('Case not found. It may have been deleted.', 'Close', {
            duration: 5000,
            panelClass: ['error-snackbar']
          });
        } else {
          this.error = 'Failed to load case. ' + (err.error?.reason || err.error?.message || 'Please try again later.');
          this.snackBar.open(this.error, 'Close', {
            duration: 5000,
            panelClass: ['error-snackbar']
          });
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // Load events associated with this case
  loadCaseEvents(caseId: string | number): void {
    this.isLoadingEvents = true;
    this.cdr.detectChanges();
    
    // Set a timeout to prevent infinite loading
    const loadingTimeout = setTimeout(() => {
      if (this.isLoadingEvents) {
        this.isLoadingEvents = false;
        this.caseEvents = [];
        console.warn('Events loading timed out - endpoint may not be available');
        this.cdr.detectChanges();
      }
    }, 5000); // 5 second timeout
    
    this.calendarService.getEventsByCaseId(caseId).subscribe({
      next: (events) => {
        clearTimeout(loadingTimeout);
        
        if (!Array.isArray(events)) {
          console.warn('Events data is not an array:', events);
          this.caseEvents = [];
          this.isLoadingEvents = false;
          this.cdr.detectChanges();
          return;
        }
        
        console.log('Received events for case:', events);
        
        // Sort events by date (most recent first)
        this.caseEvents = events.sort((a, b) => {
          const dateA = new Date(a.start).getTime();
          const dateB = new Date(b.start).getTime();
          return dateA - dateB;
        });
        
        // Only show upcoming events (today and future)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        this.caseEvents = this.caseEvents.filter(event => {
          const eventDate = new Date(event.start);
          return eventDate >= today;
        });
        
        // Limit to next 5 events for display
        this.caseEvents = this.caseEvents.slice(0, 5);
        
        this.isLoadingEvents = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        clearTimeout(loadingTimeout);
        console.error('Error loading case events:', err);
        this.isLoadingEvents = false;
        this.caseEvents = []; // Set empty array on error
        this.cdr.detectChanges();
      }
    });
  }
  
  // Event actions
  openCreateEventModal(): void {
    try {
      // Close any open modals first
      this.modalService.dismissAll();
      
      const modalRef = this.modalService.open(EventModalComponent, {
        size: 'lg',
        backdrop: 'static',
        keyboard: false,
        centered: true
      });
      
      // Pre-fill case info if available
      if (this.case) {
        modalRef.componentInstance.title = 'Create New Event';
        
        const now = new Date();
        const oneHourLater = new Date(now.getTime() + 3600000); // 1 hour later
        
        const newEvent: Partial<CalendarEvent> = {
          start: now,
          end: oneHourLater,
          startTime: now, // Add both formats for compatibility with the modal
          endTime: oneHourLater,
          caseId: this.case.id,
          caseTitle: this.case.title,
          caseNumber: this.case.caseNumber,
          status: null,
          eventType: null
        };
        
        modalRef.componentInstance.event = newEvent;
        // Explicitly set the caseId property on the modal component
        modalRef.componentInstance.caseId = this.case.id;
      }
      
      modalRef.result.then(
        (result) => {
          if (result && this.case?.id) {
            // Reload events after successful creation
            this.loadCaseEvents(this.case.id);
          }
        },
        (reason) => {
          // Modal was closed without saving
          console.log('Modal dismissed:', reason);
        }
      );
    } catch (error) {
      console.error('Error opening event modal:', error);
      
      // Fallback message if modal component isn't available
      this.snackBar.open(
        'Event creation is currently unavailable. The calendar module may not be fully configured.',
        'Close',
        { duration: 5000 }
      );
    }
  }
  
  viewEvent(event: CalendarEvent): void {
    try {
      const modalRef = this.modalService.open(EventModalComponent, {
        size: 'lg',
        backdrop: 'static',
        keyboard: false,
        centered: true
      });
      
      modalRef.componentInstance.event = event;
      modalRef.componentInstance.title = 'View Event';
      modalRef.componentInstance.viewMode = true;
    } catch (error) {
      console.error('Error opening event view modal:', error);
      
      // Fallback message if modal component isn't available
      this.snackBar.open(
        'Event details view is currently unavailable. The calendar module may not be fully configured.',
        'Close',
        { duration: 5000 }
      );
    }
  }
  
  editEvent(event: CalendarEvent): void {
    try {
      const modalRef = this.modalService.open(EventModalComponent, {
        size: 'lg',
        backdrop: 'static',
        keyboard: false,
        centered: true
      });
      
      // Ensure both start/end and startTime/endTime fields exist
      // This helps with compatibility between backend and frontend models
      const eventCopy = { ...event };
      
      // Convert if only start/end exist but not startTime/endTime
      if (event.start && !event.startTime) {
        eventCopy.startTime = event.start;
      }
      if (event.end && !event.endTime) {
        eventCopy.endTime = event.end;
      }
      
      modalRef.componentInstance.event = eventCopy;
      modalRef.componentInstance.title = 'Edit Event';
      modalRef.componentInstance.viewMode = false;
      
      modalRef.result.then(
        (result) => {
          if (result && this.case?.id) {
            // Reload events after successful edit
            this.loadCaseEvents(this.case.id);
          }
        },
        (reason) => {
          // Modal was closed without saving
          console.log('Modal dismissed:', reason);
        }
      );
    } catch (error) {
      console.error('Error opening event edit modal:', error);
      
      // Fallback message if modal component isn't available
      this.snackBar.open(
        'Event editing is currently unavailable. The calendar module may not be fully configured.',
        'Close',
        { duration: 5000 }
      );
    }
  }
  
  deleteEvent(event: CalendarEvent): void {
    Swal.fire({
      title: 'Are you sure?',
      text: 'You won\'t be able to revert this!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'No, cancel!',
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6'
    }).then((result) => {
      if (result.isConfirmed && event.id) {
        this.calendarService.deleteEvent(String(event.id)).subscribe({
          next: () => {
            Swal.fire('Deleted!', 'Event has been deleted.', 'success');
            if (this.case?.id) {
              this.loadCaseEvents(this.case.id);
            }
          },
          error: (err) => {
            console.error('Error deleting event:', err);
            Swal.fire('Error!', 'Failed to delete event.', 'error');
          }
        });
      }
    });
  }
  
  // Helper methods for styling
  getEventTypeIcon(eventType?: string): string {
    if (!eventType) return 'bg-secondary-subtle';
    
    switch(eventType) {
      case 'COURT_DATE': 
        return 'bg-danger-subtle';
      case 'DEADLINE': 
        return 'bg-warning-subtle';
      case 'CLIENT_MEETING': 
      case 'TEAM_MEETING': 
        return 'bg-primary-subtle';
      case 'DEPOSITION': 
        return 'bg-info-subtle';
      case 'MEDIATION': 
        return 'bg-success-subtle';
      default: 
        return 'bg-secondary-subtle';
    }
  }
  
  getEventTypeIconClass(eventType?: string): string {
    if (!eventType) return 'ri-calendar-line text-secondary';
    
    switch(eventType) {
      case 'COURT_DATE': 
        return 'ri-scales-line text-danger';
      case 'DEADLINE': 
        return 'ri-time-line text-warning';
      case 'CLIENT_MEETING': 
        return 'ri-user-line text-primary';
      case 'TEAM_MEETING': 
        return 'ri-team-line text-primary';
      case 'DEPOSITION': 
        return 'ri-file-text-line text-info';
      case 'MEDIATION': 
        return 'ri-discuss-line text-success';
      default: 
        return 'ri-calendar-line text-secondary';
    }
  }
  
  getEventTypeBadgeClass(type: string): string {
    switch(type) {
      case 'COURT_DATE': return 'bg-danger-subtle text-danger';
      case 'DEADLINE': return 'bg-warning-subtle text-warning';
      case 'CLIENT_MEETING': return 'bg-primary-subtle text-primary';
      case 'TEAM_MEETING': return 'bg-info-subtle text-info';
      case 'DEPOSITION': return 'bg-secondary-subtle text-secondary';
      case 'MEDIATION': return 'bg-success-subtle text-success';
      case 'CONSULTATION': return 'bg-primary-subtle text-primary';
      case 'REMINDER': return 'bg-info-subtle text-info';
      default: return 'bg-dark-subtle text-dark';
    }
  }
  
  getEventTypeColor(type: string): string {
    switch(type) {
      case 'COURT_DATE': return '#d63939';
      case 'DEADLINE': return '#f59f00';
      case 'CLIENT_MEETING': return '#3577f1';
      case 'TEAM_MEETING': return '#0ab39c';
      case 'DEPOSITION': return '#405189';
      case 'MEDIATION': return '#0ab39c';
      case 'CONSULTATION': return '#3577f1';
      case 'REMINDER': return '#299cdb';
      default: return '#212529';
    }
  }
  
  getEventStatusBadgeClass(status?: string): string {
    if (!status) return 'bg-secondary-subtle text-secondary';
    
    switch(status) {
      case 'SCHEDULED': 
        return 'bg-info-subtle text-info';
      case 'COMPLETED': 
        return 'bg-success-subtle text-success';
      case 'CANCELLED': 
        return 'bg-danger-subtle text-danger';
      case 'RESCHEDULED': 
        return 'bg-warning-subtle text-warning';
      case 'PENDING': 
        return 'bg-secondary-subtle text-secondary';
      default: 
        return 'bg-light text-dark';
    }
  }

  saveCase(): void {
    // Check form validity first
    if (!this.editForm.valid) {
      // Mark all fields as touched to show validation errors
      Object.keys(this.editForm.controls).forEach(key => {
        const control = this.editForm.get(key);
        control?.markAsTouched();
      });
      
      // Create error message based on invalid fields
      const invalidFields = Object.keys(this.editForm.controls)
        .filter(key => this.editForm.get(key)?.invalid)
        .join(', ');
      
      this.error = `Please correct the following fields: ${invalidFields}`;
      this.snackBar.open('Please fill all required fields correctly', 'Close', { 
        duration: 5000,
        panelClass: ['error-snackbar']
      });
      
      return;
    }
    
    if (this.case) {
      this.isLoading = true;
      this.error = null;
      this.cdr.detectChanges();
      
      // Extract form values
      const formValues = this.editForm.value;
      
      try {
        // Parse numeric values safely
        const hourlyRate = formValues.hourlyRate ? parseFloat(formValues.hourlyRate) : 0;
        const totalHours = formValues.totalHours ? parseFloat(formValues.totalHours) : 0;
        const totalAmount = formValues.totalAmount ? parseFloat(formValues.totalAmount) : 0;
        
        if (isNaN(hourlyRate) || isNaN(totalHours) || isNaN(totalAmount)) {
          throw new Error('Billing values must be valid numbers');
        }
        
        // Format dates properly
        const formatDate = (date: any) => {
          if (!date) return null;
          return date instanceof Date ? date : new Date(date);
        };
        
        // Create properly formatted update data
        const updateData = {
          id: this.case.id,
          caseNumber: formValues.caseNumber,
          title: formValues.title,
          clientName: formValues.clientName,
          clientEmail: formValues.clientEmail,
          clientPhone: formValues.clientPhone,
          clientAddress: formValues.clientAddress,
          status: formValues.status,
          priority: formValues.priority,
          type: formValues.type,
          description: formValues.description,
          
          // Include both nested and flat fields for maximum compatibility
          courtInfo: {
            courtName: formValues.courtName || '',
            judgeName: formValues.judgeName || '',
            courtroom: formValues.courtroom || ''
          },
          courtName: formValues.courtName || '',
          judgeName: formValues.judgeName || '',
          courtroom: formValues.courtroom || '',
          
          importantDates: {
            filingDate: formatDate(formValues.filingDate),
            nextHearing: formatDate(formValues.nextHearing),
            trialDate: formatDate(formValues.trialDate)
          },
          filingDate: formatDate(formValues.filingDate),
          nextHearing: formatDate(formValues.nextHearing),
          trialDate: formatDate(formValues.trialDate),
          
          billingInfo: {
            hourlyRate: hourlyRate,
            totalHours: totalHours,
            totalAmount: totalAmount,
            paymentStatus: formValues.paymentStatus
          },
          hourlyRate: hourlyRate,
          totalHours: totalHours,
          totalAmount: totalAmount,
          paymentStatus: formValues.paymentStatus
        };
        
        console.log('Updating case with data:', updateData);
        
        // Call the API to update the case
        this.caseService.updateCase(this.case.id, updateData).subscribe({
          next: (response) => {
            console.log('Case updated successfully:', response);
            // Reload the case data after update
            this.loadCase(this.case!.id);
            this.isEditing = false;
            this.snackBar.open('Case updated successfully', 'Close', { duration: 3000 });
          },
          error: (error) => {
            console.error('Error updating case:', error);
            this.error = 'Failed to update case: ' + (error.error?.reason || error.error?.message || 'Please try again later.');
            this.isLoading = false;
            this.cdr.detectChanges();
            
            // Show more detailed error message
            this.snackBar.open(
              `Update failed: ${error.error?.message || error.message || 'Unknown error'}`,
              'Close',
              { duration: 5000, panelClass: ['error-snackbar'] }
            );
          },
          complete: () => {
            this.isLoading = false;
            this.cdr.detectChanges();
          }
        });
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'An unexpected error occurred';
        this.error = errorMessage;
        this.isLoading = false;
        this.snackBar.open(errorMessage, 'Close', { 
          duration: 5000,
          panelClass: ['error-snackbar']
        });
        this.cdr.detectChanges();
      }
    }
  }

  onCancel(): void {
    this.isEditing = false;
    this.cdr.detectChanges();
  }

  deleteCase(): void {
    if (this.case) {
      Swal.fire({
        title: 'Are you sure?',
        text: `You are about to delete case "${this.case.title}". This action cannot be undone.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Yes, delete it!',
        cancelButtonText: 'Cancel'
      }).then((result) => {
        if (result.isConfirmed) {
          this.isLoading = true;
          this.cdr.detectChanges();
          
          this.caseService.deleteCase(this.case!.id).subscribe({
            next: () => {
              this.isLoading = false;
              Swal.fire({
                title: 'Deleted!',
                text: 'Case has been successfully deleted.',
                icon: 'success',
                confirmButtonColor: '#3085d6'
              }).then(() => {
                this.router.navigate(['/legal/cases']);
              });
            },
            error: (error) => {
              this.isLoading = false;
              console.error('Error deleting case:', error);
              
              // For status 400, always treat as dependency/foreign key error
              if (error.status === 400) {
                Swal.fire({
                  title: 'Cannot Delete Case',
                  html: `This case has related records (documents, notes, activities, etc.) that must be deleted first.<br><br>
                         Please remove all documents, notes, and other related items before deleting this case.`,
                  icon: 'warning',
                  confirmButtonColor: '#3085d6',
                  confirmButtonText: 'I Understand'
                });
              } else {
                // Generic error handling for other types of errors
                Swal.fire({
                  title: 'Error!',
                  text: 'Failed to delete case: ' + (error.error?.reason || error.error?.message || 'Please try again later.'),
                  icon: 'error',
                  confirmButtonColor: '#3085d6'
                });
              }
              
              this.cdr.detectChanges();
            }
          });
        }
      });
    }
  }
  
  /**
   * Checks if an error is related to a foreign key constraint violation
   * Note: This method is kept for backward compatibility but
   * we now handle all 400 errors as dependency errors directly
   */
  private isForeignKeyConstraintError(error: any): boolean {
    // All 400 status codes when deleting are treated as constraint errors
    if (error.status === 400) {
      return true;
    }
    
    // For additional safety, still check error messages
    const errorMsg = JSON.stringify(error || {}).toLowerCase();
    return errorMsg.includes('foreign key constraint') || 
           errorMsg.includes('constraint fails') || 
           errorMsg.includes('cannot delete') ||
           errorMsg.includes('referenced by') ||
           errorMsg.includes('bad request');
  }

  getStatusClass(status: CaseStatus): string {
    return `status-${status.toLowerCase().replace('_', '-')}`;
  }

  getPriorityClass(priority: CasePriority): string {
    return `priority-${priority.toLowerCase()}`;
  }

  startEdit(): void {
    this.isEditing = true;
  }

  cancelEdit(): void {
    this.isEditing = false;
    this.updateFormWithCaseData();
  }

  // Get only the deadline events from caseEvents
  getDeadlines(): CalendarEvent[] {
    return this.caseEvents.filter(event => event.eventType === 'DEADLINE');
  }

  // Get deadline status based on due date
  getDeadlineStatus(deadline: CalendarEvent): string {
    const now = new Date();
    const dueDate = new Date(deadline.start);
    
    if (deadline.status === 'COMPLETED') {
      return 'Completed';
    }
    
    if (dueDate < now) {
      return 'Overdue';
    }
    
    // Calculate days until deadline
    const daysUntil = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntil <= 3) {
      return 'Approaching';
    } else if (daysUntil <= 7) {
      return 'Upcoming';
    } else {
      return 'Future';
    }
  }
  
  // Get badge class based on deadline status
  getDeadlineStatusBadgeClass(deadline: CalendarEvent): string {
    const status = this.getDeadlineStatus(deadline);
    
    switch (status) {
      case 'Completed':
        return 'bg-success-subtle text-success';
      case 'Overdue':
        return 'bg-danger-subtle text-danger';
      case 'Approaching':
        return 'bg-warning-subtle text-warning';
      case 'Upcoming':
        return 'bg-info-subtle text-info';
      default:
        return 'bg-light text-dark';
    }
  }
}