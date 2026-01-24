import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CustomHttpResponse as ApiResponse } from '../interface/custom-http-response';
import { 
  CaseTask, 
  TaskCreateRequest, 
  TaskUpdateRequest,
  TaskComment,
  TaskStatistics,
  TaskFilter
} from '../interface/case-task';
import { catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class CaseTaskService {
  private readonly apiUrl = 'http://localhost:8085/api/legal';

  constructor(private http: HttpClient) {}

  // Task CRUD Operations
  createTask(task: TaskCreateRequest): Observable<ApiResponse<{task: CaseTask}>> {
    return this.http.post<ApiResponse<{task: CaseTask}>>(
      `${this.apiUrl}/tasks`, 
      task
    );
  }

  updateTask(taskId: number, task: TaskUpdateRequest): Observable<ApiResponse<CaseTask>> {
    // Validate taskId to prevent undefined in URL
    if (!taskId || taskId === undefined || taskId === null || isNaN(taskId)) {
      console.error('CaseTaskService.updateTask: Invalid taskId:', taskId);
      throw new Error('Invalid task ID provided to updateTask');
    }

    return this.http.put<ApiResponse<CaseTask>>(
      `${this.apiUrl}/tasks/${taskId}`,
      task
    );
  }

  deleteTask(taskId: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(
      `${this.apiUrl}/tasks/${taskId}`
    );
  }

  getTask(taskId: number): Observable<ApiResponse<CaseTask>> {
    return this.http.get<ApiResponse<CaseTask>>(
      `${this.apiUrl}/tasks/${taskId}`
    );
  }

  // Task Listing and Filtering
  getTasksByCaseId(caseId: number, page: number = 0, size: number = 100): Observable<ApiResponse<any>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sortBy', 'createdAt')
      .set('sortDirection', 'DESC');

    const url = `${this.apiUrl}/tasks/case/${caseId}`;

    return this.http.get<ApiResponse<any>>(url, { params })
      .pipe(
        catchError(error => {
          console.error('CaseTaskService - Error in getTasksByCaseId:', error);
          throw error;
        })
      );
  }

  getAllTasks(page: number = 0, size: number = 100): Observable<ApiResponse<any>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sortBy', 'createdAt')
      .set('sortDirection', 'DESC');

    const url = `${this.apiUrl}/tasks`;

    return this.http.get<ApiResponse<any>>(url, { params })
      .pipe(
        map(response => {
          // Backend returns { data: { tasks: Page } }
          // Return the response with tasks in the expected format
          return {
            ...response,
            data: {
              tasks: response.data?.tasks || { content: [], totalElements: 0 }
            }
          };
        }),
        catchError(error => {
          console.error('CaseTaskService - Error in getAllTasks:', error);
          throw error;
        })
      );
  }

  getUserTasks(userId: number, filter: TaskFilter): Observable<ApiResponse<CaseTask[]>> {
    let params = new HttpParams()
      .set('page', filter.page?.toString() || '0')
      .set('size', filter.size?.toString() || '10');

    if (filter.status) {
      params = params.set('status', filter.status);
    }
    if (filter.priority) {
      params = params.set('priority', filter.priority);
    }
    if (filter.dueDate) {
      params = params.set('dueDate', filter.dueDate);
    }

    return this.http.get<ApiResponse<any>>(
      `${this.apiUrl}/tasks/user/${userId}`,
      { params }
    ).pipe(
      map(response => ({
        ...response,
        // Backend returns { data: { tasks: Page } } where Page has content array
        data: response.data?.tasks?.content || response.data?.tasks || []
      }))
    );
  }

  getOverdueTasks(userId: number): Observable<ApiResponse<CaseTask[]>> {
    return this.http.get<ApiResponse<CaseTask[]>>(
      `${this.apiUrl}/tasks/user/${userId}/overdue`
    );
  }

  getUpcomingTasks(userId: number, days: number = 7): Observable<ApiResponse<CaseTask[]>> {
    return this.http.get<ApiResponse<CaseTask[]>>(
      `${this.apiUrl}/tasks/user/${userId}/upcoming/${days}`
    );
  }

  // Task Actions
  updateTaskStatus(taskId: number, status: string): Observable<ApiResponse<CaseTask>> {
    const params = new HttpParams().set('status', status);
    
    return this.http.post<ApiResponse<CaseTask>>(
      `${this.apiUrl}/tasks/${taskId}/status`,
      {},
      { params }
    );
  }

  assignTask(taskId: number, userId: number): Observable<ApiResponse<CaseTask>> {
    // Validate inputs to prevent undefined in URL
    if (!taskId || taskId === undefined || taskId === null || isNaN(taskId)) {
      console.error('CaseTaskService.assignTask: Invalid taskId:', taskId);
      throw new Error('Invalid task ID provided to assignTask');
    }

    if (!userId || userId === undefined || userId === null || isNaN(userId)) {
      console.error('CaseTaskService.assignTask: Invalid userId:', userId);
      throw new Error('Invalid user ID provided to assignTask');
    }

    return this.http.post<ApiResponse<CaseTask>>(
      `${this.apiUrl}/tasks/${taskId}/assign/${userId}`,
      {}
    );
  }

  addComment(taskId: number, comment: string): Observable<ApiResponse<TaskComment>> {
    return this.http.post<ApiResponse<TaskComment>>(
      `${this.apiUrl}/tasks/${taskId}/comments`,
      { comment }
    );
  }

  // Task Dependencies
  addDependency(taskId: number, dependsOnTaskId: number): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(
      `${this.apiUrl}/tasks/${taskId}/dependencies/${dependsOnTaskId}`,
      {}
    );
  }

  removeDependency(taskId: number, dependsOnTaskId: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(
      `${this.apiUrl}/tasks/${taskId}/dependencies/${dependsOnTaskId}`
    );
  }

  // Subtasks
  createSubtask(parentTaskId: number, subtask: TaskCreateRequest): Observable<ApiResponse<CaseTask>> {
    return this.http.post<ApiResponse<CaseTask>>(
      `${this.apiUrl}/tasks/${parentTaskId}/subtasks`,
      subtask
    );
  }

  getSubtasks(parentTaskId: number): Observable<ApiResponse<CaseTask[]>> {
    return this.http.get<ApiResponse<CaseTask[]>>(
      `${this.apiUrl}/tasks/${parentTaskId}/subtasks`
    );
  }

  // Task Statistics
  getTaskStatistics(caseId: number): Observable<ApiResponse<TaskStatistics>> {
    return this.http.get<ApiResponse<TaskStatistics>>(
      `${this.apiUrl}/tasks/statistics/case/${caseId}`
    );
  }

  getUserTaskStatistics(userId: number): Observable<ApiResponse<TaskStatistics>> {
    return this.http.get<ApiResponse<TaskStatistics>>(
      `${this.apiUrl}/tasks/statistics/user/${userId}`
    );
  }

  // Batch Operations
  batchUpdateStatus(taskIds: number[], status: string): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(
      `${this.apiUrl}/tasks/batch/status`,
      { taskIds, status }
    );
  }

  batchAssign(taskIds: number[], userId: number): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(
      `${this.apiUrl}/tasks/batch/assign`,
      { taskIds, userId }
    );
  }
}