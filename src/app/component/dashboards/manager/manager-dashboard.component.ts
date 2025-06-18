import { Component, OnInit, OnDestroy, Input, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { User } from 'src/app/interface/user';
import { ClientService } from 'src/app/service/client.service';
import { UserService } from 'src/app/service/user.service';
import { RbacService } from 'src/app/core/services/rbac.service';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-manager-dashboard',
  templateUrl: './manager-dashboard.component.html',
  styleUrls: ['./manager-dashboard.component.css']
})
export class ManagerDashboardComponent implements OnInit, OnDestroy {

  @Input() currentUser: User | null = null;
  @Input() isDarkMode: boolean = false;

  // Manager specific stats
  teamMembers = 0;
  monthlyRevenue = 0;
  caseCompletionRate = 0;

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
    this.initializeManagerMetrics();
    this.loadManagerData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeManagerMetrics(): void {
    this.teamMembers = 12;
    this.monthlyRevenue = 320;
    this.caseCompletionRate = 88;
  }

  private loadManagerData(): void {
    // Load manager-specific data
    this.clientService.clients$(0)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          // Process manager-specific data
          this.cdr.detectChanges();
        },
        error: (error) => console.error('Error loading manager data:', error)
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
} 
 
 
 
 
 
 