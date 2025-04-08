import { Component, Input, OnInit } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router } from '@angular/router';
import { State } from '@ngrx/store';
import { BehaviorSubject, Observable } from 'rxjs';
import { CustomHttpResponse, Profile } from 'src/app/interface/appstates';
import { User } from 'src/app/interface/user';
import { NotificationService } from 'src/app/service/notification.service';
import { UserService } from 'src/app/service/user.service';
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

  // BehaviorSubject to control the visibility of the preloader
  showPreloader$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);

  constructor(private router: Router) {
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
