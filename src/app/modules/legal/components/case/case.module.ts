import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { CaseListComponent } from './case-list/case-list.component';
import { CaseDetailComponent } from './case-detail/case-detail.component';
import { CaseCreateComponent } from './case-create/case-create.component';
import { CaseService } from '../../services/case.service';

@NgModule({
  declarations: [
    CaseListComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatSnackBarModule,
    MatButtonModule,
    MatIconModule,
    NgbTooltipModule,
    CaseCreateComponent,
    CaseDetailComponent,
    RouterModule.forChild([
      {
        path: '',
        component: CaseListComponent
      },
      {
        path: 'new',
        component: CaseCreateComponent
      },
      {
        path: ':id',
        component: CaseDetailComponent
      }
    ])
  ],
  providers: [CaseService]
})
export class CaseModule { } 