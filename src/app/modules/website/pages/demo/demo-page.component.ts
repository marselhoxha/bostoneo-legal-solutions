import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';
import { ScrollAnimateDirective } from '../../shared/directives/scroll-animate.directive';

@Component({
  selector: 'app-demo-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    ScrollAnimateDirective
  ],
  templateUrl: './demo-page.component.html',
  styleUrls: ['./demo-page.component.scss']
})
export class DemoPageComponent implements OnInit {
  demoForm!: FormGroup;
  submitted = false;
  submitting = false;
  errorMessage = '';

  firmSizeOptions = [
    { value: 'solo', label: 'Solo (1 attorney)' },
    { value: 'small', label: 'Small (2-5)' },
    { value: 'medium', label: 'Medium (6-15)' },
    { value: 'large', label: 'Large (16+)' }
  ];

  practiceAreaOptions = [
    'Personal Injury',
    'Criminal Defense',
    'Family Law',
    'Immigration',
    'Real Estate',
    'Intellectual Property',
    'Corporate/Business',
    'Other'
  ];

  expectItems = [
    'Personalized walkthrough of your practice area',
    'Live demo using real workflows',
    'ROI analysis tailored to your firm',
    'Q&A with our product team',
    'No obligation, no pressure'
  ];

  quickStats = [
    { value: '30 min', label: 'Average demo time' },
    { value: '< 24 hrs', label: 'Response time' },
    { value: 'Free', label: 'No obligation' }
  ];

  constructor(
    private titleService: Title,
    private metaService: Meta,
    private fb: FormBuilder,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.titleService.setTitle('Book a Demo — Legience');
    this.metaService.updateTag({
      name: 'description',
      content: 'Book a free 30-minute personalized demo of Legience. See AI-native legal practice management tailored to your firm\'s workflow.'
    });

    this.demoForm = this.fb.group({
      name: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      firmName: ['', [Validators.required]],
      firmSize: ['', [Validators.required]],
      practiceAreas: this.fb.group(
        this.practiceAreaOptions.reduce((acc: Record<string, boolean>, area) => {
          acc[area] = false;
          return acc;
        }, {}),
        { validators: this.atLeastOneCheckbox }
      ),
      phone: [''],
      message: ['']
    });
  }

  /** Custom validator: at least one checkbox must be checked */
  atLeastOneCheckbox(group: FormGroup): { [key: string]: boolean } | null {
    const hasChecked = Object.values(group.controls).some(control => control.value === true);
    return hasChecked ? null : { atLeastOne: true };
  }

  get f() {
    return this.demoForm.controls;
  }

  get practiceAreasGroup(): FormGroup {
    return this.demoForm.get('practiceAreas') as FormGroup;
  }

  async onSubmit(): Promise<void> {
    // Mark all fields as touched to show validation
    this.demoForm.markAllAsTouched();
    if (this.demoForm.invalid) return;

    this.submitting = true;
    this.errorMessage = '';

    // Build selected practice areas array
    const practiceAreasValue = this.demoForm.value.practiceAreas;
    const selectedAreas = Object.keys(practiceAreasValue).filter(key => practiceAreasValue[key]);

    const body = {
      name: this.demoForm.value.name,
      email: this.demoForm.value.email,
      firmName: this.demoForm.value.firmName,
      firmSize: this.demoForm.value.firmSize,
      practiceAreas: selectedAreas,
      phone: this.demoForm.value.phone || null,
      message: this.demoForm.value.message || null
    };

    try {
      await this.http.post('/api/v1/demo-requests', body).toPromise();
      this.submitted = true;
    } catch (err) {
      this.errorMessage = 'Something went wrong. Please try again or email us at hello@legience.com.';
    } finally {
      this.submitting = false;
    }
  }
}
