import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { catchError } from 'rxjs/operators';
import { LoginState } from 'src/app/interface/appstates';
import { UserService } from 'src/app/service/user.service';
import { DataState } from 'src/app/enum/datastate.enum';
import { Key } from 'src/app/enum/key.enum';
import { NotificationService } from 'src/app/service/notification.service';
import { HttpCacheService } from 'src/app/service/http.cache.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent implements OnInit{
  loginState$: Observable<LoginState> = of({ dataState: DataState.LOADED });
  private phoneSubject = new BehaviorSubject<string | null>(null);
  private emailSubject = new BehaviorSubject<string | null>(null);
  readonly DataState = DataState;
  fieldTextType!: boolean;

  constructor(private router: Router, private userService: UserService, 
    private notificationService: NotificationService, private httpCache: HttpCacheService) { }

  ngOnInit(): void {
    this.userService.isAuthenticated() ? this.router.navigate(['/']) : this.router.navigate(['/login']);
  }

  login(loginForm: NgForm): void {
    this.httpCache.evictAll(); // Clear the cache after successful login
          // After clearing the cache, all data will be fetched afresh from the server.
    this.loginState$ = this.userService.login$(loginForm.value.email, loginForm.value.password)
      .pipe(
        map(response => {
          this.notificationService.onSuccess(response.message)
          if (response.data.user.usingMFA) {
            this.notificationService.onSuccess(response.message)
            this.phoneSubject.next(response.data.user.phone);
            this.emailSubject.next(response.data.user.email);
            return {
              dataState: DataState.LOADED, isUsingMfa: true, loginSuccess: false,
              phone: response.data.user.phone.substring(response.data.user.phone.length - 4)
            };
          } else {
            this.notificationService.onSuccess(response.message)
            localStorage.setItem(Key.TOKEN, response.data.access_token);
            localStorage.setItem(Key.REFRESH_TOKEN, response.data.refresh_token);
            
            // DEBUG: Log token details to help diagnose permission issues
            try {
              const decodedToken = JSON.parse(atob(response.data.access_token.split('.')[1]));
              console.log('Decoded JWT Token:', decodedToken);
              console.log('Roles:', decodedToken.roles || []);
              console.log('Permissions:', decodedToken.permissions || []);
            } catch (error) {
              console.error('Error decoding token:', error);
            }
            
            this.router.navigate(['/']);
            return { dataState: DataState.LOADED, loginSuccess: true };
          }
        }),
        startWith({ dataState: DataState.LOADING, isUsingMfa: false }),
        catchError((error: string) => {
          console.log(error);
          return of({ dataState: DataState.ERROR, isUsingMfa: false, loginSuccess: false, error })
        })
      )
  }

  verifyCode(verifyCodeForm: NgForm): void {
    this.loginState$ = this.userService.verifyCode$(this.emailSubject.value, verifyCodeForm.value.code)
      .pipe(
        map(response => {
          localStorage.setItem(Key.TOKEN, response.data.access_token);
          localStorage.setItem(Key.REFRESH_TOKEN, response.data.refresh_token);
          this.router.navigate(['/']);
          return { dataState: DataState.LOADED, loginSuccess: true };
        }),
        startWith({ dataState: DataState.LOADING, isUsingMfa: true, loginSuccess: false,
          phone: this.phoneSubject.value.substring(this.phoneSubject.value.length - 4) }),
        catchError((error: string) => {
          return of({ dataState: DataState.ERROR, isUsingMfa: true, loginSuccess: false, error,
            phone: this.phoneSubject.value.substring(this.phoneSubject.value.length - 4) })
        })
      )
  }

  loginPage(): void {
    this.loginState$ = of({ dataState: DataState.LOADED });
  }

  /**
   * Password Hide/Show
   */
  toggleFieldTextType() {
    this.fieldTextType = !this.fieldTextType;
  }

}