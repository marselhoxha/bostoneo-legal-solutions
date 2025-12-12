import { NgModule } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NgbNavModule } from '@ng-bootstrap/ng-bootstrap';

// Components
import { CrmDashboardComponent } from './components/crm-dashboard/crm-dashboard.component';
import { LeadsDashboardComponent } from './components/leads-dashboard/leads-dashboard.component';
import { ConflictCheckComponent } from './components/conflict-check/conflict-check.component';
import { IntakeSubmissionsComponent } from './components/intake-submissions/intake-submissions.component';
import { ConflictChecksListComponent } from './components/conflict-checks-list/conflict-checks-list.component';

// Services
import { CrmService } from './services/crm.service';

// Routes
import { CrmRoutingModule } from './crm-routing.module';

@NgModule({
  declarations: [
    CrmDashboardComponent,
    LeadsDashboardComponent,
    ConflictCheckComponent,
    IntakeSubmissionsComponent,
    ConflictChecksListComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    NgbNavModule,
    CrmRoutingModule
  ],
  providers: [
    CrmService,
    TitleCasePipe
  ]
})
export class CrmModule { }