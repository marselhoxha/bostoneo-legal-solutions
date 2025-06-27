import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { environment } from 'src/environments/environment';
import { Key } from 'src/app/enum/key.enum';

export interface Task {
  id: number;
  title: string;
  description?: string;
  dueDate: string;
  priority: 'Low' | 'Medium' | 'High';
  status: 'Pending' | 'In Progress' | 'Completed';
  assignedTo?: string;
  caseId?: number;
  createdDate?: string;
}

@Injectable({
  providedIn: 'root'
})
export class TaskService {
  private apiUrl = `${environment.apiUrl}/api/tasks`;

  constructor(private http: HttpClient) { }

  // Helper method to get auth headers
  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem(Key.TOKEN);
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  /**
   * Get all tasks
   * @param page Page number (optional)
   * @param size Page size (optional)
   * @returns Observable of tasks
   */
  getAllTasks(page = 0, size = 10): Observable<any> {
    // For now, return mock data since backend might not have tasks endpoint
    const mockTasks: Task[] = [
      {
        id: 1,
        title: 'Prepare meeting agenda',
        description: 'Prepare agenda for client meeting on Smith vs. Jones case',
        dueDate: '2024-01-24',
        priority: 'High',
        status: 'Pending',
        assignedTo: 'John Smith',
        caseId: 1,
        createdDate: '2024-01-20'
      },
      {
        id: 2,
        title: 'File court documents',
        description: 'File motion to dismiss for ABC Corp case',
        dueDate: '2024-01-25',
        priority: 'Medium',
        status: 'In Progress',
        assignedTo: 'Jane Doe',
        caseId: 2,
        createdDate: '2024-01-21'
      },
      {
        id: 3,
        title: 'Schedule depositions',
        description: 'Schedule depositions for witnesses in Johnson case',
        dueDate: '2024-01-26',
        priority: 'High',
        status: 'Pending',
        assignedTo: 'Mike Johnson',
        caseId: 3,
        createdDate: '2024-01-22'
      }
    ];

    return of({
      data: {
        tasks: mockTasks,
        totalElements: mockTasks.length,
        totalPages: 1,
        currentPage: page
      }
    });
  }

  /**
   * Get task by ID
   * @param id Task ID
   * @returns Observable of task
   */
  getTaskById(id: number): Observable<Task> {
    const mockTask: Task = {
      id: id,
      title: 'Sample Task',
      description: 'This is a sample task',
      dueDate: '2024-01-25',
      priority: 'Medium',
      status: 'Pending',
      assignedTo: 'User',
      createdDate: '2024-01-20'
    };

    return of(mockTask);
  }

  /**
   * Create a new task
   * @param task Task data
   * @returns Observable of created task
   */
  createTask(task: Partial<Task>): Observable<Task> {
    const newTask: Task = {
      id: Math.floor(Math.random() * 1000),
      title: task.title || 'New Task',
      description: task.description || '',
      dueDate: task.dueDate || new Date().toISOString().split('T')[0],
      priority: task.priority || 'Medium',
      status: task.status || 'Pending',
      assignedTo: task.assignedTo || '',
      caseId: task.caseId,
      createdDate: new Date().toISOString().split('T')[0]
    };

    return of(newTask);
  }

  /**
   * Update a task
   * @param id Task ID
   * @param task Updated task data
   * @returns Observable of updated task
   */
  updateTask(id: number, task: Partial<Task>): Observable<Task> {
    const updatedTask: Task = {
      id: id,
      title: task.title || 'Updated Task',
      description: task.description || '',
      dueDate: task.dueDate || new Date().toISOString().split('T')[0],
      priority: task.priority || 'Medium',
      status: task.status || 'Pending',
      assignedTo: task.assignedTo || '',
      caseId: task.caseId,
      createdDate: '2024-01-20'
    };

    return of(updatedTask);
  }

  /**
   * Delete a task
   * @param id Task ID
   * @returns Observable of void
   */
  deleteTask(id: number): Observable<void> {
    return of(void 0);
  }

  /**
   * Get tasks by priority
   * @param priority Task priority
   * @returns Observable of tasks
   */
  getTasksByPriority(priority: 'Low' | 'Medium' | 'High'): Observable<Task[]> {
    const mockTasks: Task[] = [
      {
        id: 1,
        title: 'High Priority Task',
        dueDate: '2024-01-24',
        priority: priority,
        status: 'Pending'
      },
      {
        id: 2,
        title: 'Another Task',
        dueDate: '2024-01-25',
        priority: priority,
        status: 'In Progress'
      }
    ];

    return of(mockTasks.filter(task => task.priority === priority));
  }

  /**
   * Get tasks by status
   * @param status Task status
   * @returns Observable of tasks
   */
  getTasksByStatus(status: 'Pending' | 'In Progress' | 'Completed'): Observable<Task[]> {
    const mockTasks: Task[] = [
      {
        id: 1,
        title: 'Pending Task',
        dueDate: '2024-01-24',
        priority: 'High',
        status: status
      }
    ];

    return of(mockTasks.filter(task => task.status === status));
  }
} 