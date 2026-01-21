import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Key } from '../../../../../../enum/key.enum';

interface TemplateVariable {
  name: string;
  displayName: string;
  type: string;
  value: string;
  required: boolean;
}

@Component({
  selector: 'app-auto-fill-wizard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './auto-fill-wizard.component.html',
  styleUrls: ['./auto-fill-wizard.component.scss']
})
export class AutoFillWizardComponent implements OnInit {
  templateId: number = 0;
  currentStep: number = 1;
  totalSteps: number = 3;
  variables: TemplateVariable[] = [];
  isProcessing: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.templateId = Number(this.route.snapshot.params['templateId']);
    this.loadVariables();
  }

  private loadVariables(): void {
    const token = localStorage.getItem(Key.TOKEN);

    fetch(`http://localhost:8085/api/ai/templates/${this.templateId}/variables`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      }
    })
    .then(response => response.json())
    .then(data => {
      if (data && data.variables) {
        this.variables = data.variables;
      } else {
        this.variables = [];
        console.error('No variables found for template');
      }
    })
    .catch(error => {
      console.error('Failed to load template variables:', error);
      this.variables = [];
    });
  }

  nextStep(): void {
    if (this.currentStep < this.totalSteps) {
      this.currentStep++;
    }
  }

  prevStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  generateDocument(): void {
    this.isProcessing = true;
    setTimeout(() => {
      this.router.navigate(['/legal/ai-assistant/document-generation/editor', this.templateId]);
    }, 1500);
  }

  goBack(): void {
    this.router.navigate(['/legal/ai-assistant/document-generation/templates']);
  }
}