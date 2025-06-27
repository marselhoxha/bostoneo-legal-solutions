import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { DndModule } from 'ngx-drag-drop';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { SharedModule } from '../../shared/shared.module';

// Components
import { CaseAssignmentDashboardComponent } from '../../component/case-assignment/case-assignment-dashboard/case-assignment-dashboard.component';
import { CaseAssignmentManagementComponent } from '../../component/case-assignment/case-assignment-dashboard/case-assignment-management.component';
import { CaseAssignmentFormComponent } from '../../component/case-assignment/case-assignment-form/case-assignment-form.component';
import { TaskManagementComponent } from '../../component/case-task/task-management/task-management.component';

// Services
import { CaseAssignmentService } from '../../service/case-assignment.service';
import { CaseTaskService } from '../../service/case-task.service';

// Routing
import { CaseManagementRoutingModule } from './case-management-routing.module';

@NgModule({
  declarations: [
    CaseAssignmentDashboardComponent,
    CaseAssignmentManagementComponent,
    CaseAssignmentFormComponent,
    TaskManagementComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterModule,
    HttpClientModule,
    DndModule,
    NgbModule,
    SharedModule,
    CaseManagementRoutingModule
  ],
  providers: [
    CaseAssignmentService,
    CaseTaskService
  ],
  exports: [
    CaseAssignmentDashboardComponent,
    CaseAssignmentManagementComponent,
    CaseAssignmentFormComponent,
    TaskManagementComponent
  ]
})
export class CaseManagementModule { }
