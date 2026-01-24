import { Component, OnInit } from '@angular/core';
import { NgForm } from '@angular/forms';
import { ParamMap } from '@angular/router';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, BehaviorSubject, map, startWith, catchError, of, switchMap } from 'rxjs';
import { DataState } from 'src/app/enum/datastate.enum';
import { CustomHttpResponse, ClientState, Page } from 'src/app/interface/appstates';
import { State } from 'src/app/interface/state';
import { User } from 'src/app/interface/user';
import { ClientService } from 'src/app/service/client.service';

@Component({
  selector: 'app-client',
  templateUrl: './client-detail.component.html',
  styleUrls: ['./client-detail.component.css']
})
export class ClientDetailComponent implements OnInit {
  clientState$: Observable<State<CustomHttpResponse<ClientState>>>;
  private dataSubject = new BehaviorSubject<CustomHttpResponse<ClientState>>(null);
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  isLoading$ = this.isLoadingSubject.asObservable();
  readonly DataState = DataState;
  private readonly CLIENT_ID: string = 'id';

  constructor(private activatedRoute: ActivatedRoute, private clientService: ClientService) { }

  ngOnInit(): void {
    this.clientState$ = this.activatedRoute.paramMap.pipe(
      switchMap((params: ParamMap) => {
        return this.clientService.client$(+params.get(this.CLIENT_ID))
          .pipe(
            map(response => {
              this.dataSubject.next(response);
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
          return { dataState: DataState.LOADED, appData: this.dataSubject.value };
        }),
        startWith({ dataState: DataState.LOADED, appData: this.dataSubject.value }),
        catchError((error: string) => {
          this.isLoadingSubject.next(false);
          return of({ dataState: DataState.ERROR, error })
        })
      )
  }

}
