import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { IntakeFormService } from '../../services/intake-form.service';

interface PracticeArea {
  key: string;
  icon: string;
  description: string;
}

interface FormField {
  name: string;
  label: string;
  type: string;
  required: boolean;
  placeholder?: string;
  options?: any[];
  rows?: number;
  fullWidth?: boolean;
}

@Component({
  selector: 'app-intake-form-list',
  templateUrl: './intake-form-list.component.html',
  styleUrls: ['./intake-form-list.component.scss']
})
export class IntakeFormListComponent implements OnInit {
  selectedPracticeArea: string = '';
  intakeForm: FormGroup | null = null;
  isSubmitting = false;

  practiceAreas: PracticeArea[] = [
    {
      key: 'Personal Injury',
      icon: 'ri-heart-pulse-line',
      description: 'Accidents, medical malpractice, injury claims'
    },
    {
      key: 'Family Law',
      icon: 'ri-user-heart-line', 
      description: 'Divorce, child custody, family matters'
    },
    {
      key: 'Criminal Defense',
      icon: 'ri-shield-check-line',
      description: 'Criminal charges and legal defense'
    },
    {
      key: 'Business Law',
      icon: 'ri-briefcase-4-line',
      description: 'Corporate law, contracts, business matters'
    },
    {
      key: 'Real Estate Law',
      icon: 'ri-home-4-line',
      description: 'Property transactions, real estate issues'
    },
    {
      key: 'Immigration Law',
      icon: 'ri-earth-line',
      description: 'Visas, citizenship, immigration matters'
    }
  ];

  // Dynamic form fields based on practice area
  practiceAreaFields: { [key: string]: FormField[] } = {
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
      { name: 'urgency', label: 'Urgency Level', type: 'select', required: true,
        options: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
      { name: 'description', label: 'Describe the incident and injuries', type: 'textarea', required: true, rows: 4, fullWidth: true }
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
      { name: 'urgency', label: 'Urgency Level', type: 'select', required: true,
        options: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
      { name: 'description', label: 'Describe your legal matter', type: 'textarea', required: true, rows: 4, fullWidth: true }
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
      { name: 'isIncarcerated', label: 'Are you currently in custody?', type: 'radio', required: true,
        options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
      { name: 'urgency', label: 'Urgency Level', type: 'select', required: true,
        options: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
      { name: 'description', label: 'Describe the charges and circumstances', type: 'textarea', required: true, rows: 4, fullWidth: true }
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
      { name: 'urgency', label: 'Urgency Level', type: 'select', required: true,
        options: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
      { name: 'description', label: 'Describe your business legal matter', type: 'textarea', required: true, rows: 4, fullWidth: true }
    ],
    'Real Estate Law': [
      { name: 'firstName', label: 'First Name', type: 'text', required: true },
      { name: 'lastName', label: 'Last Name', type: 'text', required: true },
      { name: 'email', label: 'Email Address', type: 'email', required: true },
      { name: 'phone', label: 'Phone Number', type: 'tel', required: true },
      { name: 'propertyType', label: 'Type of Property', type: 'select', required: true,
        options: ['Residential', 'Commercial', 'Industrial', 'Land', 'Other'] },
      { name: 'transactionType', label: 'Type of Transaction', type: 'select', required: true,
        options: ['Purchase', 'Sale', 'Lease', 'Refinance', 'Dispute', 'Other'] },
      { name: 'propertyAddress', label: 'Property Address', type: 'text', required: false },
      { name: 'timeline', label: 'Expected Timeline', type: 'select', required: false,
        options: ['ASAP', 'Within 30 days', '1-3 months', '3+ months'] },
      { name: 'urgency', label: 'Urgency Level', type: 'select', required: true,
        options: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
      { name: 'description', label: 'Describe your real estate matter', type: 'textarea', required: true, rows: 4, fullWidth: true }
    ],
    'Immigration Law': [
      { name: 'firstName', label: 'First Name', type: 'text', required: true },
      { name: 'lastName', label: 'Last Name', type: 'text', required: true },
      { name: 'email', label: 'Email Address', type: 'email', required: true },
      { name: 'phone', label: 'Phone Number', type: 'tel', required: true },
      { name: 'currentStatus', label: 'Current Immigration Status', type: 'select', required: true,
        options: ['Tourist/Visitor', 'Student Visa', 'Work Visa', 'Green Card Holder', 'Undocumented', 'Other'] },
      { name: 'desiredOutcome', label: 'Desired Immigration Outcome', type: 'select', required: true,
        options: ['Green Card', 'Citizenship', 'Work Authorization', 'Family Reunification', 'Deportation Defense', 'Other'] },
      { name: 'countryOfOrigin', label: 'Country of Origin', type: 'text', required: true },
      { name: 'timeInUs', label: 'Time in United States', type: 'select', required: false,
        options: ['Less than 1 year', '1-5 years', '5-10 years', '10+ years'] },
      { name: 'urgency', label: 'Urgency Level', type: 'select', required: true,
        options: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
      { name: 'description', label: 'Describe your immigration matter', type: 'textarea', required: true, rows: 4, fullWidth: true }
    ]
  };

  constructor(
    private formBuilder: FormBuilder,
    private intakeFormService: IntakeFormService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Component initialized but no form created until practice area is selected
  }

  onPracticeAreaChange(): void {
    if (this.selectedPracticeArea) {
      this.createDynamicForm();
    } else {
      this.intakeForm = null;
    }
  }

  createDynamicForm(): void {
    const fields = this.getCurrentFields();
    const formControls: { [key: string]: any } = {};

    fields.forEach(field => {
      const validators = field.required ? [Validators.required] : [];

      // Add specific validators
      if (field.type === 'email') {
        validators.push(Validators.email);
      }

      formControls[field.name] = ['', validators];
    });

    // Add SMS consent control (MUST default to false - unchecked for A2P 10DLC compliance)
    formControls['smsConsent'] = [false];

    this.intakeForm = this.formBuilder.group(formControls);
  }

  getCurrentFields(): FormField[] {
    return this.practiceAreaFields[this.selectedPracticeArea] || [];
  }

  hasFieldError(fieldName: string): boolean {
    if (!this.intakeForm) return false;
    const field = this.intakeForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getFieldError(fieldName: string): string {
    if (!this.intakeForm) return '';
    const field = this.intakeForm.get(fieldName);
    
    if (field?.errors) {
      if (field.errors['required']) {
        return `This field is required`;
      }
      if (field.errors['email']) {
        return 'Please enter a valid email address';
      }
    }
    return '';
  }

  onSubmit(): void {
    if (!this.intakeForm?.valid || this.isSubmitting) {
      return;
    }

    this.isSubmitting = true;
    
    const formData = {
      ...this.intakeForm.value,
      practiceArea: this.selectedPracticeArea,
      submittedAt: new Date().toISOString()
    };

    this.intakeFormService.submitIntakeForm(formData).subscribe({
      next: (response) => {
        // Navigate to success page
        this.router.navigate(['/public/success'], {
          queryParams: {
            submissionId: response.submissionId,
            message: 'Thank you! We have received your consultation request and will contact you within 24 hours.'
          }
        });
      },
      error: (error) => {
        console.error('Error submitting form:', error);
        this.isSubmitting = false;
        // Handle error - could show a toast or error message
      }
    });
  }
}