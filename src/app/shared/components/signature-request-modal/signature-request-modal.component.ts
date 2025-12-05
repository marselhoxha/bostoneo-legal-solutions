import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { SignatureService, SignatureTemplate, CreateSignatureRequest } from '../../../core/services/signature.service';

@Component({
  selector: 'app-signature-request-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './signature-request-modal.component.html',
  styleUrls: ['./signature-request-modal.component.scss']
})
export class SignatureRequestModalComponent implements OnInit {
  @Input() organizationId!: number;
  @Input() caseId?: number;
  @Input() caseName?: string;
  @Input() clientId?: number;
  @Input() clientName?: string;
  @Input() clientEmail?: string;
  @Input() clientPhone?: string;
  @Input() preSelectedTemplate?: SignatureTemplate;

  @Output() requestCreated = new EventEmitter<any>();
  @Output() modalClosed = new EventEmitter<void>();

  form!: FormGroup;
  templates: SignatureTemplate[] = [];
  categories: string[] = [];
  selectedTemplate?: SignatureTemplate;
  loading = false;
  submitting = false;
  error: string | null = null;

  constructor(
    private fb: FormBuilder,
    private signatureService: SignatureService
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadTemplates();

    // Pre-fill client info if provided
    if (this.clientName) {
      this.form.patchValue({ signerName: this.clientName });
    }
    if (this.clientEmail) {
      this.form.patchValue({ signerEmail: this.clientEmail });
    }
    if (this.clientPhone) {
      this.form.patchValue({ signerPhone: this.clientPhone });
    }
  }

  private initForm(): void {
    this.form = this.fb.group({
      templateId: [null],
      title: ['', [Validators.required, Validators.maxLength(255)]],
      message: [''],
      signerName: ['', [Validators.required, Validators.maxLength(100)]],
      signerEmail: ['', [Validators.required, Validators.email]],
      signerPhone: [''],
      additionalSigners: this.fb.array([]),
      reminderEmail: [true],
      reminderSms: [true],
      reminderWhatsapp: [false],
      expiryDays: [30, [Validators.required, Validators.min(1), Validators.max(365)]],
      sendImmediately: [true]
    });
  }

  private loadTemplates(): void {
    this.loading = true;
    this.signatureService.getTemplates(this.organizationId).subscribe({
      next: (response) => {
        this.templates = response.data?.templates || [];
        this.categories = [...new Set(this.templates.map(t => t.category).filter(c => c))];
        this.loading = false;

        if (this.preSelectedTemplate) {
          this.selectTemplate(this.preSelectedTemplate);
        }
      },
      error: (err) => {
        console.error('Error loading templates:', err);
        this.loading = false;
      }
    });
  }

  get additionalSigners(): FormArray {
    return this.form.get('additionalSigners') as FormArray;
  }

  addSigner(): void {
    const signerGroup = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      order: [this.additionalSigners.length + 2]
    });
    this.additionalSigners.push(signerGroup);
  }

  removeSigner(index: number): void {
    this.additionalSigners.removeAt(index);
    // Update order numbers
    this.additionalSigners.controls.forEach((ctrl, i) => {
      ctrl.patchValue({ order: i + 2 });
    });
  }

  selectTemplate(template: SignatureTemplate): void {
    this.selectedTemplate = template;
    this.form.patchValue({
      templateId: template.id,
      title: template.name,
      expiryDays: template.defaultExpiryDays || 30,
      reminderEmail: template.defaultReminderEmail ?? true,
      reminderSms: template.defaultReminderSms ?? true
    });
  }

  clearTemplate(): void {
    this.selectedTemplate = undefined;
    this.form.patchValue({
      templateId: null,
      title: ''
    });
  }

  getTemplatesByCategory(category: string): SignatureTemplate[] {
    return this.templates.filter(t => t.category === category);
  }

  getCategoryIcon(category: string): string {
    return this.signatureService.getCategoryIcon(category);
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting = true;
    this.error = null;

    const formValue = this.form.value;
    const request: CreateSignatureRequest = {
      organizationId: this.organizationId,
      caseId: this.caseId,
      clientId: this.clientId,
      templateId: formValue.templateId,
      title: formValue.title,
      message: formValue.message,
      signerName: formValue.signerName,
      signerEmail: formValue.signerEmail,
      signerPhone: formValue.signerPhone,
      additionalSigners: formValue.additionalSigners.length > 0 ? formValue.additionalSigners : undefined,
      reminderEmail: formValue.reminderEmail,
      reminderSms: formValue.reminderSms,
      reminderWhatsapp: formValue.reminderWhatsapp,
      expiryDays: formValue.expiryDays,
      sendImmediately: formValue.sendImmediately
    };

    this.signatureService.createSignatureRequest(request).subscribe({
      next: (response) => {
        this.submitting = false;
        this.requestCreated.emit(response.data?.signatureRequest);
      },
      error: (err) => {
        this.submitting = false;
        this.error = err.error?.message || 'Failed to create signature request';
        console.error('Error creating signature request:', err);
      }
    });
  }

  close(): void {
    this.modalClosed.emit();
  }
}
