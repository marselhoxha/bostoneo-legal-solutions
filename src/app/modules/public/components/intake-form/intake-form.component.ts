import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IntakeFormService, IntakeForm, SubmissionResponse } from '../../services/intake-form.service';

@Component({
  selector: 'app-intake-form',
  templateUrl: './intake-form.component.html',
  styleUrls: ['./intake-form.component.scss']
})
export class IntakeFormComponent implements OnInit, OnDestroy {
  intakeForm: IntakeForm | null = null;
  submissionForm: FormGroup;
  isLoading = true;
  isSubmitting = false;
  error: string = '';
  formUrl: string = '';

  // Multi-step form properties
  currentStep = 1;
  totalSteps = 3;
  stepFields: { [key: number]: any[] } = {};
  completedSteps: Set<number> = new Set();
  
  // Auto-save functionality
  private autoSaveKey = 'intake_form_draft';
  autoSaveInterval: any;
  
  // Urgency and conversion optimization
  showUrgencyMessage = false;
  timeSpentOnForm = 0;
  formStartTime = new Date();

  // Dynamic form fields based on form configuration
  formFields: any[] = [];
  
  // Default form structure for practice areas
  defaultFields = {
    'Personal Injury': [
      { name: 'firstName', label: 'First Name', type: 'text', required: true },
      { name: 'lastName', label: 'Last Name', type: 'text', required: true },
      { name: 'email', label: 'Email Address', type: 'email', required: true },
      { name: 'phone', label: 'Phone Number', type: 'tel', required: true },
      { name: 'incidentDate', label: 'Date of Incident', type: 'date', required: true },
      { name: 'incidentLocation', label: 'Location of Incident', type: 'text', required: true },
      { name: 'injuryType', label: 'Type of Injury', type: 'select', required: true, 
        options: ['Motor Vehicle Accident', 'Slip and Fall', 'Medical Malpractice', 'Product Liability', 'Other'] },
      { name: 'medicalTreatment', label: 'Did you receive medical treatment?', type: 'radio', required: true,
        options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
      { name: 'description', label: 'Describe the incident and injuries', type: 'textarea', required: true, rows: 4 },
      { name: 'urgency', label: 'Urgency Level', type: 'select', required: true,
        options: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] }
    ],
    'Family Law': [
      { name: 'firstName', label: 'First Name', type: 'text', required: true },
      { name: 'lastName', label: 'Last Name', type: 'text', required: true },
      { name: 'email', label: 'Email Address', type: 'email', required: true },
      { name: 'phone', label: 'Phone Number', type: 'tel', required: true },
      { name: 'caseType', label: 'Type of Case', type: 'select', required: true,
        options: ['Divorce', 'Child Custody', 'Child Support', 'Adoption', 'Domestic Violence', 'Prenuptial Agreement', 'Other'] },
      { name: 'maritalStatus', label: 'Current Marital Status', type: 'select', required: true,
        options: ['Married', 'Separated', 'Divorced', 'Single', 'Widowed'] },
      { name: 'hasChildren', label: 'Do you have children?', type: 'radio', required: true,
        options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
      { name: 'childrenAges', label: 'Ages of children (if applicable)', type: 'text', required: false },
      { name: 'description', label: 'Describe your legal matter', type: 'textarea', required: true, rows: 4 },
      { name: 'urgency', label: 'Urgency Level', type: 'select', required: true,
        options: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] }
    ],
    'Criminal Defense': [
      { name: 'firstName', label: 'First Name', type: 'text', required: true },
      { name: 'lastName', label: 'Last Name', type: 'text', required: true },
      { name: 'email', label: 'Email Address', type: 'email', required: true },
      { name: 'phone', label: 'Phone Number', type: 'tel', required: true },
      { name: 'chargeType', label: 'Type of Charges', type: 'select', required: true,
        options: ['DUI/DWI', 'Drug Charges', 'Theft', 'Assault', 'Fraud', 'Traffic Violations', 'Other'] },
      { name: 'courtDate', label: 'Next Court Date (if known)', type: 'date', required: false },
      { name: 'arrestDate', label: 'Date of Arrest', type: 'date', required: false },
      { name: 'location', label: 'Location of Incident', type: 'text', required: false },
      { name: 'isIncarcerated', label: 'Are you currently in custody?', type: 'radio', required: true,
        options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
      { name: 'description', label: 'Describe the charges and circumstances', type: 'textarea', required: true, rows: 4 },
      { name: 'urgency', label: 'Urgency Level', type: 'select', required: true,
        options: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] }
    ],
    'Business Law': [
      { name: 'firstName', label: 'First Name', type: 'text', required: true },
      { name: 'lastName', label: 'Last Name', type: 'text', required: true },
      { name: 'email', label: 'Email Address', type: 'email', required: true },
      { name: 'phone', label: 'Phone Number', type: 'tel', required: true },
      { name: 'company', label: 'Company/Business Name', type: 'text', required: false },
      { name: 'businessType', label: 'Type of Business Matter', type: 'select', required: true,
        options: ['Contract Dispute', 'Business Formation', 'Employment Law', 'Intellectual Property', 'Mergers & Acquisitions', 'Compliance', 'Other'] },
      { name: 'industry', label: 'Industry', type: 'text', required: false },
      { name: 'businessSize', label: 'Number of Employees', type: 'select', required: false,
        options: ['1-10', '11-50', '51-200', '201-1000', '1000+'] },
      { name: 'description', label: 'Describe your business legal matter', type: 'textarea', required: true, rows: 4 },
      { name: 'urgency', label: 'Urgency Level', type: 'select', required: true,
        options: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] }
    ],
    'Real Estate Law': [
      { name: 'firstName', label: 'First Name', type: 'text', required: true },
      { name: 'lastName', label: 'Last Name', type: 'text', required: true },
      { name: 'email', label: 'Email Address', type: 'email', required: true },
      { name: 'phone', label: 'Phone Number', type: 'tel', required: true },
      { name: 'propertyType', label: 'Type of Property', type: 'select', required: true,
        options: ['Residential', 'Commercial', 'Industrial', 'Land/Vacant'] },
      { name: 'transactionType', label: 'Type of Transaction', type: 'select', required: true,
        options: ['Purchase', 'Sale', 'Lease', 'Refinancing', 'Dispute', 'Title Issue', 'Other'] },
      { name: 'propertyAddress', label: 'Property Address', type: 'text', required: false },
      { name: 'propertyValue', label: 'Estimated Property Value', type: 'select', required: false,
        options: ['Under $100K', '$100K - $250K', '$250K - $500K', '$500K - $1M', 'Over $1M'] },
      { name: 'timeline', label: 'Expected Timeline', type: 'select', required: false,
        options: ['Within 30 days', '1-3 months', '3-6 months', '6+ months', 'No specific timeline'] },
      { name: 'description', label: 'Describe your real estate matter', type: 'textarea', required: true, rows: 4 },
      { name: 'urgency', label: 'Urgency Level', type: 'select', required: true,
        options: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] }
    ],
    'Immigration Law': [
      { name: 'firstName', label: 'First Name', type: 'text', required: true },
      { name: 'lastName', label: 'Last Name', type: 'text', required: true },
      { name: 'email', label: 'Email Address', type: 'email', required: true },
      { name: 'phone', label: 'Phone Number', type: 'tel', required: true },
      { name: 'countryOfOrigin', label: 'Country of Origin', type: 'text', required: true },
      { name: 'currentStatus', label: 'Current Immigration Status', type: 'select', required: true,
        options: ['US Citizen', 'Permanent Resident', 'Work Visa', 'Student Visa', 'Tourist/Visitor', 'Asylum Seeker', 'Undocumented', 'Other'] },
      { name: 'caseType', label: 'Type of Immigration Matter', type: 'select', required: true,
        options: ['Green Card/Permanent Residency', 'Citizenship/Naturalization', 'Work Visa', 'Family Visa', 'Asylum/Refugee', 'Deportation Defense', 'Other'] },
      { name: 'familyInUS', label: 'Do you have family members in the US?', type: 'radio', required: true,
        options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
      { name: 'hasDeadline', label: 'Do you have any upcoming immigration deadlines?', type: 'radio', required: true,
        options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
      { name: 'description', label: 'Describe your immigration situation', type: 'textarea', required: true, rows: 4 },
      { name: 'urgency', label: 'Urgency Level', type: 'select', required: true,
        options: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] }
    ]
  };

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
      this.formUrl = params['formUrl'];
      this.loadForm();
    });
  }

  loadForm(): void {
    this.isLoading = true;
    this.error = '';

    this.intakeFormService.getFormByUrl(this.formUrl).subscribe({
      next: (form) => {
        this.intakeForm = form;
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

  buildForm(): void {
    if (!this.intakeForm) return;

    // Use form configuration if available, otherwise use default fields
    if (this.intakeForm.formConfig && this.intakeForm.formConfig.fields) {
      this.formFields = this.intakeForm.formConfig.fields;
    } else {
      this.formFields = this.getDefaultFields(this.intakeForm.practiceArea);
    }

    // Build FormGroup
    const formControls: { [key: string]: any } = {};

    this.formFields.forEach(field => {
      const validators = [];
      if (field.required) {
        validators.push(Validators.required);
      }
      if (field.type === 'email') {
        validators.push(Validators.email);
      }

      formControls[field.name] = [field.defaultValue || '', validators];
    });

    // Add SMS consent control (MUST default to false - unchecked for A2P 10DLC compliance)
    formControls['smsConsent'] = [false];

    this.submissionForm = this.fb.group(formControls);
    
    // Organize fields into steps after building the form
    this.organizeFieldsIntoSteps();
    
    // Load saved draft and setup auto-save
    this.loadFormDraft();
    this.setupAutoSave();
  }

  getDefaultFields(practiceArea: string): any[] {
    return this.defaultFields[practiceArea as keyof typeof this.defaultFields] || this.defaultFields['Personal Injury'];
  }

  onSubmit(): void {
    if (this.submissionForm.valid && this.intakeForm) {
      this.isSubmitting = true;
      
      const submissionData = {
        ...this.submissionForm.value,
        practiceArea: this.intakeForm.practiceArea,
        formId: this.intakeForm.id,
        submittedAt: new Date().toISOString()
      };

      this.intakeFormService.submitFormByUrl(this.formUrl, submissionData).subscribe({
        next: (response: SubmissionResponse) => {
          this.isSubmitting = false;
          if (response.success) {
            // Clear the saved draft on successful submission
            this.clearFormDraft();
            
            // Navigate to success page
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
      // Mark all fields as touched to show validation errors
      this.markFormGroupTouched(this.submissionForm);
    }
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }

  getFieldError(fieldName: string): string {
    const control = this.submissionForm.get(fieldName);
    if (control?.errors && control.touched) {
      if (control.errors['required']) {
        return 'This field is required';
      }
      if (control.errors['email']) {
        return 'Please enter a valid email address';
      }
    }
    return '';
  }

  hasFieldError(fieldName: string): boolean {
    const control = this.submissionForm.get(fieldName);
    return !!(control?.errors && control.touched);
  }

  // Multi-step form navigation methods
  nextStep(): void {
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
      // Only allow going to previous steps or next step if current is valid
      if (step < this.currentStep || this.validateCurrentStep()) {
        if (step > this.currentStep) {
          this.completedSteps.add(this.currentStep);
        }
        this.currentStep = step;
      }
    }
  }

  validateCurrentStep(): boolean {
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
    const stepFields = this.stepFields[this.currentStep] || [];
    return stepFields.filter(field => this.shouldShowField(field));
  }

  shouldShowField(field: any): boolean {
    // Implement conditional logic based on previous field values
    const formValue = this.submissionForm.value;

    // Hide children ages if no children
    if (field.name === 'childrenAges' && formValue.hasChildren === 'no') {
      return false;
    }

    // Show court date only if in custody or has charges
    if (field.name === 'courtDate' && formValue.isIncarcerated === 'no') {
      return false;
    }

    // Show timeline fields only for specific transaction types
    if (field.name === 'timeline' && !['Purchase', 'Sale', 'Refinancing'].includes(formValue.transactionType)) {
      return false;
    }

    // Show business size only if company name is provided
    if (field.name === 'businessSize' && !formValue.company) {
      return false;
    }

    // Show family related questions only if family is in US
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
    // First step is always accessible
    if (step === 1) return true;
    // Other steps are accessible if previous steps are completed
    for (let i = 1; i < step; i++) {
      if (!this.completedSteps.has(i)) {
        return false;
      }
    }
    return true;
  }

  getStepTitle(): string {
    switch (this.currentStep) {
      case 1: return 'Basic Information';
      case 2: return 'Case Details';
      case 3: return 'Additional Information';
      default: return 'Step ' + this.currentStep;
    }
  }

  getStepDescription(): string {
    switch (this.currentStep) {
      case 1: return 'Let us know how to contact you and what type of legal matter you need help with.';
      case 2: return 'Please provide details about your specific legal situation.';
      case 3: return 'Help us better understand your needs and priorities.';
      default: return '';
    }
  }

  organizeFieldsIntoSteps(): void {
    if (!this.formFields.length) return;

    // Step 1: Basic contact info and case type selection
    const basicFields = ['firstName', 'lastName', 'email', 'phone'];
    const caseTypeFields = this.formFields.filter(f => 
      f.type === 'select' && (f.name.includes('Type') || f.name.includes('caseType') || f.name.includes('businessType') || f.name.includes('chargeType') || f.name.includes('propertyType') || f.name.includes('transactionType'))
    );
    
    this.stepFields[1] = [
      ...this.formFields.filter(f => basicFields.includes(f.name)),
      ...caseTypeFields
    ];

    // Step 2: Detailed case information
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

    // Step 3: Additional information and priority
    const remainingFields = this.formFields.filter(f => 
      !this.stepFields[1].some(sf => sf.name === f.name) &&
      !this.stepFields[2].some(sf => sf.name === f.name)
    );
    
    this.stepFields[3] = remainingFields;

    // Ensure all fields are assigned to a step
    this.formFields.forEach(field => {
      let assigned = false;
      for (let step = 1; step <= 3; step++) {
        if (this.stepFields[step].some(sf => sf.name === field.name)) {
          assigned = true;
          break;
        }
      }
      if (!assigned) {
        this.stepFields[3].push(field);
      }
    });
  }

  // Auto-save functionality
  setupAutoSave(): void {
    // Auto-save every 30 seconds
    this.autoSaveInterval = setInterval(() => {
      this.saveFormDraft();
    }, 30000);

    // Also save when form value changes (debounced)
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
    if (this.submissionForm.dirty && this.formUrl) {
      const draftData = {
        formUrl: this.formUrl,
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
      if (savedDraft && this.formUrl) {
        const draftData = JSON.parse(savedDraft);
        
        // Only load draft if it's for the same form and not too old (7 days)
        const draftAge = new Date().getTime() - new Date(draftData.timestamp).getTime();
        const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
        
        if (draftData.formUrl === this.formUrl && draftAge < maxAge) {
          this.currentStep = draftData.currentStep || 1;
          this.completedSteps = new Set(draftData.completedSteps || []);
          
          // Patch form values
          Object.keys(draftData.formValue).forEach(key => {
            if (this.submissionForm.get(key)) {
              this.submissionForm.get(key)?.setValue(draftData.formValue[key]);
            }
          });
          
          // Show draft loaded notification
          console.log('Draft loaded successfully');
        }
      }
    } catch (error) {
      console.error('Error loading form draft:', error);
    }
  }

  clearFormDraft(): void {
    localStorage.removeItem(this.autoSaveKey);
  }

  ngOnDestroy(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    
    // Save final draft before component is destroyed
    this.saveFormDraft();
  }

  // Enhanced form completion tracking
  getFormCompletionPercentage(): number {
    const totalFields = this.formFields.length;
    let completedFields = 0;
    
    this.formFields.forEach(field => {
      const control = this.submissionForm.get(field.name);
      if (control?.value && control.value.toString().trim() !== '') {
        completedFields++;
      }
    });
    
    return Math.round((completedFields / totalFields) * 100);
  }

  getCurrentStepCompletionPercentage(): number {
    const currentFields = this.getCurrentStepFields();
    let completedFields = 0;
    
    currentFields.forEach(field => {
      const control = this.submissionForm.get(field.name);
      if (control?.value && control.value.toString().trim() !== '') {
        completedFields++;
      }
    });
    
    return currentFields.length ? Math.round((completedFields / currentFields.length) * 100) : 0;
  }

  // Urgency and conversion optimization methods
  getUrgencyMessage(): string {
    const messages = [
      "⚡ Free consultations are filling up fast - secure your spot today!",
      "🔥 Don't wait - statute of limitations may be running out on your case!",
      "⏰ Our attorneys are reviewing cases now - submit yours while spots are available!",
      "💪 Join thousands who got justice - your case review is FREE and takes 2 minutes!",
      "🎯 Time-sensitive cases require immediate action - get expert legal help now!"
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  }

  getCallToActionText(): string {
    const timeSpent = Math.floor((new Date().getTime() - this.formStartTime.getTime()) / 1000);
    
    if (this.currentStep === this.totalSteps) {
      if (timeSpent > 300) { // More than 5 minutes
        return "Complete Your Free Case Review Now!";
      }
      return "Get My Free Legal Consultation";
    } else if (this.currentStep === 1) {
      return `Continue to Case Details (${this.getCurrentStepCompletionPercentage()}% done)`;
    } else {
      return `Continue to Final Details (${this.getFormCompletionPercentage()}% complete)`;
    }
  }

  getMotivationalMessage(): string {
    const completion = this.getFormCompletionPercentage();
    
    if (completion >= 80) {
      return "🏁 You're almost done! Complete your consultation request now.";
    } else if (completion >= 50) {
      return "💪 Great progress! You're halfway to getting legal help.";
    } else if (completion >= 25) {
      return "✨ You're doing great! Keep going to get your free consultation.";
    } else {
      return "🎯 Take the first step towards justice - complete your consultation request.";
    }
  }

  getPracticeAreaSpecificMessage(): string {
    if (!this.intakeForm?.practiceArea) return '';
    
    const messages: { [key: string]: string } = {
      'Personal Injury': '🏥 Medical bills piling up? You may be entitled to compensation!',
      'Family Law': '👨‍👩‍👧‍👦 Protect your family\'s future with experienced legal representation.',
      'Criminal Defense': '⚖️ Your freedom is at stake - every minute counts in criminal cases.',
      'Business Law': '💼 Protect your business interests with expert legal guidance.',
      'Real Estate Law': '🏠 Real estate transactions require careful legal review - don\'t risk costly mistakes.',
      'Immigration Law': '🌟 Achieve your American dream with experienced immigration attorneys.'
    };
    
    return messages[this.intakeForm.practiceArea] || '⚖️ Get the legal help you deserve - consultation is FREE!';
  }

  getTimeBasedUrgency(): string {
    const hour = new Date().getHours();
    
    if (hour >= 9 && hour <= 17) {
      return "📞 Our legal team is online NOW - submit your case for immediate review!";
    } else {
      return "🌙 Submit tonight and we'll review your case first thing tomorrow morning!";
    }
  }
}