import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { StateCourtConfig } from '../../modules/organization-management/models/organization.model';

@Injectable({ providedIn: 'root' })
export class StateCourtConfigService {
  private readonly baseUrl = `${environment.apiUrl}/api/admin/state-court-configs`;

  constructor(private http: HttpClient) {}

  getConfigs(stateCode?: string): Observable<StateCourtConfig[]> {
    let params = new HttpParams();
    if (stateCode) {
      params = params.set('stateCode', stateCode);
    }
    return this.http.get<any>(this.baseUrl, { params }).pipe(
      map(res => res?.data || [])
    );
  }

  getConfigById(id: number): Observable<StateCourtConfig> {
    return this.http.get<any>(`${this.baseUrl}/${id}`).pipe(
      map(res => res?.data)
    );
  }

  updateConfig(id: number, data: Partial<StateCourtConfig>): Observable<StateCourtConfig> {
    return this.http.put<any>(`${this.baseUrl}/${id}`, data).pipe(
      map(res => res?.data)
    );
  }

  createConfig(data: Partial<StateCourtConfig>): Observable<StateCourtConfig> {
    return this.http.post<any>(this.baseUrl, data).pipe(
      map(res => res?.data)
    );
  }

  verifyConfig(id: number): Observable<StateCourtConfig> {
    return this.http.put<any>(`${this.baseUrl}/${id}/verify`, {}).pipe(
      map(res => res?.data)
    );
  }
}
