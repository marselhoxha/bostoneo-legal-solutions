import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { NgForm } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
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
  prefillEmail: string = '';
  prefillPassword: string = '';
  isInvitation: boolean = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private userService: UserService,
    private notificationService: NotificationService,
    private httpCache: HttpCacheService
  ) { }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      if (params['sessionExpired'] === 'true') {
        this.notificationService.onWarning('Session expired. Please log in again.');
        this.router.navigate(['/login'], { replaceUrl: true });
      }
      // Auto-fill from invitation link
      if (params['email'] && params['temp']) {
        this.prefillEmail = params['email'];
        this.prefillPassword = params['temp'];
        this.isInvitation = true;
      }
    });

    if (this.userService.isAuthenticated()) {
      this.router.navigate(['/']);
    }
  }

  login(loginForm: NgForm): void {
    this.httpCache.evictAll(); // Clear the cache after successful login
          // After clearing the cache, all data will be fetched afresh from the server.
    this.loginState$ = this.userService.login$(loginForm.value.email, loginForm.value.password)
      .pipe(
        map(response => {
          if (response.data.user.usingMFA) {
            this.notificationService.onSuccess(response.message)
            this.phoneSubject.next(response.data.user.phone);
            this.emailSubject.next(response.data.user.email);
            const phone = response.data.user.phone;
            return {
              dataState: DataState.LOADED, isUsingMfa: true, loginSuccess: false,
              phone: phone ? phone.substring(phone.length - 4) : ''
            };
          } else if (response.data.user.forcePasswordChange) {
            // Redirect to standalone password change page — user cannot bypass this
            this.router.navigate(['/user/verify/password/force-change']);
            return { dataState: DataState.LOADED, loginSuccess: true };
          } else {
            this.notificationService.onSuccess(response.message)
            this.router.navigate(['/']);
            return { dataState: DataState.LOADED, loginSuccess: true };
          }
        }),
        startWith({ dataState: DataState.LOADING, isUsingMfa: false }),
        catchError((error: string) => {
          return of({ dataState: DataState.ERROR, isUsingMfa: false, loginSuccess: false, error })
        })
      )
  }

  verifyCode(verifyCodeForm: NgForm): void {
    if (!this.emailSubject.value) {
      this.loginState$ = of({ dataState: DataState.ERROR, isUsingMfa: false, loginSuccess: false, error: 'Session expired. Please log in again.' });
      return;
    }
    this.loginState$ = this.userService.verifyCode$(this.emailSubject.value, verifyCodeForm.value.code)
      .pipe(
        map(response => {
          localStorage.setItem(Key.TOKEN, response.data.access_token);
          localStorage.setItem(Key.REFRESH_TOKEN, response.data.refresh_token);
          this.router.navigate(['/']);
          return { dataState: DataState.LOADED, loginSuccess: true };
        }),
        startWith({ dataState: DataState.LOADING, isUsingMfa: true, loginSuccess: false,
          phone: this.phoneSubject.value ? this.phoneSubject.value.substring(this.phoneSubject.value.length - 4) : '' }),
        catchError((error: string) => {
          return of({ dataState: DataState.ERROR, isUsingMfa: true, loginSuccess: false, error,
            phone: this.phoneSubject.value ? this.phoneSubject.value.substring(this.phoneSubject.value.length - 4) : '' })
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