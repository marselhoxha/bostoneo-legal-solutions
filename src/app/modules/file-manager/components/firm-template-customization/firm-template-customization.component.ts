import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import Swal from 'sweetalert2';
import { TemplateService } from '../../services/template.service';
import { 
  FolderTemplate, 
  FirmTemplateCustomization, 
  CreateFirmTemplateRequest, 
  TemplateCustomization,
  PracticeArea 
} from '../../models/template.model';

@Component({
  selector: 'app-firm-template-customization',
  templateUrl: './firm-template-customization.component.html',
  styleUrls: ['./firm-template-customization.component.scss']
})
export class FirmTemplateCustomizationComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  // Data
  baseTemplates: FolderTemplate[] = [];
  firmCustomizations: FirmTemplateCustomization[] = [];
  selectedTemplate: FolderTemplate | null = null;
  
  // Form
  customizationForm: FormGroup;
  
  // UI state
  isLoading = false;
  currentFirmId = '1'; // This would come from auth service
  currentFirmName = 'Demo Law Firm';
  
  // Practice areas for dropdown
  practiceAreas = Object.values(PracticeArea);
  
  constructor(
    private fb: FormBuilder,
    private templateService: TemplateService
  ) {
    this.customizationForm = this.fb.group({
      baseTemplateId: ['', Validators.required],
      name: ['', Validators.required],
      description: [''],
      customizations: this.fb.array([])
    });
  }
  
  ngOnInit(): void {
    this.loadBaseTemplates();
    this.loadFirmCustomizations();
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  
  /**
   * Load base templates
   */
  private loadBaseTemplates(): void {
    this.isLoading = true;
    this.templateService.getTemplates().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (templates) => {
        this.baseTemplates = templates.filter(t => t.isDefault);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading base templates:', error);
        this.isLoading = false;
      }
    });
  }
  
  /**
   * Load firm customizations
   */
  private loadFirmCustomizations(): void {
    this.templateService.getFirmTemplateCustomizations(this.currentFirmId).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (customizations) => {
        this.firmCustomizations = customizations;
      },
      error: (error) => {
        console.error('Error loading firm customizations:', error);
      }
    });
  }
  
  /**
   * Select base template for customization
   */
  selectTemplate(template: FolderTemplate): void {
    this.selectedTemplate = template;
    this.customizationForm.patchValue({
      baseTemplateId: template.id,
      name: `${template.name} - ${this.currentFirmName} Custom`,
      description: `Customized ${template.name} template for ${this.currentFirmName}`
    });
  }
  
  /**
   * Get customizations form array
   */
  get customizations(): FormArray {
    return this.customizationForm.get('customizations') as FormArray;
  }
  
  /**
   * Add folder customization
   */
  addFolderCustomization(): void {
    const customization = this.fb.group({
      type: ['add', Validators.required],
      folderPath: ['', Validators.required],
      action: this.fb.group({
        name: [''],
        description: [''],
        permissions: [[]],
        documentTypes: [[]],
        isRequired: [true],
        newPosition: [0]
      })
    });
    
    this.customizations.push(customization);
  }
  
  /**
   * Remove folder customization
   */
  removeFolderCustomization(index: number): void {
    this.customizations.removeAt(index);
  }
  
  /**
   * Save firm template customization
   */
  saveFirmCustomization(): void {
    if (this.customizationForm.invalid) {
      Object.keys(this.customizationForm.controls).forEach(key => {
        const control = this.customizationForm.get(key);
        if (control?.invalid) {
          control.markAsTouched();
        }
      });
      return;
    }
    
    const formValue = this.customizationForm.value;
    const request: CreateFirmTemplateRequest = {
      firmId: this.currentFirmId,
      baseTemplateId: formValue.baseTemplateId,
      customizations: formValue.customizations,
      name: formValue.name,
      description: formValue.description
    };
    
    this.isLoading = true;
    this.templateService.createFirmTemplateCustomization(request).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (customization) => {
        this.firmCustomizations.push(customization);
        this.customizationForm.reset();
        this.selectedTemplate = null;
        this.isLoading = false;
        
        Swal.fire({
          title: 'Success!',
          text: 'Firm template customization created successfully',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
      },
      error: (error) => {
        console.error('Error creating firm customization:', error);
        this.isLoading = false;
        
        Swal.fire({
          title: 'Error!',
          text: 'Failed to create firm template customization',
          icon: 'error',
          confirmButtonColor: '#f06548'
        });
      }
    });
  }
  
  /**
   * Edit existing firm customization
   */
  editFirmCustomization(customization: FirmTemplateCustomization): void {
    // Implementation for editing existing customization
  }
  
  /**
   * Delete firm customization
   */
  deleteFirmCustomization(customization: FirmTemplateCustomization): void {
    Swal.fire({
      title: 'Are you sure?',
      text: 'Do you want to delete this template customization?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#f06548',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
      if (result.isConfirmed) {
        this.templateService.deleteFirmTemplateCustomization(customization.id).pipe(
          takeUntil(this.destroy$)
        ).subscribe({
          next: () => {
            this.firmCustomizations = this.firmCustomizations.filter(c => c.id !== customization.id);
            
            Swal.fire({
              title: 'Deleted!',
              text: 'Template customization has been deleted.',
              icon: 'success',
              timer: 2000,
              showConfirmButton: false
            });
          },
          error: (error) => {
            console.error('Error deleting customization:', error);
            Swal.fire({
              title: 'Error!',
              text: 'Failed to delete template customization',
              icon: 'error',
              confirmButtonColor: '#f06548'
            });
          }
        });
      }
    });
  }
  
  /**
   * Preview customized template
   */
  previewCustomizedTemplate(customization: FirmTemplateCustomization): void {
    // Implementation for previewing customized template
  }
}