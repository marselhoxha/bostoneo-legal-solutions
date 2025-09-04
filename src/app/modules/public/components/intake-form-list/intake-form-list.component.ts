import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IntakeFormService, IntakeForm } from '../../services/intake-form.service';

@Component({
  selector: 'app-intake-form-list',
  templateUrl: './intake-form-list.component.html',
  styleUrls: ['./intake-form-list.component.scss']
})
export class IntakeFormListComponent implements OnInit {
  forms: IntakeForm[] = [];
  practiceAreas: string[] = [];
  selectedPracticeArea: string = '';
  isLoading = true;
  error: string = '';

  // Practice area configurations with icons and descriptions
  practiceAreaConfig = {
    'Personal Injury': {
      icon: 'ri-heart-pulse-line',
      color: 'danger',
      description: 'Accidents, medical malpractice, and injury claims'
    },
    'Family Law': {
      icon: 'ri-user-heart-line',
      color: 'info',
      description: 'Divorce, child custody, and family matters'
    },
    'Criminal Defense': {
      icon: 'ri-shield-check-line',
      color: 'warning',
      description: 'Criminal charges and legal defense'
    },
    'Business Law': {
      icon: 'ri-briefcase-4-line',
      color: 'primary',
      description: 'Corporate law, contracts, and business matters'
    },
    'Real Estate Law': {
      icon: 'ri-home-4-line',
      color: 'success',
      description: 'Property transactions and real estate issues'
    },
    'Immigration Law': {
      icon: 'ri-earth-line',
      color: 'secondary',
      description: 'Visas, citizenship, and immigration matters'
    }
  };

  constructor(
    private intakeFormService: IntakeFormService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.selectedPracticeArea = params['practiceArea'] || '';
      this.loadForms();
    });
    this.loadPracticeAreas();
  }

  loadForms(): void {
    this.isLoading = true;
    this.error = '';

    const request = this.selectedPracticeArea 
      ? this.intakeFormService.getFormsByPracticeArea(this.selectedPracticeArea)
      : this.intakeFormService.getPublicForms();

    request.subscribe({
      next: (forms) => {
        this.forms = forms;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading forms:', error);
        this.error = 'Failed to load intake forms. Please try again.';
        this.isLoading = false;
      }
    });
  }

  loadPracticeAreas(): void {
    this.intakeFormService.getPracticeAreas().subscribe({
      next: (areas) => {
        this.practiceAreas = areas;
      },
      error: (error) => {
        console.error('Error loading practice areas:', error);
      }
    });
  }

  selectPracticeArea(area: string): void {
    if (area === this.selectedPracticeArea) {
      // Deselect if clicking the same area
      this.selectedPracticeArea = '';
      this.router.navigate(['/public/intake-forms']);
    } else {
      this.selectedPracticeArea = area;
      this.router.navigate(['/public/intake-forms/practice-area', area]);
    }
  }

  openForm(form: IntakeForm): void {
    this.router.navigate(['/public/intake-forms', form.publicUrl]);
  }

  getPracticeAreaConfig(practiceArea: string) {
    return this.practiceAreaConfig[practiceArea as keyof typeof this.practiceAreaConfig] || {
      icon: 'ri-file-text-line',
      color: 'secondary',
      description: 'Legal consultation and services'
    };
  }

  getFormsByPracticeArea(practiceArea: string): IntakeForm[] {
    return this.forms.filter(form => form.practiceArea === practiceArea);
  }

  getGroupedForms(): { [key: string]: IntakeForm[] } {
    const grouped: { [key: string]: IntakeForm[] } = {};
    
    if (this.selectedPracticeArea) {
      grouped[this.selectedPracticeArea] = this.forms;
    } else {
      this.forms.forEach(form => {
        const area = form.practiceArea || 'Other';
        if (!grouped[area]) {
          grouped[area] = [];
        }
        grouped[area].push(form);
      });
    }
    
    return grouped;
  }
}