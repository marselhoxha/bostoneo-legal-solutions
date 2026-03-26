import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { NgForm } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { Observable, BehaviorSubject, map, startWith, catchError, of, switchMap } from 'rxjs';
import { DataState } from 'src/app/enum/datastate.enum';
import { AccountType, VerifyState } from 'src/app/interface/appstates';
import { User } from 'src/app/interface/user';
import { UserService } from 'src/app/service/user.service';
import { Key } from 'src/app/enum/key.enum';

@Component({
  selector: 'app-verify',
  templateUrl: './verify.component.html',
  styleUrls: ['./verify.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VerifyComponent implements OnInit {
  verifyState$: Observable<VerifyState>;
  private userSubject = new BehaviorSubject<User>(null);
  user$ = this.userSubject.asObservable();
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  isLoading$ = this.isLoadingSubject.asObservable();
  readonly DataState = DataState;
  showPassword = false;
  password = '';
  confirmPassword = '';
  isForceChange = false;
  private readonly ACCOUNT_KEY: string = 'key';

  constructor(private activatedRoute: ActivatedRoute, private userService: UserService, private router: Router) { }

  ngOnInit(): void {
    this.verifyState$ = this.activatedRoute.paramMap.pipe(
      switchMap((params: ParamMap) => {
        const key = params.get(this.ACCOUNT_KEY);

        // Handle force password change (user already logged in with temp password)
        if (key === 'force-change') {
          this.isForceChange = true;
          // Get user ID from the stored profile data
          return this.userService.profile$().pipe(
            map(response => {
              this.userSubject.next(response.data.user);
              return {
                type: 'password' as AccountType,
                title: 'Change Required',
                dataState: DataState.LOADED,
                message: 'You must set a new password before continuing.',
                verifySuccess: true
              };
            }),
            startWith({ title: 'Loading...', dataState: DataState.LOADING, message: 'Please wait...', verifySuccess: false }),
            catchError(() => {
              // If not authenticated, redirect to login
              this.router.navigate(['/login']);
              return of({ title: 'Error', dataState: DataState.ERROR, error: 'Session expired. Please log in again.', message: 'Session expired', verifySuccess: false });
            })
          );
        }

        // Normal token verification flow
        const type: AccountType = this.getAccountType(window.location.href);
        return this.userService.verify$(key, type)
          .pipe(
            map(response => {
              type === 'password' ? this.userSubject.next(response.data.user) : null;
              return { type, title: 'Verified!', dataState: DataState.LOADED, message: response.message, verifySuccess: true };
            }),
            startWith({ title: 'Verifying...', dataState: DataState.LOADING, message: 'Please wait while we verify the information', verifySuccess: false }),
            catchError((error: string) => {
              return of({ title: error, dataState: DataState.ERROR, error, message: error, verifySuccess: false })
            })
          )
      })
    );
  }

  renewPassword(resetPasswordform: NgForm): void {
    this.isLoadingSubject.next(true);
    this.verifyState$ = this.userService.renewPassword$({ userId: this.userSubject.value.id, password: resetPasswordform.value.password, confirmPassword: resetPasswordform.value.confirmPassword })
      .pipe(
        map(response => {
          this.isLoadingSubject.next(false);
          if (this.isForceChange) {
            // Clear tokens so user must log in fresh with new password
            localStorage.removeItem(Key.TOKEN);
            localStorage.removeItem(Key.REFRESH_TOKEN);
          }
          setTimeout(() => this.router.navigate(['/login']), 3000);
          return { type: 'account' as AccountType, title: 'Success', dataState: DataState.LOADED, message: 'Password changed successfully! Redirecting to login...', verifySuccess: true };
        }),
        startWith({ type: 'password' as AccountType, title: 'Verified!', dataState: DataState.LOADED, verifySuccess: false }),
        catchError((error: string) => {
          this.isLoadingSubject.next(false);
          return of({ type: 'password' as AccountType, title: 'Verified!', dataState: DataState.LOADED, error, verifySuccess: true })
        })
      )
  }

  hasUppercase(pw: string): boolean { return /[A-Z]/.test(pw); }
  hasLowercase(pw: string): boolean { return /[a-z]/.test(pw); }
  hasNumber(pw: string): boolean { return /\d/.test(pw); }
  hasSpecialChar(pw: string): boolean { return /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw); }

  isPasswordValid(): boolean {
    return this.password.length >= 12
      && this.hasUppercase(this.password)
      && this.hasLowercase(this.password)
      && this.hasNumber(this.password)
      && this.hasSpecialChar(this.password);
  }

  private getAccountType(url: string): AccountType {
    return url.includes('password') ? 'password' : 'account';
  }

}
