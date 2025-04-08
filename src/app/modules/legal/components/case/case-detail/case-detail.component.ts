import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CaseService } from '../../../services/case.service';
import { Case } from '../../../interfaces/case.interface';
import { CaseStatus } from '../../../enums/case-status.enum';
import { CasePriority } from '../../../enums/case-priority.enum';

@Component({
  selector: 'app-case-detail',
  templateUrl: './case-detail.component.html',
  styleUrls: ['./case-detail.component.scss']
})
export class CaseDetailComponent implements OnInit {
  caseForm: FormGroup;
  caseId: string | null = null;
  isNewCase = false;
  loading = false;
  error: string | null = null;
  caseStatuses = Object.values(CaseStatus);
  casePriorities = Object.values(CasePriority);
  isEditing = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private caseService: CaseService
  ) {
    this.caseForm = this.fb.group({
      caseNumber: ['', Validators.required],
      title: ['', Validators.required],
      description: [''],
      status: [CaseStatus.Active, Validators.required],
      priority: [CasePriority.Medium, Validators.required],
      clientId: ['', Validators.required],
      clientName: ['', Validators.required],
      assignedTo: [[]],
      filingDate: [''],
      notes: ['']
    });
  }

  ngOnInit(): void {
    this.caseId = this.route.snapshot.paramMap.get('id');
    this.isNewCase = this.caseId === 'new';

    if (!this.isNewCase && this.caseId) {
      this.loadCase(this.caseId);
    }
  }

  loadCase(id: string): void {
    this.loading = true;
    this.error = null;
    this.caseService.getCaseById(id).subscribe({
      next: (caseData) => {
        if (caseData) {
          this.caseForm.patchValue(caseData);
        } else {
          this.error = 'Case not found';
        }
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load case. Please try again later.';
        this.loading = false;
        console.error('Error loading case:', err);
      }
    });
  }

  toggleEdit(): void {
    this.isEditing = true;
  }

  saveCase(): void {
    if (this.caseForm.invalid) {
      return;
    }

    this.loading = true;
    this.error = null;

    const caseData: Case = {
      ...this.caseForm.value,
      id: this.caseId || undefined,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (this.isNewCase) {
      this.caseService.createCase(caseData).subscribe({
        next: (newCase) => {
          this.loading = false;
          this.router.navigate(['/legal/cases', newCase.id]);
        },
        error: (err) => {
          this.error = 'Failed to create case. Please try again later.';
          this.loading = false;
          console.error('Error creating case:', err);
        }
      });
    } else if (this.caseId) {
      this.caseService.updateCase(this.caseId, caseData).subscribe({
        next: () => {
          this.loading = false;
          this.isEditing = false;
        },
        error: (err) => {
          this.error = 'Failed to update case. Please try again later.';
          this.loading = false;
          console.error('Error updating case:', err);
        }
      });
    }
  }

  cancelEdit(): void {
    this.isEditing = false;
    if (this.caseId) {
      this.loadCase(this.caseId);
    }
  }

  onSubmit(): void {
    this.saveCase();
  }

  cancel(): void {
    this.router.navigate(['/legal/cases']);
  }
} 