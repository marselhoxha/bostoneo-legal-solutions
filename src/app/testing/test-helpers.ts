import { HttpClientTestingModule } from '@angular/common/http/testing';
import { DebugElement } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';

/**
 * Common testing imports that most tests will need
 */
export const commonTestingModules = [
  HttpClientTestingModule,
  RouterTestingModule
];

/**
 * Helper to find elements in component fixtures
 */
export class TestHelper<T> {
  constructor(private fixture: ComponentFixture<T>) {}

  /**
   * Find element by CSS selector
   */
  find(selector: string): DebugElement {
    return this.fixture.debugElement.query(By.css(selector));
  }

  /**
   * Find all elements by CSS selector
   */
  findAll(selector: string): DebugElement[] {
    return this.fixture.debugElement.queryAll(By.css(selector));
  }

  /**
   * Get element text content
   */
  getText(selector: string): string {
    const element = this.find(selector);
    return element ? element.nativeElement.textContent.trim() : '';
  }

  /**
   * Click an element
   */
  click(selector: string): void {
    const element = this.find(selector);
    if (element) {
      element.nativeElement.click();
      this.fixture.detectChanges();
    }
  }

  /**
   * Set input value
   */
  setInputValue(selector: string, value: string): void {
    const input = this.find(selector);
    if (input) {
      input.nativeElement.value = value;
      input.nativeElement.dispatchEvent(new Event('input'));
      this.fixture.detectChanges();
    }
  }

  /**
   * Check if element exists
   */
  exists(selector: string): boolean {
    return !!this.find(selector);
  }

  /**
   * Get element attribute
   */
  getAttribute(selector: string, attribute: string): string | null {
    const element = this.find(selector);
    return element ? element.nativeElement.getAttribute(attribute) : null;
  }
}

/**
 * Mock data builders
 */
export class MockDataBuilder {
  static createUser(overrides: any = {}) {
    return {
      id: 1,
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      phone: '+1234567890',
      address: '123 Test St',
      title: 'Attorney',
      bio: 'Test bio',
      imageUrl: 'https://example.com/image.jpg',
      enabled: true,
      notLocked: true,
      usingMFA: false,
      createdAt: new Date().toISOString(),
      roles: [],
      ...overrides
    };
  }

  static createLegalCase(overrides: any = {}) {
    return {
      id: '1',
      caseNumber: 'CASE-2024-001',
      title: 'Test Case',
      description: 'Test case description',
      clientName: 'Test Client',
      clientEmail: 'client@example.com',
      clientPhone: '+1234567890',
      clientAddress: '123 Client St',
      status: 'OPEN',
      priority: 'HIGH',
      type: 'Civil Litigation',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };
  }

  static createRole(overrides: any = {}) {
    return {
      id: 1,
      name: 'ROLE_USER',
      permission: 'USER:READ',
      hierarchyLevel: 10,
      ...overrides
    };
  }

  static createHttpResponse(data: any, message = 'Success', statusCode = 200) {
    return {
      timeStamp: new Date().toISOString(),
      statusCode,
      status: statusCode === 200 ? 'OK' : 'ERROR',
      message,
      data
    };
  }
}

/**
 * Common spy helpers
 */
export class SpyHelpers {
  /**
   * Create a spy that returns successful observable
   */
  static createSuccessSpy(data: any) {
    return jasmine.createSpy().and.returnValue(of(data));
  }

  /**
   * Create a spy that returns error observable
   */
  static createErrorSpy(error: any) {
    return jasmine.createSpy().and.returnValue(throwError(() => error));
  }

  /**
   * Create a spy that returns void
   */
  static createVoidSpy() {
    return jasmine.createSpy();
  }
}

/**
 * Wait for async operations
 */
export function waitForAsync(fn: Function): void {
  setTimeout(fn, 0);
}

/**
 * Trigger Angular change detection
 */
export function detectChanges(fixture: ComponentFixture<any>): void {
  fixture.detectChanges();
  fixture.whenStable();
}