import { Component, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import Swal from 'sweetalert2';

interface PDFTemplate {
  id: number;
  name: string;
  description: string;
  category: string;
  templateType: string;
  pdfFormUrl: string;
  requiredFields?: string[];
  createdAt?: Date;
}

interface PDFFormField {
  id?: number;
  pdfFieldName: string;
  caseDataPath: string;
  fieldType: string;
  isRequired: boolean;
  displayOrder: number;
  defaultValue?: any;
  value?: any;
  displayName?: string;
}

interface FillPDFResponse {
  templateId: number;
  filledPdfPath: string;
  originalPdfUrl: string;
  formFields: PDFFormField[];
  generatedAt: Date;
  status: string;
}

@Component({
  selector: 'app-pdf-forms',
  templateUrl: './pdf-forms.component.html',
  styleUrls: ['./pdf-forms.component.scss']
})
export class PdfFormsComponent implements OnInit, OnDestroy {
  @ViewChild('pdfViewer') pdfViewer: ElementRef;

  templates: PDFTemplate[] = [];
  selectedTemplate: PDFTemplate | null = null;
  formFields: PDFFormField[] = [];
  formData: FormGroup;

  currentStep = 1;
  totalSteps = 4;

  pdfSrc: SafeResourceUrl | null = null;
  pdfUrl: string | null = null;
  pdfBlob: Blob | null = null;
  pdfBlobUrl: string | null = null;
  filledPdfPath: string | null = null;
  showPdfEditor = false;
  isLoading = false;

  categories = [
    { value: 'IMMIGRATION', label: 'Immigration' },
    { value: 'CRIMINAL_DEFENSE', label: 'Criminal Defense' },
    { value: 'FAMILY_LAW', label: 'Family Law' },
    { value: 'REAL_ESTATE', label: 'Real Estate' },
    { value: 'PATENT', label: 'Patent & IP' }
  ];

  selectedCategory = '';
  searchTerm = '';

  editMode = false;
  editableFields: any = {};

  private apiUrl = 'http://localhost:8085/api';

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef
  ) {
    this.formData = this.fb.group({});
  }

  ngOnInit(): void {
    this.loadTemplates();
  }

  ngOnDestroy(): void {
    // Clean up blob URL to prevent memory leak
    if (this.pdfBlobUrl) {
      URL.revokeObjectURL(this.pdfBlobUrl);
    }
  }

  loadTemplates(): void {
    this.isLoading = true;
    this.http.get<any[]>(`${this.apiUrl}/ai/templates/pdf-forms`).subscribe({
      next: (templates) => {
        this.templates = templates.filter(t => t.templateType === 'PDF_FORM');
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading templates:', error);
        this.isLoading = false;
        Swal.fire('Error', 'Failed to load PDF templates', 'error');
      }
    });
  }

  get filteredTemplates(): PDFTemplate[] {
    return this.templates.filter(template => {
      const matchesCategory = !this.selectedCategory || template.category === this.selectedCategory;
      const matchesSearch = !this.searchTerm ||
        template.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        template.description?.toLowerCase().includes(this.searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }

  selectTemplate(template: PDFTemplate): void {
    this.selectedTemplate = template;
    this.loadFormFields(template.id);
    this.currentStep = 2;
  }

  loadFormFields(templateId: number): void {
    this.isLoading = true;
    this.http.get<PDFFormField[]>(`${this.apiUrl}/ai/pdf-forms/${templateId}/fields`).subscribe({
      next: (fields) => {
        this.formFields = fields.map(field => ({
          ...field,
          displayName: this.formatFieldName(field.caseDataPath)
        }));
        this.buildForm();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading form fields:', error);
        this.isLoading = false;
        Swal.fire('Error', 'Failed to load form fields', 'error');
      }
    });
  }

  formatFieldName(fieldPath: string): string {
    return fieldPath
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  buildForm(): void {
    const group: any = {};
    this.formFields.forEach(field => {
      group[field.caseDataPath] = [field.defaultValue || '', field.isRequired ? [] : []];
    });
    this.formData = this.fb.group(group);
  }

  async fillWithAI(): Promise<void> {
    const { value: caseInfo } = await Swal.fire({
      title: 'AI Form Filling',
      html: `
        <div class="text-start">
          <p class="mb-3">Provide case information for AI to fill the form:</p>
          <textarea id="ai-prompt" class="form-control" rows="6"
            placeholder="Example: Maria Rodriguez (petitioner) is filing for her husband Carlos Rodriguez (beneficiary). Maria is a US citizen born in San Antonio, TX. Carlos was born in Mexico City on March 15, 1985. They married in Las Vegas on June 15, 2010..."></textarea>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Generate with AI',
      preConfirm: () => {
        const prompt = (document.getElementById('ai-prompt') as HTMLTextAreaElement).value;
        if (!prompt) {
          Swal.showValidationMessage('Please provide case information');
          return false;
        }
        return prompt;
      }
    });

    if (caseInfo) {
      this.isLoading = true;

      this.http.post<any>(`${this.apiUrl}/ai/generate/form-data`, {
        templateId: this.selectedTemplate?.id,
        prompt: caseInfo,
        formFields: this.formFields.map(f => f.caseDataPath)
      }).subscribe({
        next: (response) => {
          this.formData.patchValue(response.formData);
          this.isLoading = false;
          Swal.fire('Success', 'Form fields have been filled with AI', 'success');
        },
        error: (error) => {
          console.error('Error generating form data with AI:', error);
          this.isLoading = false;

          const mockData = this.generateMockData();
          this.formData.patchValue(mockData);
          Swal.fire('Demo Mode', 'Using sample data for demonstration', 'info');
        }
      });
    }
  }

  generateMockData(): any {
    return {
      clientName: 'Rodriguez',
      clientFirstName: 'Maria',
      clientMiddleName: 'Carmen',
      beneficiaryLastName: 'Rodriguez',
      beneficiaryFirstName: 'Carlos',
      beneficiaryMiddleName: 'Antonio',
      beneficiaryDateOfBirth: '1985-03-15',
      beneficiaryGenderMale: true,
      beneficiaryGenderFemale: false,
      beneficiaryCityOfBirth: 'Mexico City',
      beneficiaryCountryOfBirth: 'Mexico',
      relationshipSpouse: true,
      beneficiaryAddress: '456 Oak Avenue, Apt 2B',
      beneficiaryCity: 'Los Angeles',
      beneficiaryState: 'CA',
      beneficiaryZipCode: '90210',
      beneficiaryCountry: 'United States',
      petitionerSSN: '123-45-6789',
      petitionerDateOfBirth: '1980-08-22',
      petitionerCity: 'Houston',
      petitionerState: 'TX'
    };
  }

  nextStep(): void {
    if (this.currentStep < this.totalSteps) {
      if (this.currentStep === 2) {
        // Call fillPDF which will handle moving to step 3
        this.fillPDF();
        return; // Don't increment step here
      }
      this.currentStep++;
      this.cdr.detectChanges();
    }
  }

  previousStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  fillPDF(): void {
    if (!this.selectedTemplate) return;

    this.isLoading = true;
    this.cdr.detectChanges();

    const caseData = this.formData.value;

    this.http.post<FillPDFResponse>(`${this.apiUrl}/ai/pdf-forms/${this.selectedTemplate.id}/fill`, {
      caseData: caseData
    }).subscribe({
      next: (response) => {
        this.filledPdfPath = response.filledPdfPath;

        // Create the PDF URL - handle both absolute and relative paths
        const filledPath = response.filledPdfPath;
        this.pdfUrl = `${this.apiUrl}/files/download?path=${encodeURIComponent(filledPath)}`;

        // Fetch PDF as blob and create blob URL for display
        this.http.get(this.pdfUrl, { responseType: 'blob' }).subscribe({
          next: (blob) => {
            // Clean up previous blob URL if exists
            if (this.pdfBlobUrl) {
              URL.revokeObjectURL(this.pdfBlobUrl);
            }

            // Create new blob URL
            this.pdfBlob = blob;
            this.pdfBlobUrl = URL.createObjectURL(blob);
            this.pdfSrc = this.sanitizer.bypassSecurityTrustResourceUrl(this.pdfBlobUrl);

            this.showPdfEditor = true;
            this.editableFields = { ...caseData };
            this.currentStep = 3;
            this.isLoading = false;

            // Force change detection
            this.cdr.detectChanges();
          },
          error: (err) => {
            console.error('Error fetching PDF blob:', err);
            this.isLoading = false;
            this.cdr.detectChanges();
            Swal.fire('Error', 'Failed to load PDF preview', 'error');
          }
        });
      },
      error: (error) => {
        console.error('Error filling PDF:', error);
        this.isLoading = false;
        this.cdr.detectChanges();
        Swal.fire('Error', 'Failed to fill PDF form', 'error');
      }
    });
  }

  enableEditMode(): void {
    this.editMode = true;
    Swal.fire({
      title: 'Edit Mode',
      text: 'You can now edit the form fields. Click Save Changes when done.',
      icon: 'info',
      timer: 3000
    });
  }

  saveEdits(): void {
    this.formData.patchValue(this.editableFields);
    this.fillPDF();
    this.editMode = false;
    Swal.fire('Success', 'Changes have been applied', 'success');
  }

  cancelEdits(): void {
    this.editMode = false;
    this.editableFields = { ...this.formData.value };
  }

  downloadPDF(): void {
    if (!this.pdfUrl) return;

    const link = document.createElement('a');
    link.href = this.pdfUrl;
    link.download = `${this.selectedTemplate?.name.replace(/\s+/g, '_')}_filled.pdf`;
    link.click();

    Swal.fire({
      title: 'Downloaded!',
      text: 'The filled PDF form has been downloaded.',
      icon: 'success',
      timer: 2000
    });
  }

  saveAndContinue(): void {
    const formData = {
      templateId: this.selectedTemplate?.id,
      filledPdfPath: this.filledPdfPath,
      caseData: this.formData.value,
      status: 'COMPLETED'
    };

    this.http.post(`${this.apiUrl}/ai/pdf-forms/save`, formData).subscribe({
      next: () => {
        this.currentStep = 4;
        Swal.fire('Saved!', 'The form has been saved successfully.', 'success');
      },
      error: (error) => {
        console.error('Error saving form:', error);
        this.currentStep = 4;
      }
    });
  }

  startOver(): void {
    // Clean up blob URL before resetting
    if (this.pdfBlobUrl) {
      URL.revokeObjectURL(this.pdfBlobUrl);
    }

    this.currentStep = 1;
    this.selectedTemplate = null;
    this.formFields = [];
    this.formData = this.fb.group({});
    this.pdfSrc = null;
    this.pdfUrl = null;
    this.pdfBlob = null;
    this.pdfBlobUrl = null;
    this.filledPdfPath = null;
    this.showPdfEditor = false;
    this.editMode = false;
    this.editableFields = {};
  }

  getFieldValue(field: PDFFormField): any {
    return this.editMode ? this.editableFields[field.caseDataPath] : this.formData.get(field.caseDataPath)?.value;
  }

  updateFieldValue(field: PDFFormField, value: any): void {
    if (this.editMode) {
      this.editableFields[field.caseDataPath] = value;
    } else {
      this.formData.get(field.caseDataPath)?.setValue(value);
    }
  }

  getRequiredFields(): PDFFormField[] {
    return this.formFields.filter(f => f.isRequired);
  }

  getOptionalFields(): PDFFormField[] {
    return this.formFields.filter(f => !f.isRequired);
  }
}