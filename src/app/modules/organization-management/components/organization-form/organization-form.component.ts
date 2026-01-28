import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { OrganizationService, Organization } from '../../../../core/services/organization.service';
import Swal from 'sweetalert2';

declare var flatpickr: any;

interface PlanTypeOption {
  value: string;
  label: string;
  description: string;
  icon: string;
  iconColor: string;
  borderClass: string;
}

@Component({
  selector: 'app-organization-form',
  templateUrl: './organization-form.component.html',
  styleUrls: ['./organization-form.component.scss']
})
export class OrganizationFormComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  organizationForm!: FormGroup;
  isEditMode = false;
  organizationId: number | null = null;
  isLoading = false;
  isSaving = false;
  slugAvailable = true;
  checkingSlug = false;
  originalSlug = ''; // Store original slug for edit mode

  planTypes = [
    { value: 'FREE', label: 'Free' },
    { value: 'STARTER', label: 'Starter' },
    { value: 'PROFESSIONAL', label: 'Professional' },
    { value: 'ENTERPRISE', label: 'Enterprise' }
  ];

  planTypeOptions: PlanTypeOption[] = [
    {
      value: 'FREE',
      label: 'Free',
      description: 'Basic features',
      icon: 'ri-gift-line',
      iconColor: 'text-secondary',
      borderClass: ''
    },
    {
      value: 'STARTER',
      label: 'Starter',
      description: '10 users, 100 cases',
      icon: 'ri-rocket-line',
      iconColor: 'text-info',
      borderClass: ''
    },
    {
      value: 'PROFESSIONAL',
      label: 'Professional',
      description: '50 users, API access',
      icon: 'ri-award-line',
      iconColor: 'text-primary',
      borderClass: ''
    },
    {
      value: 'ENTERPRISE',
      label: 'Enterprise',
      description: 'Unlimited, priority',
      icon: 'ri-vip-crown-line',
      iconColor: 'text-warning',
      borderClass: ''
    }
  ];

  constructor(
    private fb: FormBuilder,
    private organizationService: OrganizationService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.initForm();

    // Check if editing
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      if (params['id']) {
        this.isEditMode = true;
        this.organizationId = +params['id'];
        this.loadOrganization();
      }
    });

    // Initialize flatpickr after view init
    setTimeout(() => {
      this.initFlatpickr();
    }, 100);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initForm(): void {
    this.organizationForm = this.fb.group({
      // Basic Info
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      slug: ['', [Validators.required, Validators.pattern(/^[a-z0-9-]+$/)]],
      email: ['', [Validators.email]],
      phone: [''],
      website: [''],
      address: [''],
      logoUrl: [''],

      // Plan
      planType: ['FREE', Validators.required],
      planExpiresAt: [''],

      // Notification Preferences
      smsEnabled: [true],
      whatsappEnabled: [false],
      emailEnabled: [true],

      // Signature Reminder Settings
      signatureReminderEmail: [true],
      signatureReminderSms: [true],
      signatureReminderWhatsapp: [false],
      signatureReminderDays: ['7,3,1']
    });

    // Auto-generate slug from name (only in create mode)
    this.organizationForm.get('name')?.valueChanges.pipe(
      takeUntil(this.destroy$),
      debounceTime(400)
    ).subscribe(name => {
      if (!this.isEditMode && name && !this.isLoading) {
        const slug = this.generateSlug(name);
        this.organizationForm.patchValue({ slug }, { emitEvent: false });
        this.checkSlugAvailability(slug);
      }
    });
  }

  // Called from template on slug input blur
  onSlugBlur(): void {
    const slug = this.organizationForm.get('slug')?.value;
    if (slug) {
      this.checkSlugAvailability(slug);
    }
  }

  private initFlatpickr(): void {
    const planExpiresInput = document.getElementById('planExpiresAt');
    if (planExpiresInput && typeof flatpickr !== 'undefined') {
      flatpickr(planExpiresInput, {
        dateFormat: 'Y-m-d',
        minDate: 'today',
        onChange: (selectedDates: Date[]) => {
          if (selectedDates.length > 0) {
            this.organizationForm.patchValue({
              planExpiresAt: selectedDates[0].toISOString()
            });
          }
        }
      });
    }
  }

  private loadOrganization(): void {
    if (!this.organizationId) return;

    this.isLoading = true;
    this.organizationService.getOrganizationById(this.organizationId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (org) => {
          if (org) {
            // Store original slug for edit mode validation
            this.originalSlug = org.slug || '';

            this.organizationForm.patchValue({
              name: org.name,
              slug: org.slug,
              email: org.email,
              phone: org.phone,
              website: org.website,
              address: org.address,
              logoUrl: org.logoUrl,
              planType: org.planType || 'FREE',
              planExpiresAt: org.planExpiresAt,
              smsEnabled: org.smsEnabled,
              whatsappEnabled: org.whatsappEnabled,
              emailEnabled: org.emailEnabled,
              signatureReminderEmail: org.signatureReminderEmail,
              signatureReminderSms: org.signatureReminderSms,
              signatureReminderWhatsapp: org.signatureReminderWhatsapp,
              signatureReminderDays: org.signatureReminderDays
            });
          }
          this.isLoading = false;
        },
        error: () => {
          this.isLoading = false;
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Failed to load organization'
          }).then(() => {
            this.router.navigate(['/organizations/list']);
          });
        }
      });
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private checkSlugAvailability(slug: string): void {
    // In edit mode, if slug is the same as original, it's always available
    if (this.isEditMode && slug === this.originalSlug) {
      this.slugAvailable = true;
      this.checkingSlug = false;
      return;
    }

    this.checkingSlug = true;
    this.organizationService.checkSlugAvailability(slug)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (available) => {
          this.slugAvailable = available;
          this.checkingSlug = false;
        },
        error: () => {
          // On error, assume slug is available to not block the user
          this.slugAvailable = true;
          this.checkingSlug = false;
        }
      });
  }

  selectPlan(planValue: string): void {
    this.organizationForm.patchValue({ planType: planValue });
  }

  toggleNotification(fieldName: string): void {
    const currentValue = this.organizationForm.get(fieldName)?.value;
    this.organizationForm.patchValue({ [fieldName]: !currentValue });
  }

  onSubmit(): void {
    if (this.organizationForm.invalid) {
      Object.keys(this.organizationForm.controls).forEach(key => {
        this.organizationForm.get(key)?.markAsTouched();
      });
      return;
    }

    if (!this.slugAvailable) {
      Swal.fire({
        icon: 'warning',
        title: 'Slug Unavailable',
        text: 'Please choose a different slug for your organization.'
      });
      return;
    }

    this.isSaving = true;
    const formValue = this.organizationForm.value;

    const saveOperation = this.isEditMode
      ? this.organizationService.updateOrganization(this.organizationId!, formValue)
      : this.organizationService.createOrganization(formValue);

    saveOperation.pipe(takeUntil(this.destroy$)).subscribe({
      next: (org) => {
        this.isSaving = false;
        Swal.fire({
          icon: 'success',
          title: 'Success',
          text: `Organization ${this.isEditMode ? 'updated' : 'created'} successfully!`,
          timer: 2000
        }).then(() => {
          this.router.navigate(['/organizations/details', org.id]);
        });
      },
      error: (err) => {
        this.isSaving = false;
        console.error('Organization save error:', err);
        const errorMessage = err.error?.message || err.error?.reason || err.message || `Failed to ${this.isEditMode ? 'update' : 'create'} organization`;
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: errorMessage
        });
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/organizations/list']);
  }

  // Form helpers
  get f() {
    return this.organizationForm.controls;
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.organizationForm.get(fieldName);
    return field ? field.invalid && field.touched : false;
  }
}
