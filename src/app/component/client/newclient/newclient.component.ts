import { Component, OnInit, ViewChild, ElementRef, Output, EventEmitter } from '@angular/core';
import { NgForm } from '@angular/forms';
import { Observable, BehaviorSubject, map, startWith, catchError, of, takeUntil, Subject } from 'rxjs';
import { DataState } from 'src/app/enum/datastate.enum';
import { CustomHttpResponse, Page } from 'src/app/interface/appstates';
import { Client } from 'src/app/interface/client';
import { State } from 'src/app/interface/state';
import { Stats } from 'src/app/interface/stats';
import { User } from 'src/app/interface/user';
import { ClientService } from 'src/app/service/client.service';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { NotificationService } from 'src/app/service/notification.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-newclient',
  templateUrl: './newclient.component.html',
  styleUrls: ['./newclient.component.css']
})
export class NewclientComponent implements OnInit {
  @Output() clientCreated = new EventEmitter<any>();
  
  newClientState$: Observable<State<CustomHttpResponse<Page<Client> & User & Stats>>>;
  private dataSubject = new BehaviorSubject<CustomHttpResponse<Page<Client> & User & Stats>>(null);
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  isLoading$ = this.isLoadingSubject.asObservable();
  readonly DataState = DataState;
  private destroy$ = new Subject<void>();
  private isLaodingSubject = new BehaviorSubject<boolean>(false);
  isLaoding$ = this.isLaodingSubject.asObservable();

  constructor(
    private clientService: ClientService,
    public activeModal: NgbActiveModal,
    private notificationService: NotificationService
  ) { }

  ngOnInit(): void {
    this.newClientState$ = this.clientService.clients$()
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

  createClient(newClientForm: NgForm): void {
    this.isLoadingSubject.next(true);
    this.clientService.newClient$(newClientForm.value)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.isLoadingSubject.next(false);
          Swal.fire({
            title: 'Client Created Successfully!',
            text: 'Your new client has been successfully added.',
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
            text: 'There was a problem creating the client. Please try again.',
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
