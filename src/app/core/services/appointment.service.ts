import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface AttorneyAvailability {
  id?: number;
  attorneyId: number;
  dayOfWeek: number;
  dayName?: string;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  bufferMinutes: number;
  isActive: boolean;
}

export interface AvailableSlot {
  startTime: string;
  endTime: string;
  durationMinutes: number;
  attorneyId: number;
  attorneyName: string;
  available: boolean;
}

export interface AppointmentRequest {
  id?: number;
  calendarEventId?: number;
  caseId?: number;
  caseNumber?: string;
  clientId: number;
  clientName?: string;
  attorneyId: number;
  attorneyName?: string;
  title: string;
  description?: string;
  appointmentType: string;
  preferredDatetime: string;
  alternativeDatetime?: string;
  durationMinutes: number;
  isVirtual: boolean;
  meetingLink?: string;
  location?: string;
  status?: string;
  notes?: string;
  attorneyNotes?: string;
  confirmedDatetime?: string;
  cancelledBy?: string;
  cancellationReason?: string;
  // Reschedule request fields
  requestedRescheduleTime?: string;
  rescheduleReason?: string;
  originalConfirmedTime?: string;
  createdAt?: string;
  updatedAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AppointmentService {
  private apiUrl = `${environment.apiUrl}/api`;

  constructor(private http: HttpClient) {}

  // =====================================================
  // ATTORNEY AVAILABILITY ENDPOINTS
  // =====================================================

  getMyAvailability(): Observable<AttorneyAvailability[]> {
    return this.http.get<any>(`${this.apiUrl}/availability/me`)
      .pipe(map(response => response.data?.availability || []));
  }

  getAttorneyAvailability(attorneyId: number): Observable<AttorneyAvailability[]> {
    return this.http.get<any>(`${this.apiUrl}/availability/attorney/${attorneyId}`)
      .pipe(map(response => response.data?.availability || []));
  }

  setMyAvailability(availability: AttorneyAvailability[]): Observable<AttorneyAvailability[]> {
    return this.http.post<any>(`${this.apiUrl}/availability/me`, availability)
      .pipe(map(response => response.data?.availability || []));
  }

  updateAvailability(id: number, availability: AttorneyAvailability): Observable<AttorneyAvailability> {
    return this.http.put<any>(`${this.apiUrl}/availability/${id}`, availability)
      .pipe(map(response => response.data?.availability));
  }

  toggleDayActive(dayOfWeek: number, active: boolean): Observable<AttorneyAvailability> {
    return this.http.patch<any>(`${this.apiUrl}/availability/me/day/${dayOfWeek}?active=${active}`, {})
      .pipe(map(response => response.data?.availability));
  }

  initializeDefaultAvailability(): Observable<AttorneyAvailability[]> {
    return this.http.post<any>(`${this.apiUrl}/availability/me/initialize`, {})
      .pipe(map(response => response.data?.availability || []));
  }

  // =====================================================
  // AVAILABLE SLOTS ENDPOINTS
  // =====================================================

  getAvailableSlots(attorneyId: number, date: string, durationMinutes: number = 30): Observable<AvailableSlot[]> {
    return this.http.get<any>(`${this.apiUrl}/availability/slots/${attorneyId}`, {
      params: { date, durationMinutes: durationMinutes.toString() }
    }).pipe(map(response => response.data?.slots || []));
  }

  getAvailableSlotsForRange(attorneyId: number, startDate: string, endDate: string, durationMinutes: number = 30): Observable<AvailableSlot[]> {
    return this.http.get<any>(`${this.apiUrl}/availability/slots/${attorneyId}/range`, {
      params: { startDate, endDate, durationMinutes: durationMinutes.toString() }
    }).pipe(map(response => response.data?.slots || []));
  }

  // =====================================================
  // APPOINTMENT REQUEST ENDPOINTS (CLIENT)
  // =====================================================

  createAppointmentRequest(request: AppointmentRequest): Observable<AppointmentRequest> {
    return this.http.post<any>(`${this.apiUrl}/appointments/request`, request)
      .pipe(map(response => response.data?.appointment));
  }

  getClientAppointments(clientId: number, page: number = 0, size: number = 10): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/appointments/client/${clientId}`, {
      params: { page: page.toString(), size: size.toString() }
    }).pipe(map(response => response.data));
  }

  getClientUpcomingAppointments(clientId: number): Observable<AppointmentRequest[]> {
    return this.http.get<any>(`${this.apiUrl}/appointments/client/${clientId}/upcoming`)
      .pipe(map(response => response.data?.appointments || []));
  }

  getClientPendingAppointments(clientId: number): Observable<AppointmentRequest[]> {
    return this.http.get<any>(`${this.apiUrl}/appointments/client/${clientId}/pending`)
      .pipe(map(response => response.data?.appointments || []));
  }

  cancelAppointmentByClient(appointmentId: number, clientId: number, reason?: string): Observable<AppointmentRequest> {
    return this.http.post<any>(`${this.apiUrl}/appointments/${appointmentId}/cancel/client`, { reason }, {
      params: { clientId: clientId.toString() }
    }).pipe(map(response => response.data?.appointment));
  }

  // =====================================================
  // APPOINTMENT REQUEST ENDPOINTS (ATTORNEY)
  // =====================================================

  getAttorneyAppointments(page: number = 0, size: number = 10): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/appointments/attorney`, {
      params: { page: page.toString(), size: size.toString() }
    }).pipe(map(response => response.data));
  }

  getAttorneyPendingRequests(): Observable<{ appointments: AppointmentRequest[], count: number }> {
    return this.http.get<any>(`${this.apiUrl}/appointments/attorney/pending`)
      .pipe(map(response => response.data));
  }

  getAttorneyUpcomingAppointments(): Observable<AppointmentRequest[]> {
    return this.http.get<any>(`${this.apiUrl}/appointments/attorney/upcoming`)
      .pipe(map(response => response.data?.appointments || []));
  }

  confirmAppointment(appointmentId: number, confirmationDetails: Partial<AppointmentRequest>): Observable<AppointmentRequest> {
    return this.http.post<any>(`${this.apiUrl}/appointments/${appointmentId}/confirm`, confirmationDetails)
      .pipe(map(response => response.data?.appointment));
  }

  rescheduleAppointment(appointmentId: number, rescheduleDetails: Partial<AppointmentRequest>): Observable<AppointmentRequest> {
    return this.http.post<any>(`${this.apiUrl}/appointments/${appointmentId}/reschedule`, rescheduleDetails)
      .pipe(map(response => response.data?.appointment));
  }

  cancelAppointmentByAttorney(appointmentId: number, reason?: string): Observable<AppointmentRequest> {
    return this.http.post<any>(`${this.apiUrl}/appointments/${appointmentId}/cancel/attorney`, { reason })
      .pipe(map(response => response.data?.appointment));
  }

  completeAppointment(appointmentId: number, notes?: string): Observable<AppointmentRequest> {
    return this.http.post<any>(`${this.apiUrl}/appointments/${appointmentId}/complete`, { notes })
      .pipe(map(response => response.data?.appointment));
  }

  // =====================================================
  // RESCHEDULE REQUEST ENDPOINTS (ATTORNEY)
  // =====================================================

  getAttorneyPendingRescheduleRequests(): Observable<{ appointments: AppointmentRequest[], count: number }> {
    return this.http.get<any>(`${this.apiUrl}/appointments/attorney/pending-reschedules`)
      .pipe(map(response => response.data));
  }

  approveReschedule(appointmentId: number): Observable<AppointmentRequest> {
    return this.http.post<any>(`${this.apiUrl}/appointments/${appointmentId}/approve-reschedule`, {})
      .pipe(map(response => response.data?.appointment));
  }

  declineReschedule(appointmentId: number, reason?: string): Observable<AppointmentRequest> {
    return this.http.post<any>(`${this.apiUrl}/appointments/${appointmentId}/decline-reschedule`, { reason })
      .pipe(map(response => response.data?.appointment));
  }

  // =====================================================
  // CASE APPOINTMENTS
  // =====================================================

  getAppointmentsByCase(caseId: number): Observable<AppointmentRequest[]> {
    return this.http.get<any>(`${this.apiUrl}/appointments/case/${caseId}`)
      .pipe(map(response => response.data?.appointments || []));
  }

  // =====================================================
  // GENERAL
  // =====================================================

  getAppointmentById(id: number): Observable<AppointmentRequest> {
    return this.http.get<any>(`${this.apiUrl}/appointments/${id}`)
      .pipe(map(response => response.data?.appointment));
  }
}
