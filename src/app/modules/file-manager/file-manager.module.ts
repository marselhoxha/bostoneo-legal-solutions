import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { SimplebarAngularModule } from 'simplebar-angular';

import { FileManagerComponent } from './components/file-manager/file-manager.component';
import { FileVersionHistoryComponent } from './components/file-version-history/file-version-history.component';
import { FileUploadComponent } from './components/file-upload/file-upload.component';
import { UploadModalComponent } from './components/upload-modal/upload-modal.component';
import { FilePreviewModalComponent } from './components/file-preview-modal/file-preview-modal.component';
import { TemplateManagerComponent } from './components/template-manager/template-manager.component';
import { FileManagerService } from './services/file-manager.service';
import { PermissionService } from './services/permission.service';
import { FirmTemplateCustomizationComponent } from './components/firm-template-customization/firm-template-customization.component';
import { PermissionInheritanceComponent } from './components/permission-inheritance/permission-inheritance.component';

const routes: Routes = [
  { path: '', component: FileManagerComponent },
  { path: 'deleted', component: FileManagerComponent, data: { view: 'deleted' } },
  { path: 'templates', component: TemplateManagerComponent },
  { path: 'firm-templates', component: FirmTemplateCustomizationComponent },
  { path: 'permissions', component: PermissionInheritanceComponent }
];

@NgModule({
  declarations: [
    FileManagerComponent,
    FileVersionHistoryComponent,
    FileUploadComponent,
    UploadModalComponent,
    FilePreviewModalComponent,
    TemplateManagerComponent,
    FirmTemplateCustomizationComponent,
    PermissionInheritanceComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes),
    NgbModule,
    SimplebarAngularModule
  ],
  providers: [
    FileManagerService,
    PermissionService
  ]
})
export class FileManagerModule { }