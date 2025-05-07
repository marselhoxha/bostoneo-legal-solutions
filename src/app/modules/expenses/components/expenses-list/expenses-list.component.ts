import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { ExpensesService } from '../../../../service/expenses.service';
import { Expense } from '../../../../interface/expense.interface';
import { formatDate } from '@angular/common';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-expenses-list',
  templateUrl: './expenses-list.component.html',
  styleUrls: ['./expenses-list.component.scss']
})
export class ExpensesListComponent implements OnInit {
  expenses: Expense[] = [];
  loading = false;
  error: string | null = null;
  
  // Pagination
  currentPage = 0;
  pageSize = 10;
  totalItems = 0;
  totalPages = 0;

  constructor(
    private expensesService: ExpensesService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadExpenses(this.currentPage);
  }

  loadExpenses(page: number): void {
    this.loading = true;
    this.error = null;
    this.cdr.detectChanges();
    
    this.expensesService.getExpenses(page, this.pageSize).subscribe({
      next: (response) => {
        if (response && response.data) {
          this.expenses = response.data.content || [];
          if (this.expenses.length > 0) {
            console.log('First expense structure:', JSON.stringify(this.expenses[0]));
          }
          this.totalItems = response.data.totalElements || 0;
          this.totalPages = response.data.totalPages || 0;
          this.currentPage = response.data.number || 0;
        } else {
          this.expenses = [];
          this.error = 'Invalid response format from server';
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.error = error.message || 'Failed to load expenses';
        this.expenses = [];
        this.loading = false;
        this.cdr.detectChanges();
      },
      complete: () => {
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  goToPage(page: number): void {
    if (page >= 0 && page < this.totalPages) {
      this.loadExpenses(page);
    }
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i);
  }

  editExpense(id: number): void {
    this.router.navigate(['/expenses/edit', id]);
  }

  viewExpense(id: number): void {
    this.router.navigate(['/expenses/details', id]);
  }

  deleteExpense(id: number): void {
    Swal.fire({
      title: 'Are you sure?',
      text: 'You will not be able to recover this expense!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'No, cancel!',
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      reverseButtons: true
    }).then((result) => {
      if (result.isConfirmed) {
        this.loading = true;
        this.cdr.detectChanges();
        
      this.expensesService.deleteExpense(id).subscribe({
        next: () => {
            Swal.fire({
              title: 'Deleted!',
              text: 'Expense has been successfully deleted.',
              icon: 'success',
              timer: 2000,
              timerProgressBar: true,
              showConfirmButton: false
            });
          this.loadExpenses(this.currentPage);
        },
        error: (error) => {
            this.loading = false;
            Swal.fire({
              title: 'Error!',
              text: error.message || 'Failed to delete expense',
              icon: 'error'
            });
          this.error = error.message || 'Failed to delete expense';
            this.cdr.detectChanges();
        }
      });
    }
    });
  }

  exportExpenses(): void {
    // Implement export functionality
    console.log('Exporting expenses...');
  }

  formatCurrency(amount: number, currency: string): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency }).format(amount);
  }

  formatDate(date: string): string {
    return formatDate(date, 'mediumDate', 'en-US');
  }
} 