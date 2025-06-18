import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { UserService } from './user.service';
import { HttpCacheService } from './http.cache.service';
import { Router } from '@angular/router';
import { PreloaderService } from './preloader.service';
import { User } from '../interface/user';
import { CustomHttpResponse, Profile } from '../interface/appstates';
import { Key } from '../enum/key.enum';

describe('UserService', () => {
  let service: UserService;
  let httpMock: HttpTestingController;
  let httpCacheService: jasmine.SpyObj<HttpCacheService>;
  let router: jasmine.SpyObj<Router>;
  let preloaderService: jasmine.SpyObj<PreloaderService>;
  const apiUrl = 'http://localhost:8085';

  beforeEach(() => {
    const httpCacheSpy = jasmine.createSpyObj('HttpCacheService', ['evictAll']);
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    const preloaderSpy = jasmine.createSpyObj('PreloaderService', ['show', 'hide']);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        UserService,
        { provide: HttpCacheService, useValue: httpCacheSpy },
        { provide: Router, useValue: routerSpy },
        { provide: PreloaderService, useValue: preloaderSpy }
      ]
    });
    
    service = TestBed.inject(UserService);
    httpMock = TestBed.inject(HttpTestingController);
    httpCacheService = TestBed.inject(HttpCacheService) as jasmine.SpyObj<HttpCacheService>;
    router = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    preloaderService = TestBed.inject(PreloaderService) as jasmine.SpyObj<PreloaderService>;
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  describe('login$', () => {
    it('should login user successfully and store tokens', (done) => {
      const mockUser: User = {
        id: 1,
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        phone: '+1234567890',
        enabled: true,
        notLocked: true,
        usingMFA: false,
        createdAt: '2024-01-01'
      } as User;

      const mockResponse: CustomHttpResponse<Profile> = {
        timeStamp: new Date().toISOString(),
        statusCode: 200,
        status: 'OK',
        message: 'Login successful',
        data: {
          user: mockUser,
          access_token: 'fake-access-token',
          refresh_token: 'fake-refresh-token'
        }
      } as CustomHttpResponse<Profile>;

      service.login$('test@example.com', 'password123').subscribe(response => {
        expect(response).toEqual(mockResponse);
        expect(localStorage.getItem(Key.TOKEN)).toBe('fake-access-token');
        expect(localStorage.getItem(Key.REFRESH_TOKEN)).toBe('fake-refresh-token');
        
        // Check if user data was set
        service.getUserData().subscribe(userData => {
          expect(userData).toEqual(mockUser);
        });
        
        done();
      });

      const req = httpMock.expectOne(`${apiUrl}/user/login`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ email: 'test@example.com', password: 'password123' });
      req.flush(mockResponse);
    });

    it('should handle login error', (done) => {
      service.login$('test@example.com', 'wrongpassword').subscribe({
        error: (error) => {
          expect(error.status).toBe(401);
          expect(localStorage.getItem(Key.TOKEN)).toBeNull();
          done();
        }
      });

      const req = httpMock.expectOne(`${apiUrl}/user/login`);
      req.flush({ message: 'Invalid credentials' }, { status: 401, statusText: 'Unauthorized' });
    });
  });

  describe('save$ (register)', () => {
    it('should register a new user successfully', (done) => {
      const newUser: User = {
        firstName: 'New',
        lastName: 'User',
        email: 'newuser@example.com',
        phone: '+1234567890'
      } as User;

      const mockResponse: CustomHttpResponse<Profile> = {
        timeStamp: new Date().toISOString(),
        statusCode: 201,
        status: 'CREATED',
        message: 'User registered successfully',
        data: {
          user: { ...newUser, id: 2 } as User
        }
      } as CustomHttpResponse<Profile>;

      service.save$(newUser).subscribe(response => {
        expect(response).toEqual(mockResponse);
        done();
      });

      const req = httpMock.expectOne(`${apiUrl}/user/register`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(newUser);
      req.flush(mockResponse);
    });
  });

  describe('verifyCode$', () => {
    it('should verify MFA code successfully', (done) => {
      const mockResponse: CustomHttpResponse<Profile> = {
        timeStamp: new Date().toISOString(),
        statusCode: 200,
        status: 'OK',
        message: 'Code verified',
        data: {
          user: { email: 'test@example.com' } as User,
          access_token: 'new-token',
          refresh_token: 'new-refresh-token'
        }
      } as CustomHttpResponse<Profile>;

      service.verifyCode$('test@example.com', '123456').subscribe(response => {
        expect(response).toEqual(mockResponse);
        done();
      });

      const req = httpMock.expectOne(`${apiUrl}/user/verify/code/test@example.com/123456`);
      expect(req.request.method).toBe('GET');
      req.flush(mockResponse);
    });
  });

  describe('profile$', () => {
    it('should fetch user profile successfully', (done) => {
      const mockResponse: CustomHttpResponse<Profile> = {
        timeStamp: new Date().toISOString(),
        statusCode: 200,
        status: 'OK',
        message: 'Profile retrieved',
        data: {
          user: { id: 1, email: 'test@example.com' } as User
        }
      } as CustomHttpResponse<Profile>;

      service.profile$().subscribe(response => {
        expect(response).toEqual(mockResponse);
        done();
      });

      const req = httpMock.expectOne(`${apiUrl}/user/profile`);
      expect(req.request.method).toBe('GET');
      req.flush(mockResponse);
    });
  });

  describe('requestPasswordReset$', () => {
    it('should request password reset successfully', (done) => {
      const mockResponse: CustomHttpResponse<Profile> = {
        timeStamp: new Date().toISOString(),
        statusCode: 200,
        status: 'OK',
        message: 'Password reset email sent',
        data: null
      } as CustomHttpResponse<Profile>;

      service.requestPasswordReset$('test@example.com').subscribe(response => {
        expect(response.message).toBe('Password reset email sent');
        done();
      });

      const req = httpMock.expectOne(`${apiUrl}/user/resetpassword/test@example.com`);
      expect(req.request.method).toBe('GET');
      req.flush(mockResponse);
    });
  });

  describe('renewPassword$', () => {
    it('should renew password successfully', (done) => {
      const passwordForm = {
        userId: 1,
        password: 'newPassword123',
        confirmPassword: 'newPassword123'
      };

      const mockResponse: CustomHttpResponse<Profile> = {
        timeStamp: new Date().toISOString(),
        statusCode: 200,
        status: 'OK',
        message: 'Password updated successfully',
        data: null
      } as CustomHttpResponse<Profile>;

      service.renewPassword$(passwordForm).subscribe(response => {
        expect(response.message).toBe('Password updated successfully');
        done();
      });

      const req = httpMock.expectOne(`${apiUrl}/user/new/password`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(passwordForm);
      req.flush(mockResponse);
    });
  });

  describe('User Data Management', () => {
    it('should set and get user data', (done) => {
      const testUser: User = {
        id: 1,
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com'
      } as User;

      service.setUserData(testUser);

      service.getUserData().subscribe(userData => {
        expect(userData).toEqual(testUser);
        done();
      });
    });

    it('should clear user cache', (done) => {
      const testUser: User = {
        id: 1,
        email: 'test@example.com'
      } as User;

      service.setUserData(testUser);
      service.clearUserCache();

      service.getUserData().subscribe(userData => {
        expect(userData).toBeNull();
        done();
      });
    });
  });

  describe('isAuthenticated', () => {
    it('should return true when valid token exists', () => {
      localStorage.setItem(Key.TOKEN, 'valid.jwt.token');
      
      // Mock jwtHelper to return false for isTokenExpired
      spyOn(service['jwtHelper'], 'isTokenExpired').and.returnValue(false);
      
      expect(service.isAuthenticated()).toBe(true);
    });

    it('should return false when token is expired', () => {
      localStorage.setItem(Key.TOKEN, 'expired.jwt.token');
      
      // Mock jwtHelper to return true for isTokenExpired
      spyOn(service['jwtHelper'], 'isTokenExpired').and.returnValue(true);
      
      expect(service.isAuthenticated()).toBe(false);
    });

    it('should return false when no token exists', () => {
      localStorage.removeItem(Key.TOKEN);
      
      expect(service.isAuthenticated()).toBe(false);
    });
  });

  describe('refreshToken$', () => {
    it('should refresh token successfully', (done) => {
      const mockResponse: CustomHttpResponse<Profile> = {
        timeStamp: new Date().toISOString(),
        statusCode: 200,
        status: 'OK',
        message: 'Token refreshed',
        data: {
          user: { email: 'test@example.com' } as User,
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token'
        }
      } as CustomHttpResponse<Profile>;

      service.refreshToken$().subscribe(response => {
        expect(response).toEqual(mockResponse);
        expect(localStorage.getItem(Key.TOKEN)).toBe('new-access-token');
        expect(localStorage.getItem(Key.REFRESH_TOKEN)).toBe('new-refresh-token');
        done();
      });

      const req = httpMock.expectOne(`${apiUrl}/user/refresh/token`);
      expect(req.request.method).toBe('GET');
      req.flush(mockResponse);
    });
  });
});