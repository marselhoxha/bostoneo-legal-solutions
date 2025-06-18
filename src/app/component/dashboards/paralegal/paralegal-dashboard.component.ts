import { Component, OnInit, OnDestroy, Input, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { User } from 'src/app/interface/user';
import { ClientService } from 'src/app/service/client.service';
import { UserService } from 'src/app/service/user.service';
import { RbacService } from 'src/app/core/services/rbac.service';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-paralegal-dashboard',
  templateUrl: './paralegal-dashboard.component.html',
  styleUrls: ['./paralegal-dashboard.component.css']
})
export class ParalegalDashboardComponent implements OnInit, OnDestroy {

  @Input() currentUser: User | null = null;
  @Input() isDarkMode: boolean = false;

  // Paralegal specific stats
  activeCases = 0;
  documentsToReview = 0;

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
    this.initializeParalegalMetrics();
    this.loadParalegalData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeParalegalMetrics(): void {
    this.activeCases = 10;
    this.documentsToReview = 15;
  }

  private loadParalegalData(): void {
    // Load paralegal-specific data
    this.clientService.clients$(0)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          // Process paralegal-specific data
          this.cdr.detectChanges();
        },
        error: (error) => console.error('Error loading paralegal data:', error)
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
 
 
 
 
 
 