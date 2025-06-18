import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { SimplebarAngularModule } from 'simplebar-angular';
import { TranslateModule } from '@ngx-translate/core';

// Component pages
import { SharedModule } from 'src/app/shared/shared.module';
import { FooterComponent } from './footer/footer.component';
import { HorizontalTopbarComponent } from './horizontal-topbar/horizontal-topbar.component';
import { HorizontalComponent } from './horizontal/horizontal.component';
import { LayoutComponent } from './layout.component';
import { TopbarComponent } from './topbar/topbar.component';
import { SidebarComponent } from './sidebar/sidebar.component';
import { SidebarMenuComponent } from './sidebar/sidebar-menu/sidebar-menu.component';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PermissionDebuggerComponent } from 'src/app/shared/components/permission-debugger/permission-debugger.component';

@NgModule({
  declarations: [
    LayoutComponent,
    TopbarComponent,
    FooterComponent,
    HorizontalComponent,
    HorizontalTopbarComponent,
    SidebarComponent,
    SidebarMenuComponent
  ],
  imports: [
    CommonModule,
    RouterModule,
    SharedModule,
    NgbDropdownModule,
    SimplebarAngularModule,
    FormsModule, 
    ReactiveFormsModule,
    TranslateModule,
    PermissionDebuggerComponent
  ],
  exports: [
    LayoutComponent
  ],
  schemas: [
    CUSTOM_ELEMENTS_SCHEMA
  ],
})
export class LayoutsModule { }
