import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { Router } from '@angular/router';
import { jwtDecode } from 'jwt-decode';

export interface User {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  roles: string[];
  permissions: string[];
}

interface AuthResponse {
  token: string;
  refreshToken: string;
  user: User;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly API_URL = '/api/auth';
  private readonly TOKEN_KEY = 'auth_token';
  private readonly REFRESH_TOKEN_KEY = 'refresh_token';
  private readonly USER_KEY = 'current_user';
  
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  private tokenExpirationTimer: any;

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    this.loadStoredUserData();
  }

  private loadStoredUserData(): void {
    try {
      const storedUser = localStorage.getItem(this.USER_KEY);
      const storedToken = localStorage.getItem(this.TOKEN_KEY);
      
      if (storedUser && storedToken) {
        const user = JSON.parse(storedUser);
        this.currentUserSubject.next(user);
        this.startTokenExpirationTimer(storedToken);
      }
    } catch (error) {
      console.error('Error loading stored user data', error);
      this.logout(); // Clean up if there's a problem
    }
  }

  login(username: string, password: string): Observable<User> {
    return this.http.post<AuthResponse>(`${this.API_URL}/login`, { username, password })
      .pipe(
        tap(response => this.handleAuthResponse(response)),
        map(response => response.user),
        catchError(error => {
          console.error('Login failed', error);
          throw error;
        })
      );
  }

  register(userData: any): Observable<User> {
    return this.http.post<AuthResponse>(`${this.API_URL}/register`, userData)
      .pipe(
        tap(response => this.handleAuthResponse(response)),
        map(response => response.user)
      );
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.currentUserSubject.next(null);
    this.clearTokenExpirationTimer();
    this.router.navigate(['/login']);
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  getCurrentUserId(): number | null {
    const currentUser = this.getCurrentUser();
    return currentUser ? currentUser.id : null;
  }

  hasPermission(permission: string): boolean {
    const user = this.getCurrentUser();
    return user?.permissions?.includes(permission) || false;
  }

  hasRole(role: string): boolean {
    const user = this.getCurrentUser();
    return user?.roles?.includes(role) || false;
  }

  private handleAuthResponse(response: AuthResponse): void {
    if (response && response.token) {
      localStorage.setItem(this.TOKEN_KEY, response.token);
      localStorage.setItem(this.REFRESH_TOKEN_KEY, response.refreshToken);
      localStorage.setItem(this.USER_KEY, JSON.stringify(response.user));
      this.currentUserSubject.next(response.user);
      this.startTokenExpirationTimer(response.token);
    }
  }

  private startTokenExpirationTimer(token: string): void {
    this.clearTokenExpirationTimer();
    
    try {
      const decodedToken: any = jwtDecode(token);
      if (decodedToken && decodedToken.exp) {
        const expiresAt = decodedToken.exp * 1000; // convert to ms
        const timeout = expiresAt - Date.now() - (60 * 1000); // refresh 1 minute before expiry
        
        if (timeout > 0) {
          this.tokenExpirationTimer = setTimeout(() => {
            this.refreshToken().subscribe();
          }, timeout);
        } else {
          this.refreshToken().subscribe();
        }
      }
    } catch (error) {
      console.error('Error decoding token', error);
    }
  }

  private clearTokenExpirationTimer(): void {
    if (this.tokenExpirationTimer) {
      clearTimeout(this.tokenExpirationTimer);
      this.tokenExpirationTimer = null;
    }
  }

  refreshToken(): Observable<any> {
    const refreshToken = localStorage.getItem(this.REFRESH_TOKEN_KEY);
    
    if (!refreshToken) {
      this.logout();
      return of(null);
    }
    
    return this.http.post<AuthResponse>(`${this.API_URL}/refresh`, { refreshToken })
      .pipe(
        tap(response => this.handleAuthResponse(response)),
        catchError(error => {
          console.error('Token refresh failed', error);
          this.logout();
          return of(null);
        })
      );
  }
} 