import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { FlatpickrModule } from 'angularx-flatpickr';
import { NgSelectModule } from '@ng-select/ng-select';

// Standalone Components (lazy loaded)
const routes: Routes = [
  {
    path: '',
    redirectTo: '/legal/ai-assistant/templates',
    pathMatch: 'full'
  },
  {
    path: 'editor/:templateId',
    loadComponent: () => import('./document-editor/document-editor.component').then(m => m.DocumentEditorComponent),
    data: { title: 'Document Editor' }
  },
  {
    path: 'wizard/:templateId',
    loadComponent: () => import('./auto-fill-wizard/auto-fill-wizard.component').then(m => m.AutoFillWizardComponent),
    data: { title: 'Auto-Fill Wizard' }
  }
];

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    FlatpickrModule.forRoot(),
    NgSelectModule,
    RouterModule.forChild(routes)
  ]
})
export class DocumentGenerationModule { }