import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { LoginComponent } from './login.component';
import { UserService } from '../../../service/user.service';
import { NotificationService } from '../../../service/notification.service';
import { HttpCacheService } from '../../../service/http.cache.service';
import { DataState } from '../../../enum/datastate.enum';
import { Key } from '../../../enum/key.enum';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { DebugElement } from '@angular/core';
import { By } from '@angular/platform-browser';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let userService: jasmine.SpyObj<UserService>;
  let notificationService: jasmine.SpyObj<NotificationService>;
  let httpCacheService: jasmine.SpyObj<HttpCacheService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    const userServiceSpy = jasmine.createSpyObj('UserService', ['login$', 'isAuthenticated']);
    const notificationServiceSpy = jasmine.createSpyObj('NotificationService', ['onSuccess', 'onError']);
    const httpCacheServiceSpy = jasmine.createSpyObj('HttpCacheService', ['evictAll']);
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      declarations: [LoginComponent],
      imports: [
        FormsModule,
        HttpClientTestingModule,
        RouterTestingModule
      ],
      providers: [
        { provide: UserService, useValue: userServiceSpy },
        { provide: NotificationService, useValue: notificationServiceSpy },
        { provide: HttpCacheService, useValue: httpCacheServiceSpy },
        { provide: Router, useValue: routerSpy }
      ]
    }).compileComponents();

    userService = TestBed.inject(UserService) as jasmine.SpyObj<UserService>;
    notificationService = TestBed.inject(NotificationService) as jasmine.SpyObj<NotificationService>;
    httpCacheService = TestBed.inject(HttpCacheService) as jasmine.SpyObj<HttpCacheService>;
    router = TestBed.inject(Router) as jasmine.SpyObj<Router>;

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Component Initialization', () => {
    it('should redirect to home if authenticated', () => {
      userService.isAuthenticated.and.returnValue(true);
      
      component.ngOnInit();
      
      expect(router.navigate).toHaveBeenCalledWith(['/']);
    });

    it('should stay on login page if not authenticated', () => {
      userService.isAuthenticated.and.returnValue(false);
      
      component.ngOnInit();
      
      expect(router.navigate).toHaveBeenCalledWith(['/login']);
    });
  });

  describe('Login Process', () => {
    it('should login successfully without MFA', fakeAsync(() => {
      const mockResponse = {
        message: 'Login successful',
        data: {
          user: {
            email: 'test@example.com',
            usingMFA: false
          },
          access_token: 'fake-token',
          refresh_token: 'fake-refresh-token'
        }
      };

      userService.login$.and.returnValue(of(mockResponse));

      const loginForm = {
        value: {
          email: 'test@example.com',
          password: 'password123'
        }
      } as NgForm;

      component.login(loginForm);
      tick();

      expect(httpCacheService.evictAll).toHaveBeenCalled();
      expect(userService.login$).toHaveBeenCalledWith('test@example.com', 'password123');
      expect(localStorage.getItem(Key.TOKEN)).toBe('fake-token');
      expect(localStorage.getItem(Key.REFRESH_TOKEN)).toBe('fake-refresh-token');
      expect(notificationService.onSuccess).toHaveBeenCalledWith(mockResponse.message);
      expect(router.navigate).toHaveBeenCalledWith(['/']);
    }));

    it('should handle login with MFA enabled', fakeAsync(() => {
      const mockResponse = {
        message: 'Verification code sent',
        data: {
          user: {
            email: 'test@example.com',
            phone: '+1234567890',
            usingMFA: true
          },
          access_token: 'fake-token',
          refresh_token: 'fake-refresh-token'
        }
      };

      userService.login$.and.returnValue(of(mockResponse));

      const loginForm = {
        value: {
          email: 'test@example.com',
          password: 'password123'
        }
      } as NgForm;

      component.login(loginForm);
      tick();

      component.loginState$.subscribe(state => {
        expect(state.isUsingMfa).toBe(true);
        expect(state.loginSuccess).toBe(false);
        expect(state.phone).toBe('7890'); // Last 4 digits
      });

      expect(notificationService.onSuccess).toHaveBeenCalledWith(mockResponse.message);
    }));

    it('should handle login error', fakeAsync(() => {
      const errorResponse = { 
        error: { 
          message: 'Invalid credentials' 
        } 
      };

      userService.login$.and.returnValue(throwError(() => errorResponse));

      const loginForm = {
        value: {
          email: 'test@example.com',
          password: 'wrongpassword'
        }
      } as NgForm;

      component.login(loginForm);
      tick();

      component.loginState$.subscribe(state => {
        expect(state.dataState).toBe(DataState.ERROR);
      });

      expect(notificationService.onError).toHaveBeenCalledWith('Invalid credentials');
    }));
  });

  describe('MFA Verification', () => {
    it('should verify MFA code successfully', fakeAsync(() => {
      const mockResponse = {
        message: 'Verification successful',
        data: {
          user: {
            email: 'test@example.com'
          },
          access_token: 'new-token',
          refresh_token: 'new-refresh-token'
        }
      };

      userService.verifyCode$.and.returnValue(of(mockResponse));

      const verifyForm = {
        value: {
          code: '123456'
        },
        resetForm: jasmine.createSpy('resetForm')
      } as any;

      // Set up component state as if MFA login occurred
      component['emailSubject'].next('test@example.com');

      component.verifyCode(verifyForm);
      tick();

      expect(userService.verifyCode$).toHaveBeenCalledWith('test@example.com', '123456');
      expect(localStorage.getItem(Key.TOKEN)).toBe('new-token');
      expect(localStorage.getItem(Key.REFRESH_TOKEN)).toBe('new-refresh-token');
      expect(router.navigate).toHaveBeenCalledWith(['/']);
    }));
  });

  describe('UI Elements', () => {
    it('should have email and password input fields', () => {
      const compiled = fixture.nativeElement;
      const emailInput = compiled.querySelector('input[name="email"]');
      const passwordInput = compiled.querySelector('input[name="password"]');

      expect(emailInput).toBeTruthy();
      expect(passwordInput).toBeTruthy();
    });

    it('should toggle password visibility', () => {
      expect(component.fieldTextType).toBeFalsy();
      
      component.toggleFieldTextType();
      expect(component.fieldTextType).toBeTruthy();
      
      component.toggleFieldTextType();
      expect(component.fieldTextType).toBeFalsy();
    });
  });

  afterEach(() => {
    localStorage.clear();
  });
});