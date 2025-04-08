import { Component, OnInit, ViewChild, ElementRef, Output, EventEmitter } from '@angular/core';
import { NgForm } from '@angular/forms';
import { Observable, BehaviorSubject, map, startWith, catchError, of, takeUntil, Subject } from 'rxjs';
import { DataState } from 'src/app/enum/datastate.enum';
import { CustomHttpResponse, Page } from 'src/app/interface/appstates';
import { Customer } from 'src/app/interface/customer';
import { State } from 'src/app/interface/state';
import { Stats } from 'src/app/interface/stats';
import { User } from 'src/app/interface/user';
import { CustomerService } from 'src/app/service/customer.service';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { NotificationService } from 'src/app/service/notification.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-newcustomer',
  templateUrl: './newcustomer.component.html',
  styleUrls: ['./newcustomer.component.css']
})
export class NewcustomerComponent implements OnInit {
  @Output() customerCreated = new EventEmitter<any>();
  
  newCustomerState$: Observable<State<CustomHttpResponse<Page<Customer> & User & Stats>>>;
  private dataSubject = new BehaviorSubject<CustomHttpResponse<Page<Customer> & User & Stats>>(null);
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  isLoading$ = this.isLoadingSubject.asObservable();
  readonly DataState = DataState;
  private destroy$ = new Subject<void>();
  private isLaodingSubject = new BehaviorSubject<boolean>(false);
  isLaoding$ = this.isLaodingSubject.asObservable();

  constructor(
    private customerService: CustomerService,
    public activeModal: NgbActiveModal,
    private notificationService: NotificationService
  ) { }

  ngOnInit(): void {
    this.newCustomerState$ = this.customerService.customers$()
      .pipe(
        map(response => {
          console.log(response);
          this.dataSubject.next(response);
          return { dataState: DataState.LOADED, appData: response };
        }),
        startWith({ dataState: DataState.LOADING }),
        catchError((error: string) => {
          return of({ dataState: DataState.ERROR, error })
        })
      )
  }

  createCustomer(newCustomerForm: NgForm): void {
    this.isLoadingSubject.next(true);
    this.customerService.newCustomer$(newCustomerForm.value)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.isLoadingSubject.next(false);
          Swal.fire({
            title: 'Customer Created Successfully!',
            text: 'Your new customer has been successfully added.',
            icon: 'success',
            timer: 3000,
            timerProgressBar: true,
            showConfirmButton: false
          });
          this.closeModal();
        },
        error: (error) => {
          this.isLoadingSubject.next(false);
          Swal.fire({
            title: 'Error!',
            text: 'There was a problem creating the customer. Please try again.',
            icon: 'error',
            confirmButtonText: 'OK'
          });
        }
      });
  }

  closeModal(): void {
    this.activeModal.close();
  }
}
