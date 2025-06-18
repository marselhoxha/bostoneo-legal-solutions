import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CustomHttpResponse, Page } from '../interface/appstates';
import { InvoiceWorkflowRule, InvoiceWorkflowExecution, InvoiceReminder } from '../interface/invoice-workflow';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class InvoiceWorkflowService {
  private readonly baseUrl = `${environment.apiUrl}/api/invoice-workflows`;

  constructor(private http: HttpClient) {}

  getWorkflowRules(): Observable<CustomHttpResponse<InvoiceWorkflowRule[]>> {
    return this.http.get<CustomHttpResponse<InvoiceWorkflowRule[]>>(`${this.baseUrl}/rules`);
  }

  getWorkflowRule(id: number): Observable<CustomHttpResponse<InvoiceWorkflowRule>> {
    return this.http.get<CustomHttpResponse<InvoiceWorkflowRule>>(`${this.baseUrl}/rules/${id}`);
  }

  toggleWorkflowRule(id: number): Observable<CustomHttpResponse<InvoiceWorkflowRule>> {
    return this.http.put<CustomHttpResponse<InvoiceWorkflowRule>>(`${this.baseUrl}/rules/${id}/toggle`, {});
  }

  getExecutions(page = 0, size = 20): Observable<CustomHttpResponse<Page<InvoiceWorkflowExecution>>> {
    return this.http.get<CustomHttpResponse<Page<InvoiceWorkflowExecution>>>(`${this.baseUrl}/executions`, {
      params: { page: page.toString(), size: size.toString() }
    });
  }

  getInvoiceExecutions(invoiceId: number): Observable<CustomHttpResponse<InvoiceWorkflowExecution[]>> {
    return this.http.get<CustomHttpResponse<InvoiceWorkflowExecution[]>>(`${this.baseUrl}/executions/invoice/${invoiceId}`);
  }
  
  getWorkflowExecutions(workflowId: number): Observable<CustomHttpResponse<InvoiceWorkflowExecution[]>> {
    return this.http.get<CustomHttpResponse<InvoiceWorkflowExecution[]>>(`${this.baseUrl}/executions/workflow/${workflowId}`);
  }

  getReminders(page = 0, size = 20): Observable<CustomHttpResponse<Page<InvoiceReminder>>> {
    return this.http.get<CustomHttpResponse<Page<InvoiceReminder>>>(`${this.baseUrl}/reminders`, {
      params: { page: page.toString(), size: size.toString() }
    });
  }

  getInvoiceReminders(invoiceId: number): Observable<CustomHttpResponse<InvoiceReminder[]>> {
    return this.http.get<CustomHttpResponse<InvoiceReminder[]>>(`${this.baseUrl}/reminders/invoice/${invoiceId}`);
  }
  
  updateWorkflowConfig(id: number, config: any): Observable<CustomHttpResponse<InvoiceWorkflowRule>> {
    return this.http.put<CustomHttpResponse<InvoiceWorkflowRule>>(`${this.baseUrl}/rules/${id}/config`, config);
  }
}