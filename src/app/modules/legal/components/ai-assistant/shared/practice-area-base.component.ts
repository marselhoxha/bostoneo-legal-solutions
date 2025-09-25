import { FormGroup } from '@angular/forms';

export abstract class PracticeAreaBaseComponent {
  
  // Helper method to check if a form control is invalid and touched
  isFieldInvalid(form: FormGroup, fieldName: string): boolean {
    const field = form.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  // Helper method to check if a field is required
  isFieldRequired(form: FormGroup, fieldName: string): boolean {
    const field = form.get(fieldName);
    if (field && field.validator) {
      const validator = field.validator({} as any);
      return !!(validator && validator['required']);
    }
    return false;
  }

  // Helper to mark all fields as touched for validation display
  markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      if (control) {
        control.markAsTouched();
        if (control instanceof FormGroup) {
          this.markFormGroupTouched(control);
        }
      }
    });
  }

  // Export functionality
  exportDocument(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.txt`;
    link.click();
    window.URL.revokeObjectURL(url);
  }
}