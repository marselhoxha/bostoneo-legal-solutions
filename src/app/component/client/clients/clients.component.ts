import { HttpEvent, HttpEventType } from '@angular/common/http';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, NgForm, Validators } from '@angular/forms';
import { EventType, Router } from '@angular/router';
import { Observable, BehaviorSubject, map, startWith, catchError, of, switchMap, distinctUntilChanged, shareReplay } from 'rxjs';
import { DataState } from 'src/app/enum/datastate.enum';
import { CustomHttpResponse, Page, Profile } from 'src/app/interface/appstates';
import { Client } from 'src/app/interface/client';
import { State } from 'src/app/interface/state';
import { User } from 'src/app/interface/user';
import { ClientService } from 'src/app/service/client.service';
import { saveAs } from 'file-saver';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { NewclientComponent } from '../newclient/newclient.component';
import Swal from 'sweetalert2';


@Component({
  selector: 'app-clients',
  templateUrl: './clients.component.html',
  styleUrls: ['./clients.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush 

})
export class ClientsComponent implements OnInit {
  clientsState$: Observable<State<CustomHttpResponse<Page<Client> & User>>>;
  private dataSubject = new BehaviorSubject<CustomHttpResponse<Page<Client> & User>>(null);
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  isLoading$ = this.isLoadingSubject.asObservable();
  private currentPageSubject = new BehaviorSubject<number>(0);
  currentPage$ = this.currentPageSubject.asObservable();
  private showLogsSubject = new BehaviorSubject<boolean>(false);
  showLogs$ = this.showLogsSubject.asObservable();
  private fileStatusSubject = new BehaviorSubject<{ status: string, type: string, percent: number }>(undefined);
  fileStatus$ = this.fileStatusSubject.asObservable();
  readonly DataState = DataState;
  private modalRef: NgbModalRef;  // To handle modal references


  constructor(private router: Router, private clientService: ClientService, private modalService: NgbModal, private cdRef: ChangeDetectorRef) { }

  ngOnInit(): void {
    // Debug authentication status
    console.log('🔍 Clients Component - Authentication Debug:');
    console.log('- Token exists:', !!localStorage.getItem('TOKEN'));
    console.log('- Token value:', localStorage.getItem('TOKEN')?.substring(0, 50) + '...');
    console.log('- All localStorage keys:', Object.keys(localStorage));
    
    // Check if user service thinks we're authenticated
    const userService = this.clientService as any; // Access to check if we can get userService
    console.log('- UserService available:', !!userService);
    
    // Combine the clients and searchClients observables into one to prevent redundant state changes
    this.clientsState$ = this.clientService.clients$().pipe(
      switchMap(() => this.clientService.searchClients$()), // Combine both calls
      map(response => {
        console.log('✅ Client data received:', response);
        this.dataSubject.next(response);
        return { dataState: DataState.LOADED, appData: response };
      }),
      startWith({ dataState: DataState.LOADING }),
      distinctUntilChanged(), // Prevent re-emitting the same values
      shareReplay(1), // Cache the last emission to avoid redundant API calls
      catchError((error: string) => {
        console.error('❌ Client data error:', error);
        return of({ dataState: DataState.ERROR, error });
      })
    );
  }

  
  // Open the modal for creating a new client
  openNewClientModal(): void {
    this.modalRef = this.modalService.open(NewclientComponent, { size: 'md', backdrop: 'static' });

    // Listen for when the modal is closed and a new client is created
    this.modalRef.componentInstance.clientCreated.subscribe((newClient: any) => {
      this.onClientCreated(newClient);
    });
  }

  // Method called when a new client is created
  onClientCreated(newClient: any): void {
    // Make API call to create the client on the backend
    this.clientService.newClient$(newClient).subscribe(() => {
      this.loadClients();  // Refresh client list after adding new client
    });

    // Optionally, close the modal
    if (this.modalRef) {
      this.modalRef.close();
    }
  }

  // Load clients based on the current page
  loadClients(): void {
    this.clientsState$ = this.clientService.clients$(this.currentPageSubject.value)
      .pipe(
        map(response => {
          this.dataSubject.next(response);  // Update the data
          return { dataState: DataState.LOADED, appData: response };
        }),
        startWith({ dataState: DataState.LOADING }),
        catchError((error: string) => {
          return of({ dataState: DataState.ERROR, error });
        })
      );
  }

  searchClients(searchForm: NgForm): void {
    this.currentPageSubject.next(0);
    this.clientsState$ = this.clientService.searchClients$(searchForm.value.name)
      .pipe(
        map(response => {
          console.log(response);
          this.dataSubject.next(response);
          return { dataState: DataState.LOADED, appData: response };
        }),
        startWith({ dataState: DataState.LOADED, appData: this.dataSubject.value }),
        catchError((error: string) => {
          return of({ dataState: DataState.ERROR, error })
        })
      )
  }

  deleteClient(clientId: number): void {
  // Show confirmation dialog using SweetAlert2
  Swal.fire({
    title: 'Are you sure?',
    text: 'Do you want to delete this client?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Yes, delete it!',
    cancelButtonText: 'No, cancel!',
    reverseButtons: true
  }).then((result) => {
    if (result.isConfirmed) {
      // If user confirms, proceed with deletion
      this.clientService.deleteClient$(clientId).subscribe(
        () => {
          console.log(`Client ${clientId} deleted successfully`);

          // Show success message using SweetAlert2
          Swal.fire({
            title: 'Deleted!',
            text: 'The client has been deleted successfully.',
            icon: 'success',
            timer: 2000,
            timerProgressBar: true,
            showConfirmButton: false
          });

          // Reload the first page of clients after deletion
          this.goToPage(0);

          // Optionally, trigger change detection manually
          this.cdRef.detectChanges();
        },
        error => {
          console.error('Error deleting client:', error);

          // Detect if the error is a permission issue
          const errorMessage = error || 'There was a problem deleting the client.';

          // Show the error message using SweetAlert2
          Swal.fire({
            title: 'Error!',
            text: errorMessage,
            icon: 'error',
            confirmButtonText: 'OK'
          });
        }
      );
    } else if (result.dismiss === Swal.DismissReason.cancel) {
      // If user cancels, show cancellation message
      Swal.fire({
        title: 'Cancelled',
        text: 'Your client is safe :)',
        icon: 'info',
        timer: 2000,
        timerProgressBar: true,
        showConfirmButton: false
      });
    }
  });
}

  

  goToPage(pageNumber?: number, name?: string): void {
    this.clientsState$ = this.clientService.searchClients$(name, pageNumber)
      .pipe(
        map(response => {
          console.log(response);
          this.dataSubject.next(response);
          this.currentPageSubject.next(pageNumber);
          return { dataState: DataState.LOADED, appData: response };
        }),
        startWith({ dataState: DataState.LOADED, appData: this.dataSubject.value }),
        catchError((error: string) => {
          return of({ dataState: DataState.LOADED, error, appData: this.dataSubject.value })
        })
      )
  }

  goToNextOrPreviousPage(direction?: string, name?: string): void {
    this.goToPage(direction === 'forward' ? this.currentPageSubject.value + 1 : this.currentPageSubject.value - 1, name);
  }

  selectClient(client: Client): void {
    this.router.navigate([`/clients/${client.id}`]);
  }

  report(): void {
    this.clientsState$ = this.clientService.downloadReport$()
      .pipe(
        map(response => {
          console.log(response);
          this.reportProgress(response);
          return { dataState: DataState.LOADED, appData: this.dataSubject.value };
        }),
        startWith({ dataState: DataState.LOADED, appData: this.dataSubject.value }),
        catchError((error: string) => {
          return of({ dataState: DataState.LOADED, error, appData: this.dataSubject.value })
        })
      )
  }

  private reportProgress(httpEvent: HttpEvent<string[] | Blob>): void {
    switch (httpEvent.type) {
      case HttpEventType.DownloadProgress || HttpEventType.UploadProgress:
        this.fileStatusSubject.next({ status: 'progress', type: 'Downloading...', percent: Math.round(100 * httpEvent.loaded / httpEvent.total) });
        break;
      case HttpEventType.ResponseHeader:
        console.log('Got response Headers', httpEvent);
        break;
      case HttpEventType.Response:
        saveAs(new File([<Blob>httpEvent.body], httpEvent.headers.get('File-Name'),
          { type: `${httpEvent.headers.get('Content-Type')};charset=utf-8` }));
        this.fileStatusSubject.next(undefined);
        break;
      default:
        console.log(httpEvent);
        break;
    }
  }

    /**
* Open modal
* @param content modal content
*/
// Open Modal with proper options
openModal(content: any) {
  this.modalService.open(content, {
    ariaLabelledBy: 'modal-basic-title',
    backdrop: 'static',  // This ensures the backdrop is properly handled
    keyboard: false      // Optional: Prevent closing the modal with the Esc key
  });
}



}
