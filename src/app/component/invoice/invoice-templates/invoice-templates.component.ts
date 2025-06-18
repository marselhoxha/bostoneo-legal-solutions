import { Component, OnInit } from '@angular/core';
import { Observable, BehaviorSubject, map, startWith, catchError, of } from 'rxjs';
import { InvoiceTemplate } from 'src/app/interface/invoice-template';
import { CustomHttpResponse, Page } from 'src/app/interface/appstates';
import { InvoiceTemplateService } from 'src/app/service/invoice-template.service';
import { DataState } from 'src/app/enum/datastate.enum';
import { State } from 'src/app/interface/state';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-invoice-templates',
  templateUrl: './invoice-templates.component.html',
  styleUrls: ['./invoice-templates.component.css']
})
export class InvoiceTemplatesComponent implements OnInit {
  templatesState$: Observable<State<CustomHttpResponse<Page<InvoiceTemplate>>>>;
  private dataSubject = new BehaviorSubject<CustomHttpResponse<Page<InvoiceTemplate>>>(null);
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  private currentPageSubject = new BehaviorSubject<number>(0);
  currentPage$ = this.currentPageSubject.asObservable();
  isLoading$ = this.isLoadingSubject.asObservable();
  readonly DataState = DataState;
  
  templates: InvoiceTemplate[] = [];
  totalPages = 0;
  totalElements = 0;
  pageSize = 10;

  constructor(
    private templateService: InvoiceTemplateService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadTemplates();
  }

  loadTemplates(page: number = 0): void {
    this.isLoadingSubject.next(true);
    this.templatesState$ = this.templateService.getTemplates(page, this.pageSize)
      .pipe(
        map(response => {
          this.dataSubject.next(response);
          this.isLoadingSubject.next(false);
          
          if (response.data && 'content' in response.data) {
            this.templates = response.data.content;
            this.totalPages = response.data.totalPages;
            this.totalElements = response.data.totalElements;
          }
          
          return { dataState: DataState.LOADED, appData: response };
        }),
        startWith({ dataState: DataState.LOADING }),
        catchError((error: string) => {
          this.isLoadingSubject.next(false);
          return of({ dataState: DataState.ERROR, error });
        })
      );
  }

  goToPage(page: number): void {
    if (page >= 0 && page < this.totalPages) {
      this.currentPageSubject.next(page);
      this.loadTemplates(page);
    }
  }

  goToPreviousPage(): void {
    const currentPage = this.currentPageSubject.value;
    if (currentPage > 0) {
      this.goToPage(currentPage - 1);
    }
  }

  goToNextPage(): void {
    const currentPage = this.currentPageSubject.value;
    if (currentPage < this.totalPages - 1) {
      this.goToPage(currentPage + 1);
    }
  }

  get currentPage(): number {
    return this.currentPageSubject.value;
  }

  isCurrentPage(page: number): boolean {
    return this.currentPageSubject.value === page;
  }

  isPreviousDisabled(): boolean {
    return this.currentPageSubject.value === 0;
  }

  isNextDisabled(): boolean {
    return this.currentPageSubject.value === this.totalPages - 1;
  }

  getPageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i);
  }

  createTemplate(): void {
    this.router.navigate(['/invoices/templates/new']);
  }

  editTemplate(template: InvoiceTemplate): void {
    this.router.navigate(['/invoices/templates', template.id, 'edit']);
  }

  viewTemplate(template: InvoiceTemplate): void {
    this.router.navigate(['/invoices/templates', template.id]);
  }

  deleteTemplate(template: InvoiceTemplate): void {
    Swal.fire({
      title: 'Are you sure?',
      text: `Delete template "${template.name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
      if (result.isConfirmed) {
        this.isLoadingSubject.next(true);
        this.templateService.deleteTemplate(template.id).subscribe({
          next: () => {
            Swal.fire('Deleted!', 'Template has been deleted.', 'success');
            this.loadTemplates(this.currentPageSubject.value);
          },
          error: (error) => {
            this.isLoadingSubject.next(false);
            Swal.fire('Error!', error.message || 'Failed to delete template', 'error');
          }
        });
      }
    });
  }

  toggleDefault(template: InvoiceTemplate): void {
    const updatedTemplate = { ...template, isDefault: !template.isDefault };
    this.templateService.updateTemplate(template.id, updatedTemplate).subscribe({
      next: () => {
        this.loadTemplates(this.currentPageSubject.value);
      },
      error: (error) => {
        Swal.fire('Error!', error.message || 'Failed to update template', 'error');
      }
    });
  }

  toggleActive(template: InvoiceTemplate): void {
    const updatedTemplate = { ...template, isActive: !template.isActive };
    this.templateService.updateTemplate(template.id, updatedTemplate).subscribe({
      next: () => {
        this.loadTemplates(this.currentPageSubject.value);
      },
      error: (error) => {
        Swal.fire('Error!', error.message || 'Failed to update template', 'error');
      }
    });
  }
}