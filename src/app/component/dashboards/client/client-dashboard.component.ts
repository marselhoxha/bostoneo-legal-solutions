import { Component, OnInit, OnDestroy, Input, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { User } from 'src/app/interface/user';
import { ClientService } from 'src/app/service/client.service';
import { UserService } from 'src/app/service/user.service';
import { RbacService } from 'src/app/core/services/rbac.service';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-client-dashboard',
  templateUrl: './client-dashboard.component.html',
  styleUrls: ['./client-dashboard.component.css']
})
export class ClientDashboardComponent implements OnInit, OnDestroy {

  @Input() currentUser: User | null = null;
  @Input() isDarkMode: boolean = false;

  // Client specific stats
  myCases = 0;
  nextAppointment = new Date();

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
    this.initializeClientMetrics();
    this.loadClientData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeClientMetrics(): void {
    this.myCases = 2;
    this.nextAppointment = new Date();
    this.nextAppointment.setDate(this.nextAppointment.getDate() + 2);
  }

  private loadClientData(): void {
    // Load client-specific data
    this.clientService.clients$(0)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          // Process client-specific data
          this.cdr.detectChanges();
        },
        error: (error) => console.error('Error loading client data:', error)
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

  getNextAppointmentFormatted(): string {
    return this.nextAppointment.toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }
} 
 
 
 
 
 
 