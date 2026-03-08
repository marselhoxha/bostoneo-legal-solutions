import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-sidebar',
  template: `
    <div class="app-menu navbar-menu">
      <div class="navbar-brand-box">
        <a routerLink="/" class="logo logo-dark">
          <span class="logo-sm">
            <img src="assets/images/legience-logo-blue.svg" alt="" height="80">
          </span>
          <span class="logo-lg">
            <img src="assets/images/legience-logo-blue.svg" alt="" height="90">
          </span>
        </a>
        <a routerLink="/" class="logo logo-light">
          <span class="logo-sm">
            <img src="assets/images/legience-logo-white.svg" alt="" height="80">
          </span>
          <span class="logo-lg">
            <img src="assets/images/legience-logo-white.svg" alt="" height="90">
          </span>
        </a>
      </div>

      <div id="scrollbar">
        <div class="container-fluid">
          <div id="two-column-menu"></div>
          <ul class="navbar-nav" id="navbar-nav">
            <app-sidebar-menu></app-sidebar-menu>
          </ul>
        </div>
      </div>
    </div>
  `
})
export class SidebarComponent implements OnInit {
  constructor() { }

  ngOnInit(): void { }
} 