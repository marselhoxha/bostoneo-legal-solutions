import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { InvoiceTemplateService } from 'src/app/service/invoice-template.service';
import { InvoiceTemplate } from 'src/app/interface/invoice-template';
import Swal from 'sweetalert2';
import { BehaviorSubject } from 'rxjs';

@Component({
  selector: 'app-invoice-template-form',
  templateUrl: './invoice-template-form.component.html',
  styleUrls: ['./invoice-template-form.component.css']
})
export class InvoiceTemplateFormComponent implements OnInit {
  templateForm: FormGroup;
  templateId: number | null = null;
  isEditMode = false;
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  isLoading$ = this.isLoadingSubject.asObservable();

  categories = ['LEGAL', 'CONSULTATION', 'RESEARCH', 'FILING', 'DOCUMENTATION'];
  
  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private templateService: InvoiceTemplateService
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      if (params['id']) {
        this.templateId = +params['id'];
        this.isEditMode = true;
        this.loadTemplate();
      }
    });
  }

  private initializeForm(): void {
    this.templateForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(100)]],
      description: ['', Validators.maxLength(500)],
      isActive: [true],
      isDefault: [false],
      
      // Template settings
      taxRate: [0, [Validators.min(0), Validators.max(100)]],
      paymentTerms: [30, [Validators.min(0)]],
      currencyCode: ['USD'],
      
      // Template content
      headerText: [''],
      footerText: [''],
      notesTemplate: [''],
      termsAndConditions: [''],
      
      // Styling options
      logoPosition: ['top-left'],
      primaryColor: ['#405189'],
      secondaryColor: ['#878a99'],
      fontFamily: ['Inter'],
      
      // Template items
      templateItems: this.fb.array([])
    });
  }

  get templateItems(): FormArray {
    return this.templateForm.get('templateItems') as FormArray;
  }

  createTemplateItem(): FormGroup {
    return this.fb.group({
      description: ['', Validators.required],
      defaultQuantity: [1, [Validators.required, Validators.min(0.01)]],
      defaultUnitPrice: [0, [Validators.min(0)]],
      category: [''],
      isOptional: [false],
      sortOrder: [this.templateItems.length]
    });
  }

  addTemplateItem(): void {
    this.templateItems.push(this.createTemplateItem());
  }

  removeTemplateItem(index: number): void {
    this.templateItems.removeAt(index);
    // Update sort order for remaining items
    this.templateItems.controls.forEach((control, i) => {
      control.get('sortOrder')?.setValue(i);
    });
  }

  private loadTemplate(): void {
    this.isLoadingSubject.next(true);
    this.templateService.getTemplateById(this.templateId!).subscribe({
      next: (response) => {
        this.isLoadingSubject.next(false);
        const template = response.data;
        if (template) {
          // Clear existing items
          while (this.templateItems.length !== 0) {
            this.templateItems.removeAt(0);
          }
          
          // Patch form with template data
          this.templateForm.patchValue({
            name: template.name,
            description: template.description,
            isActive: template.isActive,
            isDefault: template.isDefault,
            taxRate: template.taxRate,
            paymentTerms: template.paymentTerms,
            currencyCode: template.currencyCode,
            headerText: template.headerText,
            footerText: template.footerText,
            notesTemplate: template.notesTemplate,
            termsAndConditions: template.termsAndConditions,
            logoPosition: template.logoPosition,
            primaryColor: template.primaryColor,
            secondaryColor: template.secondaryColor,
            fontFamily: template.fontFamily
          });
          
          // Add template items
          if (template.templateItems && template.templateItems.length > 0) {
            template.templateItems.forEach(item => {
              const itemForm = this.fb.group({
                description: [item.description, Validators.required],
                defaultQuantity: [item.defaultQuantity || 1, [Validators.required, Validators.min(0.01)]],
                defaultUnitPrice: [item.defaultUnitPrice || 0, [Validators.min(0)]],
                category: [item.category || ''],
                isOptional: [item.isOptional || false],
                sortOrder: [item.sortOrder || 0]
              });
              this.templateItems.push(itemForm);
            });
          }
        }
      },
      error: (error) => {
        this.isLoadingSubject.next(false);
        Swal.fire('Error!', 'Failed to load template', 'error');
        this.router.navigate(['/invoices/templates']);
      }
    });
  }

  onSubmit(): void {
    if (this.templateForm.invalid) {
      Object.keys(this.templateForm.controls).forEach(key => {
        const control = this.templateForm.get(key);
        if (control?.invalid) {
          control.markAsTouched();
        }
      });
      return;
    }

    this.isLoadingSubject.next(true);
    const template: InvoiceTemplate = this.templateForm.value;

    const request = this.isEditMode
      ? this.templateService.updateTemplate(this.templateId!, template)
      : this.templateService.createTemplate(template);

    request.subscribe({
      next: (response) => {
        this.isLoadingSubject.next(false);
        Swal.fire({
          title: 'Success!',
          text: `Template ${this.isEditMode ? 'updated' : 'created'} successfully`,
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        }).then(() => {
          this.router.navigate(['/invoices/templates']);
        });
      },
      error: (error) => {
        this.isLoadingSubject.next(false);
        Swal.fire('Error!', error.message || 'Failed to save template', 'error');
      }
    });
  }

  onCancel(): void {
    this.router.navigate(['/invoices/templates']);
  }

  moveItemUp(index: number): void {
    if (index > 0) {
      const items = this.templateItems.controls;
      const temp = items[index];
      items[index] = items[index - 1];
      items[index - 1] = temp;
      
      // Update sort order
      items[index].get('sortOrder')?.setValue(index);
      items[index - 1].get('sortOrder')?.setValue(index - 1);
    }
  }

  moveItemDown(index: number): void {
    const items = this.templateItems.controls;
    if (index < items.length - 1) {
      const temp = items[index];
      items[index] = items[index + 1];
      items[index + 1] = temp;
      
      // Update sort order
      items[index].get('sortOrder')?.setValue(index);
      items[index + 1].get('sortOrder')?.setValue(index + 1);
    }
  }
}