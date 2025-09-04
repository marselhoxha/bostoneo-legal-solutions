import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IntakeFormService, IntakeForm, SubmissionResponse } from '../../services/intake-form.service';

@Component({
  selector: 'app-intake-form',
  templateUrl: './intake-form.component.html',
  styleUrls: ['./intake-form.component.scss']
})
export class IntakeFormComponent implements OnInit {
  intakeForm: IntakeForm | null = null;
  submissionForm: FormGroup;
  isLoading = true;
  isSubmitting = false;
  error: string = '';
  formUrl: string = '';

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

    this.submissionForm = this.fb.group(formControls);
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
}