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
import { OrganizationManagementModule } from 'src/app/modules/organization-management/organization-management.module';
import { BackgroundTasksIndicatorComponent } from 'src/app/modules/legal/components/ai-assistant/ai-workspace/background-tasks-indicator/background-tasks-indicator.component';
import { LucideAngularModule, Search, Bell, MessageSquare, Moon, Sun, Sparkles,
         Clock, FolderOpen, LayoutDashboard, Folder, Calendar, CheckSquare,
         Wrench, Users, DollarSign, Headphones, PenTool, Briefcase,
         X, ChevronDown, Building2, BarChart2, Settings, Megaphone,
         FileText, CalendarCheck, MessageCircle, UserCog,
         BookOpen, Receipt, ScrollText, Square } from 'lucide-angular';
import { AiQuickDrawerComponent } from './ai-quick-drawer/ai-quick-drawer.component';

@NgModule({
  declarations: [
    LayoutComponent,
    TopbarComponent,
    FooterComponent,
    HorizontalComponent,
    HorizontalTopbarComponent,
    SidebarComponent,
    SidebarMenuComponent,
    AiQuickDrawerComponent
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
    PermissionDebuggerComponent,
    OrganizationManagementModule,
    BackgroundTasksIndicatorComponent,
    LucideAngularModule.pick({
      Search, Bell, MessageSquare, Moon, Sun, Sparkles, Clock, FolderOpen,
      LayoutDashboard, Folder, Calendar, CheckSquare, Wrench, Users,
      DollarSign, Headphones, PenTool, Briefcase, X, ChevronDown,
      Building2, BarChart2, Settings, Megaphone, FileText, CalendarCheck,
      MessageCircle, UserCog, BookOpen, Receipt, ScrollText, Square
    })
  ],
  exports: [
    LayoutComponent
  ],
  schemas: [
    CUSTOM_ELEMENTS_SCHEMA
  ],
})
export class LayoutsModule { }
