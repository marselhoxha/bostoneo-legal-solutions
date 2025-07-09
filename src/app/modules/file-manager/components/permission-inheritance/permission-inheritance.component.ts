import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import Swal from 'sweetalert2';
import { PermissionService } from '../../services/permission.service';
import { 
  PermissionSet, 
  InheritanceRule, 
  PermissionInheritanceConfig,
  CreateInheritanceRuleRequest,
  PermissionType,
  InheritanceSourceType,
  InheritanceTargetType,
  ConditionType,
  ConditionOperator
} from '../../models/permission.model';

@Component({
  selector: 'app-permission-inheritance',
  templateUrl: './permission-inheritance.component.html',
  styleUrls: ['./permission-inheritance.component.scss']
})
export class PermissionInheritanceComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  // Data
  permissionSets: PermissionSet[] = [];
  inheritanceRules: InheritanceRule[] = [];
  inheritanceConfig: PermissionInheritanceConfig | null = null;
  
  // Forms
  ruleForm: FormGroup;
  configForm: FormGroup;
  
  // UI state
  isLoading = false;
  currentFirmId = '1'; // This would come from auth service
  currentFirmName = 'Demo Law Firm';
  
  // Enums for dropdowns
  permissionTypes = Object.values(PermissionType);
  sourceTypes = Object.values(InheritanceSourceType);
  targetTypes = Object.values(InheritanceTargetType);
  conditionTypes = Object.values(ConditionType);
  conditionOperators = Object.values(ConditionOperator);
  
  constructor(
    private fb: FormBuilder,
    private permissionService: PermissionService
  ) {
    this.ruleForm = this.fb.group({
      name: ['', Validators.required],
      description: [''],
      sourceType: [InheritanceSourceType.PARENT_FOLDER, Validators.required],
      targetType: [InheritanceTargetType.FILE, Validators.required],
      priority: [1, [Validators.required, Validators.min(1)]],
      permissionMapping: this.fb.array([]),
      conditions: this.fb.array([])
    });
    
    this.configForm = this.fb.group({
      isActive: [true],
      defaultFolderPermissionSet: [''],
      defaultFilePermissionSet: ['']
    });
  }
  
  ngOnInit(): void {
    this.loadData();
    this.addPermissionMapping();
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  
  /**
   * Load all data
   */
  private loadData(): void {
    this.isLoading = true;
    
    // Load permission sets
    this.permissionService.getPredefinedPermissionSets().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (sets) => {
        this.permissionSets = sets;
      },
      error: (error) => {
        console.error('Error loading permission sets:', error);
      }
    });
    
    // Load inheritance rules
    this.permissionService.getInheritanceRules(this.currentFirmId).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (rules) => {
        this.inheritanceRules = rules;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading inheritance rules:', error);
        // Use mock data for demo
        this.inheritanceRules = this.permissionService.getMockInheritanceRules();
        this.isLoading = false;
      }
    });
    
    // Load inheritance config
    this.permissionService.getInheritanceConfig(this.currentFirmId).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (config) => {
        this.inheritanceConfig = config;
        this.configForm.patchValue({
          isActive: config.isActive,
          defaultFolderPermissionSet: config.defaultPermissionSets.folder.id,
          defaultFilePermissionSet: config.defaultPermissionSets.file.id
        });
      },
      error: (error) => {
        console.error('Error loading inheritance config:', error);
      }
    });
  }
  
  /**
   * Get permission mapping form array
   */
  get permissionMapping(): FormArray {
    return this.ruleForm.get('permissionMapping') as FormArray;
  }
  
  /**
   * Get conditions form array
   */
  get conditions(): FormArray {
    return this.ruleForm.get('conditions') as FormArray;
  }
  
  /**
   * Add permission mapping
   */
  addPermissionMapping(): void {
    const mapping = this.fb.group({
      sourcePermission: [PermissionType.READ, Validators.required],
      targetPermission: [PermissionType.READ, Validators.required],
      override: [false]
    });
    
    this.permissionMapping.push(mapping);
  }
  
  /**
   * Remove permission mapping
   */
  removePermissionMapping(index: number): void {
    this.permissionMapping.removeAt(index);
  }
  
  /**
   * Add condition
   */
  addCondition(): void {
    const condition = this.fb.group({
      type: [ConditionType.FILE_TYPE, Validators.required],
      field: ['', Validators.required],
      operator: [ConditionOperator.EQUALS, Validators.required],
      value: ['', Validators.required]
    });
    
    this.conditions.push(condition);
  }
  
  /**
   * Remove condition
   */
  removeCondition(index: number): void {
    this.conditions.removeAt(index);
  }
  
  /**
   * Save inheritance rule
   */
  saveInheritanceRule(): void {
    if (this.ruleForm.invalid) {
      Object.keys(this.ruleForm.controls).forEach(key => {
        const control = this.ruleForm.get(key);
        if (control?.invalid) {
          control.markAsTouched();
        }
      });
      return;
    }
    
    const formValue = this.ruleForm.value;
    const request: CreateInheritanceRuleRequest = {
      name: formValue.name,
      description: formValue.description,
      sourceType: formValue.sourceType,
      targetType: formValue.targetType,
      permissionMapping: formValue.permissionMapping,
      conditions: formValue.conditions.length > 0 ? formValue.conditions : undefined,
      priority: formValue.priority
    };
    
    this.isLoading = true;
    this.permissionService.createInheritanceRule(this.currentFirmId, request).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (rule) => {
        this.inheritanceRules.push(rule);
        this.ruleForm.reset();
        this.permissionMapping.clear();
        this.conditions.clear();
        this.addPermissionMapping();
        this.isLoading = false;
        
        Swal.fire({
          title: 'Success!',
          text: 'Inheritance rule created successfully',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
      },
      error: (error) => {
        console.error('Error creating inheritance rule:', error);
        this.isLoading = false;
        
        Swal.fire({
          title: 'Error!',
          text: 'Failed to create inheritance rule',
          icon: 'error',
          confirmButtonColor: '#f06548'
        });
      }
    });
  }
  
  /**
   * Delete inheritance rule
   */
  deleteInheritanceRule(rule: InheritanceRule): void {
    Swal.fire({
      title: 'Are you sure?',
      text: 'Do you want to delete this inheritance rule?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#f06548',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
      if (result.isConfirmed) {
        this.permissionService.deleteInheritanceRule(rule.id).pipe(
          takeUntil(this.destroy$)
        ).subscribe({
          next: () => {
            this.inheritanceRules = this.inheritanceRules.filter(r => r.id !== rule.id);
            
            Swal.fire({
              title: 'Deleted!',
              text: 'Inheritance rule has been deleted.',
              icon: 'success',
              timer: 2000,
              showConfirmButton: false
            });
          },
          error: (error) => {
            console.error('Error deleting inheritance rule:', error);
            Swal.fire({
              title: 'Error!',
              text: 'Failed to delete inheritance rule',
              icon: 'error',
              confirmButtonColor: '#f06548'
            });
          }
        });
      }
    });
  }
  
  /**
   * Toggle rule active status
   */
  toggleRuleStatus(rule: InheritanceRule): void {
    rule.isActive = !rule.isActive;
    
    const request: CreateInheritanceRuleRequest = {
      name: rule.name,
      description: rule.description,
      sourceType: rule.sourceType,
      targetType: rule.targetType,
      permissionMapping: rule.permissionMapping,
      conditions: rule.conditions,
      priority: rule.priority
    };
    
    this.permissionService.updateInheritanceRule(rule.id, request).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: () => {
        Swal.fire({
          title: 'Success!',
          text: `Rule ${rule.isActive ? 'activated' : 'deactivated'} successfully`,
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
      },
      error: (error) => {
        console.error('Error updating rule status:', error);
        // Revert the change
        rule.isActive = !rule.isActive;
        
        Swal.fire({
          title: 'Error!',
          text: 'Failed to update rule status',
          icon: 'error',
          confirmButtonColor: '#f06548'
        });
      }
    });
  }
  
  /**
   * Save inheritance config
   */
  saveInheritanceConfig(): void {
    if (this.configForm.invalid) {
      return;
    }
    
    const formValue = this.configForm.value;
    
    // Update the config (this would be a real API call in production)
    Swal.fire({
      title: 'Success!',
      text: 'Inheritance configuration updated successfully',
      icon: 'success',
      timer: 2000,
      showConfirmButton: false
    });
  }
  
  /**
   * Get source type display name
   */
  getSourceTypeDisplayName(sourceType: InheritanceSourceType): string {
    return sourceType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
  
  /**
   * Get target type display name
   */
  getTargetTypeDisplayName(targetType: InheritanceTargetType): string {
    return targetType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
  
  /**
   * Get permission type display name
   */
  getPermissionTypeDisplayName(permissionType: PermissionType): string {
    return permissionType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
}