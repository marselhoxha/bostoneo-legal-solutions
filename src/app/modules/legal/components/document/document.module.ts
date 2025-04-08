import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { DocumentListComponent } from './document-list/document-list.component';
import { DocumentDetailComponent } from './document-detail/document-detail.component';
import { DocumentService } from '../../services/document.service';

const routes: Routes = [
  { path: '', component: DocumentListComponent },
  { path: 'new', component: DocumentDetailComponent },
  { path: ':id', component: DocumentDetailComponent },
  { path: ':id/edit', component: DocumentDetailComponent }
];

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes),
    DocumentListComponent,
    DocumentDetailComponent
  ],
  providers: [DocumentService]
})
export class DocumentModule { } 