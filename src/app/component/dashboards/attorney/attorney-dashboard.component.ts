import { Component, OnInit, OnDestroy, Input, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { User } from 'src/app/interface/user';
import { ClientService } from 'src/app/service/client.service';
import { UserService } from 'src/app/service/user.service';
import { RbacService } from 'src/app/core/services/rbac.service';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-attorney-dashboard',
  templateUrl: './attorney-dashboard.component.html',
  styleUrls: ['./attorney-dashboard.component.css']
})
export class AttorneyDashboardComponent implements OnInit, OnDestroy {

  @Input() currentUser: User | null = null;
  @Input() isDarkMode: boolean = false;

  // Attorney specific stats
  activeCases = 0;
  upcomingHearings = 0;
  documentsToReview = 0;
  currentDate = new Date();

  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private clientService: ClientService,
    private userService: UserService,
    private rbacService: RbacService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.initializeAttorneyMetrics();
    this.loadAttorneyData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeAttorneyMetrics(): void {
    this.activeCases = 25;
    this.upcomingHearings = 4;
    this.documentsToReview = 8;
  }

  private loadAttorneyData(): void {
    // Load attorney-specific data
    this.clientService.clients$(0)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          // Process attorney-specific client data
          this.cdr.detectChanges();
        },
        error: (error) => console.error('Error loading attorney data:', error)
      });
  }

  // Helper methods for template
  getCurrentTime(): string {
    return new Date().toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      timeZone: 'America/New_York'
    });
  }

  getWeatherInfo(): string {
    return '72°F Sunny';
  }

  getCurrentDateFormatted(): string {
    return this.currentDate.toLocaleDateString('en-US', { 
      month: 'long',
      day: 'numeric'
    });
  }

  getCurrentDayFormatted(): string {
    return this.currentDate.toLocaleDateString('en-US', { 
      weekday: 'long'
    });
  }
} 
 
 
 
 
 
 