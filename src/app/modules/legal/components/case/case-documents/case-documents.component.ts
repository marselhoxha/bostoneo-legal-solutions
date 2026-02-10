import { Component, Input, OnInit, ChangeDetectorRef, Inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CaseDocument } from '../../../interfaces/case.interface';
import { DocumentType, DocumentCategory } from '../../../interfaces/document.interface';
import { CaseDocumentsService } from '../../../services/case-documents.service';
import { FileManagerService } from '../../../../file-manager/services/file-manager.service';
import { FileItemModel, FolderModel } from '../../../../file-manager/models/file-manager.model';
import { FilePreviewModalComponent } from '../../../../file-manager/components/file-preview-modal/file-preview-modal.component';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastrService } from 'ngx-toastr';
import { User } from 'src/app/interface/user';
import Swal from 'sweetalert2';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { SharedModule } from 'src/app/shared/shared.module';
import { DOCUMENT } from '@angular/common';
import { finalize } from 'rxjs/operators';
import { Pipe, PipeTransform } from '@angular/core';
import { RbacService } from '../../../../../core/services/rbac.service';
import { TemplateService } from '../../../../file-manager/services/template.service';
import { FolderTemplate, TemplateFolderStructure } from '../../../../file-manager/models/template.model';

@Pipe({
  name: 'safe',
  standalone: true
})
export class SafePipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}
  
  transform(url: string | null, type: string = 'resourceUrl'): SafeResourceUrl | null {
    if (!url) return null;
    
    switch (type) {
      case 'resourceUrl':
        return this.sanitizer.bypassSecurityTrustResourceUrl(url);
      default:
        return this.sanitizer.bypassSecurityTrustResourceUrl(url);
    }
  }
}

