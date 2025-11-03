/**
 * Document field configuration for dynamic form generation
 */
export interface DocumentField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'multiselect' | 'date' | 'number' | 'currency';
  placeholder?: string;
  helperText?: string;
  options?: string[]; // For select/multiselect types
  defaultValue?: any;
  validation?: {
    required: boolean;
    minLength?: number;
    maxLength?: number;
    min?: number; // For number type
    max?: number; // For number type
    pattern?: string; // Regex pattern
    customValidator?: (value: any) => boolean;
    errorMessage?: string;
  };
  dependsOn?: {
    fieldId: string;
    value: any; // Show this field only if dependsOn field has this value
  };
  rows?: number; // For textarea
  columns?: number; // For layout
}

/**
 * Document type configuration with all necessary metadata
 */
export interface DocumentTypeConfig {
  id: string;
  name: string;
  description: string;
  category: 'Discovery' | 'Motions' | 'Pleadings' | 'Briefs' | 'Contracts' | 'Family Law' | 'Other';
  icon: string;
  color: 'primary' | 'success' | 'info' | 'warning' | 'danger' | 'purple';
  templateId?: number; // Backend template ID
  requiredFields: DocumentField[];
  optionalFields: DocumentField[];
  jurisdictionRequired: boolean;
  practiceAreas: string[];
  popular?: boolean;
  estimatedTime?: string; // e.g., "2-5 minutes"
  complexity?: 'simple' | 'moderate' | 'complex';
  tags?: string[]; // For search/filtering
}

/**
 * Document generation form data
 */
export interface DocumentFormData {
  documentType: string;
  documentTypeConfig: DocumentTypeConfig;
  jurisdiction: string;
  fieldValues: { [fieldId: string]: any };
  customPrompt?: string;
}

/**
 * Helper function to validate document form data
 */
export function validateDocumentForm(formData: DocumentFormData): {
  valid: boolean;
  errors: { [fieldId: string]: string };
} {
  const errors: { [fieldId: string]: string } = {};
  const config = formData.documentTypeConfig;

  // Validate required fields
  config.requiredFields.forEach(field => {
    const value = formData.fieldValues[field.id];

    if (!value || (typeof value === 'string' && value.trim() === '')) {
      errors[field.id] = field.validation?.errorMessage || `${field.label} is required`;
      return;
    }

    // Validate field-specific rules
    if (field.validation) {
      const validation = field.validation;

      // String length validation
      if (validation.minLength && typeof value === 'string' && value.length < validation.minLength) {
        errors[field.id] = `${field.label} must be at least ${validation.minLength} characters`;
      }

      if (validation.maxLength && typeof value === 'string' && value.length > validation.maxLength) {
        errors[field.id] = `${field.label} must not exceed ${validation.maxLength} characters`;
      }

      // Number range validation
      if (validation.min !== undefined && typeof value === 'number' && value < validation.min) {
        errors[field.id] = `${field.label} must be at least ${validation.min}`;
      }

      if (validation.max !== undefined && typeof value === 'number' && value > validation.max) {
        errors[field.id] = `${field.label} must not exceed ${validation.max}`;
      }

      // Pattern validation
      if (validation.pattern && typeof value === 'string') {
        const regex = new RegExp(validation.pattern);
        if (!regex.test(value)) {
          errors[field.id] = validation.errorMessage || `${field.label} format is invalid`;
        }
      }

      // Custom validator
      if (validation.customValidator && !validation.customValidator(value)) {
        errors[field.id] = validation.errorMessage || `${field.label} is invalid`;
      }
    }
  });

  // Validate jurisdiction if required
  if (config.jurisdictionRequired && !formData.jurisdiction) {
    errors['jurisdiction'] = 'Jurisdiction is required';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Helper function to build prompt from form data
 */
export function buildDocumentPrompt(formData: DocumentFormData): string {
  const config = formData.documentTypeConfig;
  let prompt = `Generate a ${config.name} document`;

  if (formData.jurisdiction) {
    prompt += ` for ${formData.jurisdiction} jurisdiction`;
  }

  prompt += ' with the following details:\n\n';

  // Add required fields
  config.requiredFields.forEach(field => {
    const value = formData.fieldValues[field.id];
    if (value) {
      prompt += `${field.label}: ${Array.isArray(value) ? value.join(', ') : value}\n`;
    }
  });

  // Add optional fields if provided
  config.optionalFields.forEach(field => {
    const value = formData.fieldValues[field.id];
    if (value) {
      prompt += `${field.label}: ${Array.isArray(value) ? value.join(', ') : value}\n`;
    }
  });

  // Add custom prompt if provided
  if (formData.customPrompt) {
    prompt += `\nAdditional Instructions: ${formData.customPrompt}\n`;
  }

  return prompt;
}
