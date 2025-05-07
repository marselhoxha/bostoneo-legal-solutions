import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SharedModule } from 'src/app/shared/shared.module';
import { DocumentListComponent } from './document-list/document-list.component';
import { DocumentDetailComponent } from './document-detail/document-detail.component';
import { DocumentVersionComponent } from './document-version/document-version.component';
import { DocumentService } from '../../services/document.service';
import { MatSnackBarModule } from '@angular/material/snack-bar';

const routes: Routes = [
  { path: '', component: DocumentListComponent },
  { path: 'create', component: DocumentDetailComponent },
  { path: ':id', component: DocumentDetailComponent },
  { path: ':id/edit', component: DocumentDetailComponent },
  { path: ':id/new-version', component: DocumentVersionComponent },
  { path: 'case/:caseId/:id/new-version', component: DocumentVersionComponent }
];

@NgModule({
  declarations: [
    DocumentListComponent,
    DocumentDetailComponent,
    DocumentVersionComponent
  ],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    FormsModule,
    ReactiveFormsModule,
    SharedModule,
    MatSnackBarModule
  ],
  providers: [DocumentService],
  exports: [
    DocumentListComponent,
    DocumentDetailComponent,
    DocumentVersionComponent
  ]
})
export class DocumentModule { } 