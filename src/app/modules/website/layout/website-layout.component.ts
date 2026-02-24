import { Component, OnInit, OnDestroy, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { WebsiteNavbarComponent } from '../components/navbar/website-navbar.component';
import { WebsiteFooterComponent } from '../components/footer/website-footer.component';

@Component({
  selector: 'app-website-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, WebsiteNavbarComponent, WebsiteFooterComponent],
  template: `
    <div class="legience-website">
      <app-website-navbar></app-website-navbar>
      <main>
        <router-outlet></router-outlet>
      </main>
      <app-website-footer></app-website-footer>
    </div>
  `,
  styleUrls: ['./website-layout.component.scss']
})
export class WebsiteLayoutComponent implements OnInit, OnDestroy {
  private routerSub!: Subscription;

  constructor(private renderer: Renderer2, private router: Router) {}

  ngOnInit(): void {
    // Hide Velzon sidebar/topbar by adding a body class
    this.renderer.addClass(document.body, 'legience-website-active');

    // Scroll to top on route change
    this.routerSub = this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe(() => {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    });
  }

  ngOnDestroy(): void {
    this.renderer.removeClass(document.body, 'legience-website-active');
    this.routerSub?.unsubscribe();
  }
}
