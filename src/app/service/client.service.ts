import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpEvent, HttpHeaders } from '@angular/common/http';
import { catchError, Observable, throwError } from 'rxjs';
import { CustomHttpResponse, ClientState, Page, Profile } from '../interface/appstates';
import { User } from '../interface/user';
import { Key } from '../enum/key.enum';
import { Stats } from '../interface/stats';
import { Client } from '../interface/client';
import { Invoice } from '../interface/invoice';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ClientService {

    private readonly server: string = environment.apiUrl;

    constructor(private http: HttpClient) { }

    clients$ = (page: number = 0) => <Observable<CustomHttpResponse<Page<Client> & User & Stats>>>
        this.http.get<CustomHttpResponse<Page<Client> & User & Stats>>
            (`${this.server}/client?page=${page}`)
            .pipe(
                catchError(this.handleError)
            );

    allClients$ = () => <Observable<CustomHttpResponse<Page<Client> & User & Stats>>>
        this.http.get<CustomHttpResponse<Page<Client> & User & Stats>>
            (`${this.server}/client?page=0&size=1000`)
            .pipe(
                catchError(this.handleError)
            );

    clientsWithUnbilledTimeEntries$ = () => <Observable<CustomHttpResponse<Client[] & User>>>
        this.http.get<CustomHttpResponse<Client[] & User>>
            (`${this.server}/client/with-unbilled-time-entries`)
            .pipe(
                catchError(this.handleError)
            );

    client$ = (clientId: number) => <Observable<CustomHttpResponse<ClientState>>>
        this.http.get<CustomHttpResponse<ClientState>>
            (`${this.server}/client/get/${clientId}`)
            .pipe(
                catchError(this.handleError)
            );

    update$ = (client: Client) => <Observable<CustomHttpResponse<ClientState>>>
        this.http.put<CustomHttpResponse<ClientState>>
            (`${this.server}/client/update`, client)
            .pipe(
                catchError(this.handleError)
            );

    searchClients$ = (name: string = '', page: number = 0) => <Observable<CustomHttpResponse<Page<Client> & User>>>
        this.http.get<CustomHttpResponse<Page<Client> & User>>
            (`${this.server}/client/search?name=${name}&page=${page}`)
            .pipe(
                catchError(this.handleError)
            );

    newClient$ = (client: Client) => <Observable<CustomHttpResponse<Client & User>>>
        this.http.post<CustomHttpResponse<Client & User>>
            (`${this.server}/client/save`, client)
            .pipe(
                catchError(this.handleError)
            );

    deleteClient$ = (clientId: number): Observable<void> =>
        this.http.delete<void>(`${this.server}/client/delete/${clientId}`, {
        })
            .pipe(
                catchError(this.handleError)
            );
                

    newInvoice$ = () => <Observable<CustomHttpResponse<Client[] & User>>>
        this.http.get<CustomHttpResponse<Client[] & User>>
            (`${this.server}/client/invoice/new`)
            .pipe(
                catchError(this.handleError)
            );

    createInvoice$ = (clientId: number, invoice: Invoice) => <Observable<CustomHttpResponse<Client[] & User>>>
        this.http.post<CustomHttpResponse<Client[] & User>>
            (`${this.server}/client/invoice/addtoclient/${clientId}`, invoice)
            .pipe(
                catchError(this.handleError)
            );

    invoices$ = (page: number = 0) => <Observable<CustomHttpResponse<Page<Invoice> & User>>>
        this.http.get<CustomHttpResponse<Page<Invoice> & User>>
            (`${this.server}/client/invoice/list?page=${page}`)
            .pipe(
                catchError(this.handleError)
            );

    allInvoices$ = (page: number = 0, size: number = 100) => <Observable<CustomHttpResponse<Page<Invoice> & User>>>
        this.http.get<CustomHttpResponse<Page<Invoice> & User>>
            (`${this.server}/client/invoice/list?page=${page}&size=${size}`)
            .pipe(
                catchError(this.handleError)
            );

    invoice$ = (invoiceId: number) => <Observable<CustomHttpResponse<Client & Invoice & User>>>
        this.http.get<CustomHttpResponse<Client & Invoice & User>>
            (`${this.server}/client/invoice/get/${invoiceId}`)
            .pipe(
                catchError(this.handleError)
            );

     deleteInvoice$ = (invoiceId: number): Observable<void> =>
                this.http.delete<void>(`${this.server}/client/invoice/get/${invoiceId}`)
                  .pipe(
                    catchError(this.handleError)
                  );
                  

    downloadReport$ = () => <Observable<HttpEvent<Blob>>>
        this.http.get
            (`${this.server}/client/download/report`, {reportProgress: true, observe: 'events', responseType: 'blob'})
            .pipe(
                catchError(this.handleError)
            );
            
    downloadInvoiceReport$ = () => <Observable<HttpEvent<Blob>>>
        this.http.get
            (`${this.server}/client/invoice/download/invoice-report`, { reportProgress: true, observe: 'events', responseType: 'blob' })
            .pipe(
                catchError(this.handleError)
            ); 

    private handleError(error: HttpErrorResponse): Observable<never> {
        let errorMessage: string;
        if (error.error instanceof ErrorEvent) {
            errorMessage = `A client error occurred - ${error.error.message}`;
        } else {
            if (error.error.reason) {
                errorMessage = error.error.reason;
            } else {
                errorMessage = `An error occurred - Error status ${error.status}`;
            }
        }
        return throwError(() => errorMessage);
    }
}