@Component({
  selector: 'app-case-documents',
  standalone: true,
  imports: [CommonModule, FormsModule, SharedModule, SafePipe],
  template: `
    <div class="card">
      <div class="card-header border-bottom-dashed">
        <div class="d-flex align-items-center">
          <h5 class="card-title mb-0 flex-grow-1">
            <i class="ri-folder-3-line me-2 text-primary"></i>Case Documents
          </h5>
          <div class="flex-shrink-0">
            <button
              class="btn btn-primary rounded-pill"
              (click)="toggleUploadForm()"
            >
              <i class="ri-upload-cloud-2-line align-bottom me-1"></i>
              Upload Document
            </button>
          </div>
        </div>
      </div>
      <div class="card-body p-4">
        <!-- Document Statistics -->
        <div class="row mb-4">
          <div class="col-xl-3 col-md-6">
            <div class="card card-animate border-0 overflow-hidden">
              <div class="position-absolute start-0 end-0 top-0 border-top rounded-top" style="height: 3px; background: linear-gradient(45deg, #405189, #299cdb);"></div>
              <div class="card-body">
                <div class="d-flex align-items-center">
                  <div class="flex-grow-1 overflow-hidden">
                    <p class="text-uppercase fw-medium text-muted text-truncate mb-0">Total Documents</p>
                  </div>
                  <div class="flex-shrink-0">
                    <h5 class="text-primary fs-14 mb-0">
                      <i class="ri-file-text-line align-middle"></i>
                    </h5>
                  </div>
                </div>
                <div class="d-flex align-items-end justify-content-between mt-2">
                  <div>
                    <h4 class="fs-22 fw-semibold ff-secondary mb-2">
                      <span class="counter-value" [attr.data-target]="getDocumentStats().totalCount">{{getDocumentStats().totalCount}}</span>
                    </h4>
                    <span class="badge bg-success-subtle text-success fs-12">
                      <i class="ri-arrow-up-s-line fs-13 align-middle"></i>
                      {{getDocumentStats().fileManagerCount}} from File Manager
                    </span>
                  </div>
                  <div class="avatar-sm flex-shrink-0">
                    <span class="avatar-title bg-primary-subtle rounded fs-3">
                      <i class="bx bx-file text-primary"></i>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="col-xl-3 col-md-6">
            <div class="card card-animate border-0 overflow-hidden">
              <div class="position-absolute start-0 end-0 top-0 border-top rounded-top" style="height: 3px; background: linear-gradient(45deg, #0ab39c, #20c997);"></div>
              <div class="card-body">
                <div class="d-flex align-items-center">
                  <div class="flex-grow-1 overflow-hidden">
                    <p class="text-uppercase fw-medium text-muted text-truncate mb-0">Storage Used</p>
                  </div>
                  <div class="flex-shrink-0">
                    <h5 class="text-success fs-14 mb-0">
                      <i class="ri-hard-drive-2-line align-middle"></i>
                    </h5>
                  </div>
                </div>
                <div class="d-flex align-items-end justify-content-between mt-2">
                  <div>
                    <h4 class="fs-22 fw-semibold ff-secondary mb-2">
                      <span class="counter-value">{{formatFileSize(getDocumentStats().totalSize)}}</span>
                    </h4>
                    <span class="badge bg-info-subtle text-info fs-12">
                      <i class="ri-database-2-line fs-13 align-middle"></i>
                      {{getDocumentStats().averageSize}} avg
                    </span>
                  </div>
                  <div class="avatar-sm flex-shrink-0">
                    <span class="avatar-title bg-success-subtle rounded fs-3">
                      <i class="bx bx-data text-success"></i>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="col-xl-3 col-md-6">
            <div class="card card-animate border-0 overflow-hidden">
              <div class="position-absolute start-0 end-0 top-0 border-top rounded-top" style="height: 3px; background: linear-gradient(45deg, #f7b84b, #fd7e14);"></div>
              <div class="card-body">
                <div class="d-flex align-items-center">
                  <div class="flex-grow-1 overflow-hidden">
                    <p class="text-uppercase fw-medium text-muted text-truncate mb-0">Recent Activity</p>
                  </div>
                  <div class="flex-shrink-0">
                    <h5 class="text-warning fs-14 mb-0">
                      <i class="ri-time-line align-middle"></i>
                    </h5>
                  </div>
                </div>
                <div class="d-flex align-items-end justify-content-between mt-2">
                  <div>
                    <h4 class="fs-22 fw-semibold ff-secondary mb-2">
                      <span class="counter-value">{{getDocumentStats().recentCount}}</span>
                    </h4>
                    <span class="badge bg-warning-subtle text-warning fs-12">
                      <i class="ri-calendar-line fs-13 align-middle"></i>
                      Last 7 days
                    </span>
                  </div>
                  <div class="avatar-sm flex-shrink-0">
                    <span class="avatar-title bg-warning-subtle rounded fs-3">
                      <i class="bx bx-time text-warning"></i>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="col-xl-3 col-md-6">
            <div class="card card-animate border-0 overflow-hidden">
              <div class="position-absolute start-0 end-0 top-0 border-top rounded-top" style="height: 3px; background: linear-gradient(45deg, #f06548, #ef476f);"></div>
              <div class="card-body">
                <div class="d-flex align-items-center">
                  <div class="flex-grow-1 overflow-hidden">
                    <p class="text-uppercase fw-medium text-muted text-truncate mb-0">Document Types</p>
                  </div>
                  <div class="flex-shrink-0">
                    <h5 class="text-danger fs-14 mb-0">
                      <i class="ri-bar-chart-2-line align-middle"></i>
                    </h5>
                  </div>
                </div>
                <div class="d-flex align-items-end justify-content-between mt-2">
                  <div>
                    <h4 class="fs-22 fw-semibold ff-secondary mb-2">
                      <span class="counter-value">{{getDocumentStats().typeCount}}</span>
                    </h4>
                    <span class="badge bg-danger-subtle text-danger fs-12">
                      <i class="ri-price-tag-3-line fs-13 align-middle"></i>
                      Different types
                    </span>
                  </div>
                  <div class="avatar-sm flex-shrink-0">
                    <span class="avatar-title bg-danger-subtle rounded fs-3">
                      <i class="bx bx-category text-danger"></i>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Split-Panel Layout (always show) -->
          <div class="row g-0">
            <!-- Left: Folder Tree Sidebar -->
            <div class="col-md-3 col-12 mb-3 mb-md-0">
              <div class="folder-tree-sidebar">
                <div class="folder-tree-header d-flex align-items-center justify-content-between">
                  <span class="fs-13 fw-semibold text-uppercase text-muted">Folders</span>
                  <div class="d-flex gap-1">
                    <button class="btn btn-sm btn-soft-secondary p-0 tree-action-btn"
                            (click)="createFolderStructure()"
                            title="Create Folder Structure from Template">
                      <i class="ri-node-tree fs-14"></i>
                    </button>
                    <button class="btn btn-sm btn-soft-primary p-0 tree-action-btn"
                            (click)="createNewFolder()"
                            title="New Folder">
                      <i class="ri-folder-add-line fs-14"></i>
                    </button>
                  </div>
                </div>

                <!-- All Documents -->
                <div class="tree-item"
                     [class.active]="selectedFolderId === null"
                     (click)="selectFolder(null)">
                  <div class="d-flex align-items-center">
                    <i class="ri-file-list-3-line me-2 fs-16 text-primary"></i>
                    <span class="tree-item-name flex-grow-1">All Documents</span>
                    <span class="badge bg-primary-subtle text-primary rounded-pill ms-auto">{{combinedDocuments.length}}</span>
                  </div>
                </div>

                <hr class="my-1 opacity-25">

                <!-- Loading state -->
                @if(isLoadingFolders || isCreatingStructure) {
                  <div class="text-center py-3">
                    <div class="spinner-border spinner-border-sm text-primary" role="status">
                      <span class="visually-hidden">Loading...</span>
                    </div>
                    @if(isCreatingStructure) {
                      <p class="text-muted fs-12 mt-2 mb-0">Creating folder structure...</p>
                    }
                  </div>
                }

                <!-- Empty state: no folders yet -->
                @if(!isLoadingFolders && !isCreatingStructure && topLevelFolders.length === 0) {
                  <div class="text-center py-3 px-2">
                    <i class="ri-folder-line fs-24 text-muted d-block mb-2"></i>
                    <p class="text-muted fs-12 mb-2">No folder structure yet</p>
                    <button class="btn btn-sm btn-soft-primary w-100 mb-2" (click)="createFolderStructure()">
                      <i class="ri-folder-add-line me-1"></i> Create Folder Structure
                    </button>
                    <button class="btn btn-sm btn-soft-secondary w-100" (click)="createNewFolder()">
                      <i class="ri-add-line me-1"></i> New Empty Folder
                    </button>
                  </div>
                }

                <!-- Folder tree -->
                @for(folder of topLevelFolders; track folder.id) {
                  <ng-container>
                    <!-- Parent folder row -->
                    <div class="tree-item"
                         [class.active]="selectedFolderId === folder.id"
                         [class.drag-over]="dragOverFolderId === folder.id"
                         (click)="selectFolder(folder)"
                         (dragover)="onTreeFolderDragOver($event, folder)"
                         (dragleave)="onTreeFolderDragLeave($event)"
                         (drop)="onTreeFolderDrop($event, folder)">
                      <div class="d-flex align-items-center">
                        @if(hasChildren(folder.id)) {
                          <button class="btn btn-sm tree-expand-btn p-0 me-1"
                                  (click)="toggleFolderExpand(folder.id, $event)">
                            <i [class]="isFolderExpanded(folder.id) ? 'ri-arrow-down-s-fill' : 'ri-arrow-right-s-fill'" class="fs-14"></i>
                          </button>
                        } @else {
                          <span class="tree-expand-spacer me-1"></span>
                        }
                        <i class="ri-folder-fill text-warning me-2 fs-16"></i>
                        <span class="tree-item-name flex-grow-1 text-truncate" [title]="folder.name">{{folder.name}}</span>
                        @if(folder.fileCount) {
                          <span class="badge bg-light text-muted rounded-pill ms-1 fs-10">{{folder.fileCount}}</span>
                        }
                        <button class="btn btn-sm tree-delete-btn p-0 ms-1"
                                (click)="deleteFolderConfirm(folder, $event)"
                                title="Delete folder">
                          <i class="ri-delete-bin-line fs-12"></i>
                        </button>
                      </div>
                    </div>

                    <!-- Child folders (expanded) -->
                    @if(isFolderExpanded(folder.id)) {
                      @for(child of getChildFolders(folder.id); track child.id) {
                        <div class="tree-item tree-child"
                             [class.active]="selectedFolderId === child.id"
                             [class.drag-over]="dragOverFolderId === child.id"
                             (click)="selectFolder(child)"
                             (dragover)="onTreeFolderDragOver($event, child)"
                             (dragleave)="onTreeFolderDragLeave($event)"
                             (drop)="onTreeFolderDrop($event, child)">
                          <div class="d-flex align-items-center">
                            @if(hasChildren(child.id)) {
                              <button class="btn btn-sm tree-expand-btn p-0 me-1"
                                      (click)="toggleFolderExpand(child.id, $event)">
                                <i [class]="isFolderExpanded(child.id) ? 'ri-arrow-down-s-fill' : 'ri-arrow-right-s-fill'" class="fs-14"></i>
                              </button>
                            } @else {
                              <span class="tree-expand-spacer me-1"></span>
                            }
                            <i class="ri-folder-line text-warning me-2 fs-14"></i>
                            <span class="tree-item-name flex-grow-1 text-truncate" [title]="child.name">{{child.name}}</span>
                            @if(child.fileCount) {
                              <span class="badge bg-light text-muted rounded-pill ms-1 fs-10">{{child.fileCount}}</span>
                            }
                            <button class="btn btn-sm tree-delete-btn p-0 ms-1"
                                    (click)="deleteFolderConfirm(child, $event)"
                                    title="Delete folder">
                              <i class="ri-delete-bin-line fs-12"></i>
                            </button>
                          </div>
                        </div>

                        <!-- Third level children -->
                        @if(isFolderExpanded(child.id)) {
                          @for(grandchild of getChildFolders(child.id); track grandchild.id) {
                            <div class="tree-item tree-grandchild"
                                 [class.active]="selectedFolderId === grandchild.id"
                                 [class.drag-over]="dragOverFolderId === grandchild.id"
                                 (click)="selectFolder(grandchild)"
                                 (dragover)="onTreeFolderDragOver($event, grandchild)"
                                 (dragleave)="onTreeFolderDragLeave($event)"
                                 (drop)="onTreeFolderDrop($event, grandchild)">
                              <div class="d-flex align-items-center">
                                @if(hasChildren(grandchild.id)) {
                                  <button class="btn btn-sm tree-expand-btn p-0 me-1"
                                          (click)="toggleFolderExpand(grandchild.id, $event)">
                                    <i [class]="isFolderExpanded(grandchild.id) ? 'ri-arrow-down-s-fill' : 'ri-arrow-right-s-fill'" class="fs-14"></i>
                                  </button>
                                } @else {
                                  <span class="tree-expand-spacer me-1"></span>
                                }
                                <i class="ri-folder-line text-muted me-2 fs-14"></i>
                                <span class="tree-item-name flex-grow-1 text-truncate" [title]="grandchild.name">{{grandchild.name}}</span>
                                @if(grandchild.fileCount) {
                                  <span class="badge bg-light text-muted rounded-pill ms-1 fs-10">{{grandchild.fileCount}}</span>
                                }
                                <button class="btn btn-sm tree-delete-btn p-0 ms-1"
                                        (click)="deleteFolderConfirm(grandchild, $event)"
                                        title="Delete folder">
                                  <i class="ri-delete-bin-line fs-12"></i>
                                </button>
                              </div>
                            </div>
                          }
                        }
                      }
                    }
                  </ng-container>
                }

                <!-- New Folder button at bottom of tree -->
                <div class="tree-item" style="opacity: 0.6;">
                  <div class="d-flex align-items-center" (click)="createNewFolder()">
                    <span class="tree-expand-spacer me-1"></span>
                    <i class="ri-add-line me-2 fs-14 text-muted"></i>
                    <span class="tree-item-name text-muted fs-12">New Folder...</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Right: Content Area -->
            <div class="col-md-9 col-12">
              <div class="content-panel ps-md-3">
                <!-- Breadcrumb bar -->
                <div class="d-flex align-items-center mb-3 flex-wrap gap-2">
                  <nav aria-label="folder breadcrumb">
                    <ol class="breadcrumb mb-0 fs-13">
                      <li class="breadcrumb-item">
                        <a href="javascript:void(0);" (click)="selectFolder(null)" class="text-primary">
                          <i class="ri-folder-3-line me-1"></i>All Documents
                        </a>
                      </li>
                      @for(crumb of getSelectedFolderBreadcrumb(); track crumb.id; let last = $last) {
                        <li class="breadcrumb-item" [class.active]="last">
                          @if(!last) {
                            <a href="javascript:void(0);" (click)="selectFolder(crumb)" class="text-primary">{{crumb.name}}</a>
                          } @else {
                            <span class="text-muted">{{crumb.name}}</span>
                          }
                        </li>
                      }
                    </ol>
                  </nav>
                </div>

                <!-- Compact filters row -->
                <div class="row g-2 mb-3">
                  <div class="col-md-3 col-6">
                    <select class="form-select form-select-sm" [(ngModel)]="selectedCategory" (change)="filterDocuments()">
                      <option value="">All Categories</option>
                      @for(category of categories; track category) {
                        <option [value]="category">{{category}}</option>
                      }
                    </select>
                  </div>
                  <div class="col-md-3 col-6">
                    <select class="form-select form-select-sm" [(ngModel)]="selectedType" (change)="filterDocuments()">
                      <option value="">All Types</option>
                      @for(type of documentTypes; track type) {
                        <option [value]="type">{{type}}</option>
                      }
                    </select>
                  </div>
                  <div class="col-md-6">
                    <div class="input-group input-group-sm">
                      <span class="input-group-text"><i class="ri-search-line"></i></span>
                      <input type="text" class="form-control" placeholder="Search documents..."
                             [(ngModel)]="searchTerm" (input)="filterDocuments()">
                    </div>
                  </div>
                </div>

                <!-- Loading folder files -->
                @if(isLoadingFolderFiles) {
                  <div class="text-center py-4">
                    <div class="spinner-border spinner-border-sm text-primary" role="status">
                      <span class="visually-hidden">Loading...</span>
                    </div>
                  </div>
                } @else if(getDisplayedDocuments().length === 0) {
                  <!-- Empty state -->
                  <div class="dropzone-wrapper"
                       [class.dropzone-dragging]="isDragging"
                       (dragover)="onContentAreaDragOver($event)"
                       (dragleave)="onContentAreaDragLeave($event)"
                       (drop)="onContentAreaDrop($event)"
                       (click)="toggleUploadForm()">
                    <div class="dropzone-content">
                      <div class="dropzone-icon">
                        <i class="ri-upload-cloud-2-line"></i>
                      </div>
                      <h5 class="dropzone-title">
                        @if(selectedFolderId !== null) {
                          This folder is empty - drop files here to upload
                        } @else {
                          Drop files here or click to upload
                        }
                      </h5>
                      <p class="dropzone-subtitle">PDF, DOC, DOCX, XLS, XLSX, JPG, PNG up to 50MB</p>
                    </div>
                  </div>
                } @else {
                  <!-- Document table -->
                  <div class="table-responsive"
                       (dragover)="onContentAreaDragOver($event)"
                       (dragleave)="onContentAreaDragLeave($event)"
                       (drop)="onContentAreaDrop($event)">
                    <table class="table table-nowrap table-hover mb-0">
                      <thead class="table-light">
                        <tr>
                          <th scope="col">Document</th>
                          <th scope="col">Type</th>
                          <th scope="col">Category</th>
                          <th scope="col">Date</th>
                          <th scope="col" class="text-end">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for(document of getDisplayedDocuments(); track document.id) {
                          <tr [attr.draggable]="document.isFileManagerFile ? 'true' : null"
                              [class.draggable-row]="document.isFileManagerFile"
                              (dragstart)="onFileDragStart($event, document)"
                              (dragend)="onFileDragEnd($event)">
                            <td>
                              <div class="d-flex align-items-center">
                                <div class="avatar-sm flex-shrink-0">
                                  <span class="avatar-title bg-soft-primary text-primary rounded fs-3"
                                        [style.background-color]="document.isFileManagerFile && document.iconColor ? document.iconColor + '20' : ''"
                                        [style.color]="document.isFileManagerFile && document.iconColor ? document.iconColor : ''">
                                    <i [class]="document.isFileManagerFile && document.icon ? document.icon : 'ri-file-text-line'"></i>
                                  </span>
                                </div>
                                <div class="flex-grow-1 ms-3">
                                  <h6 class="mb-0 fs-13">{{document.title}}</h6>
                                  @if(document.isFileManagerFile && document.size) {
                                    <small class="text-muted">{{formatFileSize(document.size)}}</small>
                                  }
                                </div>
                              </div>
                            </td>
                            <td>
                              @if(document.type) {
                                <span class="badge bg-primary-subtle text-primary">{{document.type | titlecase}}</span>
                              } @else {
                                <span class="text-muted">-</span>
                              }
                            </td>
                            <td>
                              @if(document.category) {
                                <span class="badge bg-info-subtle text-info">{{document.category | titlecase}}</span>
                              } @else {
                                <span class="text-muted">-</span>
                              }
                            </td>
                            <td><span class="fs-12 text-muted">{{document.uploadedAt | date:'mediumDate'}}</span></td>
                            <td class="text-end">
                              <div class="d-flex justify-content-end gap-1">
                                <button class="btn btn-icon btn-sm btn-soft-primary"
                                        type="button"
                                        (click)="openPreviewModal(document)"
                                        title="Preview">
                                  <i class="ri-eye-line"></i>
                                </button>
                                <button class="btn btn-icon btn-sm btn-soft-danger"
                                        type="button"
                                        (click)="deleteDocument(document)"
                                        title="Delete">
                                  <i class="ri-delete-bin-line"></i>
                                </button>
                              </div>
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>

                  <!-- Drop zone hint at bottom -->
                  <div class="upload-drop-hint mt-3"
                       [class.dropzone-dragging]="isDragging"
                       (dragover)="onContentAreaDragOver($event)"
                       (dragleave)="onContentAreaDragLeave($event)"
                       (drop)="onContentAreaDrop($event)">
                    <i class="ri-upload-cloud-line me-2 text-muted"></i>
                    <span class="text-muted fs-12">Drag files here to upload</span>
                    @if(selectedFolderId !== null) {
                      <span class="text-muted fs-12"> to this folder</span>
                    }
                  </div>
                }
              </div>
            </div>
          </div>
      </div>
    </div>

    <!-- Document Preview Modal -->
    <div class="modal fade" id="documentPreviewModal" tabindex="-1" aria-labelledby="documentPreviewModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-xl modal-dialog-centered">
        <div class="modal-content border-0">
          <div class="modal-header bg-light">
            <h5 class="modal-title" id="documentPreviewModalLabel">{{ selectedDocument?.title }}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" (click)="closePreview()"></button>
          </div>
          <div class="modal-body p-0 position-relative">
            <!-- Loading spinner -->
            <div *ngIf="isPreviewLoading" class="position-absolute w-100 h-100 d-flex align-items-center justify-content-center bg-white" style="z-index: 2;">
              <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading preview...</span>
              </div>
            </div>
            
            <!-- Document preview container -->
            <div *ngIf="previewUrl && !previewError" class="document-preview-container border rounded" style="height: 70vh; overflow: auto;">
              <iframe [src]="previewUrl" style="width: 100%; height: 100%; border: none;"></iframe>
            </div>
            
            <!-- Error state -->
            <div *ngIf="previewError && !isPreviewLoading" class="text-center py-5">
              <div class="avatar-lg mx-auto mb-4">
                <div class="avatar-title bg-soft-warning text-warning rounded-circle fs-1">
                  <i class="ri-error-warning-line"></i>
                </div>
              </div>
              <h5>Preview Unavailable</h5>
              <p class="text-muted">{{ previewError }}</p>
              <button type="button" class="btn btn-primary btn-sm mt-2" (click)="downloadDocument(selectedDocument?.id)">
                <i class="ri-download-line align-bottom me-1"></i> Download Document
              </button>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-light" data-bs-dismiss="modal" (click)="closePreview()">Close</button>
            <button type="button" class="btn btn-primary" (click)="downloadDocument(selectedDocument?.id)" [disabled]="!selectedDocument">
              <i class="ri-download-line align-bottom me-1"></i> Download
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Version History Modal -->
    @if(documentForVersionHistory) {
      <div class="modal fade show" style="display: block;" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Version History - {{documentForVersionHistory.title}}</h5>
              <button type="button" class="btn-close" (click)="closeVersionHistory()"></button>
            </div>
            <div class="modal-body">
              <div class="table-responsive">
                <table class="table table-nowrap mb-0">
                  <thead class="table-light">
                    <tr>
                      <th>Version</th>
                      <th>Changes</th>
                      <th>Uploaded By</th>
                      <th>Date</th>
                      <th class="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for(version of documentForVersionHistory.versions; track version.id) {
                      <tr>
                        <td>v{{version.versionNumber}}</td>
                        <td>{{version.changes}}</td>
                        <td>
                          @if(version.uploadedBy) {
                            {{version.uploadedBy.firstName}} {{version.uploadedBy.lastName}}
                          } @else {
                            <span class="text-muted">Unknown</span>
                          }
                        </td>
                        <td>{{version.uploadedAt | date:'mediumDate'}}</td>
                        <td class="text-end">
                          <button class="btn btn-soft-primary btn-sm" (click)="downloadVersion(documentForVersionHistory.id, version.id)">
                            <i class="ri-download-line align-bottom"></i>
                          </button>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-backdrop fade show"></div>
    }

    <!-- New Version Upload Modal -->
    @if(documentForNewVersion) {
      <div class="modal fade show" style="display: block;" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Upload New Version</h5>
              <button type="button" class="btn-close" (click)="closeNewVersionUpload()"></button>
            </div>
            <div class="modal-body">
              <div class="mb-3">
                <label class="form-label">Version Notes</label>
                <textarea 
                  class="form-control" 
                  rows="3" 
                  placeholder="Enter version notes"
                  [(ngModel)]="versionNotes"
                ></textarea>
              </div>
              <div class="mb-3">
                <label class="form-label">File</label>
                <input 
                  type="file" 
                  class="form-control" 
                  (change)="onNewVersionFileSelected($event)"
                >
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-backdrop fade show"></div>
    }

    <!-- Upload Document Modal -->
    @if(isUploading) {
      <div class="modal fade show" style="display: block;" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">
                <i class="ri-upload-cloud-line me-2"></i>Upload Document
              </h5>
              <button type="button" class="btn-close" (click)="toggleUploadForm()"></button>
            </div>
            <div class="modal-body">
              <div class="mb-3">
                <label class="form-label">Document Title <span class="text-danger">*</span></label>
                <input
                  type="text"
                  class="form-control"
                  placeholder="Enter document title"
                  [(ngModel)]="newDocument.title"
                >
              </div>
              <div class="row">
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label">Document Type <span class="text-danger">*</span></label>
                    <select class="form-select" [(ngModel)]="newDocument.type">
                      <option [ngValue]="null" disabled>-- Select Type --</option>
                      @for(type of documentTypes; track type) {
                        <option [ngValue]="type">{{type | titlecase}}</option>
                      }
                    </select>
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label">Category <span class="text-danger">*</span></label>
                    <select class="form-select" [(ngModel)]="newDocument.category">
                      <option [ngValue]="null" disabled>-- Select Category --</option>
                      @for(category of categories; track category) {
                        <option [ngValue]="category">{{category | titlecase}}</option>
                      }
                    </select>
                  </div>
                </div>
              </div>
              <div class="mb-3">
                <label class="form-label">Description</label>
                <textarea
                  class="form-control"
                  rows="3"
                  placeholder="Enter document description (optional)"
                  [(ngModel)]="newDocument.description"
                ></textarea>
              </div>
              <div class="mb-3">
                <label class="form-label">Tags</label>
                <input
                  type="text"
                  class="form-control"
                  placeholder="Enter tags (comma separated)"
                  [(ngModel)]="tagsInput"
                >
              </div>
              <div class="mb-3">
                <label class="form-label">File <span class="text-danger">*</span></label>
                @if(selectedFile) {
                  <div class="selected-file-display">
                    <div class="d-flex align-items-center">
                      <i class="ri-file-text-line fs-20 text-primary me-2"></i>
                      <div class="flex-grow-1">
                        <div class="fw-medium">{{selectedFile.name}}</div>
                        <small class="text-muted">{{formatFileSize(selectedFile.size)}}</small>
                      </div>
                      <button type="button" class="btn btn-sm btn-ghost-danger" (click)="clearSelectedFile($event)">
                        <i class="ri-close-line"></i>
                      </button>
                    </div>
                  </div>
                } @else {
                  <div class="file-upload-box" (click)="fileInput.click()">
                    <input
                      type="file"
                      class="d-none"
                      #fileInput
                      (change)="onFileSelected($event)"
                    >
                    <i class="ri-upload-2-line fs-24 text-muted"></i>
                    <span class="text-muted">Click to select a file</span>
                  </div>
                }
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary" (click)="toggleUploadForm()">
                Cancel
              </button>
              <button
                type="button"
                class="btn btn-primary"
                (click)="uploadDocument()"
                [disabled]="!isFormValid()"
              >
                <i class="ri-upload-cloud-line me-1"></i>Upload Document
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-backdrop fade show"></div>
    }
  `,
  styles: [`
    .avatar-sm {
      width: 2.5rem;
      height: 2.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .bg-soft-primary {
      background-color: rgba(64, 81, 137, 0.18) !important;
    }
    .avatar-lg {
      height: 5rem;
      width: 5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto;
    }
    
    .avatar-title {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    /* Fix for dropdown menu z-index */
    .dropdown-menu {
      z-index: 9999 !important; /* Much higher z-index to ensure it appears over everything */
    }
    
    /* Modal animation */
    .modal.fade .modal-dialog {
      transition: transform .3s ease-out;
      transform: translate(0, -25%);
    }
    
    .modal.show .modal-dialog {
      transform: translate(0, 0);
    }
    
    .modal-backdrop.fade {
      opacity: 0;
      transition: opacity .15s linear;
    }
    
    .modal-backdrop.show {
      opacity: 0.5;
    }

    /* Action button styling */
    .btn-icon {
      width: 32px;
      height: 32px;
      padding: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: all 0.2s ease;
    }

    .btn-icon:hover {
      transform: translateY(-2px);
    }

    .btn-soft-primary {
      background-color: rgba(64, 81, 137, 0.1);
      color: #405189;
      border: none;
    }

    .btn-soft-danger {
      background-color: rgba(239, 71, 111, 0.1);
      color: #ef476f;
      border: none;
    }

    .btn-soft-primary:hover {
      background-color: #405189;
      color: #fff;
    }

    .btn-soft-danger:hover {
      background-color: #ef476f;
      color: #fff;
    }

    /* Activity Feed Styles */
    .activity-feed {
      border-radius: 0.375rem;
    }

    .activity-item:last-child {
      border-bottom: none !important;
    }

    .activity-item:hover {
      background-color: rgba(0, 0, 0, 0.02);
    }

    /* Statistics Cards Animation */
    .card-animate {
      transition: all 0.3s ease;
    }

    .card-animate:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .counter-value {
      font-variant-numeric: tabular-nums;
    }

    /* Gradient borders for stats cards */
    .position-absolute.start-0.end-0.top-0 {
      z-index: 1;
    }

    /* Timeline Styles */
    .timeline-container {
      position: relative;
      padding-left: 2rem;
    }

    .timeline-container::before {
      content: '';
      position: absolute;
      left: 1rem;
      top: 0;
      bottom: 0;
      width: 2px;
      background: linear-gradient(to bottom, #405189, #e9ecef);
    }

    .timeline-item {
      position: relative;
    }

    .timeline-marker {
      position: absolute;
      left: -2rem;
      top: 0;
    }

    .timeline-icon {
      width: 2rem;
      height: 2rem;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid #fff;
      box-shadow: 0 0 0 2px #e9ecef;
    }

    .timeline-content {
      background: #f8f9fa05;
      border-radius: 0.5rem;
      padding: 1rem;
      border-left: 3px solid #405189;
    }

    /* Category Card Styles */
    .category-card {
      transition: all 0.3s ease;
      cursor: pointer;
    }

    .category-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    /* Team Member Card Styles */
    .team-member-card {
      transition: all 0.3s ease;
    }

    .team-member-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .team-member-card .avatar-sm img {
      width: 2.5rem;
      height: 2.5rem;
      object-fit: cover;
    }

    .permission-icons i {
      font-size: 14px;
    }

    /* Document View Selector */
    .btn-check:checked + .btn-outline-primary {
      background-color: #405189;
      border-color: #405189;
      color: #fff;
    }

    .btn-outline-primary:hover {
      background-color: rgba(64, 81, 137, 0.1);
      border-color: #405189;
      color: #405189;
    }

    /* Dropzone Styles - Light Mode */
    .dropzone-wrapper {
      border: 2px dashed var(--vz-border-color, #e9ebec);
      border-radius: 8px;
      padding: 60px 40px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s ease;
      background: var(--vz-card-bg, #fff);
    }

    .dropzone-wrapper:hover {
      border-color: var(--vz-primary, #405189);
      background: var(--vz-primary-bg-subtle, rgba(64, 81, 137, 0.06));
    }

    .dropzone-wrapper.dropzone-dragging {
      border-color: var(--vz-primary, #405189);
      background: var(--vz-primary-bg-subtle, rgba(64, 81, 137, 0.1));
      border-style: solid;
    }

    .dropzone-icon {
      font-size: 48px;
      color: var(--vz-secondary-color, #878a99);
      margin-bottom: 16px;
      line-height: 1;
    }

    .dropzone-wrapper:hover .dropzone-icon,
    .dropzone-wrapper.dropzone-dragging .dropzone-icon {
      color: var(--vz-primary, #405189);
    }

    .dropzone-title {
      font-size: 16px;
      font-weight: 500;
      color: var(--vz-heading-color, #495057);
      margin-bottom: 8px;
    }

    .dropzone-subtitle {
      font-size: 13px;
      color: var(--vz-secondary-color, #878a99);
      margin: 0;
    }

    /* Dark Mode Support */
    [data-layout-mode="dark"] .dropzone-wrapper {
      border-color: var(--vz-border-color, #32383e);
      background: var(--vz-card-bg, #212529);
    }

    [data-layout-mode="dark"] .dropzone-wrapper:hover {
      border-color: var(--vz-primary, #405189);
      background: rgba(64, 81, 137, 0.15);
    }

    [data-layout-mode="dark"] .dropzone-wrapper.dropzone-dragging {
      background: rgba(64, 81, 137, 0.2);
    }

    [data-layout-mode="dark"] .dropzone-icon {
      color: var(--vz-secondary-color, #ced4da);
    }

    [data-layout-mode="dark"] .dropzone-title {
      color: var(--vz-heading-color, #ced4da);
    }

    [data-layout-mode="dark"] .dropzone-subtitle {
      color: var(--vz-secondary-color, #878a99);
    }

    /* File Upload Box in Modal */
    .file-upload-box {
      border: 2px dashed var(--vz-border-color, #e9ebec);
      border-radius: 6px;
      padding: 24px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }

    .file-upload-box:hover {
      border-color: var(--vz-primary, #405189);
      background: var(--vz-primary-bg-subtle, rgba(64, 81, 137, 0.06));
    }

    .selected-file-display {
      border: 1px solid var(--vz-border-color, #e9ebec);
      border-radius: 6px;
      padding: 12px;
      background: var(--vz-light, #f3f6f9);
    }

    [data-layout-mode="dark"] .file-upload-box {
      border-color: var(--vz-border-color, #32383e);
    }

    [data-layout-mode="dark"] .selected-file-display {
      background: var(--vz-light, #2a2f34);
      border-color: var(--vz-border-color, #32383e);
    }

    .btn-ghost-danger {
      color: #f06548;
      background: transparent;
      border: none;
    }

    .btn-ghost-danger:hover {
      background: rgba(240, 101, 72, 0.1);
    }

    /* Folder card styles */
    .folder-card {
      transition: all 0.2s ease;
      border-radius: 0.375rem;
    }

    .folder-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      border-color: var(--vz-primary, #405189) !important;
    }

    /* === Split-Panel Folder Tree === */
    .folder-tree-sidebar {
      background: var(--vz-card-bg, #fff);
      border: 1px solid var(--vz-border-color, #e9ebec);
      border-radius: 0.375rem;
      padding: 0.5rem 0;
      max-height: 60vh;
      overflow-y: auto;
      overflow-x: hidden;
    }

    .folder-tree-header {
      padding: 0.5rem 0.75rem;
      letter-spacing: 0.5px;
    }

    .tree-item {
      padding: 0.4rem 0.75rem;
      cursor: pointer;
      transition: all 0.15s ease;
      border-left: 3px solid transparent;
      user-select: none;
    }

    .tree-item:hover {
      background: var(--vz-primary-bg-subtle, rgba(64, 81, 137, 0.06));
    }

    .tree-item.active {
      background: var(--vz-primary-bg-subtle, rgba(64, 81, 137, 0.1));
      border-left-color: var(--vz-primary, #405189);
    }

    .tree-item.active .tree-item-name {
      color: var(--vz-primary, #405189);
      font-weight: 600;
    }

    .tree-item.drag-over {
      background: rgba(255, 193, 7, 0.15);
      border-left-color: #ffc107;
    }

    .tree-item-name {
      font-size: 13px;
      color: var(--vz-heading-color, #495057);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .tree-child {
      padding-left: 1.75rem;
    }

    .tree-grandchild {
      padding-left: 2.75rem;
    }

    .tree-expand-btn {
      width: 18px;
      height: 18px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--vz-secondary-color, #878a99);
      background: none;
      border: none;
      border-radius: 3px;
      line-height: 1;
    }

    .tree-expand-btn:hover {
      background: var(--vz-light, #f3f6f9);
      color: var(--vz-primary, #405189);
    }

    .tree-expand-spacer {
      width: 18px;
      display: inline-block;
    }

    .tree-delete-btn {
      width: 20px;
      height: 20px;
      display: none;
      align-items: center;
      justify-content: center;
      color: var(--vz-secondary-color, #878a99);
      background: none;
      border: none;
      border-radius: 3px;
      line-height: 1;
      flex-shrink: 0;
    }

    .tree-item:hover .tree-delete-btn {
      display: inline-flex;
    }

    .tree-delete-btn:hover {
      color: #ef476f;
      background: rgba(239, 71, 111, 0.1);
    }

    .tree-action-btn {
      width: 24px;
      height: 24px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
    }

    .content-panel {
      min-height: 300px;
    }

    /* Draggable rows */
    .draggable-row {
      cursor: grab;
    }

    .draggable-row:active {
      cursor: grabbing;
      opacity: 0.7;
    }

    /* Upload drop hint */
    .upload-drop-hint {
      border: 1px dashed var(--vz-border-color, #e9ebec);
      border-radius: 6px;
      padding: 0.5rem 1rem;
      text-align: center;
      transition: all 0.2s ease;
    }

    .upload-drop-hint.dropzone-dragging {
      border-color: var(--vz-primary, #405189);
      background: var(--vz-primary-bg-subtle, rgba(64, 81, 137, 0.06));
    }

    /* Dark mode support for folder tree */
    [data-layout-mode="dark"] .folder-tree-sidebar {
      background: var(--vz-card-bg, #212529);
      border-color: var(--vz-border-color, #32383e);
    }

    [data-layout-mode="dark"] .tree-item:hover {
      background: rgba(64, 81, 137, 0.15);
    }

    [data-layout-mode="dark"] .tree-item.active {
      background: rgba(64, 81, 137, 0.2);
    }

    /* Scrollbar styling for folder tree */
    .folder-tree-sidebar::-webkit-scrollbar {
      width: 4px;
    }

    .folder-tree-sidebar::-webkit-scrollbar-track {
      background: transparent;
    }

    .folder-tree-sidebar::-webkit-scrollbar-thumb {
      background: var(--vz-border-color, #e9ebec);
      border-radius: 4px;
    }
  `]
})
export class CaseDocumentsComponent implements OnInit, OnDestroy {
  @Input() caseId!: string | number;

