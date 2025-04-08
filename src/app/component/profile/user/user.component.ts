import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { NgForm } from '@angular/forms';
import { Router, NavigationEnd } from '@angular/router';
import { Observable, of, BehaviorSubject, map, startWith, catchError, Subject, takeUntil } from 'rxjs';
import { DataState } from 'src/app/enum/datastate.enum';
import { EventType } from 'src/app/enum/event-type.enum';
import { Key } from 'src/app/enum/key.enum';
import { CustomHttpResponse, Profile } from 'src/app/interface/appstates';
import { State } from 'src/app/interface/state';
import { NotificationService } from 'src/app/service/notification.service';
import { UserService } from 'src/app/service/user.service';

@Component({
  selector: 'app-profile',
  templateUrl: './user.component.html',
  styleUrls: ['./user.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserComponent implements OnInit, OnDestroy {
  profileState$: Observable<State<CustomHttpResponse<Profile>>>;
  private dataSubject = new BehaviorSubject<CustomHttpResponse<Profile>>(null);
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  isLoading$ = this.isLoadingSubject.asObservable();
  private showLogsSubject = new BehaviorSubject<boolean>(true);
  showLogs$ = this.showLogsSubject.asObservable();
  readonly DataState = DataState;
  readonly EventType = EventType;
  @ViewChild('profileForm') profileForm: NgForm;  // Access the form using ViewChild
  profileCompletion: number = 0;
  user: any = {};
  private destroy$ = new Subject<void>();

  constructor(
    private userService: UserService,
    private cdr: ChangeDetectorRef, 
    private noficationService: NotificationService,
    private router: Router
  ) { }

  ngOnInit(): void {
    // Force a fresh profile data load
    this.userService.refreshUserData();
    
    // Initialize the observable to fetch profile data
    this.profileState$ = this.userService.profile$()
      .pipe(
        map(response => {
          console.log('Profile data loaded:', response);
          // Update the dataSubject to store the latest response
          this.dataSubject.next(response);
  
          // Return the loaded state with the appData
          return { dataState: DataState.LOADED, appData: response };
        }),
        startWith({ dataState: DataState.LOADING }),
        catchError((error: string) => {
          this.noficationService.onError(error);
          return of({ dataState: DataState.ERROR, appData: this.dataSubject.value, error });
        })
      );
      
    // Subscribe to profileState$ to call updateProfileCompletion after data is loaded
    this.profileState$.pipe(takeUntil(this.destroy$)).subscribe(state => {
      if (state?.appData?.data?.user) {
        // Call the method to calculate profile completion once the profile data is loaded
        this.updateProfileCompletion(state.appData.data.user);
        // Force change detection
        this.cdr.detectChanges();
      }
    });

    // Subscribe to user data changes from the service
    this.userService.userData$.pipe(takeUntil(this.destroy$)).subscribe(user => {
      if (user) {
        console.log('User data updated:', user);
        // Update the data subject with the new user data
        this.dataSubject.next({
          ...this.dataSubject.value,
          data: {
            ...this.dataSubject.value?.data,
            user: user
          }
        });
        // Force change detection
        this.cdr.detectChanges();
      }
    });

    // Subscribe to router events to refresh data on navigation
    this.router.events.pipe(
      takeUntil(this.destroy$)
    ).subscribe(event => {
      if (event instanceof NavigationEnd) {
        // Force a refresh of user data when navigating to this component
        this.userService.refreshUserData();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngAfterViewInit(): void {
    // Start tracking form changes after the view has initialized
    this.trackInputChanges();
    
    // Force change detection to ensure the view is updated
    setTimeout(() => {
      this.cdr.detectChanges();
    }, 0);
  }
   // Function to calculate profile completion based on user and form data
   updateProfileCompletion(user: any): void {
    if (!user) return;
    
    const totalFields = 7;  // Total number of fields
    let completedFields = 0;

    // Get form values if available
    const form = this.profileForm;
    const formValues = form ? form.value : null;

    // Check initial user data and form values
    if (user?.firstName || (formValues?.firstName)) completedFields++;
    if (user?.lastName || (formValues?.lastName)) completedFields++;
    if (user?.phone || (formValues?.phone)) completedFields++;
    if (user?.email || (formValues?.email)) completedFields++;
    if (user?.address || (formValues?.address)) completedFields++;
    if (user?.title || (formValues?.title)) completedFields++;
    if (user?.bio || (formValues?.bio)) completedFields++;

    // Calculate profile completion percentage
    this.profileCompletion = Math.round((completedFields / totalFields) * 100);

    // Trigger change detection to ensure the view is updated
    this.cdr.detectChanges();
  }

  // Hook input changes manually to update profile completion dynamically
  trackInputChanges(): void {
    // Remove any existing event listeners to prevent duplicates
    const inputElements = document.querySelectorAll('input, textarea');
    inputElements.forEach((input) => {
      // Remove existing event listeners
      const newInput = input.cloneNode(true);
      input.parentNode.replaceChild(newInput, input);
      
      // Add new event listener
      newInput.addEventListener('input', () => {
        this.updateProfileCompletion(this.dataSubject.value?.data?.user);
      });
    });
  }

  // Reset profile completion to original value
  resetProfileCompletion(): void {
    if (this.dataSubject.value?.data?.user) {
      this.updateProfileCompletion(this.dataSubject.value.data.user);
    }
  }

  // Update profile completion when form values change
  onFormValueChange(): void {
    // Get the current form values
    const formValues = this.profileForm ? this.profileForm.value : null;
    
    // Create a merged user object with form values
    const mergedUser = {
      ...this.dataSubject.value?.data?.user,
      ...formValues
    };
    
    // Update profile completion with the merged user object
    this.updateProfileCompletion(mergedUser);
  }

  updateProfile(profileForm: NgForm): void {
    this.isLoadingSubject.next(true);
    this.profileState$ = this.userService.update$(profileForm.value)
      .pipe(
        map(response => {
          this.noficationService.onDefault(response.message);
          console.log(response);
          this.dataSubject.next({ ...response, data: response.data });
          
          // Update profile completion after successful update
          if (response?.data?.user) {
            // Use setTimeout to ensure the form is updated before calculating profile completion
            setTimeout(() => {
              this.onFormValueChange();
            }, 0);
          }
          
          this.isLoadingSubject.next(false);
          return { dataState: DataState.LOADED, appData: this.dataSubject.value };
        }),
        startWith({ dataState: DataState.LOADED, appData: this.dataSubject.value }),
        catchError((error: string) => {
          this.noficationService.onError(error);
          this.isLoadingSubject.next(false);
          return of({ dataState: DataState.LOADED, appData: this.dataSubject.value, error })
        })
      )
  }

  updatePassword(passwordForm: NgForm): void {
    this.isLoadingSubject.next(true);
  
    this.profileState$ = this.userService.updatePassword$(passwordForm.value)
      .pipe(
        map(response => {
          this.noficationService.onDefault(response.message);
          console.log(response);
          this.dataSubject.next({ ...response, data: response.data });
          passwordForm.reset();
          this.isLoadingSubject.next(false);
          return { dataState: DataState.LOADED, appData: this.dataSubject.value };
        }),
        startWith({ dataState: DataState.LOADED, appData: this.dataSubject.value }),
        catchError((error: any) => {
          // Ensure you're extracting the correct part of the error object
          const errorMessage = error || 'An error occurred';
          this.noficationService.onError(errorMessage);
          passwordForm.reset();
          this.isLoadingSubject.next(false);
          return of({ dataState: DataState.LOADED, appData: this.dataSubject.value, error: errorMessage });
        })
      );
  }

  updateRole(roleForm: NgForm): void {
    this.isLoadingSubject.next(true);
    this.profileState$ = this.userService.updateRoles$(roleForm.value.roleName)
      .pipe(
        map(response => {
          this.noficationService.onDefault(response.message);
          console.log(response);
          this.dataSubject.next({ ...response, data: response.data });
          this.isLoadingSubject.next(false);
          return { dataState: DataState.LOADED, appData: this.dataSubject.value };
        }),
        startWith({ dataState: DataState.LOADED, appData: this.dataSubject.value }),
        catchError((error: string) => {
          this.noficationService.onError(error);
          this.isLoadingSubject.next(false);
          return of({ dataState: DataState.LOADED, appData: this.dataSubject.value, error })
        })
      )
  }

  updateAccountSettings(settingsForm: NgForm): void {
    this.isLoadingSubject.next(true);
    this.profileState$ = this.userService.updateAccountSettings$(settingsForm.value)
      .pipe(
        map(response => {
          this.noficationService.onDefault(response.message);
          console.log(response);
          this.dataSubject.next({ ...response, data: response.data });
          this.isLoadingSubject.next(false);
          return { dataState: DataState.LOADED, appData: this.dataSubject.value };
        }),
        startWith({ dataState: DataState.LOADED, appData: this.dataSubject.value }),
        catchError((error: string) => {
          this.noficationService.onError(error);
          this.isLoadingSubject.next(false);
          return of({ dataState: DataState.LOADED, appData: this.dataSubject.value, error })
        })
      )
  }
  

  toggleMfa(): void {
    this.isLoadingSubject.next(true);
    this.profileState$ = this.userService.toggleMfa$()
      .pipe(
        map(response => {
          this.noficationService.onDefault(response.message);
          console.log(response);
          this.dataSubject.next({ ...response, data: response.data });
          this.isLoadingSubject.next(false);
          return { dataState: DataState.LOADED, appData: this.dataSubject.value };
        }),
        startWith({ dataState: DataState.LOADED, appData: this.dataSubject.value }),
        catchError((error: string) => {
          this.noficationService.onError(error);
          this.isLoadingSubject.next(false);
          return of({ dataState: DataState.LOADED, appData: this.dataSubject.value, error })
        })
      )
  }

  updatePicture(image: File): void {
    if (image) {
      this.isLoadingSubject.next(true);
      this.profileState$ = this.userService.updateImage$(this.getFormData(image))
        .pipe(
          map(response => {
            this.noficationService.onDefault(response.message);
            console.log(response);
            
            // Update the user data in the service with a timestamp to force cache refresh
            const updatedUser = {
              ...response.data.user,
              imageUrl: `${response.data.user.imageUrl}?time=${new Date().getTime()}`
            };
            this.userService.setUserData(updatedUser);
            
            // Update the local data subject
            this.dataSubject.next({ 
              ...response, 
              data: { 
                ...response.data, 
                user: updatedUser
              }
            });
            
            this.isLoadingSubject.next(false);
            return { dataState: DataState.LOADED, appData: this.dataSubject.value };
          }),
          startWith({ dataState: DataState.LOADED, appData: this.dataSubject.value }),
          catchError((error: string) => {
            this.noficationService.onError(error);
            this.isLoadingSubject.next(false);
            return of({ dataState: DataState.LOADED, appData: this.dataSubject.value, error })
          })
        )
    }
  }

  toggleLogs(): void {
    this.showLogsSubject.next(!this.showLogsSubject.value);
  }

  private getFormData(image: File): FormData {
    const formData = new FormData();
    formData.append('image', image);
    return formData;
  }

}
