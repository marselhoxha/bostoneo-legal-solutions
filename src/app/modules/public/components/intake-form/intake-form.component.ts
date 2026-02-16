import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IntakeFormService, IntakeForm, SubmissionResponse, FileUploadResponse } from '../../services/intake-form.service';
import { INTAKE_FIELD_DEFINITIONS } from '../../constants/intake-field-definitions';

interface PracticeAreaOption {
  key: string;
  icon: string;
  description: string;
}

interface UploadedFile {
  fileKey: string;
  fileName: string;
  fileSize: number;
  contentType: string;
}

@Component({
  selector: 'app-intake-form',
  templateUrl: './intake-form.component.html',
  styleUrls: ['./intake-form.component.scss']
})
export class IntakeFormComponent implements OnInit, OnDestroy {
  intakeForm: IntakeForm | null = null;
  submissionForm: FormGroup;
  isLoading = false;
  isSubmitting = false;
  error: string = '';
  formUrl: string = '';

  // Practice area selection (Step 1 when no formUrl)
  showPracticeAreaStep = false;
  selectedPracticeArea: string = '';

  practiceAreas: PracticeAreaOption[] = [
    { key: 'Personal Injury', icon: 'ri-heart-pulse-line', description: 'Accidents, medical malpractice, injury claims' },
    { key: 'Family Law', icon: 'ri-user-heart-line', description: 'Divorce, child custody, family matters' },
    { key: 'Criminal Defense', icon: 'ri-shield-check-line', description: 'Criminal charges and legal defense' },
    { key: 'Business Law', icon: 'ri-briefcase-4-line', description: 'Corporate law, contracts, business matters' },
    { key: 'Real Estate Law', icon: 'ri-home-4-line', description: 'Property transactions, real estate issues' },
    { key: 'Immigration Law', icon: 'ri-earth-line', description: 'Visas, citizenship, immigration matters' }
  ];

  // Multi-step form properties
  currentStep = 1;
  totalSteps = 3;
  stepFields: { [key: number]: any[] } = {};
  completedSteps: Set<number> = new Set();

  // Auto-save functionality
  private autoSaveKey = 'intake_form_draft';
  autoSaveInterval: any;

  // Dynamic form fields based on form configuration
  formFields: any[] = [];

  // Default form structure for practice areas (imported from shared constants)
  defaultFields = INTAKE_FIELD_DEFINITIONS;

  constructor(
    private fb: FormBuilder,
    private intakeFormService: IntakeFormService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.submissionForm = this.fb.group({});
  }

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.formUrl = params['formUrl'] || '';

