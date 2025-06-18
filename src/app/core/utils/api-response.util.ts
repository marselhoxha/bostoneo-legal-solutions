import { CustomHttpResponse, Page } from '../../interface/appstates';

/**
 * Utility class for extracting data from API responses
 */
export class ApiResponseUtil {
  
  /**
   * Extract page data from various API response formats
   */
  static extractPageData<T>(response: any): Page<T> | null {
    // Direct page object
    if (response && this.isPageObject(response)) {
      return response as Page<T>;
    }
    
    // CustomHttpResponse with page data
    if (response?.data?.page && this.isPageObject(response.data.page)) {
      return response.data.page;
    }
    
    // CustomHttpResponse with direct page properties
    if (response?.data && this.isPageObject(response.data)) {
      return response.data;
    }
    
    // Legacy format with content directly in data
    if (response?.data?.content && Array.isArray(response.data.content)) {
      return this.createPageFromArray(response.data.content, response.data);
    }
    
    return null;
  }
  
  /**
   * Extract array data from various API response formats
   */
  static extractArrayData<T>(response: any): T[] {
    // Direct array
    if (Array.isArray(response)) {
      return response;
    }
    
    // Page object
    const pageData = this.extractPageData<T>(response);
    if (pageData?.content) {
      return pageData.content;
    }
    
    // CustomHttpResponse with array data
    if (response?.data && Array.isArray(response.data)) {
      return response.data;
    }
    
    // Nested structures
    if (response?.data?.items && Array.isArray(response.data.items)) {
      return response.data.items;
    }
    
    if (response?.data?.results && Array.isArray(response.data.results)) {
      return response.data.results;
    }
    
    // Legacy formats
    if (response?.data?.cases && Array.isArray(response.data.cases)) {
      return response.data.cases;
    }
    
    if (response?.data?.clients && Array.isArray(response.data.clients)) {
      return response.data.clients;
    }
    
    return [];
  }
  
  /**
   * Extract single object data from API response
   */
  static extractObjectData<T>(response: any): T | null {
    // Direct object
    if (response && typeof response === 'object' && !Array.isArray(response)) {
      // Check if it's a CustomHttpResponse
      if ('data' in response && response.data) {
        return response.data;
      }
      // Check if it's wrapped in a result property
      if ('result' in response && response.result) {
        return response.result;
      }
      // Otherwise return as is
      return response;
    }
    
    return null;
  }
  
  /**
   * Check if object is a Page structure
   */
  private static isPageObject(obj: any): boolean {
    return obj &&
      typeof obj === 'object' &&
      'content' in obj &&
      Array.isArray(obj.content) &&
      'totalPages' in obj &&
      'totalElements' in obj;
  }
  
  /**
   * Create a Page object from an array
   */
  private static createPageFromArray<T>(content: T[], metadata?: any): Page<T> {
    return {
      content: content,
      totalPages: metadata?.totalPages || 1,
      totalElements: metadata?.totalElements || content.length,
      numberOfElements: metadata?.numberOfElements || content.length,
      size: metadata?.size || content.length,
      number: metadata?.number || 0
    };
  }
  
  /**
   * Extract error message from various error response formats
   */
  static extractErrorMessage(error: any): string {
    if (typeof error === 'string') {
      return error;
    }
    
    // Check for backend HttpResponse format first (most specific)
    if (error?.error?.reason) {
      return error.error.reason;
    }
    
    if (error?.reason) {
      return error.reason;
    }
    
    // Check for standard error message formats
    if (error?.error?.message) {
      return error.error.message;
    }
    
    if (error?.message) {
      return error.message;
    }
    
    // Check for string error in error property
    if (error?.error && typeof error.error === 'string') {
      return error.error;
    }
    
    // Check for backend HttpResponse fields
    if (error?.error?.developerMessage) {
      return error.error.developerMessage;
    }
    
    if (error?.developerMessage) {
      return error.developerMessage;
    }
    
    // Fallback to HTTP status text
    if (error?.statusText && error.statusText !== 'OK') {
      return error.statusText;
    }
    
    return 'An unexpected error occurred';
  }
}