  documents: CaseDocument[] = [];
  filteredDocuments: CaseDocument[] = [];
  fileManagerFiles: FileItemModel[] = [];
  combinedDocuments: any[] = [];
  isUploading: boolean = false;
  isLoading: boolean = false;
  selectedFile: File | null = null;
  selectedDocument: CaseDocument | null = null;
  documentForVersionHistory: CaseDocument | null = null;
  documentForNewVersion: string | null = null;
  selectedCategory: string = '';
  selectedType: string = '';
  searchTerm: string = '';
  tagsInput: string = '';
  versionNotes: string = '';
  selectedVersionFile: File | null = null;
  versionFileName: string = '';
  isUploadingVersion: boolean = false;
  activeVersionDocument: any = null;
  currentObjectUrl: string | null = null;
  previewUrl: SafeResourceUrl | null = null;
  previewError: string | null = null;
  isPreviewLoading: boolean = false;
  showAllActivity: boolean = false;
  isDragging: boolean = false;
  currentView: 'activity' | 'timeline' | 'categories' | 'team' | 'deadlines' = 'activity';
  deadlineFilter: 'upcoming' | 'overdue' | 'all' = 'upcoming';

  // Folder tree state (split-panel layout)
  caseFolders: FolderModel[] = [];
  topLevelFolders: FolderModel[] = [];
  folderChildrenMap: Map<number, FolderModel[]> = new Map();
  allFoldersMap: Map<number, FolderModel> = new Map();
  expandedFolderIds: Set<number> = new Set();
  selectedFolderId: number | null = null; // null = "All Documents"
  selectedFolderFiles: any[] = [];
  dragOverFolderId: number | null = null;
  draggingFileId: number | null = null;
  isLoadingFolders: boolean = false;
  isLoadingFolderFiles: boolean = false;
  isCreatingStructure: boolean = false;

