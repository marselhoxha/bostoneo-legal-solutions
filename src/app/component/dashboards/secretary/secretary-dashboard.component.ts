import { Component, OnInit, OnDestroy, Input, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { User } from 'src/app/interface/user';
import { ClientService } from 'src/app/service/client.service';
import { UserService } from 'src/app/service/user.service';
import { RbacService } from 'src/app/core/services/rbac.service';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-secretary-dashboard',
  templateUrl: './secretary-dashboard.component.html',
  styleUrls: ['./secretary-dashboard.component.css']
})
export class SecretaryDashboardComponent implements OnInit, OnDestroy {

  @Input() currentUser: User | null = null;
  @Input() isDarkMode: boolean = false;

  // Secretary specific stats
  todayAppointments = 0;
  pendingTasks = 0;
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
    this.initializeSecretaryMetrics();
    this.loadSecretaryData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeSecretaryMetrics(): void {
    this.todayAppointments = 8;
    this.pendingTasks = 5;
  }

  private loadSecretaryData(): void {
    // Load secretary-specific data
    this.clientService.clients$(0)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          // Process secretary-specific data
          this.cdr.detectChanges();
        },
        error: (error) => console.error('Error loading secretary data:', error)
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
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
  }
} 
 
 
 
 
 
 