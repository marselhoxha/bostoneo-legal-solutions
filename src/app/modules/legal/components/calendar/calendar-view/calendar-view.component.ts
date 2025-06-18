import { Component, OnInit, ViewChild, AfterViewInit, Renderer2, OnDestroy, ElementRef } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CalendarService } from '../../../services/calendar.service';
import { CalendarEvent } from '../interfaces/calendar-event.interface';
import { EventModalComponent } from '../event-modal/event-modal.component';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';

import { CalendarOptions, DateSelectArg, EventClickArg, EventInput } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import { FullCalendarComponent } from '@fullcalendar/angular';
import { Subscription } from 'rxjs';

// Interface for backend response structure
interface ApiResponse {
  timeStamp?: string;
  statusCode?: number;
  status?: string;
  message?: string;
  data?: {
    events?: any[];
    [key: string]: any;
  };
}

@Component({
  selector: 'app-calendar-view',
  templateUrl: './calendar-view.component.html',
  styleUrls: [
    './calendar-view.component.scss',
    './calendar-view-popover.scss'
  ]
})
export class CalendarViewComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('calendar') calendarComponent: FullCalendarComponent;
  
  events: CalendarEvent[] = [];
  calendarEvents: EventInput[] = [];
  loading = false;
  error: string | null = null;
  
  // Use API data by default
  useMockData = false;
  
  // Dark mode detection
  isDarkMode = false;
  private darkModeObserver: MutationObserver | null = null;
  private layoutElement: HTMLElement | null = null;
  
  calendarOptions: CalendarOptions = {
    plugins: [
      dayGridPlugin,
      timeGridPlugin,
      listPlugin,
      interactionPlugin
    ],
    initialView: 'dayGridMonth',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
    },
    weekends: true,
    editable: true,
    selectable: true,
    selectMirror: true,
    dayMaxEvents: 3, // Display up to 3 events, then show +X more
    moreLinkClick: 'popover', // Show events in a popover when clicking "+X more"
    moreLinkClassNames: 'more-events-link', // Custom class for styling
    moreLinkContent: (arg) => {
      // Customize the +more text to make it more visible
      return `+${arg.num} more`;
    },
    events: [], // Start with empty events, they'll be loaded
    height: 650,
    themeSystem: 'bootstrap5',
    dateClick: this.handleDateClick.bind(this),
    eventClick: this.handleEventClick.bind(this),
    select: this.handleDateSelect.bind(this),
    // Sort events by start time (earliest first), then by duration (longest first)
    eventOrder: 'start,-duration',
    eventClassNames: (arg) => {
      // Add custom classes based on event type
      const eventType = arg.event.extendedProps['eventType'];
      let className = '';
      
      switch(eventType) {
        case 'COURT_DATE':
          className = 'bg-danger-subtle';
          break;
        case 'DEADLINE':
          className = 'bg-warning-subtle';
          break;
        case 'CLIENT_MEETING':
          className = 'bg-primary-subtle';
          break;
        case 'TEAM_MEETING':
          className = 'bg-info-subtle';
          break;
        case 'DEPOSITION':
          className = 'bg-secondary-subtle';
          break;  
        case 'MEDIATION':
          className = 'bg-success-subtle';
          break;
        case 'CONSULTATION':
          className = 'bg-primary-subtle';
          break;
        case 'REMINDER':
          className = 'bg-info-subtle';
          break;
        default:
          className = 'bg-dark-subtle';
      }
      
      return [className];
    }
  };
  
  constructor(
    private calendarService: CalendarService,
    private modalService: NgbModal,
    private renderer: Renderer2,
    private toastr: ToastrService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadEvents();
    this.setupDarkModeDetection();
  }

  ngAfterViewInit(): void {
    // Force calendar to render after view initialization
    setTimeout(() => {
      if (this.calendarComponent && this.calendarComponent.getApi()) {
        this.calendarComponent.getApi().render();
      }
    }, 100);
  }
  
  ngOnDestroy(): void {
    // Cleanup dark mode observer
    if (this.darkModeObserver) {
      this.darkModeObserver.disconnect();
    }
  }
  
  // Set up dark mode detection by watching data-layout-mode attribute
  private setupDarkModeDetection(): void {
    this.layoutElement = document.documentElement;
    this.isDarkMode = this.layoutElement.getAttribute('data-layout-mode') === 'dark';
    
    // Watch for changes to the data-layout-mode attribute
    this.darkModeObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'data-layout-mode') {
          const newValue = (mutation.target as HTMLElement).getAttribute('data-layout-mode');
          this.isDarkMode = newValue === 'dark';
          
          // Re-render calendar when mode changes
          if (this.calendarComponent && this.calendarComponent.getApi()) {
            this.calendarComponent.getApi().render();
          }
        }
      });
    });
    
    this.darkModeObserver.observe(this.layoutElement, { attributes: true });
  }

  loadEvents(): void {
    this.loading = true;
    this.error = null;
    
    // Always load from API
    this.calendarService.getEvents().subscribe({
      next: (response: any) => {
        console.log('Calendar API response:', response);
        
        // Check if the response contains a data structure with events array
        if (response && typeof response === 'object' && 'data' in response && response.data && Array.isArray(response.data.events)) {
          // API response with data.events structure
          this.events = this.convertToCalendarEvents(response.data.events);
        } else if (Array.isArray(response)) {
          // Direct array response
          this.events = this.convertToCalendarEvents(response);
        } else if (response && typeof response === 'object' && 'data' in response && response.data && response.data.events) {
          // Single event or non-array format
          this.events = this.convertToCalendarEvents([response.data.events]);
        } else {
          // Empty or unexpected format
          this.events = [];
          console.warn('Unexpected API response format:', response);
        }
        
        this.mapEventsToCalendar();
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading calendar events:', err);
        // Don't show error message to the user
        this.error = null;
        this.loading = false;
        this.events = [];
        
        // Show empty calendar even on error
        if (this.calendarComponent && this.calendarComponent.getApi()) {
          this.calendarComponent.getApi().removeAllEvents();
        }
        
        // Continue with empty calendar and no error message
        this.mapEventsToCalendar();
      }
    });
  }
  
  // Convert backend event format to CalendarEvent format
  private convertToCalendarEvents(events: any[]): CalendarEvent[] {
    if (!events || !Array.isArray(events)) return [];
    
    return events.map(event => {
      // Handle different field names between backend and frontend
      const calEvent: CalendarEvent = {
        id: event.id,
        title: event.title,
        description: event.description,
        // Convert startTime/endTime to start/end expected by the interface
        start: event.start || new Date(event.startTime),
        end: event.end || (event.endTime ? new Date(event.endTime) : undefined),
        location: event.location,
        eventType: event.eventType,
        status: event.status || 'SCHEDULED',
        allDay: event.allDay || false,
        recurrenceRule: event.recurrenceRule,
        color: event.color,
        caseId: event.caseId,
        caseTitle: event.caseTitle,
        caseNumber: event.caseNumber
      };
      return calEvent;
    });
  }
  
  mapEventsToCalendar(): void {
    if (!Array.isArray(this.events)) {
      console.error('Events is not an array:', this.events);
      this.calendarEvents = [];
      return;
    }
    
    this.calendarEvents = this.events.map(event => {
      return {
        id: event.id?.toString(),
        title: event.title,
        start: event.start,
        end: event.end,
        allDay: event.allDay || false,
        extendedProps: {
          description: event.description,
          location: event.location,
          eventType: event.eventType,
          status: event.status,
          caseId: event.caseId,
          caseTitle: event.caseTitle,
          caseNumber: event.caseNumber
        }
      };
    });
    
    // Update the calendar events
    if (this.calendarComponent && this.calendarComponent.getApi()) {
      this.calendarComponent.getApi().removeAllEvents();
      this.calendarComponent.getApi().addEventSource(this.calendarEvents);
    } else {
      this.calendarOptions.events = this.calendarEvents;
    }
  }

  handleDateClick(arg: any): void {
    // Prevent event bubbling
    if (arg.jsEvent) {
      arg.jsEvent.preventDefault();
      arg.jsEvent.stopPropagation();
    }
    this.openCreateEventModal(arg.date);
  }
  
  handleDateSelect(selectInfo: DateSelectArg): void {
    // Prevent event bubbling
    if (selectInfo.jsEvent) {
      selectInfo.jsEvent.preventDefault();
      selectInfo.jsEvent.stopPropagation();
    }
    this.openCreateEventModal(selectInfo.start);
  }
  
  handleEventClick(clickInfo: EventClickArg): void {
    // Prevent event bubbling and double-click
    if (clickInfo.jsEvent) {
      clickInfo.jsEvent.preventDefault();
      clickInfo.jsEvent.stopPropagation();
    }
    
    const eventId = parseInt(clickInfo.event.id || '0');
    
    // Find the event in our local cache
    const event = this.events.find(e => e.id === eventId);
    
    if (event) {
      this.openViewEventModal(event);
    } else {
      console.error('Event not found with ID:', eventId);
    }
  }

  openViewEventModal(event: CalendarEvent): void {
    // Close any open modals first to prevent multiple instances
    this.modalService.dismissAll();
    
    const modalRef = this.modalService.open(EventModalComponent, { 
      size: 'lg',
      backdrop: 'static',
      keyboard: false,
      centered: true
    });
    
    modalRef.componentInstance.event = event;
    modalRef.componentInstance.title = 'Event Details';
    modalRef.componentInstance.viewMode = true;
    
    modalRef.result.then(
      (result) => {
        if (result) {
          this.loadEvents(); // Refresh events after successful update
        }
      },
      (reason) => {
        // Modal was closed without saving
        console.log('Modal dismissed:', reason);
      }
    );
  }

  openEditEventModal(event: CalendarEvent): void {
    // Close any open modals first to prevent multiple instances
    this.modalService.dismissAll();
    
    const modalRef = this.modalService.open(EventModalComponent, { 
      size: 'lg',
      backdrop: 'static',
      keyboard: false,
      centered: true
    });
    
    modalRef.componentInstance.event = event;
    modalRef.componentInstance.title = 'Edit Event';
    modalRef.componentInstance.viewMode = false;
    
    modalRef.result.then(
      (result) => {
        if (result) {
          this.loadEvents(); // Refresh events after successful update
        }
      },
      (reason) => {
        // Modal was closed without saving
        console.log('Modal dismissed:', reason);
      }
    );
  }
  
  openCreateEventModal(date?: Date): void {
    // Close any open modals first to prevent multiple instances
    this.modalService.dismissAll();
    
    const modalRef = this.modalService.open(EventModalComponent, { 
      size: 'lg',
      backdrop: 'static',
      keyboard: false,
      centered: true
    });
    
    modalRef.componentInstance.title = 'Create New Event';
    
    // Always set caseId to null explicitly to make "None" the default selection
    modalRef.componentInstance.caseId = null;
    
    // If date was provided (e.g., clicked on calendar day), pre-fill it
    if (date) {
      const newEvent: Partial<CalendarEvent> = {
        start: date,
        end: new Date(date.getTime() + 3600000) // 1 hour later
      };
      modalRef.componentInstance.event = newEvent;
    }
    
    modalRef.result.then(
      (result) => {
        if (result) {
          this.loadEvents(); // Refresh events after successful creation
        }
      },
      (reason) => {
        // Modal was closed without saving
        console.log('Modal dismissed:', reason);
      }
    );
  }
  
  // Toggle button is hidden in UI now, but keeping the method for future use if needed
  toggleDataSource(): void {
    // Toggle between mock data and API data
    this.useMockData = !this.useMockData;
    this.loadEvents();
  }
  
  /**
   * Navigate to the legal dashboard
   */
  navigateToLegal(): void {
    this.router.navigate(['/legal']);
  }
} 