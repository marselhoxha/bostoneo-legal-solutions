import { Component, ChangeDetectionStrategy, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import Swal from 'sweetalert2';
import { SuperAdminService } from '../../services/superadmin.service';
import { CreateOrganization } from '../../models/superadmin.models';

interface PlanOption {
  value: string;
  label: string;
  description: string;
  price: string;
  icon: string;
  color: string;
  users: number;
  cases: number;
  storage: number;
}

interface FeatureOption {
  control: string;
  label: string;
  description: string;
  icon: string;
}

interface StepInfo {
  number: number;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-create-organization',
  templateUrl: './create-organization.component.html',
  styleUrls: ['./create-organization.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CreateOrganizationComponent implements OnDestroy {

  currentStep = 1;
  submitting = false;

  firmInfoForm: FormGroup;
  planForm: FormGroup;
  adminForm: FormGroup;
  featuresForm: FormGroup;

  private destroy$ = new Subject<void>();

  steps: StepInfo[] = [
    { number: 1, label: 'Firm Info', icon: 'ri-building-line' },
    { number: 2, label: 'Plan & Quotas', icon: 'ri-price-tag-3-line' },
    { number: 3, label: 'Admin User', icon: 'ri-user-star-line' },
    { number: 4, label: 'Features', icon: 'ri-toggle-line' },
    { number: 5, label: 'Review', icon: 'ri-check-double-line' }
  ];

  plans: PlanOption[] = [
    {
      value: 'STARTER', label: 'Starter', description: 'For small firms',
      price: '$49/mo', icon: 'ri-rocket-line', color: 'warning',
      users: 5, cases: 100, storage: 5368709120
    },
    {
      value: 'PROFESSIONAL', label: 'Professional', description: 'For growing firms',
      price: '$149/mo', icon: 'ri-building-line', color: 'primary',
      users: 25, cases: 500, storage: 53687091200
    },
    {
      value: 'ENTERPRISE', label: 'Enterprise', description: 'For large firms',
      price: '$399/mo', icon: 'ri-building-4-line', color: 'success',
      users: 999, cases: 9999, storage: 536870912000
    }
  ];

  features: FeatureOption[] = [
    { control: 'emailEnabled', label: 'Email Notifications', description: 'Send automated email notifications to users and clients', icon: 'ri-mail-line' },
    { control: 'smsEnabled', label: 'SMS Notifications', description: 'Send SMS messages for urgent notifications and reminders', icon: 'ri-message-2-line' },
    { control: 'whatsappEnabled', label: 'WhatsApp Integration', description: 'Enable WhatsApp messaging for client communication', icon: 'ri-whatsapp-line' },
    { control: 'twilioEnabled', label: 'Twilio Voice', description: 'Enable Twilio-powered voice calling and IVR features', icon: 'ri-phone-line' },
    { control: 'boldsignEnabled', label: 'BoldSign e-Signatures', description: 'Enable electronic document signing via BoldSign', icon: 'ri-quill-pen-line' }
  ];

  timezones: string[] = [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Anchorage',
    'Pacific/Honolulu',
    'Europe/London',
    'Europe/Berlin',
    'Asia/Tokyo',
    'Australia/Sydney'
  ];

  constructor(
    private fb: FormBuilder,
    private superAdminService: SuperAdminService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    this.firmInfoForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      slug: ['', [Validators.required, Validators.pattern(/^[a-z0-9-]+$/)]],
      phone: [''],
      address: [''],
      website: [''],
      timezone: ['America/New_York']
    });

    this.planForm = this.fb.group({
      planType: ['STARTER', Validators.required],
      maxUsers: [5, [Validators.required, Validators.min(1)]],
      maxCases: [100, [Validators.required, Validators.min(1)]],
      maxStorageBytes: [5368709120, [Validators.required, Validators.min(1)]]
    });

    this.adminForm = this.fb.group({
      adminFirstName: ['', [Validators.required, Validators.minLength(2)]],
      adminLastName: ['', [Validators.required, Validators.minLength(2)]],
      adminEmail: ['', [Validators.required, Validators.email]],
      skipEmail: [false],
      temporaryPassword: ['']
    });

    this.featuresForm = this.fb.group({
      emailEnabled: [true],
      smsEnabled: [false],
      whatsappEnabled: [false],
      twilioEnabled: [false],
      boldsignEnabled: [false]
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Auto-generate slug from organization name */
  onNameChange(): void {
    const name = this.firmInfoForm.get('name')?.value || '';
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    this.firmInfoForm.get('slug')?.setValue(slug);
  }

  /** Select a plan and auto-fill quotas */
  onPlanSelect(planType: string): void {
    const plan = this.plans.find(p => p.value === planType);
    if (plan) {
      this.planForm.patchValue({
        planType: plan.value,
        maxUsers: plan.users,
        maxCases: plan.cases,
        maxStorageBytes: plan.storage
      });
    }
  }

  /** Get the form group for the current step */
  getCurrentForm(): FormGroup | null {
    switch (this.currentStep) {
      case 1: return this.firmInfoForm;
      case 2: return this.planForm;
      case 3: return this.adminForm;
      case 4: return this.featuresForm;
      case 5: return null; // Review step has no form
      default: return null;
    }
  }

  /** Check if the user can proceed to the next step */
  canProceed(): boolean {
    const form = this.getCurrentForm();
    return form ? form.valid : true;
  }

  /** Move to the next step */
  nextStep(): void {
    const form = this.getCurrentForm();
    if (form) {
      form.markAllAsTouched();
      if (!form.valid) return;
    }
    if (this.currentStep < 5) {
      this.currentStep++;
      this.cdr.markForCheck();
    }
  }

  /** Move to the previous step */
  prevStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
      this.cdr.markForCheck();
    }
  }

  /** Jump to a specific step (only completed or current) */
  goToStep(step: number): void {
    if (step < this.currentStep) {
      this.currentStep = step;
      this.cdr.markForCheck();
    }
  }

  /** Get step state for the wizard indicator */
  getStepState(step: number): 'active' | 'completed' | 'pending' {
    if (step === this.currentStep) return 'active';
    if (step < this.currentStep) return 'completed';
    return 'pending';
  }

  /** Format bytes to human-readable storage */
  formatStorage(bytes: number): string {
    if (bytes >= 1099511627776) {
      return (bytes / 1099511627776).toFixed(0) + ' TB';
    }
    return (bytes / 1073741824).toFixed(0) + ' GB';
  }

  /** Get selected plan label */
  getSelectedPlanLabel(): string {
    const plan = this.plans.find(p => p.value === this.planForm.get('planType')?.value);
    return plan ? plan.label : '';
  }

  /** Get enabled features as comma-separated string */
  getEnabledFeatures(): string {
    const enabled: string[] = [];
    this.features.forEach(f => {
      if (this.featuresForm.get(f.control)?.value) {
        enabled.push(f.label);
      }
    });
    return enabled.length > 0 ? enabled.join(', ') : 'None';
  }

  /** Submit the organization creation request */
  submitOrganization(): void {
    if (this.submitting) return;
    this.submitting = true;
    this.cdr.markForCheck();

    const skipEmail = this.adminForm.get('skipEmail')?.value || false;
    const tempPwd = this.adminForm.get('temporaryPassword')?.value || undefined;
    const data: CreateOrganization = {
      name: this.firmInfoForm.get('name')?.value,
      slug: this.firmInfoForm.get('slug')?.value,
      phone: this.firmInfoForm.get('phone')?.value || undefined,
      address: this.firmInfoForm.get('address')?.value || undefined,
      website: this.firmInfoForm.get('website')?.value || undefined,
      timezone: this.firmInfoForm.get('timezone')?.value || undefined,
      planType: this.planForm.get('planType')?.value,
      maxUsers: this.planForm.get('maxUsers')?.value,
      maxCases: this.planForm.get('maxCases')?.value,
      maxStorageBytes: this.planForm.get('maxStorageBytes')?.value,
      adminFirstName: this.adminForm.get('adminFirstName')?.value,
      adminLastName: this.adminForm.get('adminLastName')?.value,
      adminEmail: this.adminForm.get('adminEmail')?.value,
      skipEmail: skipEmail || undefined,
      temporaryPassword: skipEmail ? tempPwd : undefined
    };

    this.superAdminService.createOrganization(data)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.submitting = false;
          this.cdr.markForCheck();
          const successMsg = skipEmail && tempPwd
            ? `<p><strong>${data.name}</strong> has been created successfully.</p>
               <p class="mt-2">Temporary password for <strong>${data.adminEmail}</strong>:</p>
               <div class="alert alert-warning text-center mt-2" style="font-size: 18px; font-family: monospace; user-select: all;">${tempPwd}</div>
               <p class="text-muted fs-12">The user will be required to change this password on first login.</p>`
            : `${data.name} has been created successfully. An invitation email will be sent to ${data.adminEmail}.`;
          Swal.fire({
            icon: 'success',
            title: 'Organization Created',
            html: successMsg,
            showCancelButton: true,
            confirmButtonText: 'Go to Organizations',
            cancelButtonText: 'Create Another',
            confirmButtonColor: '#405189'
          }).then((result) => {
            if (result.isConfirmed) {
              this.router.navigate(['/superadmin/organizations']);
            } else {
              this.currentStep = 1;
              this.firmInfoForm.reset();
              this.planForm.reset({ planType: 'STARTER', maxUsers: 5, maxCases: 100, maxStorageBytes: 5368709120 });
              this.adminForm.reset();
              this.featuresForm.reset({ emailNotifications: true, smsNotifications: false, whatsapp: false, twilio: false, boldSign: false });
              this.cdr.markForCheck();
            }
          });
        },
        error: (err) => {
          this.submitting = false;
          this.cdr.markForCheck();
          const message = err?.error?.reason || err?.error?.message || err?.message || 'An unexpected error occurred. Please try again.';
          Swal.fire({
            icon: 'error',
            title: 'Creation Failed',
            text: message,
            confirmButtonColor: '#405189'
          });
        }
      });
  }

  /** Check if a specific form control has an error */
  hasError(form: FormGroup, controlName: string): boolean {
    const control = form.get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  /** Get error message for a form control */
  getError(form: FormGroup, controlName: string): string {
    const control = form.get(controlName);
    if (!control || !control.errors) return '';
    if (control.errors['required']) return 'This field is required';
    if (control.errors['email']) return 'Please enter a valid email address';
    if (control.errors['minlength']) return `Minimum ${control.errors['minlength'].requiredLength} characters required`;
    if (control.errors['pattern']) return 'Only lowercase letters, numbers, and hyphens are allowed';
    if (control.errors['min']) return `Minimum value is ${control.errors['min'].min}`;
    return 'Invalid value';
  }
}
