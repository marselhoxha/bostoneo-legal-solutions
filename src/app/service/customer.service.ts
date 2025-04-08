import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpEvent, HttpHeaders } from '@angular/common/http';
import { catchError, Observable, tap, throwError } from 'rxjs';
import { CustomHttpResponse, CustomerState, Page, Profile } from '../interface/appstates';
import { User } from '../interface/user';
import { Key } from '../enum/key.enum';
import { Stats } from '../interface/stats';
import { Customer } from '../interface/customer';
import { Invoice } from '../interface/invoice';

@Injectable({ providedIn: 'root' })
export class CustomerService {
    
    private readonly server: string = 'http://localhost:8085';

    constructor(private http: HttpClient) { }

    customers$ = (page: number = 0) => <Observable<CustomHttpResponse<Page<Customer> & User & Stats>>>
        this.http.get<CustomHttpResponse<Page<Customer> & User & Stats>>
            (`${this.server}/customer/list?page=${page}`)
            .pipe(
                tap(console.log),
                catchError(this.handleError)
            );

    customer$ = (customerId: number) => <Observable<CustomHttpResponse<CustomerState>>>
        this.http.get<CustomHttpResponse<CustomerState>>
            (`${this.server}/customer/get/${customerId}`)
            .pipe(
                tap(console.log),
                catchError(this.handleError)
            );

    update$ = (customer: Customer) => <Observable<CustomHttpResponse<CustomerState>>>
        this.http.put<CustomHttpResponse<CustomerState>>
            (`${this.server}/customer/update`, customer)
            .pipe(
                tap(console.log),
                catchError(this.handleError)
            );

    searchCustomers$ = (name: string = '', page: number = 0) => <Observable<CustomHttpResponse<Page<Customer> & User>>>
        this.http.get<CustomHttpResponse<Page<Customer> & User>>
            (`${this.server}/customer/search?name=${name}&page=${page}`)
            .pipe(
                tap(console.log),
                catchError(this.handleError)
            );

    newCustomer$ = (customer: Customer) => <Observable<CustomHttpResponse<Customer & User>>>
        this.http.post<CustomHttpResponse<Customer & User>>
            (`${this.server}/customer/create`, customer)
            .pipe(
                tap(console.log),
                catchError(this.handleError)
            );

    deleteCustomer$ = (customerId: number): Observable<void> =>
        this.http.delete<void>(`${this.server}/customer/delete/${customerId}`, {
        })
            .pipe(
                tap(() => console.log(`Customer ${customerId} deleted`)),
                catchError(this.handleError)
            );
                

    newInvoice$ = () => <Observable<CustomHttpResponse<Customer[] & User>>>
        this.http.get<CustomHttpResponse<Customer[] & User>>
            (`${this.server}/customer/invoice/new`)
            .pipe(
                tap(console.log),
                catchError(this.handleError)
            );

    createInvoice$ = (customerId: number, invoice: Invoice) => <Observable<CustomHttpResponse<Customer[] & User>>>
        this.http.post<CustomHttpResponse<Customer[] & User>>
            (`${this.server}/customer/invoice/addtocustomer/${customerId}`, invoice)
            .pipe(
                tap(console.log),
                catchError(this.handleError)
            );

    invoices$ = (page: number = 0) => <Observable<CustomHttpResponse<Page<Invoice> & User>>>
        this.http.get<CustomHttpResponse<Page<Invoice> & User>>
            (`${this.server}/customer/invoice/list?page=${page}`)
            .pipe(
                tap(console.log),
                catchError(this.handleError)
            );

    invoice$ = (invoiceId: number) => <Observable<CustomHttpResponse<Customer & Invoice & User>>>
        this.http.get<CustomHttpResponse<Customer & Invoice & User>>
            (`${this.server}/customer/invoice/get/${invoiceId}`)
            .pipe(
                tap(console.log),
                catchError(this.handleError)
            );

     deleteInvoice$ = (invoiceId: number): Observable<void> => 
                this.http.delete<void>(`${this.server}/customer/invoice/get/${invoiceId}`)
                  .pipe(
                    tap(() => console.log(`Invoice ${invoiceId} deleted`)),
                    catchError(this.handleError)
                  );
                  

    downloadReport$ = () => <Observable<HttpEvent<Blob>>>
        this.http.get
            (`${this.server}/customer/download/report`, {reportProgress: true, observe: 'events', responseType: 'blob'})
            .pipe(
                tap(console.log),
                catchError(this.handleError)
            );
            
    downloadInvoiceReport$ = () => <Observable<HttpEvent<Blob>>>
        this.http.get
            (`${this.server}/customer/invoice/download/invoice-report`, { reportProgress: true, observe: 'events', responseType: 'blob' })
            .pipe(
                tap(console.log),
                catchError(this.handleError)
            ); 

    private handleError(error: HttpErrorResponse): Observable<never> {
        console.log(error);
        let errorMessage: string;
        if (error.error instanceof ErrorEvent) {
            errorMessage = `A client error occurred - ${error.error.message}`;
        } else {
            if (error.error.reason) {
                errorMessage = error.error.reason;
                console.log(errorMessage);
            } else {
                errorMessage = `An error occurred - Error status ${error.status}`;
            }
        }
        return throwError(() => errorMessage);
    }
}
