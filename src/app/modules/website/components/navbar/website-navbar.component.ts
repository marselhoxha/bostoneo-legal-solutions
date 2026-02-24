import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-website-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './website-navbar.component.html',
  styleUrls: ['./website-navbar.component.scss']
})
export class WebsiteNavbarComponent {
  scrolled = false;
  mobileMenuOpen = false;

  @HostListener('window:scroll')
  onScroll(): void {
    this.scrolled = window.scrollY > 20;
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen = false;
  }
}