  documentTypes = Object.values(DocumentType);
  allCategories = Object.values(DocumentCategory);
  
  // Dynamic categories based on user role
  categories: DocumentCategory[] = [];
  
  // Category descriptions for user guidance
  categoryDescriptions: {[key: string]: string} = {
    PUBLIC: 'Documents accessible to all parties including clients (contracts, court orders)',
    INTERNAL: 'Internal documents visible to staff only (research, briefs)',
    CONFIDENTIAL: 'Sensitive documents for attorneys and admins only (financial, strategy)',
    ATTORNEY_CLIENT_PRIVILEGE: 'Privileged communications protected by attorney-client privilege'
  };

  newDocument: Partial<CaseDocument> = {
    title: '',
    type: null as unknown as DocumentType,
    category: null as unknown as DocumentCategory,
    description: '',
    tags: []
  };

  uploadForm: FormGroup;

  constructor(
    private documentsService: CaseDocumentsService,
    private fileManagerService: FileManagerService,
    private fb: FormBuilder,
    private modalService: NgbModal,
    private toastr: ToastrService,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef,
    @Inject(DOCUMENT) private document: Document,
    private rbacService: RbacService,
    private templateService: TemplateService
  ) {
    this.uploadForm = this.fb.group({
      title: ['', Validators.required],
      type: [null, Validators.required],
      category: [null, Validators.required],
      description: [''],
      tags: ['']
    });
  }

  ngOnInit(): void {
    // Set available categories based on user role
    this.setAvailableCategories();

    if (this.caseId) {
      this.loadDocuments();
      this.loadFileManagerFiles();
      this.loadCaseFolders();
    } else {
      console.error('No case ID provided. Documents cannot be loaded.');
      this.toastr.error('Unable to load documents - missing case ID');
      this.documents = [];
      this.filteredDocuments = [];
    }

    // Initialize Bootstrap dropdowns
    this.initDropdowns();
  }
  
  ngOnDestroy(): void {
    // Clean up any resources
    this.revokeCurrentObjectUrl();
    this.document.body.classList.remove('modal-open');
  }
  
  // Initialize Bootstrap dropdowns
  private initDropdowns(): void {
    try {
      // Check if we're in a browser environment with the proper Bootstrap JS
      if (typeof window !== 'undefined' && (window as any).bootstrap) {
        setTimeout(() => {
          const dropdownElements = this.document.querySelectorAll('.dropdown-toggle');
          dropdownElements.forEach(dropdownToggle => {
            new (window as any).bootstrap.Dropdown(dropdownToggle);
          });
        }, 500);
      }
      
      // Add global event listener for dropdown show events to fix z-index issues
      document.addEventListener('shown.bs.dropdown', (event) => {
        // Force higher z-index when dropdown is shown
        const dropdown = (event.target as HTMLElement).querySelector('.dropdown-menu');
        if (dropdown) {
          (dropdown as HTMLElement).style.zIndex = '9999';
        }
      });
      
      // Add style directly to head to ensure it's applied globally
      const style = document.createElement('style');
      style.innerHTML = `
        .dropdown-menu.show {
          z-index: 9999 !important;
        }
      `;
      document.head.appendChild(style);
    } catch (error) {
      console.error('Error initializing Bootstrap dropdowns:', error);
    }
  }

  loadFileManagerFiles(): void {
    // Load files from file manager for this case
    this.fileManagerService.getFilesByCase(Number(this.caseId), 0, 100).subscribe({
      next: (response) => {
        this.fileManagerFiles = response.content || [];
        this.combineCaseDocuments();
      },
      error: (error) => {
        console.error('Error loading file manager files:', error);
        this.fileManagerFiles = [];
        this.combineCaseDocuments();
      }
    });
  }

  loadCaseFolders(): void {
    this.isLoadingFolders = true;
    this.fileManagerService.getFoldersByCase(Number(this.caseId)).subscribe({
      next: (folders) => {
        // API returns only ROOT folders for this case
        this.caseFolders = folders || [];
        this.topLevelFolders = [...this.caseFolders].sort((a, b) => a.name.localeCompare(b.name));
        // Index root folders
        for (const folder of this.topLevelFolders) {
          this.allFoldersMap.set(folder.id, folder);
        }
        this.isLoadingFolders = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading case folders:', error);
        this.caseFolders = [];
        this.topLevelFolders = [];
        this.isLoadingFolders = false;
        this.cdr.detectChanges();
      }
    });
  }

  getChildFolders(parentId: number): FolderModel[] {
    return this.folderChildrenMap.get(parentId) || [];
  }

  hasChildren(folderId: number): boolean {
    // Check loaded children first, then fall back to hasChildren flag from API
    const loaded = this.folderChildrenMap.get(folderId);
    if (loaded && loaded.length > 0) return true;
    const folder = this.allFoldersMap.get(folderId);
    return folder?.hasChildren || (folder?.folderCount || 0) > 0;
  }

  toggleFolderExpand(folderId: number, event: Event): void {
    event.stopPropagation();
    if (this.expandedFolderIds.has(folderId)) {
      this.expandedFolderIds.delete(folderId);
    } else {
      this.expandedFolderIds.add(folderId);
      // Lazy-load children if not already loaded
      if (!this.folderChildrenMap.has(folderId)) {
        this.loadFolderChildren(folderId);
      }
    }
  }

