import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { StateCourtConfigService } from '../../../../core/services/state-court-config.service';
import { StateCourtConfig } from '../../../organization-management/models/organization.model';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-court-configurations-tab',
  templateUrl: './court-configurations-tab.component.html',
  styleUrls: ['./court-configurations-tab.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CourtConfigurationsTabComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  courtConfigs: StateCourtConfig[] = [];
  filteredConfigs: StateCourtConfig[] = [];
  stateFilter = '';
  isLoading = false;
  isSaving = false;
  availableStates: string[] = [];

  // Modal state
  modalRef: NgbModalRef | null = null;
  editingConfig: Partial<StateCourtConfig> = {};
  isCreating = false;
  showRawHtml = false;

  constructor(
    private configService: StateCourtConfigService,
    private modalService: NgbModal,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadConfigs();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadConfigs(): void {
    this.isLoading = true;
    this.configService.getConfigs()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (configs) => {
          this.courtConfigs = configs;
          this.availableStates = [...new Set(configs.map(c => c.stateCode))].sort();
          this.applyFilter();
          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.isLoading = false;
          this.cdr.markForCheck();
          Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to load court configurations' });
        }
      });
  }

  applyFilter(): void {
    this.filteredConfigs = this.stateFilter
      ? this.courtConfigs.filter(c => c.stateCode === this.stateFilter)
      : [...this.courtConfigs];
    this.cdr.markForCheck();
  }

  openModal(modal: any, config?: StateCourtConfig): void {
    if (config) {
      this.isCreating = false;
      this.editingConfig = { ...config };
    } else {
      this.isCreating = true;
      this.editingConfig = {
        stateCode: '',
        stateName: '',
        courtLevel: 'DEFAULT',
        courtDisplayName: '',
        captionTemplateHtml: '',
        captionSeparator: '',
        causeNumberLabel: 'Case No.',
        barNumberPrefix: 'Bar No.',
        isCommonwealth: false,
        partyLabelStyle: 'STANDARD',
        isActive: true,
        notes: ''
      };
    }
    this.showRawHtml = false;
    this.modalRef = this.modalService.open(modal, { centered: true, size: 'lg', scrollable: true });
  }

  getCaptionPreviewHtml(): string {
    const html = this.editingConfig.captionTemplateHtml || '';
    if (!html) return '<em class="text-muted">No caption template configured</em>';

    return html
      .replace(/\{\{courtName\}\}/g, this.editingConfig.courtDisplayName || 'District Court')
      .replace(/\{\{courtDisplayName\}\}/g, this.editingConfig.courtDisplayName || 'District Court')
      .replace(/\{\{causeNumberLabel\}\}/g, this.editingConfig.causeNumberLabel || 'Case No.')
      .replace(/\{\{caseNumber\}\}/g, '2024-CV-12345')
      .replace(/\{\{causeNumber\}\}/g, '2024-CV-12345')
      .replace(/\{\{plaintiffName\}\}/g, 'JOHN DOE')
      .replace(/\{\{defendantName\}\}/g, 'JANE SMITH')
      .replace(/\{\{countyState\}\}/g, this.editingConfig.stateName || 'State')
      .replace(/\{\{separator\}\}/g, this.editingConfig.captionSeparator || 'v.')
      .replace(/\{\{plaintiff\}\}/g, 'JOHN DOE')
      .replace(/\{\{defendant\}\}/g, 'JANE SMITH')
      .replace(/\{\{plaintiffLabel\}\}/g, 'Plaintiff')
      .replace(/\{\{defendantLabel\}\}/g, 'Defendant');
  }

  saveConfig(): void {
    if (!this.isCreating && !this.editingConfig.id) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Cannot update: configuration ID is missing.' });
      return;
    }
    this.isSaving = true;
    const obs = this.isCreating
      ? this.configService.createConfig(this.editingConfig)
      : this.configService.updateConfig(this.editingConfig.id!, this.editingConfig);

    obs.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.isSaving = false;
        this.cdr.markForCheck();
        this.modalRef?.close();
        this.loadConfigs();
        Swal.fire({
          icon: 'success',
          title: this.isCreating ? 'Config Created' : 'Config Updated',
          timer: 2000,
          showConfirmButton: false
        });
      },
      error: (err) => {
        this.isSaving = false;
        this.cdr.markForCheck();
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: err?.error?.message || 'Failed to save configuration'
        });
      }
    });
  }

  verifyConfig(config: StateCourtConfig): void {
    Swal.fire({
      title: 'Verify Configuration?',
      text: `Mark ${config.stateName} (${config.courtLevel}) as verified?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#405189',
      confirmButtonText: 'Verify'
    }).then((result) => {
      if (result.isConfirmed) {
        this.configService.verifyConfig(config.id)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.loadConfigs();
              Swal.fire({
                icon: 'success',
                title: 'Verified',
                text: `${config.stateName} configuration has been verified.`,
                timer: 2000,
                showConfirmButton: false
              });
            },
            error: () => {
              Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to verify configuration' });
            }
          });
      }
    });
  }
}
