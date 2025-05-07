import { Component, OnInit } from '@angular/core';
import { ExpenseCategoryService } from '../../services/expense-category.service';

@Component({
  selector: 'app-expense-category',
  templateUrl: './expense-category.component.html',
  styleUrls: ['./expense-category.component.scss']
})
export class ExpenseCategoryComponent implements OnInit {
  categories: any[] = [];
  loading = true;
  error: string | null = null;
  
  constructor(private categoryService: ExpenseCategoryService) {}
  
  ngOnInit(): void {
    this.loadCategories();
  }
  
  loadCategories(): void {
    this.loading = true;
    this.error = null;
    
    this.categoryService.getAllCategories().subscribe({
      next: (data) => {
        this.categories = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading categories', err);
        this.error = 'Failed to load expense categories. Please try again later.';
        this.loading = false;
      }
    });
  }
  
  // Add additional methods for category CRUD operations as needed
} 