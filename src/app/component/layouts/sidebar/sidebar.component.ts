import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-sidebar',
  template: `
    <div class="app-menu navbar-menu">
      <div class="navbar-brand-box">
        <a routerLink="/" class="logo logo-dark">
          <span class="logo-sm">
            <img src="assets/images/logo-sm.png" alt="" height="22">
          </span>
          <span class="logo-lg">
            <img src="assets/images/bostoneo-logo.svg" alt="" height="30">
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