import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { NgForm } from '@angular/forms';
import { ParamMap } from '@angular/router';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, BehaviorSubject, map, startWith, catchError, of, switchMap } from 'rxjs';
import { DataState } from 'src/app/enum/datastate.enum';
import { CustomHttpResponse, ClientState, Page } from 'src/app/interface/appstates';
import { State } from 'src/app/interface/state';
import { User } from 'src/app/interface/user';
import { ClientService } from 'src/app/service/client.service';
import { CrmService } from 'src/app/modules/crm/services/crm.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-client',
  templateUrl: './client-detail.component.html',
  styleUrls: ['./client-detail.component.scss']
})
export class ClientDetailComponent implements OnInit {
  clientState$: Observable<State<CustomHttpResponse<ClientState>>>;
  private dataSubject = new BehaviorSubject<CustomHttpResponse<ClientState>>(null);
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  isLoading$ = this.isLoadingSubject.asObservable();
  readonly DataState = DataState;
  private readonly CLIENT_ID: string = 'id';

  isEditing = false;
  isSendingConsent = false;
  consentEmailSent = false;
  consentEmailError = '';
  consentSentToEmail = '';

  // Intake submission data
  intakeSubmissions: any[] = [];
  isLoadingIntake = false;

  constructor(
    private activatedRoute: ActivatedRoute,
    private clientService: ClientService,
    private crmService: CrmService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.clientState$ = this.activatedRoute.paramMap.pipe(
      switchMap((params: ParamMap) => {
        return this.clientService.client$(+params.get(this.CLIENT_ID))
          .pipe(
            map(response => {
              this.dataSubject.next(response);
              // Load intake submissions for this client's email
              const clientEmail = response?.data?.client?.email;
              if (clientEmail) {
                this.loadIntakeSubmissions(clientEmail);
              }
              return { dataState: DataState.LOADED, appData: response };
            }),
            startWith({ dataState: DataState.LOADING }),
            catchError((error: string) => {
              return of({ dataState: DataState.ERROR, error })
            })
          )
      })
    );
  }

  startEditing(): void {
    this.isEditing = true;
  }

  cancelEditing(): void {
    this.isEditing = false;
  }

  updateClient(customerForm: NgForm): void {
    this.isLoadingSubject.next(true);
    this.clientState$ = this.clientService.update$(customerForm.value)
      .pipe(
        map(response => {
          this.dataSubject.next({ ...response,
            data: { ...response.data,
              client: { ...response.data.client,
                invoices: this.dataSubject.value.data.client.invoices }}});

          this.isLoadingSubject.next(false);
          this.isEditing = false;
          return { dataState: DataState.LOADED, appData: this.dataSubject.value };
        }),
        startWith({ dataState: DataState.LOADED, appData: this.dataSubject.value }),
        catchError((error: string) => {
          this.isLoadingSubject.next(false);
          return of({ dataState: DataState.ERROR, error })
        })
      )
  }

  getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name[0].toUpperCase();
  }

  getStatusBadgeClass(status: string): string {
    const statusMap: { [key: string]: string } = {
      'ACTIVE': 'bg-success',
      'INACTIVE': 'bg-secondary',
      'PENDING': 'bg-warning',
      'BANNED': 'bg-danger'
    };
    return statusMap[status] || 'bg-secondary';
  }

  formatStatus(value: string): string {
    if (!value) return '-';
    return value.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  isOverdue(dueDate: string): boolean {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  }

  loadIntakeSubmissions(email: string): void {
    this.isLoadingIntake = true;
    this.crmService.getSubmissionsByEmail(email).subscribe({
      next: (submissions) => {
        this.intakeSubmissions = submissions;
        this.isLoadingIntake = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoadingIntake = false;
        this.cdr.detectChanges();
      }
    });
  }

  getIntakeSubmissionData(submission: any): any {
    if (!submission?.submissionData) return {};
    if (typeof submission.submissionData === 'string') {
      try { return JSON.parse(submission.submissionData); } catch { return {}; }
    }
    return submission.submissionData;
  }

  formatIntakeDate(date: string): string {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
    });
  }

  sendAiConsent(clientId: number, clientEmail: string): void {
    Swal.fire({
      title: 'Send AI Disclosure',
      html: `
        <p class="text-muted mb-3" style="font-size: 0.9rem;">
          An AI technology disclosure email will be sent to the client. You can change the recipient email below.
        </p>
        <div class="text-start">
          <label class="form-label fw-semibold">Recipient Email</label>
          <input id="swal-email" type="email" class="form-control" value="${clientEmail || ''}" placeholder="Enter email address">
        </div>
      `,
      icon: 'info',
      showCancelButton: true,
      confirmButtonText: '<i class="ri-mail-send-line me-1"></i> Send Disclosure',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#405189',
      cancelButtonColor: '#6c757d',
      focusConfirm: false,
      preConfirm: () => {
        const email = (document.getElementById('swal-email') as HTMLInputElement).value.trim();
        if (!email) {
          Swal.showValidationMessage('Please enter an email address');
          return false;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          Swal.showValidationMessage('Please enter a valid email address');
          return false;
        }
        return email;
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        const email = result.value;
        this.isSendingConsent = true;
        this.consentEmailSent = false;
        this.consentEmailError = '';
        this.consentSentToEmail = email;
        this.cdr.detectChanges();

        this.clientService.sendAiConsent$(clientId, email).subscribe({
          next: () => {
            this.isSendingConsent = false;
            this.consentEmailSent = true;
            this.cdr.detectChanges();
          },
          error: (error: string) => {
            this.isSendingConsent = false;
            this.consentEmailError = error || 'Failed to send email. Please try again.';
            this.cdr.detectChanges();
          }
        });
      }
    });
  }
}