  private loadFolderChildren(folderId: number): void {
    this.fileManagerService.getFolderContents(folderId).subscribe({
      next: (response) => {
        const childFolders = (response.folders || []) as FolderModel[];
        childFolders.sort((a: FolderModel, b: FolderModel) => a.name.localeCompare(b.name));
        this.folderChildrenMap.set(folderId, childFolders);
        // Index the child folders so breadcrumb and expand work for them
        for (const child of childFolders) {
          this.allFoldersMap.set(child.id, child);
        }
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading children for folder:', folderId, error);
        this.folderChildrenMap.set(folderId, []);
        this.cdr.detectChanges();
      }
    });
  }

  isFolderExpanded(folderId: number): boolean {
    return this.expandedFolderIds.has(folderId);
  }

  selectFolder(folder: FolderModel | null): void {
    if (folder === null) {
      // "All Documents" selected
      this.selectedFolderId = null;
      this.selectedFolderFiles = [];
      return;
    }

    this.selectedFolderId = folder.id;
    this.isLoadingFolderFiles = true;

    // Auto-expand parent folders to show selection context
    this.expandParents(folder.id);

    this.fileManagerService.getFolderContents(folder.id).subscribe({
      next: (response) => {
        this.selectedFolderFiles = (response.files || []).map((file: any) => this.mapFileToDocument(file));
        // Also populate children if not yet loaded
        const childFolders = (response.folders || []) as FolderModel[];
        if (childFolders.length > 0) {
          childFolders.sort((a: FolderModel, b: FolderModel) => a.name.localeCompare(b.name));
          this.folderChildrenMap.set(folder.id, childFolders);
          for (const child of childFolders) {
            this.allFoldersMap.set(child.id, child);
          }
        }
        this.isLoadingFolderFiles = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading folder contents:', error);
        this.selectedFolderFiles = [];
        this.isLoadingFolderFiles = false;
        this.cdr.detectChanges();
      }
    });
  }

  private expandParents(folderId: number): void {
    const folder = this.allFoldersMap.get(folderId);
    if (folder?.parentId) {
      this.expandedFolderIds.add(folder.parentId);
      this.expandParents(folder.parentId);
    }
  }

  // Create folder
  createNewFolder(parentFolderId?: number): void {
    Swal.fire({
      title: 'New Folder',
      input: 'text',
      inputLabel: 'Folder name',
      inputPlaceholder: 'Enter folder name',
      showCancelButton: true,
      confirmButtonText: 'Create',
      inputValidator: (value) => {
        if (!value || !value.trim()) {
          return 'Please enter a folder name';
        }
        return null;
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        const request = {
          name: result.value.trim(),
          parentId: parentFolderId || undefined,
          caseId: Number(this.caseId)
        };
        this.fileManagerService.createFolder(request).subscribe({
          next: (folder) => {
            this.toastr.success(`Folder "${folder.name}" created`);
            // Reload folder tree
            this.folderChildrenMap.clear();
            this.allFoldersMap.clear();
            this.expandedFolderIds.clear();
            this.loadCaseFolders();
          },
          error: (error) => {
            console.error('Error creating folder:', error);
            this.toastr.error('Failed to create folder');
          }
        });
      }
    });
  }

