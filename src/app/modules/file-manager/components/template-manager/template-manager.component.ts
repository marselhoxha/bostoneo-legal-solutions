import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { TemplateService } from '../../services/template.service';
import { FolderTemplate, PracticeArea, TemplateFolderStructure } from '../../models/template.model';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-template-manager',
  templateUrl: './template-manager.component.html',
  styleUrls: ['./template-manager.component.scss']
})
export class TemplateManagerComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  templates: FolderTemplate[] = [];
  practiceAreas = Object.values(PracticeArea);
  selectedTemplate: FolderTemplate | null = null;
  isLoading = false;
  
  templateForm: FormGroup;
  editingTemplate: FolderTemplate | null = null;
  
  constructor(
    private templateService: TemplateService,
    private fb: FormBuilder
  ) {
    this.templateForm = this.fb.group({
      name: ['', Validators.required],
      description: ['', Validators.required],
      practiceArea: ['', Validators.required],
      isDefault: [false]
    });
  }
  
  ngOnInit(): void {
    this.loadTemplates();
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  
  /**
   * Load all templates
   */
  loadTemplates(): void {
    this.isLoading = true;
    this.templateService.getTemplates().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (templates) => {
        this.templates = templates;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading templates:', error);
        this.isLoading = false;
      }
    });
  }
  
  /**
   * Select template for viewing
   */
  selectTemplate(template: FolderTemplate): void {
    this.selectedTemplate = template;
    this.editingTemplate = null;
  }
  
  /**
   * Start editing template
   */
  editTemplate(template: FolderTemplate): void {
    this.editingTemplate = template;
    this.templateForm.patchValue({
      name: template.name,
      description: template.description,
      practiceArea: template.practiceArea,
      isDefault: template.isDefault
    });
  }
  
  /**
   * Create new template
   */
  createNewTemplate(): void {
    this.editingTemplate = null;
    this.templateForm.reset();
    this.templateForm.patchValue({
      isDefault: false
    });
  }
  
  /**
   * Save template
   */
  saveTemplate(): void {
    if (this.templateForm.valid) {
      const formValue = this.templateForm.value;
      
      if (this.editingTemplate) {
        // Update existing template
        this.updateTemplate(this.editingTemplate.id, formValue);
      } else {
        // Create new template
        this.createTemplate(formValue);
      }
    }
  }
  
  /**
   * Create new template
   */
  private createTemplate(templateData: any): void {
    const request = {
      name: templateData.name,
      description: templateData.description,
      practiceArea: templateData.practiceArea,
      folders: [], // Will be populated through folder structure editor
      isDefault: templateData.isDefault
    };
    
    this.templateService.createTemplate(request).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (template) => {
        this.templates.push(template);
        this.editingTemplate = null;
        this.templateForm.reset();
        
        Swal.fire({
          title: 'Success!',
          text: 'Template created successfully',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
      },
      error: (error) => {
        console.error('Error creating template:', error);
        Swal.fire({
          title: 'Error!',
          text: 'Failed to create template: ' + error.message,
          icon: 'error',
          confirmButtonColor: '#f06548'
        });
      }
    });
  }
  
  /**
   * Update existing template
   */
  private updateTemplate(templateId: string, templateData: any): void {
    // This would call a template update API when implemented
    Swal.fire({
      title: 'Info',
      text: 'Template update functionality will be implemented with backend API',
      icon: 'info',
      confirmButtonColor: '#0ab39c'
    });
  }
  
  /**
   * Delete template
   */
  deleteTemplate(template: FolderTemplate): void {
    Swal.fire({
      title: 'Are you sure?',
      text: `Delete template "${template.name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#f06548',
      cancelButtonColor: '#74788d',
      confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
      if (result.isConfirmed) {
        // This would call a template delete API when implemented
        Swal.fire({
          title: 'Info',
          text: 'Template deletion functionality will be implemented with backend API',
          icon: 'info',
          confirmButtonColor: '#0ab39c'
        });
      }
    });
  }
  
  /**
   * Get practice area display name
   */
  getPracticeAreaName(practiceArea: PracticeArea): string {
    return practiceArea.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
  
  /**
   * Get folder structure preview
   */
  getFolderStructurePreview(folders: TemplateFolderStructure[]): string[] {
    return folders.map(folder => folder.name).slice(0, 5);
  }
  
  /**
   * Get template status badge class
   */
  getStatusBadgeClass(template: FolderTemplate): string {
    if (template.isDefault) return 'bg-success-subtle text-success';
    if (template.isCustom) return 'bg-primary-subtle text-primary';
    return 'bg-secondary-subtle text-secondary';
  }
  
  /**
   * Get template status text
   */
  getStatusText(template: FolderTemplate): string {
    if (template.isDefault) return 'Default';
    if (template.isCustom) return 'Custom';
    return 'Standard';
  }
}