      if (this.formUrl) {
        // Direct form URL — load from backend, skip practice area step
        this.showPracticeAreaStep = false;
        this.totalSteps = 3;
        this.loadForm();
      } else {
        // No formUrl — show practice area selection as Step 1
        this.showPracticeAreaStep = true;
        this.totalSteps = 4;
        this.isLoading = false;
      }
    });
  }

  // ---- Practice area selection (Step 1) ----

  selectPracticeArea(area: string): void {
    this.selectedPracticeArea = area;
  }

  confirmPracticeArea(): void {
    if (!this.selectedPracticeArea) return;

    // Build a local IntakeForm-like object for the selected practice area
    this.intakeForm = {
      id: 0,
      name: `${this.selectedPracticeArea} Consultation`,
      description: '',
      formType: 'INTAKE',
      status: 'PUBLISHED',
      isPublic: true,
      publicUrl: '',
      formConfig: null,
      successMessage: '',
      redirectUrl: '',
      practiceArea: this.selectedPracticeArea,
      submissionCount: 0,
      conversionRate: 0,
      createdAt: new Date(),
      publishedAt: new Date()
    } as IntakeForm;

    this.buildForm();
    this.completedSteps.add(1);
    this.currentStep = 2;
  }

  // ---- Form loading (when formUrl is provided) ----

  loadForm(): void {
    this.isLoading = true;
    this.error = '';

    this.intakeFormService.getFormByUrl(this.formUrl).subscribe({
      next: (form) => {
        this.intakeForm = form;
        this.selectedPracticeArea = form.practiceArea;
        this.buildForm();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading form:', error);
        this.error = 'Form not found or not available.';
        this.isLoading = false;
      }
    });
  }

  // ---- Form building ----

  buildForm(): void {
    if (!this.intakeForm) return;

    if (this.intakeForm.formConfig && this.intakeForm.formConfig.fields) {
      this.formFields = this.intakeForm.formConfig.fields;
    } else {
      this.formFields = this.getDefaultFields(this.intakeForm.practiceArea);
    }

    const formControls: { [key: string]: any } = {};

    this.formFields.forEach(field => {
      const validators = [];
      if (field.required) {
        validators.push(Validators.required);
      }
      if (field.type === 'email') {
        validators.push(Validators.email);
      }
      if (field.type === 'tel') {
        validators.push(Validators.pattern(/^\(\d{3}\)\s\d{3}-\d{4}$/));
      }

      formControls[field.name] = [field.defaultValue || '', validators];
    });

    // Consent controls (shown only on final step)
    formControls['smsConsent'] = [false];
    formControls['aiConsent'] = [false];

    this.submissionForm = this.fb.group(formControls);

    this.organizeFieldsIntoSteps();
    this.loadFormDraft();
    this.setupAutoSave();
  }

  getDefaultFields(practiceArea: string): any[] {
    return this.defaultFields[practiceArea] || this.defaultFields['Personal Injury'];
  }

  // ---- Step navigation ----

  /** The first form-field step number (2 if practice area step is shown, 1 otherwise) */
  get firstFieldStep(): number {
    return this.showPracticeAreaStep ? 2 : 1;
  }

  getStepTitle(): string {
    if (this.showPracticeAreaStep && this.currentStep === 1) {
      return 'Select Practice Area';
    }
    const fieldStep = this.currentStep - this.firstFieldStep + 1;
    switch (fieldStep) {
      case 1: return 'Basic Information';
      case 2: return 'Case Details';
      case 3: return 'Review & Submit';
      default: return 'Step ' + this.currentStep;
    }
  }

  getStepDescription(): string {
    if (this.showPracticeAreaStep && this.currentStep === 1) {
      return 'Choose the area of law that best fits your legal matter.';
    }
    const fieldStep = this.currentStep - this.firstFieldStep + 1;
    switch (fieldStep) {
      case 1: return 'Tell us how to reach you and what type of legal matter you need help with.';
      case 2: return 'Please provide details about your specific legal situation.';
      case 3: return 'Review your information and submit your consultation request.';
      default: return '';
    }
  }

  getStepLabel(step: number): string {
    if (this.showPracticeAreaStep) {
      switch (step) {
        case 1: return 'Practice Area';
        case 2: return 'Basic Info';
        case 3: return 'Case Details';
        case 4: return 'Review & Submit';
        default: return '';
      }
    } else {
      switch (step) {
        case 1: return 'Basic Info';
        case 2: return 'Case Details';
        case 3: return 'Review & Submit';
        default: return '';
      }
    }
  }

  get stepNumbers(): number[] {
    return Array.from({ length: this.totalSteps }, (_, i) => i + 1);
  }

  nextStep(): void {
    // Practice area step validation
    if (this.showPracticeAreaStep && this.currentStep === 1) {
      if (!this.selectedPracticeArea) return;
      this.confirmPracticeArea();
      return;
    }

    if (this.validateCurrentStep()) {
      this.completedSteps.add(this.currentStep);
      if (this.currentStep < this.totalSteps) {
        this.currentStep++;
      }
    } else {
      this.markCurrentStepFieldsTouched();
    }
  }

  previousStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  goToStep(step: number): void {
    if (step >= 1 && step <= this.totalSteps) {
      if (step < this.currentStep || this.validateCurrentStep()) {
        if (step > this.currentStep) {
          this.completedSteps.add(this.currentStep);
        }
        this.currentStep = step;
      }
    }
  }

  validateCurrentStep(): boolean {
    // Practice area step
    if (this.showPracticeAreaStep && this.currentStep === 1) {
      return !!this.selectedPracticeArea;
    }

    const currentStepFields = this.getCurrentStepFields();
    for (const field of currentStepFields) {
      const control = this.submissionForm.get(field.name);
      if (control?.invalid) {
        return false;
      }
    }
    return true;
  }

  markCurrentStepFieldsTouched(): void {
    const currentStepFields = this.getCurrentStepFields();
    currentStepFields.forEach(field => {
      const control = this.submissionForm.get(field.name);
      control?.markAsTouched();
    });
  }

  getCurrentStepFields(): any[] {
    // Map step number to field-step index
    const fieldStepIndex = this.currentStep - this.firstFieldStep + 1;
    const stepFields = this.stepFields[fieldStepIndex] || [];
    return stepFields.filter(field => this.shouldShowField(field));
  }

  shouldShowField(field: any): boolean {
    const formValue = this.submissionForm.value;

    if (field.name === 'childrenAges' && formValue.hasChildren === 'no') {
      return false;
    }
    if (field.name === 'courtDate' && formValue.isIncarcerated === 'no') {
      return false;
    }
    if (field.name === 'timeline' && !['Purchase', 'Sale', 'Refinancing'].includes(formValue.transactionType)) {
      return false;
    }
    if (field.name === 'businessSize' && !formValue.company) {
      return false;
    }
    if (field.name.includes('family') && formValue.familyInUS === 'no') {
      return false;
    }

    return true;
  }

  getProgressPercentage(): number {
    return (this.currentStep / this.totalSteps) * 100;
  }

  isStepCompleted(step: number): boolean {
    return this.completedSteps.has(step);
  }

  isStepAccessible(step: number): boolean {
    if (step === 1) return true;
    for (let i = 1; i < step; i++) {
      if (!this.completedSteps.has(i)) {
        return false;
      }
    }
    return true;
  }

  organizeFieldsIntoSteps(): void {
    if (!this.formFields.length) return;

    // Field-step 1: Basic contact info + case type selects
    const basicFields = ['firstName', 'lastName', 'email', 'phone'];
    const caseTypeFields = this.formFields.filter(f =>
      f.type === 'select' && (f.name.includes('Type') || f.name.includes('caseType') || f.name.includes('businessType') || f.name.includes('chargeType') || f.name.includes('propertyType') || f.name.includes('transactionType'))
    );

    this.stepFields[1] = [
      ...this.formFields.filter(f => basicFields.includes(f.name)),
      ...caseTypeFields
    ];

    // Field-step 2: Detailed case information
    const detailFields = this.formFields.filter(f =>
      f.type === 'textarea' ||
      f.name.includes('Date') ||
      f.name.includes('Location') ||
      f.name.includes('Address') ||
      f.name.includes('Treatment') ||
      f.name.includes('Status') ||
      f.name.includes('Children') ||
      f.name.includes('Incarcerated') ||
      f.name.includes('Family') ||
      f.name.includes('Deadline')
    );

    this.stepFields[2] = detailFields;

    // Field-step 3: Remaining fields (urgency, etc.)
    const remainingFields = this.formFields.filter(f =>
      !this.stepFields[1].some((sf: any) => sf.name === f.name) &&
      !this.stepFields[2].some((sf: any) => sf.name === f.name)
    );

    this.stepFields[3] = remainingFields;

    // Ensure every field is assigned
    this.formFields.forEach(field => {
      let assigned = false;
      for (let step = 1; step <= 3; step++) {
        if (this.stepFields[step].some((sf: any) => sf.name === field.name)) {
          assigned = true;
          break;
        }
      }
      if (!assigned) {
        this.stepFields[3].push(field);
      }
    });
  }

  // ---- Validation helpers ----

  hasFieldError(fieldName: string): boolean {
    const control = this.submissionForm.get(fieldName);
    return !!(control?.errors && (control.dirty || control.touched));
  }

  isFieldValid(fieldName: string): boolean {
    const control = this.submissionForm.get(fieldName);
    return !!(control && control.dirty && !control.errors && control.value);
  }

  getFieldError(fieldName: string): string {
    const control = this.submissionForm.get(fieldName);
    if (control?.errors && (control.dirty || control.touched)) {
      if (control.errors['required']) {
        return 'This field is required';
      }
      if (control.errors['email']) {
        return 'Please enter a valid email address';
      }
      if (control.errors['pattern']) {
        return 'Please enter a valid phone number';
      }
    }
    return '';
  }

  // ---- Phone mask ----

  onPhoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    let digits = input.value.replace(/\D/g, '');
    if (digits.length > 10) digits = digits.substring(0, 10);

    let formatted = '';
    if (digits.length > 0) formatted = '(' + digits.substring(0, 3);
    if (digits.length >= 3) formatted += ') ';
    if (digits.length > 3) formatted += digits.substring(3, 6);
    if (digits.length >= 6) formatted += '-' + digits.substring(6, 10);

    input.value = formatted;
    this.submissionForm.get('phone')?.setValue(formatted, { emitEvent: false });
  }

  // ---- File upload ----

  uploadedFiles: UploadedFile[] = [];
  isUploading = false;
  uploadError = '';
  maxFiles = 3;
  maxFileSize = 10 * 1024 * 1024; // 10MB
  allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'docx'];

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    Array.from(input.files).forEach(file => this.uploadFile(file));
    input.value = ''; // reset input so same file can be re-selected
  }

  onFileDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (!event.dataTransfer?.files?.length) return;

    Array.from(event.dataTransfer.files).forEach(file => this.uploadFile(file));
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  private uploadFile(file: File): void {
    if (this.uploadedFiles.length >= this.maxFiles) {
      this.uploadError = `Maximum ${this.maxFiles} files allowed.`;
      return;
    }

    if (file.size > this.maxFileSize) {
      this.uploadError = `"${file.name}" exceeds the 10MB size limit.`;
      return;
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!this.allowedExtensions.includes(ext)) {
      this.uploadError = `"${file.name}" is not a supported file type. Use PDF, JPG, PNG, or DOCX.`;
      return;
    }

    this.uploadError = '';
    this.isUploading = true;

    this.intakeFormService.uploadFile(file).subscribe({
      next: (response: FileUploadResponse) => {
        if (response.success) {
          this.uploadedFiles.push({
            fileKey: response.fileKey,
            fileName: response.fileName,
            fileSize: response.fileSize,
            contentType: response.contentType
          });
        } else {
          this.uploadError = 'Failed to upload file. Please try again.';
        }
        this.isUploading = false;
      },
      error: () => {
        this.uploadError = 'Failed to upload file. Please try again.';
        this.isUploading = false;
      }
    });
  }

  removeFile(index: number): void {
    this.uploadedFiles.splice(index, 1);
    this.uploadError = '';
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  getFileIcon(contentType: string): string {
    if (contentType.includes('pdf')) return 'ri-file-pdf-line';
    if (contentType.includes('image')) return 'ri-image-line';
    if (contentType.includes('word') || contentType.includes('docx')) return 'ri-file-word-line';
    return 'ri-file-line';
  }

  // ---- Organization branding helpers ----

  get orgName(): string {
    return this.intakeForm?.organizationName || '';
  }

  get orgPhone(): string {
    return this.intakeForm?.organizationPhone || '';
  }

  get orgEmail(): string {
    return this.intakeForm?.organizationEmail || '';
  }

  // ---- Submission ----

  onSubmit(): void {
    if (this.submissionForm.valid && this.intakeForm) {
      this.isSubmitting = true;

      const submissionData = {
        ...this.submissionForm.value,
        practiceArea: this.intakeForm.practiceArea || this.selectedPracticeArea,
        formId: this.intakeForm.id || null,
        submittedAt: new Date().toISOString(),
        uploadedFiles: this.uploadedFiles.length > 0 ? this.uploadedFiles : undefined
      };

      // Use appropriate submit method based on whether we have a formUrl
      const submit$ = this.formUrl
        ? this.intakeFormService.submitFormByUrl(this.formUrl, submissionData)
        : this.intakeFormService.submitIntakeForm(submissionData);

      submit$.subscribe({
        next: (response: SubmissionResponse) => {
          this.isSubmitting = false;
          if (response.success) {
            this.clearFormDraft();
            this.router.navigate(['/public/success'], {
              queryParams: {
                submissionId: response.submissionId,
                message: response.message,
                redirectUrl: response.redirectUrl
              }
            });
          } else {
            this.error = response.message || 'Failed to submit form. Please try again.';
          }
        },
        error: (error) => {
          console.error('Error submitting form:', error);
          this.error = 'Failed to submit form. Please check your information and try again.';
          this.isSubmitting = false;
        }
      });
    } else {
      this.markFormGroupTouched(this.submissionForm);
    }
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }

  // ---- Auto-save ----

  setupAutoSave(): void {
    this.autoSaveInterval = setInterval(() => {
      this.saveFormDraft();
    }, 30000);

    this.submissionForm.valueChanges.subscribe(() => {
      this.debouncedSave();
    });
  }

  private saveTimeout: any;
  debouncedSave(): void {
    clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.saveFormDraft();
    }, 2000);
  }

  saveFormDraft(): void {
    if (this.submissionForm.dirty) {
      const draftData = {
        formUrl: this.formUrl,
        practiceArea: this.selectedPracticeArea,
        currentStep: this.currentStep,
        formValue: this.submissionForm.value,
        completedSteps: Array.from(this.completedSteps),
        timestamp: new Date().toISOString()
      };
      localStorage.setItem(this.autoSaveKey, JSON.stringify(draftData));
    }
  }

  loadFormDraft(): void {
    try {
      const savedDraft = localStorage.getItem(this.autoSaveKey);
      if (savedDraft) {
        const draftData = JSON.parse(savedDraft);

        const draftAge = new Date().getTime() - new Date(draftData.timestamp).getTime();
        const maxAge = 7 * 24 * 60 * 60 * 1000;

        // Match draft by formUrl or practiceArea
        const matchesForm = this.formUrl
          ? draftData.formUrl === this.formUrl
          : draftData.practiceArea === this.selectedPracticeArea;

        if (matchesForm && draftAge < maxAge) {
          Object.keys(draftData.formValue).forEach(key => {
            if (this.submissionForm.get(key)) {
              this.submissionForm.get(key)?.setValue(draftData.formValue[key]);
            }
          });
        }
      }
    } catch (error) {
      console.error('Error loading form draft:', error);
    }
  }

  clearFormDraft(): void {
    localStorage.removeItem(this.autoSaveKey);
  }

  // ---- Completion tracking ----

  getFormCompletionPercentage(): number {
    const totalFields = this.formFields.length;
    let completedFields = 0;

    this.formFields.forEach(field => {
      const control = this.submissionForm.get(field.name);
      if (control?.value && control.value.toString().trim() !== '') {
        completedFields++;
      }
    });

    return totalFields > 0 ? Math.round((completedFields / totalFields) * 100) : 0;
  }

  // ---- Lifecycle ----

  ngOnDestroy(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveFormDraft();
  }
}
