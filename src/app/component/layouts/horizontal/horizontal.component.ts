import { Component, Input, OnInit } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router } from '@angular/router';
import { State } from '@ngrx/store';
import { BehaviorSubject, Observable } from 'rxjs';
import { CustomHttpResponse, Profile } from 'src/app/interface/appstates';
import { User } from 'src/app/interface/user';
import { NotificationService } from 'src/app/service/notification.service';
import { UserService } from 'src/app/service/user.service';
import { RbacService } from 'src/app/core/services/rbac.service';
import { Key } from 'src/app/enum/key.enum';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-horizontal',
  templateUrl: './horizontal.component.html',
  styleUrls: ['./horizontal.component.scss']
})

/**
 * Horizontal Component
 */
export class HorizontalComponent implements OnInit {
  isCondensed = false;
  currentUser: User | null = null;

  // BehaviorSubject to control the visibility of the preloader
  showPreloader$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);

  constructor(private router: Router, private userService: UserService, private rbacService: RbacService) {
    // Subscribe to route changes to close mobile menu
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      if (document.documentElement.clientWidth <= 1024) {
        document.body.classList.remove('menu');
      }
    });
  }

  ngOnInit(): void {
    // Get current user
    console.log("🔍 Horizontal component - UserService result:", this.userService.getCurrentUser());
    this.currentUser = this.userService.getCurrentUser();
    console.log("🔍 Horizontal component - currentUser set to:", this.currentUser);
    console.log("🔍 Token in localStorage:", localStorage.getItem(Key.TOKEN));
    console.log("🔍 Current user in localStorage:", localStorage.getItem("currentUser"));
    
    // If user is null but we have a token, load user data
    if (!this.currentUser && this.userService.isAuthenticated()) {
      console.log("🔄 User is null but authenticated - loading profile data");
      this.userService.profile$().subscribe(response => {
        if (response && response.data && response.data.user) {
          this.currentUser = response.data.user;
          console.log("✅ User profile loaded:", this.currentUser);
          // Initialize RBAC service now that user is loaded
          console.log("🔄 Initializing RBAC service");
          this.rbacService.initialize();
        }
      });
    }
    
    // Initialize RBAC service if user is already loaded
    if (this.currentUser && this.userService.isAuthenticated()) {
      console.log("🔄 User already loaded, initializing RBAC service");
      this.rbacService.initialize();
    }
    
    // Subscribe to router events to show/hide preloader
    this.router.events.subscribe(event => {
      if (event instanceof NavigationStart) {
        // Show the preloader when navigation starts
        this.showPreloader$.next(true);
      }

      if (event instanceof NavigationEnd || event instanceof NavigationCancel || event instanceof NavigationError) {
        // Hide the preloader when navigation completes or is cancelled
        setTimeout(() => {
          this.showPreloader$.next(false);  // Hide preloader after 500ms delay for smoothness
        }, 500);  // Delay ensures smooth transition
      }
    });
  }

  /**
   * on settings button clicked from topbar
   */
   onSettingsButtonClicked() {
    document.body.classList.toggle('right-bar-enabled');
    const rightBar = document.getElementById('theme-settings-offcanvas');
    if(rightBar != null){
      rightBar.classList.toggle('show');
      rightBar.setAttribute('style',"visibility: visible;");
    }
  }

  /**
   * On mobile toggle button clicked
   */
   onToggleMobileMenu() {     
   if (document.documentElement.clientWidth <= 1024) {
     document.body.classList.toggle('menu');
   }
 }

}
