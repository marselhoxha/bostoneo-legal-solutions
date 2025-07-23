import { Component, Input, OnInit, ChangeDetectorRef, Inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CaseDocument } from '../../../interfaces/case.interface';
import { DocumentType, DocumentCategory } from '../../../interfaces/document.interface';
import { CaseDocumentsService } from '../../../services/case-documents.service';
import { FileManagerService } from '../../../../file-manager/services/file-manager.service';
import { FileItemModel } from '../../../../file-manager/models/file-manager.model';
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
          <h5 class="card-title mb-0 flex-grow-1">Case Documents</h5>
          <div class="flex-shrink-0">
            <div class="btn-group" role="group">
              <button 
                class="btn btn-primary btn-sm" 
                (click)="openQuickUpload()"
              >
                <i class="ri-upload-cloud-line align-bottom me-1"></i>
                Quick Upload
              </button>
              <button 
                class="btn btn-soft-primary btn-sm" 
                (click)="toggleUploadForm()"
              >
                <i class="ri-upload-2-line align-bottom me-1"></i>
                Detailed Upload
              </button>
            </div>
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
        
        <!-- Document Views Selector -->
        <div class="row mb-4">
          <div class="col-12">
            <div class="card border-0 bg-light-subtle">
              <div class="card-body p-3">
                <div class="d-flex align-items-center justify-content-between">
                  <h6 class="mb-0 text-muted">
                    <i class="ri-layout-3-line me-2"></i>Document Views
                  </h6>
                  <div class="btn-group" role="group">
                    <input type="radio" class="btn-check" name="documentView" id="activityView" 
                           [checked]="currentView === 'activity'" (change)="setView('activity')">
                    <label class="btn btn-outline-primary btn-sm" for="activityView">
                      <i class="ri-history-line me-1"></i>Activity
                    </label>
                    
                    <input type="radio" class="btn-check" name="documentView" id="timelineView" 
                           [checked]="currentView === 'timeline'" (change)="setView('timeline')">
                    <label class="btn btn-outline-primary btn-sm" for="timelineView">
                      <i class="ri-time-line me-1"></i>Timeline
                    </label>
                    
                    <input type="radio" class="btn-check" name="documentView" id="categoriesView" 
                           [checked]="currentView === 'categories'" (change)="setView('categories')">
                    <label class="btn btn-outline-primary btn-sm" for="categoriesView">
                      <i class="ri-folder-chart-line me-1"></i>Categories
                    </label>
                    
                    <input type="radio" class="btn-check" name="documentView" id="teamView" 
                           [checked]="currentView === 'team'" (change)="setView('team')">
                    <label class="btn btn-outline-primary btn-sm" for="teamView">
                      <i class="ri-team-line me-1"></i>Team Access
                    </label>
                    
                    <input type="radio" class="btn-check" name="documentView" id="deadlinesView" 
                           [checked]="currentView === 'deadlines'" (change)="setView('deadlines')">
                    <label class="btn btn-outline-primary btn-sm" for="deadlinesView">
                      <i class="ri-calendar-event-line me-1"></i>Deadlines
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Activity View -->
        @if(currentView === 'activity' && getRecentActivity().length > 0) {
          <div class="card border-0 shadow-sm mb-4">
            <div class="card-header bg-light-subtle">
              <div class="d-flex align-items-center">
                <h6 class="card-title mb-0 flex-grow-1">
                  <i class="ri-history-line me-2 text-muted"></i>
                  Recent Document Activity
                </h6>
                <button class="btn btn-link btn-sm text-muted p-0" (click)="showAllActivity = !showAllActivity">
                  {{showAllActivity ? 'Show Less' : 'Show All'}}
                  <i [class]="showAllActivity ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'"></i>
                </button>
              </div>
            </div>
            <div class="card-body p-0">
              <div class="activity-feed" style="max-height: {{showAllActivity ? 'none' : '200px'}}; overflow-y: auto;">
                @for(activity of getRecentActivity().slice(0, showAllActivity ? getRecentActivity().length : 3); track activity.id) {
                  <div class="activity-item border-bottom">
                    <div class="d-flex p-3">
                      <div class="flex-shrink-0">
                        <div class="avatar-xs">
                          <span class="avatar-title bg-soft-primary text-primary rounded-circle">
                            <i [class]="activity.icon"></i>
                          </span>
                        </div>
                      </div>
                      <div class="flex-grow-1 ms-3">
                        <div class="d-flex">
                          <div class="flex-grow-1">
                            <h6 class="mb-1 fs-14">{{activity.title}}</h6>
                            <p class="text-muted mb-0 fs-13">{{activity.description}}</p>
                          </div>
                          <div class="flex-shrink-0">
                            <small class="text-muted">{{activity.timestamp | date:'short'}}</small>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                }
              </div>
            </div>
          </div>
        }

        <!-- Timeline View -->
        @if(currentView === 'timeline') {
          <div class="card border-0 shadow-sm mb-4">
            <div class="card-header bg-light-subtle">
              <h6 class="card-title mb-0">
                <i class="ri-time-line me-2 text-muted"></i>Document Timeline
              </h6>
            </div>
            <div class="card-body">
              <div class="timeline-container">
                @for(timelineItem of getDocumentTimeline(); track timelineItem.id) {
                  <div class="timeline-item d-flex mb-4">
                    <div class="timeline-marker flex-shrink-0">
                      <div class="timeline-icon" [ngClass]="getTimelineIconClass(timelineItem.type)">
                        <i [class]="timelineItem.icon"></i>
                      </div>
                    </div>
                    <div class="timeline-content flex-grow-1 ms-3">
                      <div class="timeline-header d-flex justify-content-between align-items-start mb-2">
                        <h6 class="timeline-title mb-1">{{timelineItem.title}}</h6>
                        <small class="text-muted">{{timelineItem.date | date:'MMM d, y h:mm a'}}</small>
                      </div>
                      <p class="text-muted mb-2">{{timelineItem.description}}</p>
                      @if(timelineItem.documentName) {
                        <div class="d-flex align-items-center">
                          <i class="ri-file-text-line text-primary me-2"></i>
                          <span class="badge bg-primary-subtle text-primary">{{timelineItem.documentName}}</span>
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>
            </div>
          </div>
        }

        <!-- Categories View -->
        @if(currentView === 'categories') {
          <div class="card border-0 shadow-sm mb-4">
            <div class="card-header bg-light-subtle">
              <h6 class="card-title mb-0">
                <i class="ri-folder-chart-line me-2 text-muted"></i>Document Categories
              </h6>
            </div>
            <div class="card-body">
              <div class="row">
                @for(category of getDocumentCategories(); track category.name) {
                  <div class="col-md-6 col-lg-4 mb-3">
                    <div class="category-card border rounded p-3 h-100">
                      <div class="d-flex align-items-center mb-3">
                        <div class="avatar-sm flex-shrink-0 me-3">
                          <span class="avatar-title rounded" [style.background-color]="category.color + '20'" [style.color]="category.color">
                            <i [class]="category.icon"></i>
                          </span>
                        </div>
                        <div class="flex-grow-1">
                          <h6 class="mb-1">{{category.name}}</h6>
                          <p class="text-muted mb-0 fs-12">{{category.count}} documents</p>
                        </div>
                      </div>
                      <div class="progress mb-2" style="height: 6px;">
                        <div class="progress-bar" [style.width.%]="category.percentage" [style.background-color]="category.color"></div>
                      </div>
                      <small class="text-muted">{{category.percentage}}% of total documents</small>
                    </div>
                  </div>
                }
              </div>
            </div>
          </div>
        }

        <!-- Team Access View -->
        @if(currentView === 'team') {
          <div class="card border-0 shadow-sm mb-4">
            <div class="card-header bg-light-subtle">
              <h6 class="card-title mb-0">
                <i class="ri-team-line me-2 text-muted"></i>Team Document Access
              </h6>
            </div>
            <div class="card-body">
              <div class="row">
                @for(member of getTeamAccess(); track member.id) {
                  <div class="col-md-6 col-lg-4 mb-3">
                    <div class="team-member-card border rounded p-3 h-100">
                      <div class="d-flex align-items-center mb-3">
                        <div class="avatar-sm flex-shrink-0 me-3">
                          <img [src]="member.avatar || '/assets/images/users/avatar-placeholder.jpg'" 
                               [alt]="member.name" 
                               class="rounded-circle">
                        </div>
                        <div class="flex-grow-1">
                          <h6 class="mb-1">{{member.name}}</h6>
                          <p class="text-muted mb-0 fs-12">{{member.role}}</p>
                        </div>
                        <div class="flex-shrink-0">
                          <span class="badge" [ngClass]="getAccessBadgeClass(member.accessLevel)">
                            {{member.accessLevel}}
                          </span>
                        </div>
                      </div>
                      <div class="access-stats">
                        <div class="d-flex justify-content-between mb-2">
                          <span class="text-muted fs-13">Documents Accessed:</span>
                          <span class="fw-medium">{{member.documentsAccessed}}</span>
                        </div>
                        <div class="d-flex justify-content-between mb-2">
                          <span class="text-muted fs-13">Last Activity:</span>
                          <span class="fs-13">{{member.lastActivity | date:'MMM d'}}</span>
                        </div>
                        <div class="d-flex justify-content-between">
                          <span class="text-muted fs-13">Permissions:</span>
                          <div class="permission-icons">
                            <i *ngIf="member.canView" class="ri-eye-line text-info me-1" title="Can View"></i>
                            <i *ngIf="member.canEdit" class="ri-edit-line text-warning me-1" title="Can Edit"></i>
                            <i *ngIf="member.canDelete" class="ri-delete-bin-line text-danger me-1" title="Can Delete"></i>
                            <i *ngIf="member.canShare" class="ri-share-line text-success" title="Can Share"></i>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                }
              </div>
            </div>
          </div>
        }

        <!-- Deadlines View -->
        @if(currentView === 'deadlines') {
          <div class="card border-0 shadow-sm mb-4">
            <div class="card-header bg-light-subtle">
              <div class="d-flex align-items-center justify-content-between">
                <h6 class="card-title mb-0">
                  <i class="ri-calendar-event-line me-2 text-muted"></i>
                  Document Deadlines
                </h6>
                <div class="d-flex gap-2">
                  <div class="btn-group btn-group-sm" role="group">
                    <input type="radio" class="btn-check" name="deadlineFilter" id="upcomingDeadlines" 
                           [checked]="deadlineFilter === 'upcoming'" (change)="setDeadlineFilter('upcoming')">
                    <label class="btn btn-outline-warning" for="upcomingDeadlines">
                      <i class="ri-time-line me-1"></i>Upcoming
                    </label>
                    
                    <input type="radio" class="btn-check" name="deadlineFilter" id="overdueDeadlines" 
                           [checked]="deadlineFilter === 'overdue'" (change)="setDeadlineFilter('overdue')">
                    <label class="btn btn-outline-danger" for="overdueDeadlines">
                      <i class="ri-alarm-warning-line me-1"></i>Overdue
                    </label>
                    
                    <input type="radio" class="btn-check" name="deadlineFilter" id="allDeadlines" 
                           [checked]="deadlineFilter === 'all'" (change)="setDeadlineFilter('all')">
                    <label class="btn btn-outline-primary" for="allDeadlines">
                      <i class="ri-calendar-line me-1"></i>All
                    </label>
                  </div>
                </div>
              </div>
            </div>
            <div class="card-body p-0">
              <div class="table-responsive">
                <table class="table table-nowrap mb-0">
                  <thead class="table-light">
                    <tr>
                      <th>Document</th>
                      <th>Deadline Type</th>
                      <th>Due Date</th>
                      <th>Priority</th>
                      <th>Status</th>
                      <th>Days Left</th>
                      <th class="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for(deadline of getFilteredDeadlines(); track deadline.id) {
                      <tr [class]="getDeadlineRowClass(deadline)">
                        <td>
                          <div class="d-flex align-items-center">
                            <div class="flex-shrink-0">
                              <div class="avatar-xs">
                                <span class="avatar-title bg-soft-primary text-primary rounded">
                                  <i class="ri-file-text-line"></i>
                                </span>
                              </div>
                            </div>
                            <div class="flex-grow-1 ms-3">
                              <h6 class="mb-1 fs-14">{{deadline.documentTitle}}</h6>
                              <p class="text-muted mb-0 fs-12">{{deadline.documentType}}</p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span class="badge" [class]="getDeadlineTypeClass(deadline.type)">
                            {{deadline.type}}
                          </span>
                        </td>
                        <td>
                          <div>
                            <span class="fw-medium">{{deadline.dueDate | date:'MMM d, y'}}</span>
                            <br>
                            <small class="text-muted">{{deadline.dueDate | date:'h:mm a'}}</small>
                          </div>
                        </td>
                        <td>
                          <span class="badge" [class]="getPriorityClass(deadline.priority)">
                            <i [class]="getPriorityIcon(deadline.priority)" class="me-1"></i>
                            {{deadline.priority}}
                          </span>
                        </td>
                        <td>
                          <span class="badge" [class]="getStatusClass(deadline.status)">
                            {{deadline.status}}
                          </span>
                        </td>
                        <td>
                          <div class="deadline-countdown">
                            <span [class]="getDaysLeftClass(deadline)">
                              {{getDaysLeft(deadline)}}
                            </span>
                          </div>
                        </td>
                        <td class="text-end">
                          <div class="dropdown">
                            <button class="btn btn-soft-primary btn-sm dropdown-toggle" 
                                    type="button" 
                                    data-bs-toggle="dropdown">
                              <i class="ri-more-2-fill"></i>
                            </button>
                            <ul class="dropdown-menu dropdown-menu-end">
                              <li>
                                <a class="dropdown-item" href="javascript:void(0);" 
                                   (click)="viewDocument(deadline.documentId)">
                                  <i class="ri-eye-line me-2"></i>View Document
                                </a>
                              </li>
                              <li>
                                <a class="dropdown-item" href="javascript:void(0);" 
                                   (click)="editDeadline(deadline)">
                                  <i class="ri-edit-line me-2"></i>Edit Deadline
                                </a>
                              </li>
                              <li>
                                <a class="dropdown-item" href="javascript:void(0);" 
                                   (click)="markDeadlineComplete(deadline)">
                                  <i class="ri-check-line me-2"></i>Mark Complete
                                </a>
                              </li>
                              <li class="dropdown-divider"></li>
                              <li>
                                <a class="dropdown-item text-danger" href="javascript:void(0);" 
                                   (click)="deleteDeadline(deadline.id)">
                                  <i class="ri-delete-bin-line me-2"></i>Delete
                                </a>
                              </li>
                            </ul>
                          </div>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
              
              @if(getFilteredDeadlines().length === 0) {
                <div class="text-center py-5">
                  <div class="avatar-lg mx-auto mb-4">
                    <div class="avatar-title bg-soft-info text-info rounded-circle">
                      <i class="ri-calendar-line fs-1"></i>
                    </div>
                  </div>
                  <h5 class="mb-2">No {{deadlineFilter}} deadlines</h5>
                  <p class="text-muted">There are no {{deadlineFilter}} deadlines for this case.</p>
                </div>
              }
            </div>
          </div>
        }

        <!-- Document Filters -->
        <div class="row mb-4">
          <div class="col-md-3">
            <select class="form-select" [(ngModel)]="selectedCategory" (change)="filterDocuments()">
              <option value="">All Categories</option>
              @for(category of categories; track category) {
                <option [value]="category">{{category}}</option>
              }
            </select>
          </div>
          <div class="col-md-3">
            <select class="form-select" [(ngModel)]="selectedType" (change)="filterDocuments()">
              <option value="">All Types</option>
              @for(type of documentTypes; track type) {
                <option [value]="type">{{type}}</option>
              }
            </select>
          </div>
          <div class="col-md-6">
            <input 
              type="text" 
              class="form-control" 
              placeholder="Search documents..."
              [(ngModel)]="searchTerm"
              (input)="filterDocuments()"
            >
          </div>
        </div>

        <!-- Upload Document Form -->
        @if(isUploading) {
          <div class="mb-4">
            <div class="mb-3">
              <label class="form-label">Document Title</label>
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
                  <label class="form-label">Document Type</label>
                  <select class="form-select" [(ngModel)]="newDocument.type">
                    <option [ngValue]="null" disabled hidden>Select document type</option>
                    @for(type of documentTypes; track type) {
                      <option [value]="type">{{type}}</option>
                    }
                  </select>
                </div>
              </div>
              <div class="col-md-6">
            <div class="mb-3">
              <label class="form-label">Category</label>
              <select class="form-select" [(ngModel)]="newDocument.category">
                <option [ngValue]="null" disabled hidden>Select category</option>
                <option *ngFor="let category of categories; trackBy: trackByCategory"
                        [value]="category">
                  {{ category }}
                </option>
              </select>
            </div>
          </div>

            </div>
            <div class="mb-3">
              <label class="form-label">Description</label>
              <textarea 
                class="form-control" 
                rows="3" 
                placeholder="Enter document description"
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
              <label class="form-label">File</label>
              <input 
                type="file" 
                class="form-control" 
                (change)="onFileSelected($event)"
              >
            </div>
            <div class="d-flex justify-content-end gap-2">
              <button 
                class="btn btn-outline-secondary btn-sm" 
                (click)="toggleUploadForm()"
              >
                Cancel
              </button>
              <button 
                class="btn btn-outline-primary btn-sm" 
                (click)="uploadDocument()"
                [disabled]="!isFormValid()"
              >
                Upload
              </button>
            </div>
          </div>
        }

        <!-- Documents List -->
        <div class="table-responsive">
          <table class="table table-nowrap table-hover mb-0">
            <thead class="table-light">
              <tr>
                <th scope="col">Document</th>
                <th scope="col">Type</th>
                <th scope="col">Category</th>
                <th scope="col">Version</th>
                <th scope="col">Uploaded By</th>
                <th scope="col">Date</th>
                <th scope="col" class="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for(document of filteredDocuments; track document.id) {
                <tr>
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
                        <div class="d-flex align-items-center gap-2">
                          <h6 class="mb-0">{{document.title}}</h6>
                          @if(document.isFileManagerFile) {
                            <span class="badge bg-info-subtle text-info fs-11">File Manager</span>
                          } @else {
                            <span class="badge bg-secondary-subtle text-secondary fs-11">Legacy</span>
                          }
                        </div>
                        @if(document.description) {
                          <small class="text-muted">{{document.description}}</small>
                        }
                        @if(document.isFileManagerFile && document.size) {
                          <small class="text-muted d-block">Size: {{formatFileSize(document.size)}}</small>
                        }
                      </div>
                    </div>
                  </td>
                  <td>{{document.type}}</td>
                  <td>{{document.category}}</td>
                  <td>v{{document.currentVersion}}</td>
                  <td>
                    @if(document.uploadedBy) {
                      {{document.uploadedBy.firstName}} {{document.uploadedBy.lastName}}
                    } @else {
                      <span class="text-muted">Unknown</span>
                    }
                  </td>
                  <td>{{document.uploadedAt | date:'mediumDate'}}</td>
                  <td class="text-end">
                    <div class="d-flex justify-content-end gap-2">
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

    <!-- Quick Upload Modal -->
    @if(showQuickUpload) {
      <div class="modal fade show" style="display: block;" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Quick Upload Documents</h5>
              <button type="button" class="btn-close" (click)="closeQuickUpload()"></button>
            </div>
            <div class="modal-body">
              <!-- Drag and Drop Area -->
              <div class="dropzone-area border-2 border-dashed rounded p-4 text-center mb-3"
                   [class.drag-over]="isDragOver"
                   (dragover)="onDragOver($event)"
                   (dragleave)="onDragLeave($event)"
                   (drop)="onQuickUploadDrop($event)">
                <div class="py-4">
                  <div class="avatar-xl mx-auto mb-3">
                    <div class="avatar-title bg-soft-primary text-primary rounded-circle">
                      <i class="ri-upload-cloud-2-line fs-1"></i>
                    </div>
                  </div>
                  <h5 class="mb-2">Drop files here or click to select</h5>
                  <p class="text-muted mb-3">Upload multiple files at once for quick processing</p>
                  <input type="file" 
                         class="d-none" 
                         multiple 
                         #quickFileInput
                         (change)="onQuickFileSelected($event)">
                  <button type="button" 
                          class="btn btn-primary" 
                          (click)="quickFileInput.click()">
                    Select Files
                  </button>
                </div>
              </div>
              
              <!-- Selected Files -->
              @if(quickUploadFiles.length > 0) {
                <div class="selected-files mb-3">
                  <h6 class="mb-3">Selected Files ({{quickUploadFiles.length}})</h6>
                  <div class="list-group">
                    @for(file of quickUploadFiles; track file.name; let i = $index) {
                      <div class="list-group-item d-flex align-items-center">
                        <div class="flex-shrink-0">
                          <div class="avatar-xs">
                            <span class="avatar-title bg-soft-info text-info rounded">
                              <i class="ri-file-line"></i>
                            </span>
                          </div>
                        </div>
                        <div class="flex-grow-1 ms-3">
                          <h6 class="mb-1 fs-14">{{file.name}}</h6>
                          <p class="text-muted mb-0 fs-12">{{formatFileSize(file.size)}}</p>
                        </div>
                        <div class="flex-shrink-0">
                          <button type="button" 
                                  class="btn btn-sm btn-outline-danger" 
                                  (click)="removeQuickUploadFile(i)">
                            <i class="ri-close-line"></i>
                          </button>
                        </div>
                      </div>
                    }
                  </div>
                </div>
                
                <!-- Quick Settings -->
                <div class="row mb-3">
                  <div class="col-md-6">
                    <label class="form-label">Default Document Type</label>
                    <select class="form-select" [(ngModel)]="quickUploadDefaults.type">
                      @for(type of documentTypes; track type) {
                        <option [value]="type">{{type}}</option>
                      }
                    </select>
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Default Category</label>
                    <select class="form-select" [(ngModel)]="quickUploadDefaults.category">
                      @for(category of categories; track category) {
                        <option [value]="category">{{category}}</option>
                      }
                    </select>
                  </div>
                </div>
                
                <!-- Progress -->
                @if(isQuickUploading) {
                  <div class="progress-container mb-3">
                    <div class="d-flex justify-content-between mb-2">
                      <span class="text-muted">Uploading files...</span>
                      <span class="text-muted">{{quickUploadProgress.completed}}/{{quickUploadProgress.total}}</span>
                    </div>
                    <div class="progress">
                      <div class="progress-bar" 
                           role="progressbar" 
                           [style.width.%]="quickUploadProgress.percentage">
                      </div>
                    </div>
                  </div>
                }
              }
            </div>
            <div class="modal-footer">
              <button type="button" 
                      class="btn btn-outline-secondary" 
                      (click)="closeQuickUpload()"
                      [disabled]="isQuickUploading">
                Cancel
              </button>
              <button type="button" 
                      class="btn btn-primary" 
                      (click)="startQuickUpload()"
                      [disabled]="quickUploadFiles.length === 0 || isQuickUploading">
                <i class="ri-upload-cloud-line me-1"></i>
                Upload {{quickUploadFiles.length}} Files
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

    /* Quick Upload Styles */
    .dropzone-area {
      border-color: #dee2e6;
      background-color: #f8f9fa;
      transition: all 0.3s ease;
      cursor: pointer;
    }

    .dropzone-area:hover {
      border-color: #405189;
      background-color: rgba(64, 81, 137, 0.05);
    }

    .dropzone-area.drag-over {
      border-color: #405189;
      background-color: rgba(64, 81, 137, 0.1);
      transform: scale(1.02);
    }

    .avatar-xl {
      width: 5rem;
      height: 5rem;
      margin: 0 auto;
    }

    .selected-files .list-group-item {
      border: 1px solid #e9ecef;
      margin-bottom: 0.5rem;
      border-radius: 0.375rem;
    }

    .selected-files .list-group-item:last-child {
      margin-bottom: 0;
    }

    .progress-container .progress {
      height: 8px;
      background-color: #e9ecef;
    }

    .progress-container .progress-bar {
      background: linear-gradient(45deg, #405189, #299cdb);
      transition: width 0.3s ease;
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
  currentView: 'activity' | 'timeline' | 'categories' | 'team' | 'deadlines' = 'activity';
  deadlineFilter: 'upcoming' | 'overdue' | 'all' = 'upcoming';
  
  // Quick upload properties
  showQuickUpload: boolean = false;
  quickUploadFiles: File[] = [];
  isQuickUploading: boolean = false;
  isDragOver: boolean = false;
  quickUploadDefaults = {
    type: DocumentType.OTHER,
    category: DocumentCategory.PUBLIC
  };
  quickUploadProgress = {
    total: 0,
    completed: 0,
    percentage: 0
  };

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
    private rbacService: RbacService
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
      const caseIdStr = String(this.caseId);
      console.log('Loading documents for case ID:', caseIdStr);
      this.loadDocuments();
      this.loadFileManagerFiles();
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
      ...this.fileManagerFiles.map(file => ({
        id: file.id,
        title: file.name,
        type: this.mapMimeTypeToDocumentType(file.mimeType),
        category: file.documentCategory || 'PUBLIC',
        status: file.documentStatus || 'FINAL',
        description: file.description || '',
        fileName: file.originalName,
        fileUrl: file.downloadUrl,
        uploadedAt: file.createdAt,
        uploadedBy: { 
          firstName: file.createdByName?.split(' ')[0] || 'Unknown',
          lastName: file.createdByName?.split(' ').slice(1).join(' ') || ''
        },
        tags: file.tags || [],
        currentVersion: file.version || 1,
        versions: [],
        source: 'filemanager',
        isFileManagerFile: true,
        size: file.size,
        mimeType: file.mimeType,
        icon: file.icon,
        iconColor: file.iconColor
      }))
    ];
    
    this.filteredDocuments = [...this.combinedDocuments];
    this.filterDocuments();
  }

  private mapMimeTypeToDocumentType(mimeType: string): DocumentType {
    if (mimeType?.includes('pdf')) return DocumentType.PLEADING;
    if (mimeType?.includes('word')) return DocumentType.CONTRACT;
    if (mimeType?.includes('image')) return DocumentType.EVIDENCE;
    if (mimeType?.includes('excel')) return DocumentType.OTHER;
    return DocumentType.OTHER;
  }

  loadDocuments(): void {
    this.isLoading = true;
    const caseIdStr = String(this.caseId);
    
    console.log('Loading documents for case ID:', caseIdStr);
    console.log('Raw caseId value:', this.caseId, 'Type:', typeof this.caseId);
    
    this.documentsService.getDocuments(caseIdStr).subscribe({
      next: (response) => {
        console.log('Raw documents response:', response);
        console.log('Response type:', typeof response, 'Is array:', Array.isArray(response));
        
        try {
          // Enhanced response processing
          let docsArray: any[] = [];
          
          if (Array.isArray(response)) {
            console.log('Response is an array with', response.length, 'documents');
            docsArray = response;
          } else if (response && response.data && Array.isArray(response.data)) {
            console.log('Response has data array with', response.data.length, 'documents');
            docsArray = response.data;
          } else if (response && response.data && response.data.documents && Array.isArray(response.data.documents)) {
            console.log('Response has nested documents array with', response.data.documents.length, 'documents');
            docsArray = response.data.documents;
          } else {
            console.error('Unexpected response format:', response);
            console.log('Response keys:', response ? Object.keys(response) : 'null');
            this.toastr.warning('Unexpected document format received. Contact support if documents are missing.');
            docsArray = [];
          }
          
          console.log('Extracted documents array:', docsArray);
          console.log('Documents array length:', docsArray.length);
          
          // Log results without showing intrusive toast messages
          if (docsArray.length === 0) {
            console.log('No documents found for case ID:', caseIdStr);
          } else {
            console.log(`Found ${docsArray.length} documents for case ID:`, caseIdStr);
          }
          
          // Process and normalize each document
          this.documents = docsArray.map(doc => {
            if (!doc || typeof doc !== 'object') {
              console.warn('Invalid document object:', doc);
              return null;
            }
            
            console.log('Processing document:', doc);
            
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
          
          console.log('Normalized documents:', this.documents);
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
      
      console.log(`Filtered to ${this.filteredDocuments.length} documents`);
      
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
    console.log('Opening preview for document:', document);
    
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
    
    console.log(`Downloading document ${document.id} for preview`);
    
    this.documentsService.downloadDocument(String(this.caseId), document.id)
      .pipe(
        finalize(() => {
          this.isPreviewLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (blob: Blob) => {
          console.log('Blob received for preview:', blob);
          console.log('Blob type:', blob.type);
          
          if (blob && blob.size > 0) {
            // Force PDF type if filename ends with .pdf but type is incorrect
            let blobToUse = blob;
            const filename = document.fileName || '';
            
            // If file is PDF but content type is not set correctly, fix it
            if (filename.toLowerCase().endsWith('.pdf') && blob.type !== 'application/pdf') {
              console.log('File appears to be PDF but has wrong content type. Creating new blob with correct type');
              blobToUse = new Blob([blob], { type: 'application/pdf' });
            }
            
            // Check blob type for preview compatibility
            if (blobToUse.type === 'application/pdf' || blobToUse.type.startsWith('image/')) {
              console.log('Creating object URL for blob type:', blobToUse.type);
              this.currentObjectUrl = URL.createObjectURL(blobToUse);
              this.previewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.currentObjectUrl);
              console.log('Preview URL generated:', this.currentObjectUrl);
              this.previewError = null;
            } else {
              console.warn(`Preview not supported for type: ${blobToUse.type}`);
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
        console.log('Revoking previous object URL:', this.currentObjectUrl);
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

    const formData = new FormData();
    formData.append('file', this.selectedFile);
    formData.append('title', this.newDocument.title || 'Untitled Document');
    
    // Convert type to string, handle both enum and string values
    const typeValue = typeof this.newDocument.type === 'string' ? 
      this.newDocument.type : String(this.newDocument.type);
    formData.append('type', typeValue);
    
    // Convert category to string, handle both enum and string values
    const categoryValue = typeof this.newDocument.category === 'string' ? 
      this.newDocument.category : String(this.newDocument.category);
    formData.append('category', categoryValue || '');
    
    if (this.newDocument.description) {
      formData.append('description', this.newDocument.description);
    }
    
    if (this.tagsInput && this.tagsInput.length > 0) {
      formData.append('tags', this.tagsInput);
    }

    console.log('Uploading document with data:', {
      title: this.newDocument.title,
      type: typeValue,
      category: categoryValue,
      description: this.newDocument.description,
      tags: this.tagsInput
    });

    this.documentsService.uploadDocument(String(this.caseId), formData)
      .subscribe({
        next: (response) => {
          console.log('Upload response:', response);
          this.loadDocuments();
          
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

  showVersionHistory(document: CaseDocument): void {
    this.documentForVersionHistory = document;
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
                console.log('File manager file deleted successfully');
                
                // Update UI
                this.fileManagerFiles = this.fileManagerFiles.filter(f => f.id !== document.id);
                this.combineCaseDocuments();
                
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
                  console.log('Document deleted successfully');
                  
                  // Update UI
                  this.documents = this.documents.filter(d => d.id !== document.id);
                  this.combineCaseDocuments();
                
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

  // Quick upload methods
  openQuickUpload(): void {
    this.showQuickUpload = true;
    this.quickUploadFiles = [];
    this.isQuickUploading = false;
    this.isDragOver = false;
    this.quickUploadProgress = { total: 0, completed: 0, percentage: 0 };
  }

  closeQuickUpload(): void {
    if (!this.isQuickUploading) {
      this.showQuickUpload = false;
      this.quickUploadFiles = [];
      this.quickUploadProgress = { total: 0, completed: 0, percentage: 0 };
    }
  }

  onQuickFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.addQuickUploadFiles(Array.from(input.files));
    }
  }

  onQuickUploadDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
    const files = event.dataTransfer?.files;
    if (files) {
      this.addQuickUploadFiles(Array.from(files));
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
  }

  private addQuickUploadFiles(files: File[]): void {
    // Filter out duplicates and add new files
    const existingNames = this.quickUploadFiles.map(f => f.name);
    const newFiles = files.filter(file => !existingNames.includes(file.name));
    this.quickUploadFiles.push(...newFiles);
  }

  removeQuickUploadFile(index: number): void {
    this.quickUploadFiles.splice(index, 1);
  }

  startQuickUpload(): void {
    if (this.quickUploadFiles.length === 0) return;

    this.isQuickUploading = true;
    this.quickUploadProgress = {
      total: this.quickUploadFiles.length,
      completed: 0,
      percentage: 0
    };

    // Upload files sequentially to avoid overwhelming the server
    this.uploadFilesSequentially(0);
  }

  private uploadFilesSequentially(index: number): void {
    if (index >= this.quickUploadFiles.length) {
      // All files uploaded
      this.completeQuickUpload();
      return;
    }

    const file = this.quickUploadFiles[index];
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', file.name.replace(/\.[^/.]+$/, '')); // Remove extension for title
    formData.append('type', this.quickUploadDefaults.type);
    formData.append('category', this.quickUploadDefaults.category);
    formData.append('description', `Quick upload: ${file.name}`);

    this.documentsService.uploadDocument(String(this.caseId), formData)
      .subscribe({
        next: (response) => {
          this.quickUploadProgress.completed++;
          this.quickUploadProgress.percentage = Math.round(
            (this.quickUploadProgress.completed / this.quickUploadProgress.total) * 100
          );
          
          // Continue with next file
          this.uploadFilesSequentially(index + 1);
        },
        error: (error) => {
          console.error(`Error uploading file ${file.name}:`, error);
          
          // Continue with next file even if one fails
          this.quickUploadProgress.completed++;
          this.quickUploadProgress.percentage = Math.round(
            (this.quickUploadProgress.completed / this.quickUploadProgress.total) * 100
          );
          
          this.uploadFilesSequentially(index + 1);
        }
      });
  }

  private completeQuickUpload(): void {
    this.isQuickUploading = false;
    
    Swal.fire({
      title: 'Upload Complete!',
      text: `Successfully processed ${this.quickUploadProgress.total} files`,
      icon: 'success',
      confirmButtonText: 'OK'
    }).then(() => {
      // Refresh documents and close modal
      this.loadDocuments();
      this.loadFileManagerFiles();
      this.closeQuickUpload();
    });
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