  // Delete folder
  deleteFolderConfirm(folder: FolderModel, event: Event): void {
    event.stopPropagation();
    Swal.fire({
      title: 'Delete Folder?',
      text: `Are you sure you want to delete "${folder.name}"? This will also delete all files and subfolders inside it.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#ef476f'
    }).then((result) => {
      if (result.isConfirmed) {
        this.fileManagerService.deleteFolder(folder.id).subscribe({
          next: () => {
            this.toastr.success(`Folder "${folder.name}" deleted`);
            // If the deleted folder was selected, go back to All Documents
            if (this.selectedFolderId === folder.id) {
              this.selectedFolderId = null;
              this.selectedFolderFiles = [];
            }
            // Reload folder tree
            this.folderChildrenMap.clear();
            this.allFoldersMap.clear();
            this.expandedFolderIds.clear();
            this.loadCaseFolders();
            this.loadFileManagerFiles();
          },
          error: (error) => {
            console.error('Error deleting folder:', error);
            this.toastr.error('Failed to delete folder');
          }
        });
      }
    });
  }

  // Create folder structure from template
  createFolderStructure(): void {
    this.templateService.getTemplates().subscribe(templates => {
      const inputOptions: { [key: string]: string } = {};
      templates.forEach(t => {
        inputOptions[t.id] = t.name;
      });

      Swal.fire({
        title: 'Create Folder Structure',
        text: 'Choose a template to create the folder structure for this case.',
        input: 'select',
        inputOptions: inputOptions,
        inputPlaceholder: 'Select a template',
        showCancelButton: true,
        confirmButtonText: 'Create',
        inputValidator: (value) => {
          if (!value) {
            return 'Please select a template';
          }
          return null;
        }
      }).then((result) => {
        if (result.isConfirmed && result.value) {
          const selectedTemplate = templates.find(t => t.id === result.value);
          if (selectedTemplate) {
            this.applyFolderTemplate(selectedTemplate);
          }
        }
      });
    });
  }

  private applyFolderTemplate(template: FolderTemplate): void {
    this.isCreatingStructure = true;
    this.cdr.detectChanges();
    this.createRootFoldersSequentially(template.folders, 0, template.name);
  }

  private createRootFoldersSequentially(folders: TemplateFolderStructure[], index: number, templateName: string): void {
    if (index >= folders.length) {
      // All done
      this.toastr.success(`"${templateName}" folder structure created`);
      this.isCreatingStructure = false;
      this.folderChildrenMap.clear();
      this.allFoldersMap.clear();
      this.expandedFolderIds.clear();
      this.loadCaseFolders();
      return;
    }

    const rootFolder = folders[index];
    this.fileManagerService.createFolder({
      name: rootFolder.name,
      caseId: Number(this.caseId)
    }).subscribe({
      next: (createdRoot) => {
        if (rootFolder.subFolders?.length && createdRoot?.id) {
          this.createSubFoldersSequentially(rootFolder.subFolders, 0, createdRoot.id, () => {
            this.createRootFoldersSequentially(folders, index + 1, templateName);
          });
        } else {
          this.createRootFoldersSequentially(folders, index + 1, templateName);
        }
      },
      error: (error) => {
        console.error(`Error creating folder "${rootFolder.name}":`, error);
        // Continue with next folder even on error
        this.createRootFoldersSequentially(folders, index + 1, templateName);
      }
    });
  }

  private createSubFoldersSequentially(subFolders: TemplateFolderStructure[], index: number, parentId: number, onComplete: () => void): void {
    if (index >= subFolders.length) {
      onComplete();
      return;
    }

    this.fileManagerService.createFolder({
      name: subFolders[index].name,
      parentId: parentId,
      caseId: Number(this.caseId)
    }).subscribe({
      next: () => {
        this.createSubFoldersSequentially(subFolders, index + 1, parentId, onComplete);
      },
      error: (error) => {
        console.error(`Error creating subfolder "${subFolders[index].name}":`, error);
        this.createSubFoldersSequentially(subFolders, index + 1, parentId, onComplete);
      }
    });
  }

  private mapFileToDocument(file: any): any {
    return {
      id: file.id,
      title: file.name,
      type: file.documentStatus || this.mapMimeTypeToDocumentType(file.mimeType),
      category: file.documentCategory || 'OTHER',
      status: 'FINAL',
      description: file.description || '',
      fileName: file.originalName,
      fileUrl: file.downloadUrl,
      uploadedAt: file.createdAt,
      uploadedBy: file.createdByName ? {
        firstName: file.createdByName.split(' ')[0],
        lastName: file.createdByName.split(' ').slice(1).join(' ') || ''
      } : null,
      tags: file.tags || [],
      currentVersion: file.version || 1,
      versions: [],
      source: 'filemanager',
      isFileManagerFile: true,
      size: file.size,
      mimeType: file.mimeType,
      icon: file.icon,
      iconColor: file.iconColor
    };
  }

  getSelectedFolderBreadcrumb(): FolderModel[] {
    if (!this.selectedFolderId) return [];
    const path: FolderModel[] = [];
    let current = this.allFoldersMap.get(this.selectedFolderId);
    while (current) {
      path.unshift(current);
      current = current.parentId ? this.allFoldersMap.get(current.parentId) : undefined;
    }
    return path;
  }

  getDisplayedDocuments(): any[] {
    if (this.selectedFolderId !== null) {
      return this.selectedFolderFiles;
    }
    return this.filteredDocuments;
  }

  getFolderFileCount(folder: FolderModel): number {
    return folder.fileCount || 0;
  }

  // Drag-and-drop: file row drag from table
  onFileDragStart(event: DragEvent, doc: any): void {
    // Only allow dragging file manager files (legacy docs can't be moved)
    if (!doc.isFileManagerFile) {
      event.preventDefault();
      return;
    }
    this.draggingFileId = doc.id;
    event.dataTransfer?.setData('text/plain', String(doc.id));
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  onFileDragEnd(event: DragEvent): void {
    this.draggingFileId = null;
    this.dragOverFolderId = null;
  }

  // Drag-and-drop: folder tree as drop target
  onTreeFolderDragOver(event: DragEvent, folder: FolderModel): void {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    this.dragOverFolderId = folder.id;
  }

  onTreeFolderDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragOverFolderId = null;
  }

  onTreeFolderDrop(event: DragEvent, folder: FolderModel): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOverFolderId = null;

    const fileIdStr = event.dataTransfer?.getData('text/plain');
    if (!fileIdStr) return;

    const fileId = Number(fileIdStr);
    if (isNaN(fileId)) return;

    this.fileManagerService.moveFiles([fileId], folder.id).subscribe({
      next: () => {
        this.toastr.success(`File moved to ${folder.name}`);
        // Refresh data: reload files, clear folder cache, reload tree
        this.loadFileManagerFiles();
        this.folderChildrenMap.clear();
        this.loadCaseFolders();
        // Refresh the current view
        if (this.selectedFolderId !== null) {
          // Re-select after a brief delay to allow the folder tree to reload
          const currentFolderId = this.selectedFolderId;
          setTimeout(() => {
            const f = this.allFoldersMap.get(currentFolderId);
            if (f) this.selectFolder(f);
          }, 300);
        }
      },
      error: (error) => {
        console.error('Error moving file:', error);
        this.toastr.error('Failed to move file');
      }
    });
  }

  // External file drop on content area → upload to selected folder
  onContentAreaDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onContentAreaDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  onContentAreaDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;

    const files = event.dataTransfer?.files;
    if (!files?.length) return;

    // If we have an internal file drag (from table), ignore here
    if (this.draggingFileId) {
      this.draggingFileId = null;
      return;
    }

    // External file → upload to selected folder
    const file = files[0];
    const folderId = this.selectedFolderId || undefined;

    this.fileManagerService.uploadFile(
      file,
      folderId,
      Number(this.caseId)
    ).subscribe({
      next: (response) => {
        if (response.success) {
          this.toastr.success('File uploaded successfully');
          this.loadFileManagerFiles();
          if (this.selectedFolderId !== null) {
            this.selectFolder(this.allFoldersMap.get(this.selectedFolderId) || null);
          }
          this.loadCaseFolders();
        }
      },
      error: (error) => {
        console.error('Error uploading file:', error);
        this.toastr.error('Failed to upload file');
      }
    });
  }

  private combineCaseDocuments(): void {
    // Combine both legacy documents and file manager files
    this.combinedDocuments = [
      // Convert legacy documents to unified format
      ...this.documents.map(doc => ({
        ...doc,
        source: 'legacy',
        isFileManagerFile: false
      })),
      // Convert file manager files to unified format
      ...this.fileManagerFiles.map(file => {
        return {
          id: file.id,
          title: file.name,
          type: file.documentStatus || this.mapMimeTypeToDocumentType(file.mimeType), // documentStatus stores the type
          category: file.documentCategory || 'OTHER',
          status: 'FINAL',
          description: file.description || '',
          fileName: file.originalName,
          fileUrl: file.downloadUrl,
          uploadedAt: file.createdAt,
          uploadedBy: file.createdByName ? {
            firstName: file.createdByName.split(' ')[0],
            lastName: file.createdByName.split(' ').slice(1).join(' ') || ''
          } : null,
          tags: file.tags || [],
          currentVersion: file.version || 1,
          versions: [],
          source: 'filemanager',
          isFileManagerFile: true,
          size: file.size,
          mimeType: file.mimeType,
          icon: file.icon,
          iconColor: file.iconColor
        };
      })
    ];
    
    this.filteredDocuments = [...this.combinedDocuments];
    this.filterDocuments();
  }

  private mapMimeTypeToDocumentType(mimeType: string): DocumentType {
    if (mimeType?.includes('pdf')) return DocumentType.COURT_FILING;
    if (mimeType?.includes('word')) return DocumentType.CONTRACT;
    if (mimeType?.includes('image')) return DocumentType.EVIDENCE;
    if (mimeType?.includes('excel')) return DocumentType.FINANCIAL;
    return DocumentType.OTHER;
  }


  loadDocuments(): void {
    this.isLoading = true;
    const caseIdStr = String(this.caseId);

    this.documentsService.getDocuments(caseIdStr).subscribe({
      next: (response) => {
        try {
          // Enhanced response processing
          let docsArray: any[] = [];

          if (Array.isArray(response)) {
            docsArray = response;
          } else if (response && response.data && Array.isArray(response.data)) {
            docsArray = response.data;
          } else if (response && response.data && response.data.documents && Array.isArray(response.data.documents)) {
            docsArray = response.data.documents;
          } else {
            console.error('Unexpected response format:', response);
            this.toastr.warning('Unexpected document format received. Contact support if documents are missing.');
            docsArray = [];
          }

          // Process and normalize each document
          this.documents = docsArray.map(doc => {
            if (!doc || typeof doc !== 'object') {
              return null;
            }

            // Normalize category from string to enum if needed
            let normalizedCategory = doc.category || 'OTHER';

            // Create a normalized document object with default values
            const normalizedDoc: any = {
              id: doc.id,
              title: doc.title || 'Untitled Document',
              type: doc.type || DocumentType.OTHER,
              category: normalizedCategory,
              status: doc.status || 'FINAL',
              description: doc.description || '',
              fileName: doc.fileName || '',
              fileUrl: doc.fileUrl || doc.url || '',
              uploadedAt: doc.uploadedAt ? new Date(doc.uploadedAt) : new Date(),
              uploadedBy: doc.uploadedBy || null,
              tags: Array.isArray(doc.tags) ? doc.tags : [],
              currentVersion: doc.currentVersion || 1,
              versions: Array.isArray(doc.versions) ? doc.versions : []
            };

            return normalizedDoc;
          }).filter(doc => doc !== null);

          this.combineCaseDocuments();
        } catch (err) {
          console.error('Error processing documents response:', err);
          this.toastr.error('Error processing documents data. Please try again or contact support.');
          this.documents = [];
        }
        
        this.isLoading = false;
        this.cdr.detectChanges();
        
        // Re-initialize dropdowns after data is loaded
        this.initDropdowns();
      },
      error: (error) => {
        console.error('Error loading documents:', error);
        let errorMessage = 'Failed to load documents';
        
        if (error.status === 401) {
          errorMessage = 'Authentication error. Please log in again.';
        } else if (error.status === 403) {
          errorMessage = 'You do not have permission to access these documents.';
        } else if (error.status === 404) {
          errorMessage = 'Case or documents not found.';
        } else if (error.status >= 500) {
          errorMessage = 'Server error. Please try again later.';
        }
        
        this.toastr.error(errorMessage);
        this.documents = [];
        this.filteredDocuments = [];
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  filterDocuments(): void {
    try {
      if (!Array.isArray(this.combinedDocuments)) {
        console.error('combinedDocuments is not an array:', this.combinedDocuments);
        this.filteredDocuments = [];
        return;
      }
      
      this.filteredDocuments = this.combinedDocuments.filter(doc => {
        if (!doc) {
          console.warn('Skipping null or undefined document during filtering');
          return false;
        }
        
        try {
          // Convert values to string for comparison when needed
          const docCategory = typeof doc.category === 'string' ? doc.category : String(doc.category || '');
          const docType = typeof doc.type === 'string' ? doc.type : String(doc.type || '');
          const selectedCategoryStr = this.selectedCategory;
          const selectedTypeStr = this.selectedType;
          
          // Check if matches category filter
          const matchesCategory = !selectedCategoryStr || docCategory === selectedCategoryStr;
          
          // Check if matches type filter
          const matchesType = !selectedTypeStr || docType === selectedTypeStr;
          
          // Check if matches search term
          const matchesSearch = !this.searchTerm || 
            (doc.title || '').toLowerCase().includes(this.searchTerm.toLowerCase()) ||
            (doc.description || '').toLowerCase().includes(this.searchTerm.toLowerCase()) ||
            (Array.isArray(doc.tags) && doc.tags.some(tag => 
              tag && tag.toLowerCase().includes(this.searchTerm.toLowerCase())
            ));
          
          return matchesCategory && matchesType && matchesSearch;
        } catch (err) {
          console.error('Error filtering document:', doc, err);
          return false;
        }
      });

      // If no documents match the filters, show a message
      if (this.filteredDocuments.length === 0 && this.combinedDocuments.length > 0) {
        this.toastr.info('No documents match the current filters.');
      }
    } catch (err) {
      console.error('Error in filterDocuments:', err);
      this.toastr.error('Error filtering documents');
      this.filteredDocuments = [...this.combinedDocuments];
    }
  }

  openPreviewModal(document: any): void {
    // If this is a file manager file, use the file preview modal
    if (document.isFileManagerFile) {
      this.openFileManagerPreview(document);
      return;
    }
    
    // Reset state for legacy documents
    this.previewUrl = null;
    this.previewError = null;
    this.isPreviewLoading = true;
    this.selectedDocument = document;
    this.cdr.detectChanges();
    
    // Revoke any existing object URL
    this.revokeCurrentObjectUrl();
    
    // Manually handle modal with DOM
    const modalElement = this.document.getElementById('documentPreviewModal');
    if (modalElement) {
      try {
        // Initialize modal if bootstrap is available
        if (typeof window !== 'undefined' && (window as any).bootstrap) {
          if (!(window as any).bs_modal) {
            (window as any).bs_modal = new (window as any).bootstrap.Modal(modalElement);
          }
          (window as any).bs_modal.show();
        } else {
          // Fallback if bootstrap JS is not available
          modalElement.classList.add('show');
          modalElement.style.display = 'block';
          this.document.body.classList.add('modal-open');
          
          // Create backdrop if needed
          let backdrop = this.document.querySelector('.modal-backdrop');
          if (!backdrop) {
            backdrop = this.document.createElement('div');
            backdrop.className = 'modal-backdrop fade show';
            this.document.body.appendChild(backdrop);
          }
        }
      } catch (error) {
        console.error('Error showing modal:', error);
      }
    }
    
    // Download and preview the document
    if (!document || !document.id) {
      this.previewError = 'Invalid document';
      this.isPreviewLoading = false;
      this.cdr.detectChanges();
      return;
    }

    this.documentsService.downloadDocument(String(this.caseId), document.id)
      .pipe(
        finalize(() => {
          this.isPreviewLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (blob: Blob) => {
          if (blob && blob.size > 0) {
            // Force PDF type if filename ends with .pdf but type is incorrect
            let blobToUse = blob;
            const filename = document.fileName || '';

            // If file is PDF but content type is not set correctly, fix it
            if (filename.toLowerCase().endsWith('.pdf') && blob.type !== 'application/pdf') {
              blobToUse = new Blob([blob], { type: 'application/pdf' });
            }

            // Check blob type for preview compatibility
            if (blobToUse.type === 'application/pdf' || blobToUse.type.startsWith('image/')) {
              this.currentObjectUrl = URL.createObjectURL(blobToUse);
              this.previewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.currentObjectUrl);
              this.previewError = null;
            } else {
              this.previewError = `Preview is not available for this file type (${blobToUse.type || 'unknown'}). Please download the file instead.`;
            }
          } else {
            console.error('Received empty blob for preview.');
            this.previewError = 'Could not load document for preview (empty file).';
          }
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error downloading document for preview:', error);
          this.previewError = 'Failed to load document for preview. Please try downloading it.';
          this.previewUrl = null;
          this.cdr.detectChanges();
        }
      });
  }
  
  openFileManagerPreview(document: any): void {
    // Convert the combined document back to FileItemModel format
    const fileItem: FileItemModel = {
      id: document.id,
      name: document.title,
      originalName: document.fileName,
      size: document.size,
      mimeType: document.mimeType,
      extension: document.fileName?.split('.').pop() || '',
      icon: document.icon,
      iconColor: document.iconColor,
      description: document.description,
      createdAt: document.uploadedAt,
      updatedAt: document.uploadedAt,
      createdBy: null,
      createdByName: document.uploadedBy ? `${document.uploadedBy.firstName} ${document.uploadedBy.lastName}` : 'Unknown',
      downloadUrl: document.fileUrl,
      previewUrl: document.fileUrl,
      version: document.currentVersion,
      tags: document.tags,
      documentCategory: document.category,
      documentStatus: document.status,
      folderId: null,
      folderName: null,
      caseName: null,
      caseId: Number(this.caseId)
    };

    const modalRef = this.modalService.open(FilePreviewModalComponent, {
      size: 'xl',
      backdrop: 'static',
      keyboard: true,
      windowClass: 'file-preview-modal'
    });

    modalRef.componentInstance.file = fileItem;
  }
  
  private revokeCurrentObjectUrl(): void {
    if (this.currentObjectUrl) {
      try {
        URL.revokeObjectURL(this.currentObjectUrl);
      } catch (error) {
        console.error('Error revoking URL:', error);
      }
      this.currentObjectUrl = null;
    }
  }

  toggleUploadForm(): void {
    this.isUploading = !this.isUploading;
    if (!this.isUploading) {
      this.resetForm();
    }
  }

  resetForm(): void {
    this.newDocument = {
      title: '',
      type: null as unknown as DocumentType,
      category: null as unknown as DocumentCategory,
      description: '',
      tags: []
    };
    this.selectedFile = null;
    this.tagsInput = '';
  }

  isFormValid(): boolean {
    return !!(
      this.newDocument.title &&
      this.newDocument.type &&
      this.newDocument.category &&
      this.selectedFile
    );
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.selectedFile = input.files[0];
      // Auto-fill title with filename (without extension)
      if (!this.newDocument.title) {
        this.newDocument.title = this.getFileNameWithoutExtension(this.selectedFile.name);
      }
    }
  }

  clearSelectedFile(event: Event): void {
    event.stopPropagation();
    this.selectedFile = null;
  }

  getFileNameWithoutExtension(fileName: string): string {
    const lastDotIndex = fileName.lastIndexOf('.');
    return lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName;
  }

  // Drag and drop handlers
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;

    if (event.dataTransfer?.files?.length) {
      this.selectedFile = event.dataTransfer.files[0];
      // Auto-fill title with filename (without extension)
      this.newDocument.title = this.getFileNameWithoutExtension(this.selectedFile.name);
      this.toggleUploadForm();
    }
  }

  uploadDocument(): void {
    if (!this.isFormValid()) {
      Swal.fire({
        title: 'Error!',
        text: 'Please fill in all required fields',
        icon: 'error',
        confirmButtonText: 'OK'
      });
      return;
    }

    if (!this.selectedFile) {
      Swal.fire({
        title: 'Error!',
        text: 'Please select a file to upload',
        icon: 'error',
        confirmButtonText: 'OK'
      });
      return;
    }

    this.isUploading = true;

    // Get document type and category
    const documentType = this.newDocument.type ? String(this.newDocument.type) : undefined;
    const documentCategory = this.newDocument.category ? String(this.newDocument.category) : undefined;
    const description = this.newDocument.description || '';
    const tags = this.tagsInput || '';

    // Use File Manager service for upload - upload to selected folder if any
    const folderId = this.selectedFolderId || undefined;
    this.fileManagerService.uploadFile(
      this.selectedFile,
      folderId,
      Number(this.caseId), // caseId - link to this case
      description,
      tags,
      documentCategory,
      documentType
    ).subscribe({
      next: (response) => {
        this.loadFileManagerFiles();
        this.loadCaseFolders();
        // Refresh current folder view if a folder is selected
        if (this.selectedFolderId !== null) {
          this.selectFolder(this.allFoldersMap.get(this.selectedFolderId) || null);
        }

        // Show sweet alert success message
        Swal.fire({
          title: 'Success!',
          text: 'Document uploaded successfully',
          icon: 'success',
          confirmButtonText: 'OK'
        }).then(() => {
          // Reset the form and explicitly hide it after the alert is closed
          this.resetForm();
          this.isUploading = false;
        });
      },
      error: (error) => {
        this.isUploading = false;
        console.error('Error uploading document:', error);

        // Show sweet alert error message
        Swal.fire({
          title: 'Error!',
          text: error.message || 'Failed to upload document',
          icon: 'error',
          confirmButtonText: 'OK'
        });
      }
    });
  }

  closePreview(): void {
    // Clean up resources first
    this.revokeCurrentObjectUrl();
    
    // Close modal using DOM
    const modalElement = this.document.getElementById('documentPreviewModal');
    if (modalElement) {
      try {
        // Use bootstrap if available
        if (typeof window !== 'undefined' && (window as any).bootstrap && (window as any).bs_modal) {
          (window as any).bs_modal.hide();
          // Explicitly remove modal-open and backdrop
          this.document.body.classList.remove('modal-open');
          const backdrop = this.document.querySelector('.modal-backdrop');
          if (backdrop && backdrop.parentNode) {
            backdrop.parentNode.removeChild(backdrop);
          }
        } else {
          // Fallback
          modalElement.classList.remove('show');
          modalElement.style.display = 'none';
          this.document.body.classList.remove('modal-open');
          
          // Remove backdrop
          const backdrop = this.document.querySelector('.modal-backdrop');
          if (backdrop && backdrop.parentNode) {
            backdrop.parentNode.removeChild(backdrop);
          }
        }
      } catch (error) {
        console.error('Error closing modal:', error);
        // Force cleanup if there's an error
        this.document.body.classList.remove('modal-open');
        const backdrop = this.document.querySelector('.modal-backdrop');
        if (backdrop && backdrop.parentNode) {
          backdrop.parentNode.removeChild(backdrop);
        }
      }
    }
    
    // Reset component state
    this.selectedDocument = null;
    this.previewUrl = null;
    this.previewError = null;
    this.cdr.detectChanges();
  }

  showVersionHistory(document: any): void {
    this.documentForVersionHistory = document;

    // Load versions from backend if it's a file manager file
    if (document.isFileManagerFile && document.id) {
      this.fileManagerService.getFileVersions(document.id).subscribe({
        next: (versions) => {
          this.documentForVersionHistory = {
            ...document,
            versions: versions.map((v: any) => ({
              id: v.id,
              versionNumber: v.versionNumber || v.version,
              changes: v.comment || v.changes || 'No notes',
              uploadedAt: v.uploadedAt || v.createdAt,
              uploadedBy: v.uploadedByName ? {
                firstName: v.uploadedByName.split(' ')[0],
                lastName: v.uploadedByName.split(' ').slice(1).join(' ')
              } : null
            }))
          };
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error loading versions:', error);
        }
      });
    }
  }

  closeVersionHistory(): void {
    this.documentForVersionHistory = null;
  }

  uploadNewVersion(documentId: string): void {
    this.documentForNewVersion = documentId;
  }

  closeNewVersionUpload(): void {
    this.documentForNewVersion = null;
    this.selectedFile = null;
    this.versionNotes = '';
  }

  onNewVersionFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length && this.documentForNewVersion) {
      this.selectedFile = input.files[0];
      const formData = new FormData();
      formData.append('file', this.selectedFile);
      
      if (this.versionNotes) {
        formData.append('notes', this.versionNotes);
      }

      this.documentsService.uploadNewVersion(String(this.caseId), this.documentForNewVersion, formData).subscribe({
        next: () => {
          this.loadDocuments();
          this.closeNewVersionUpload();
          
          // Show sweet alert success message
          Swal.fire({
            title: 'Success!',
            text: 'New version uploaded successfully',
            icon: 'success',
            confirmButtonText: 'OK'
          });
        },
        error: (error) => {
          console.error('Error uploading new version:', error);
          
          // Show sweet alert error message
          Swal.fire({
            title: 'Error!',
            text: error.message || 'Failed to upload new version',
            icon: 'error',
            confirmButtonText: 'OK'
          });
        }
      });
    }
  }

  downloadDocument(documentId: string): void {
    if (!documentId) {
      this.toastr.error('Invalid document ID');
      return;
    }
    
    this.documentsService.downloadDocument(String(this.caseId), documentId).subscribe({
      next: (response) => {
        const blob = new Blob([response], { type: 'application/octet-stream' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = this.documents.find(d => d.id === documentId)?.fileName || 'document';
        link.click();
        window.URL.revokeObjectURL(url);
      },
      error: (error) => {
        console.error('Error downloading document:', error);
        this.toastr.error('Failed to download document');
      }
    });
  }

  downloadVersion(documentId: string, versionId: string): void {
    this.documentsService.downloadVersion(String(this.caseId), documentId, versionId).subscribe({
      next: (response) => {
        const blob = new Blob([response], { type: 'application/octet-stream' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = this.documents.find(d => d.id === documentId)?.fileName || 'document';
        link.click();
        window.URL.revokeObjectURL(url);
      },
      error: (error) => {
        console.error('Error downloading version:', error);
        this.toastr.error('Failed to download version');
      }
    });
  }

  deleteDocument(document: any): void {
    if (!document || !document.id) {
      console.error('Cannot delete document: Invalid document or missing ID', document);
      Swal.fire({
        title: 'Error!',
        text: 'Cannot delete document: Invalid document identifier',
        icon: 'error',
        confirmButtonText: 'OK'
      });
      return;
    }
    
    Swal.fire({
      title: 'Are you sure?',
      text: 'You will not be able to recover this document!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'No, keep it'
    }).then((result) => {
      if (result.isConfirmed) {
        try {
          if (document.isFileManagerFile) {
            // Delete file manager file
            this.fileManagerService.deleteFile(document.id).subscribe({
              next: () => {
                // Update UI - remove from both arrays
                this.fileManagerFiles = this.fileManagerFiles.filter(f => f.id !== document.id);
                this.combinedDocuments = this.combinedDocuments.filter(d => d.id !== document.id);
                this.filteredDocuments = this.filteredDocuments.filter(d => d.id !== document.id);
                this.cdr.detectChanges();

                Swal.fire({
                  title: 'Deleted!',
                  text: 'File has been deleted.',
                  icon: 'success',
                  timer: 2000,
                  showConfirmButton: false
                });
              },
              error: (error) => {
                console.error('Error deleting file manager file:', error);
                
                Swal.fire({
                  title: 'Error!',
                  text: 'Failed to delete file: ' + (error.error?.message || error.message || 'Unknown error'),
                  icon: 'error',
                  confirmButtonText: 'OK'
                });
              }
            });
          } else {
            // Delete legacy document
            this.documentsService.deleteDocument(String(this.caseId), document.id)
              .subscribe({
                next: () => {
                  // Update UI - remove from all arrays
                  this.documents = this.documents.filter(d => d.id !== document.id);
                  this.combinedDocuments = this.combinedDocuments.filter(d => d.id !== document.id);
                  this.filteredDocuments = this.filteredDocuments.filter(d => d.id !== document.id);
                  this.cdr.detectChanges();

                  Swal.fire({
                    title: 'Deleted!',
                    text: 'Document has been deleted.',
                    icon: 'success',
                    timer: 2000,
                    showConfirmButton: false
                  });
                },
                error: (error) => {
                  console.error('Error deleting document:', error);
                  
                  Swal.fire({
                    title: 'Error!',
                    text: 'Failed to delete document: ' + (error.error?.message || error.message || 'Unknown error'),
                    icon: 'error',
                    confirmButtonText: 'OK'
                  });
                }
              });
          }
        } catch (e) {
          console.error('Exception during document deletion:', e);
          
          Swal.fire({
            title: 'Error!',
            text: 'An unexpected error occurred: ' + (e instanceof Error ? e.message : 'Unknown error'),
            icon: 'error',
            confirmButtonText: 'OK'
          });
        }
      }
    });
  }

  setAvailableCategories(): void {
    const isClient = this.rbacService.hasRole('ROLE_CLIENT');
    const isAttorney = this.rbacService.isAttorneyLevel();
    const isAdmin = this.rbacService.isAdmin();
    const isParalegal = this.rbacService.hasRole('ROLE_PARALEGAL');
    const isSecretary = this.rbacService.hasRole('ROLE_SECRETARY');
    
    if (isClient) {
      // Clients can only upload PUBLIC documents
      this.categories = [DocumentCategory.PUBLIC];
    } else if (isAttorney || isAdmin) {
      // Attorneys and admins can use all categories
      this.categories = this.allCategories;
    } else if (isParalegal) {
      // Paralegals can't create attorney-client privileged documents
      this.categories = this.allCategories.filter(cat => cat !== DocumentCategory.ATTORNEY_CLIENT_PRIVILEGE);
    } else if (isSecretary) {
      // Secretaries can only create public and internal documents
      this.categories = [
        DocumentCategory.PUBLIC,
        DocumentCategory.INTERNAL
      ];
    } else {
      // Default: basic categories
      this.categories = [DocumentCategory.PUBLIC];
    }
  }
  
  // Helper method to get category description
  getCategoryDescription(category: string): string {
    return this.categoryDescriptions[category] || '';
  }

  // Helper method to get category badge class
  getCategoryBadgeClass(category: string): string {
    switch(category) {
      case 'PUBLIC':
        return 'badge bg-success-subtle text-success';
      case 'INTERNAL':
        return 'badge bg-info-subtle text-info';
      case 'CONFIDENTIAL':
        return 'badge bg-warning-subtle text-warning';
      case 'ATTORNEY_CLIENT_PRIVILEGE':
        return 'badge bg-danger-subtle text-danger';
      default:
        return 'badge bg-secondary-subtle text-secondary';
    }
  }
  
  // Helper method to get category icon
  getCategoryIcon(category: string): string {
    switch(category) {
      case 'PUBLIC':
        return 'ri-global-line'; // Globe icon for public
      case 'INTERNAL':
        return 'ri-building-line'; // Building for internal
      case 'CONFIDENTIAL':
        return 'ri-lock-line'; // Lock for confidential
      case 'ATTORNEY_CLIENT_PRIVILEGE':
        return 'ri-shield-keyhole-line'; // Shield for privileged
      default:
        return 'ri-file-text-line';
    }
  }

  // Track by function for category dropdown
  trackByCategory(index: number, category: DocumentCategory): string {
    return category;
  }

  // Helper method to format file size
  formatFileSize(size: number): string {
    if (!size) return 'Unknown';
    
    const units = ['B', 'KB', 'MB', 'GB'];
    let unitIndex = 0;
    let fileSize = size;
    
    while (fileSize >= 1024 && unitIndex < units.length - 1) {
      fileSize /= 1024;
      unitIndex++;
    }
    
    return `${fileSize.toFixed(1)} ${units[unitIndex]}`;
  }

  // Get document statistics
  getDocumentStats(): any {
    const totalCount = this.combinedDocuments.length;
    const fileManagerCount = this.fileManagerFiles.length;
    const legacyCount = totalCount - fileManagerCount;
    
    // Calculate total size (only for file manager files that have size)
    const totalSize = this.fileManagerFiles.reduce((sum, file) => sum + (file.size || 0), 0);
    
    // Calculate average size
    const averageSize = fileManagerCount > 0 ? totalSize / fileManagerCount : 0;
    
    // Count recent documents (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentCount = this.combinedDocuments.filter(doc => {
      const uploadDate = doc.uploadedAt ? new Date(doc.uploadedAt) : null;
      return uploadDate && uploadDate > sevenDaysAgo;
    }).length;
    
    // Count unique document types
    const uniqueTypes = new Set(this.combinedDocuments.map(doc => doc.type)).size;
    
    return {
      totalCount,
      fileManagerCount,
      legacyCount,
      totalSize,
      averageSize: this.formatFileSize(averageSize),
      recentCount,
      typeCount: uniqueTypes
    };
  }

  // Get recent document activity
  getRecentActivity(): any[] {
    const activities: any[] = [];
    
    // Sort documents by upload date (most recent first)
    const sortedDocs = [...this.combinedDocuments].sort((a, b) => {
      const dateA = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
      const dateB = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
      return dateB - dateA;
    });
    
    // Create activity entries for recent documents
    sortedDocs.slice(0, 10).forEach((doc, index) => {
      activities.push({
        id: `activity-${doc.id}`,
        title: `Document uploaded: ${doc.title}`,
        description: `${doc.type} document added to case`,
        timestamp: doc.uploadedAt,
        icon: this.getActivityIcon(doc.type),
        type: 'upload'
      });
    });
    
    return activities;
  }

  // Get activity icon based on document type
  private getActivityIcon(type: string): string {
    switch (type) {
      case 'PLEADING':
        return 'ri-file-text-line';
      case 'CONTRACT':
        return 'ri-file-list-line';
      case 'EVIDENCE':
        return 'ri-camera-line';
      case 'CORRESPONDENCE':
        return 'ri-mail-line';
      default:
        return 'ri-file-line';
    }
  }

  // View management methods
  setView(view: 'activity' | 'timeline' | 'categories' | 'team' | 'deadlines'): void {
    this.currentView = view;
  }

  setDeadlineFilter(filter: 'upcoming' | 'overdue' | 'all'): void {
    this.deadlineFilter = filter;
  }

  // Document timeline
  getDocumentTimeline(): any[] {
    const timeline: any[] = [];
    
    // Convert documents to timeline events
    this.combinedDocuments.forEach(doc => {
      timeline.push({
        id: `upload-${doc.id}`,
        type: 'upload',
        title: 'Document Uploaded',
        description: `${doc.title} was uploaded to the case`,
        date: doc.uploadedAt,
        documentName: doc.title,
        icon: 'ri-upload-line'
      });
    });
    
    // Add version events for documents with versions
    this.combinedDocuments.forEach(doc => {
      if (doc.versions && doc.versions.length > 1) {
        doc.versions.slice(1).forEach((version: any) => {
          timeline.push({
            id: `version-${doc.id}-${version.id}`,
            type: 'version',
            title: 'New Version',
            description: `Version ${version.versionNumber} of ${doc.title} was uploaded`,
            date: version.uploadedAt,
            documentName: doc.title,
            icon: 'ri-file-copy-line'
          });
        });
      }
    });
    
    // Sort by date (most recent first)
    return timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  getTimelineIconClass(type: string): string {
    switch (type) {
      case 'upload':
        return 'bg-success-subtle text-success';
      case 'version':
        return 'bg-info-subtle text-info';
      case 'review':
        return 'bg-warning-subtle text-warning';
      case 'approval':
        return 'bg-primary-subtle text-primary';
      default:
        return 'bg-secondary-subtle text-secondary';
    }
  }

  // Document categories
  getDocumentCategories(): any[] {
    const categoryStats: { [key: string]: { count: number, color: string, icon: string } } = {};
    
    // Count documents by category
    this.combinedDocuments.forEach(doc => {
      const category = doc.category || 'OTHER';
      if (!categoryStats[category]) {
        categoryStats[category] = {
          count: 0,
          color: this.getCategoryColor(category),
          icon: this.getCategoryIcon(category)
        };
      }
      categoryStats[category].count++;
    });
    
    const totalDocs = this.combinedDocuments.length;
    
    return Object.entries(categoryStats).map(([name, stats]) => ({
      name,
      count: stats.count,
      percentage: totalDocs > 0 ? Math.round((stats.count / totalDocs) * 100) : 0,
      color: stats.color,
      icon: stats.icon
    })).sort((a, b) => b.count - a.count);
  }

  private getCategoryColor(category: string): string {
    switch (category) {
      case 'PUBLIC':
        return '#0ab39c';
      case 'INTERNAL':
        return '#299cdb';
      case 'CONFIDENTIAL':
        return '#f7b84b';
      case 'ATTORNEY_CLIENT_PRIVILEGE':
        return '#f06548';
      default:
        return '#6c757d';
    }
  }

  // Team access
  getTeamAccess(): any[] {
    // Mock team data - in real implementation, this would come from API
    return [
      {
        id: 1,
        name: 'John Doe',
        role: 'Lead Attorney',
        avatar: '/assets/images/users/avatar-1.jpg',
        accessLevel: 'Full',
        documentsAccessed: 15,
        lastActivity: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        canView: true,
        canEdit: true,
        canDelete: true,
        canShare: true
      },
      {
        id: 2,
        name: 'Jane Smith',
        role: 'Paralegal',
        avatar: '/assets/images/users/avatar-2.jpg',
        accessLevel: 'Limited',
        documentsAccessed: 8,
        lastActivity: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        canView: true,
        canEdit: true,
        canDelete: false,
        canShare: false
      },
      {
        id: 3,
        name: 'Mike Johnson',
        role: 'Associate',
        avatar: '/assets/images/users/avatar-3.jpg',
        accessLevel: 'Read Only',
        documentsAccessed: 5,
        lastActivity: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        canView: true,
        canEdit: false,
        canDelete: false,
        canShare: false
      }
    ];
  }

  getAccessBadgeClass(accessLevel: string): string {
    switch (accessLevel) {
      case 'Full':
        return 'bg-success-subtle text-success';
      case 'Limited':
        return 'bg-warning-subtle text-warning';
      case 'Read Only':
        return 'bg-info-subtle text-info';
      default:
        return 'bg-secondary-subtle text-secondary';
    }
  }

  // Deadline Management Methods
  getDocumentDeadlines(): any[] {
    // Mock deadline data for demonstration
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    return [
      {
        id: 1,
        documentId: 'doc_1',
        documentTitle: 'Motion to Dismiss',
        documentType: 'Legal Motion',
        type: 'Filing Deadline',
        dueDate: tomorrow,
        priority: 'High',
        status: 'Pending',
        assignedTo: 'John Smith',
        description: 'File motion to dismiss with the court'
      },
      {
        id: 2,
        documentId: 'doc_2',
        documentTitle: 'Discovery Response',
        documentType: 'Discovery',
        type: 'Response Deadline',
        dueDate: nextWeek,
        priority: 'Medium',
        status: 'In Progress',
        assignedTo: 'Sarah Connor',
        description: 'Respond to opposing counsel discovery requests'
      },
      {
        id: 3,
        documentId: 'doc_3',
        documentTitle: 'Client Contract',
        documentType: 'Contract',
        type: 'Review Deadline',
        dueDate: lastWeek,
        priority: 'High',
        status: 'Overdue',
        assignedTo: 'Mike Johnson',
        description: 'Complete contract review for client approval'
      },
      {
        id: 4,
        documentId: 'doc_4',
        documentTitle: 'Expert Witness Report',
        documentType: 'Expert Report',
        type: 'Submission Deadline',
        dueDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
        priority: 'Medium',
        status: 'Draft',
        assignedTo: 'John Smith',
        description: 'Submit expert witness report to court'
      }
    ];
  }

  getFilteredDeadlines(): any[] {
    const allDeadlines = this.getDocumentDeadlines();
    const now = new Date();
    
    switch (this.deadlineFilter) {
      case 'upcoming':
        return allDeadlines.filter(deadline => 
          new Date(deadline.dueDate) > now && deadline.status !== 'Completed'
        );
      case 'overdue':
        return allDeadlines.filter(deadline => 
          new Date(deadline.dueDate) < now && deadline.status !== 'Completed'
        );
      case 'all':
      default:
        return allDeadlines;
    }
  }

  getDeadlineRowClass(deadline: any): string {
    const now = new Date();
    const dueDate = new Date(deadline.dueDate);
    
    if (deadline.status === 'Completed') {
      return 'table-success';
    } else if (dueDate < now) {
      return 'table-danger';
    } else if (dueDate.getTime() - now.getTime() < 48 * 60 * 60 * 1000) {
      return 'table-warning';
    }
    return '';
  }

  getDeadlineTypeClass(type: string): string {
    switch (type) {
      case 'Filing Deadline':
        return 'bg-danger-subtle text-danger';
      case 'Response Deadline':
        return 'bg-warning-subtle text-warning';
      case 'Review Deadline':
        return 'bg-info-subtle text-info';
      case 'Submission Deadline':
        return 'bg-primary-subtle text-primary';
      default:
        return 'bg-secondary-subtle text-secondary';
    }
  }

  getPriorityClass(priority: string): string {
    switch (priority) {
      case 'High':
        return 'bg-danger-subtle text-danger';
      case 'Medium':
        return 'bg-warning-subtle text-warning';
      case 'Low':
        return 'bg-success-subtle text-success';
      default:
        return 'bg-secondary-subtle text-secondary';
    }
  }

  getPriorityIcon(priority: string): string {
    switch (priority) {
      case 'High':
        return 'ri-arrow-up-circle-line';
      case 'Medium':
        return 'ri-arrow-right-circle-line';
      case 'Low':
        return 'ri-arrow-down-circle-line';
      default:
        return 'ri-circle-line';
    }
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'Completed':
        return 'bg-success-subtle text-success';
      case 'In Progress':
        return 'bg-info-subtle text-info';
      case 'Pending':
        return 'bg-warning-subtle text-warning';
      case 'Overdue':
        return 'bg-danger-subtle text-danger';
      case 'Draft':
        return 'bg-secondary-subtle text-secondary';
      default:
        return 'bg-light text-muted';
    }
  }

  getDaysLeft(deadline: any): string {
    const now = new Date();
    const dueDate = new Date(deadline.dueDate);
    const diffTime = dueDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > 0) {
      return `${diffDays} day${diffDays === 1 ? '' : 's'} left`;
    } else if (diffDays === 0) {
      return 'Due today';
    } else {
      return `${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'} overdue`;
    }
  }

  getDaysLeftClass(deadline: any): string {
    const now = new Date();
    const dueDate = new Date(deadline.dueDate);
    const diffTime = dueDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (deadline.status === 'Completed') {
      return 'text-success fw-medium';
    } else if (diffDays < 0) {
      return 'text-danger fw-bold';
    } else if (diffDays <= 2) {
      return 'text-warning fw-medium';
    } else {
      return 'text-muted';
    }
  }

  viewDocument(documentId: string): void {
    // Find and preview the document
    const document = this.combinedDocuments.find(doc => doc.id === documentId);
    if (document) {
      this.openPreviewModal(document);
    }
  }

  editDeadline(deadline: any): void {
    // Placeholder for deadline editing functionality
    this.toastr.info('Deadline editing functionality coming soon');
  }

  markDeadlineComplete(deadline: any): void {
    // Placeholder for marking deadline as complete
    Swal.fire({
      title: 'Mark as Complete?',
      text: `Mark "${deadline.documentTitle}" deadline as completed?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, complete it!',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        // Update deadline status
        deadline.status = 'Completed';
        this.toastr.success('Deadline marked as completed');
      }
    });
  }

  deleteDeadline(deadlineId: number): void {
    // Placeholder for deadline deletion
    Swal.fire({
      title: 'Delete Deadline?',
      text: 'Are you sure you want to delete this deadline?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        this.toastr.success('Deadline deleted successfully');
      }
    });
  }
} 
