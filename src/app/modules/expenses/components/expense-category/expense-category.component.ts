import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ExpenseCategoryService } from '../../services/expense-category.service';
import { ExpenseCategory } from '../../models/expense-category.model';
import { catchError, finalize, tap } from 'rxjs/operators';
import { of } from 'rxjs';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-expense-category',
  templateUrl: './expense-category.component.html',
  styleUrls: ['./expense-category.component.css']
})
export class ExpenseCategoryComponent implements OnInit {
  categories: ExpenseCategory[] = [];
  categoryForm: FormGroup;
  editingCategory: ExpenseCategory | null = null;
  loading = false;
  submitting = false;
  error: string | null = null;
  
  // Track categories that cannot be deleted (have children)
  nonDeletableCategories = new Set<number>();

  constructor(
    private fb: FormBuilder,
    private categoryService: ExpenseCategoryService,
    private changeDetectorRef: ChangeDetectorRef
  ) {
    this.categoryForm = this.createForm();
  }

  ngOnInit(): void {
    this.loadCategories();
  }

  private createForm(): FormGroup {
    return this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      color: ['#000000'],
      parentId: [null]
    });
  }

  loadCategories(): void {
    console.log('loadCategories started, loading = true');
    this.loading = true;
    this.error = null;
    this.changeDetectorRef.detectChanges();
    
    this.categoryService.getCategories()
      .pipe(
        tap(categories => {
          console.log('Loaded categories:', categories);
          this.categories = categories;
          
          // Clear the set of non-deletable categories
          this.nonDeletableCategories.clear();
          
          // Find all categories that are used as parents
          for (const category of categories) {
            if (category.parentId) {
              // If a category has a parent, that parent cannot be deleted
              this.nonDeletableCategories.add(category.parentId);
              console.log(`Category ${category.parentId} cannot be deleted because it's a parent of ${category.id} (${category.name})`);
            }
          }
          
          // Log all non-deletable categories
          console.log('Non-deletable categories:', Array.from(this.nonDeletableCategories).join(', '));
        }),
        catchError(error => {
          console.log('Error in getCategories catchError');
          this.error = 'Failed to load categories. Please try again.';
          console.error('Error loading categories:', error);
          this.changeDetectorRef.detectChanges();
          return of([]);
        })
      )
      .subscribe({
        next: () => {
          console.log('getCategories subscribe next');
          this.loading = false;
          this.changeDetectorRef.detectChanges();
        },
        error: (err) => {
           console.log('getCategories subscribe error (might not be reached)');
           this.error = 'Failed to load categories. Please try again later.';
           this.loading = false;
           this.changeDetectorRef.detectChanges();
        },
        complete: () => {
           console.log('getCategories subscribe complete');
           if(this.loading) {
              this.loading = false;
              this.changeDetectorRef.detectChanges();
           }
        }
      });
  }

  // Simple check if a category can be deleted
  canDeleteCategory(categoryId: number): boolean {
    const canDelete = !this.nonDeletableCategories.has(categoryId);
    console.log(`Can delete category ${categoryId}? ${canDelete}`);
    return canDelete;
  }

  // Get the categories that have this category as their parent
  getChildCategories(parentId: number): ExpenseCategory[] {
    return this.categories.filter(c => c.parentId === parentId);
  }

  onSubmit(): void {
    if (this.categoryForm.invalid) return;

    console.log('onSubmit started, submitting = true');
    this.submitting = true;
    this.error = null;
    this.changeDetectorRef.detectChanges();

    // Create a copy of form data to avoid reference issues
    const formData = { ...this.categoryForm.value };
    const isEditing = !!this.editingCategory;
    const categoryId = isEditing ? this.editingCategory.id : null;

    console.log(isEditing ? `Updating category ${categoryId}` : 'Creating new category', formData);

    const request = isEditing
      ? this.categoryService.updateCategory(categoryId!, formData)
      : this.categoryService.createCategory(formData);

    request
      .pipe(
        catchError(error => {
          this.error = `Failed to ${isEditing ? 'update' : 'create'} category. Please try again.`;
          console.error('Error saving category:', error);
          return of(null);
        }),
        finalize(() => {
          this.submitting = false;
          this.changeDetectorRef.detectChanges();
        })
      )
      .subscribe({
        next: (response) => {
          if (response) {
            // Show success message
            Swal.fire({
              title: isEditing ? 'Updated!' : 'Created!',
              text: `Category has been successfully ${isEditing ? 'updated' : 'created'}.`,
              icon: 'success',
              timer: 2000,
              timerProgressBar: true,
              showConfirmButton: false
            });
            
            // Reset form
              this.resetForm();
            
            // Reload categories to get fresh data
              this.loadCategories();
          }
        }
      });
  }

  editCategory(category: ExpenseCategory): void {
    // Make a deep copy to avoid reference issues
    this.editingCategory = {...category};
    
    // Reset form first to clear any previous values
    this.categoryForm.reset();
    
    // Then patch with the category values
    this.categoryForm.patchValue({
      name: category.name,
      color: category.color || '#000000',
      parentId: category.parentId
    });
    
    this.changeDetectorRef.detectChanges();
  }

  cancelEdit(): void {
    this.editingCategory = null;
    this.resetForm();
    this.changeDetectorRef.detectChanges();
  }

  deleteCategory(id: number): void {
    // First check if the category can be deleted
    if (!this.canDeleteCategory(id)) {
      const childCategories = this.getChildCategories(id);
      const childNames = childCategories.map(c => c.name).join(', ');
      
      this.error = `Cannot delete this category because it has subcategories: ${childNames}. Please reassign or delete these subcategories first.`;
      this.changeDetectorRef.detectChanges();
      return;
    }

    // Use SweetAlert2 for confirmation
    Swal.fire({
      title: 'Are you sure?',
      text: 'Do you want to delete this category? This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'No, cancel!',
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      reverseButtons: true
    }).then((result) => {
      if (result.isConfirmed) {
        this.loading = true;
        this.error = null;
        this.changeDetectorRef.detectChanges();

    this.categoryService.deleteCategory(id)
      .pipe(
        catchError(error => {
          this.error = 'Failed to delete category. Please try again.';
          console.error('Error deleting category:', error);
              this.loading = false;
          this.changeDetectorRef.detectChanges();
          return of(null);
            })
      )
      .subscribe({
        next: (result) => {
              this.loading = false;
              
          if (result !== undefined) {
                // Show success message
                Swal.fire({
                  title: 'Deleted!',
                  text: 'Category has been successfully deleted.',
                  icon: 'success',
                  timer: 2000,
                  timerProgressBar: true,
                  showConfirmButton: false
                });
                
                // Reload the categories
              this.loadCategories();
          }
        },
        error: (err) => {
              this.loading = false;
            this.error = 'Failed to delete category. An unexpected error occurred.';
            this.changeDetectorRef.detectChanges();
              
              Swal.fire({
                title: 'Error!',
                text: 'Failed to delete category. Please try again.',
                icon: 'error',
                confirmButtonText: 'OK'
              });
            }
          });
        }
      });
  }

  getParentCategoryName(parentId: number | null): string {
    if (!parentId) return 'None';
    const parent = this.categories.find(c => c.id === parentId);
    return parent ? parent.name : 'Unknown';
  }

  private resetForm(): void {
    this.categoryForm.reset({
      name: '',
      color: '#000000',
      parentId: null
    });
    this.editingCategory = null;
    this.error = null;
  }
} 