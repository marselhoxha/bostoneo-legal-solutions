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
import { FileManagerService } from './services/file-manager.service';

const routes: Routes = [
  { path: '', component: FileManagerComponent }
];

@NgModule({
  declarations: [
    FileManagerComponent,
    FileVersionHistoryComponent,
    FileUploadComponent,
    UploadModalComponent,
    FilePreviewModalComponent
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
    FileManagerService
  ]
})
export class FileManagerModule { }