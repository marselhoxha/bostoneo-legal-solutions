import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { InvitationService, InvitationValidation } from '../../../core/services/invitation.service';
import { UserService } from '../../../service/user.service';
import { catchError, of, switchMap, tap } from 'rxjs';

interface AcceptInviteState {
  loading: boolean;
  validating: boolean;
  invitation: InvitationValidation | null;
  error: string | null;
  isLoggedIn: boolean;
  activeTab: 'login' | 'register';
  submitting: boolean;
  success: boolean;
  successMessage: string;
  willRedirect: boolean;
}

@Component({
  selector: 'app-accept-invite',
  templateUrl: './accept-invite.component.html',
  styleUrls: ['./accept-invite.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AcceptInviteComponent implements OnInit {
  state: AcceptInviteState = {
    loading: true,
    validating: true,
    invitation: null,
    error: null,
    isLoggedIn: false,
    activeTab: 'login',
    submitting: false,
    success: false,
    successMessage: '',
    willRedirect: false
  };

  token: string = '';
  loginForm!: UntypedFormGroup;
  registerForm!: UntypedFormGroup;
  showPassword = false;
  currentYear = new Date().getFullYear();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private formBuilder: UntypedFormBuilder,
    private invitationService: InvitationService,
    private userService: UserService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.initForms();

    // Get token from route
    this.token = this.route.snapshot.paramMap.get('token') || '';

    // If no token in URL, check localStorage for pending invite
    if (!this.token) {
      const pendingToken = localStorage.getItem('pendingInviteToken');
      if (pendingToken) {
        this.token = pendingToken;
      }
    }

    if (!this.token) {
      this.state.error = 'Invalid invitation link';
      this.state.loading = false;
      this.state.validating = false;
      this.cdr.markForCheck();
      return;
    }

    // Check if user is already logged in
    this.checkAuthAndValidate();
  }

  private initForms(): void {
    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });

    this.registerForm = this.formBuilder.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    });
  }

  private checkAuthAndValidate(): void {
    // Check if user is logged in (synchronous check)
    this.state.isLoggedIn = this.userService.isAuthenticated();
    this.validateToken();
  }

  private validateToken(): void {
    this.invitationService.validateToken(this.token).subscribe({
      next: (validation) => {
        this.state.invitation = validation;
        this.state.validating = false;
        this.state.loading = false;

        if (!validation.valid) {
          this.state.error = validation.errorMessage || 'Invalid or expired invitation';
        } else {
          // Pre-fill email in forms
          if (validation.email) {
            this.loginForm.patchValue({ email: validation.email });
            this.registerForm.patchValue({ email: validation.email });
          }
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.state.error = err?.error?.message || 'Failed to validate invitation';
        this.state.validating = false;
        this.state.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  setActiveTab(tab: 'login' | 'register'): void {
    this.state.activeTab = tab;
    this.cdr.markForCheck();
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  // For logged-in users - just accept the invitation
  acceptInvitation(): void {
    this.state.submitting = true;
    this.cdr.markForCheck();

    this.invitationService.acceptInvitation(this.token).subscribe({
      next: () => {
        // Clear pending invite token
        localStorage.removeItem('pendingInviteToken');

        this.state.success = true;
        this.state.willRedirect = true;
        this.state.successMessage = `You have successfully joined ${this.state.invitation?.organizationName || 'the organization'}!`;
        this.state.submitting = false;
        this.cdr.markForCheck();

        // Redirect to dashboard after short delay
        setTimeout(() => {
          this.router.navigate(['/home']);
        }, 2000);
      },
      error: (err) => {
        this.state.error = err?.error?.reason || err?.error?.message || 'Failed to accept invitation';
        this.state.submitting = false;
        this.cdr.markForCheck();
      }
    });
  }

  // Login and then accept
  login(): void {
    if (this.loginForm.invalid) return;

    this.state.submitting = true;
    this.state.error = null;
    this.cdr.markForCheck();

    const { email, password } = this.loginForm.value;

    this.userService.login$(email, password).pipe(
      switchMap(response => {
        // After successful login, accept the invitation
        return this.invitationService.acceptInvitation(this.token);
      }),
      catchError(err => {
        this.state.error = err?.error?.reason || err?.error?.message || 'Login failed. Please check your credentials.';
        this.state.submitting = false;
        this.cdr.markForCheck();
        return of(null);
      })
    ).subscribe({
      next: (result) => {
        if (result) {
          // Clear pending invite token
          localStorage.removeItem('pendingInviteToken');

          this.state.success = true;
          this.state.willRedirect = true;
          this.state.successMessage = `Welcome! You have joined ${this.state.invitation?.organizationName || 'the organization'}.`;
          this.state.submitting = false;
          this.cdr.markForCheck();

          setTimeout(() => {
            this.router.navigate(['/home']);
          }, 2000);
        }
      }
    });
  }

  // Register - user needs to verify email before they can accept
  register(): void {
    if (this.registerForm.invalid) return;

    const { password, confirmPassword } = this.registerForm.value;
    if (password !== confirmPassword) {
      this.state.error = 'Passwords do not match';
      this.cdr.markForCheck();
      return;
    }

    this.state.submitting = true;
    this.state.error = null;
    this.cdr.markForCheck();

    const registerData = {
      firstName: this.registerForm.value.firstName,
      lastName: this.registerForm.value.lastName,
      email: this.registerForm.value.email,
      password: this.registerForm.value.password
    };

    this.userService.save$(registerData as any).pipe(
      catchError(err => {
        this.state.error = err?.error?.reason || err?.error?.message || 'Registration failed. Please try again.';
        this.state.submitting = false;
        this.cdr.markForCheck();
        return of(null);
      })
    ).subscribe({
      next: (result) => {
        if (result) {
          // Store token in localStorage so user can come back after email verification
          localStorage.setItem('pendingInviteToken', this.token);
          this.state.success = true;
          this.state.successMessage = `Account created! Please check your email to verify your account, then come back to this page to join ${this.state.invitation?.organizationName || 'the organization'}.`;
          this.state.submitting = false;
          this.cdr.markForCheck();
        }
      }
    });
  }

  goToLogin(): void {
    this.router.navigate(['/login/login']);
  }

  get f() {
    return this.loginForm.controls;
  }

  get rf() {
    return this.registerForm.controls;
  }
}
