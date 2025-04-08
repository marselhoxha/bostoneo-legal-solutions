import { Component, OnInit } from '@angular/core';
import {
  Router,
  NavigationStart,
  NavigationEnd,
  NavigationCancel,
  NavigationError,
  Event,
  UrlSerializer,
} from '@angular/router';
import { PreloaderService } from './service/preloader.service';
import { UserService } from './service/user.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {
  showPreloader = false;

  constructor(
    private router: Router,
    private preloaderService: PreloaderService,
    private urlSerializer: UrlSerializer,
    private userService: UserService
  ) {
    this.preloaderService.showPreloader$.subscribe((show) => {
      this.showPreloader = show;
    });

    this.router.events.subscribe((event: Event) => {
      if (event instanceof NavigationStart) {
        console.log('NavigationStart:', event.url);
        if (!this.isExcludedRoute(event.url)) {
          console.log('Showing preloader');
          this.preloaderService.show();
        } else {
          console.log('Hiding preloader (excluded route)');
          this.preloaderService.hide();
        }
      } else if (
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      ) {
        console.log('NavigationEnd/Cancel/Error:', event);
        setTimeout(() => {
          console.log('Hiding preloader after navigation end');
          this.preloaderService.hide();
        }, 700);
      }
    });
  }

  ngOnInit(): void {
    // Preload user data if authenticated
    if (this.userService.isAuthenticated()) {
      this.userService.preloadUserData();
    }
  }

  private isExcludedRoute(url: string): boolean {
    const cleanUrl = url.split('?')[0].split('#')[0];
    const urlSegments = cleanUrl.split('/').filter(segment => segment.length > 0);
    const routePath = urlSegments.join('/');
    const excludedRoutes = ['login', 'register', 'resetpassword'];
  
    const isExcluded = excludedRoutes.includes(routePath);
    console.log(`Navigating to: ${routePath}, isExcludedRoute: ${isExcluded}`);
    return isExcluded;
  }
}
