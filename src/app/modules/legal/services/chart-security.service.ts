import { Injectable } from '@angular/core';

/**
 * Security service for sanitizing and validating chart data from AI responses
 * Protects against XSS, injection attacks, and DoS
 */
@Injectable({
  providedIn: 'root'
})
export class ChartSecurityService {

  // Security limits
  private readonly MAX_DATA_POINTS = 100;
  private readonly MAX_LABEL_LENGTH = 100;
  private readonly MAX_VALUE = 999999999;

  constructor() {}

  /**
   * Sanitize a text label by removing dangerous characters and HTML
   */
  sanitizeLabel(label: string): string {
    if (!label || typeof label !== 'string') {
      return '';
    }

    // Remove HTML tags
    let sanitized = label.replace(/<[^>]*>/g, '');

    // Remove script-related content
    sanitized = sanitized.replace(/javascript:/gi, '');
    sanitized = sanitized.replace(/on\w+\s*=/gi, ''); // Remove event handlers like onclick=

    // Decode HTML entities to prevent double-encoding attacks
    sanitized = this.decodeHtmlEntities(sanitized);

    // Remove any remaining potentially dangerous characters
    sanitized = sanitized.replace(/[<>'"]/g, '');

    // Truncate to max length
    if (sanitized.length > this.MAX_LABEL_LENGTH) {
      sanitized = sanitized.substring(0, this.MAX_LABEL_LENGTH) + '...';
    }

    return sanitized.trim();
  }

  /**
   * Validate and sanitize a numeric value
   */
  sanitizeValue(value: any): number {
    if (typeof value === 'number' && !isNaN(value)) {
      // Clamp to reasonable range
      if (value > this.MAX_VALUE) return this.MAX_VALUE;
      if (value < -this.MAX_VALUE) return -this.MAX_VALUE;
      return value;
    }

    // Try to parse string to number
    const parsed = parseFloat(String(value));
    if (isNaN(parsed)) {
      return 0;
    }

    // Clamp parsed value
    if (parsed > this.MAX_VALUE) return this.MAX_VALUE;
    if (parsed < -this.MAX_VALUE) return -this.MAX_VALUE;
    return parsed;
  }

  /**
   * Validate and sanitize percentage value (0-100)
   */
  sanitizePercentage(value: any): number {
    const num = this.sanitizeValue(value);
    // Clamp to 0-100 range
    if (num < 0) return 0;
    if (num > 100) return 100;
    return num;
  }

  /**
   * Limit array size to prevent DoS
   */
  limitDataSize<T>(data: T[]): T[] {
    if (!Array.isArray(data)) {
      console.warn('ChartSecurity: Invalid data array');
      return [];
    }

    if (data.length > this.MAX_DATA_POINTS) {
      console.warn(`ChartSecurity: Data truncated from ${data.length} to ${this.MAX_DATA_POINTS} points`);
      return data.slice(0, this.MAX_DATA_POINTS);
    }

    return data;
  }

  /**
   * Sanitize chart configuration object
   */
  sanitizeChartConfig(config: any): any {
    if (!config || typeof config !== 'object') {
      throw new Error('Invalid chart configuration');
    }

    // Sanitize title and subtitle
    if (config.title) {
      config.title = this.sanitizeLabel(config.title);
    }
    if (config.subtitle) {
      config.subtitle = this.sanitizeLabel(config.subtitle);
    }

    // Sanitize labels array
    if (Array.isArray(config.labels)) {
      config.labels = this.limitDataSize(config.labels);
      config.labels = config.labels.map((label: any) => this.sanitizeLabel(String(label)));
    }

    // Sanitize data array
    if (Array.isArray(config.data)) {
      config.data = this.limitDataSize(config.data);

      // Handle different data structures
      config.data = config.data.map((item: any) => {
        if (typeof item === 'object' && item !== null) {
          // Object with label and value
          return {
            ...item,
            label: item.label ? this.sanitizeLabel(String(item.label)) : '',
            value: item.value !== undefined ? this.sanitizeValue(item.value) : 0,
            displayValue: item.displayValue ? this.sanitizeLabel(String(item.displayValue)) : undefined,
            percentage: item.percentage !== undefined ? this.sanitizePercentage(item.percentage) : undefined
          };
        } else {
          // Primitive value
          return this.sanitizeValue(item);
        }
      });
    }

    // Validate chart type
    const validTypes = ['bar', 'pie', 'donut', 'line'];
    if (!validTypes.includes(config.type)) {
      console.warn(`ChartSecurity: Invalid chart type "${config.type}", defaulting to "bar"`);
      config.type = 'bar';
    }

    return config;
  }

  /**
   * Detect suspicious patterns that might indicate XSS attempts
   */
  detectSuspiciousPatterns(text: string): boolean {
    if (!text || typeof text !== 'string') {
      return false;
    }

    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,  // Event handlers
      /<iframe/i,
      /eval\(/i,
      /document\./i,
      /window\./i,
      /<embed/i,
      /<object/i
    ];

    return suspiciousPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Decode HTML entities to prevent double-encoding attacks
   */
  private decodeHtmlEntities(text: string): string {
    const element = document.createElement('textarea');
    element.innerHTML = text;
    return element.value;
  }

  /**
   * Validate entire chart data before rendering
   * Returns sanitized config or throws error
   */
  validateAndSanitize(configStr: string): any {
    try {
      // Check for suspicious patterns before parsing
      if (this.detectSuspiciousPatterns(configStr)) {
        console.error('ChartSecurity: Suspicious pattern detected in chart data');
        throw new Error('Invalid chart data detected');
      }

      // Parse JSON
      const config = JSON.parse(configStr);

      // Sanitize the configuration
      return this.sanitizeChartConfig(config);

    } catch (error) {
      console.error('ChartSecurity: Validation failed', error);
      throw new Error('Failed to validate chart data');
    }
  }
}
