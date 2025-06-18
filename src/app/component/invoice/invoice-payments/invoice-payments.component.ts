import { Component, Input, OnInit, ViewChild } from '@angular/core';
import { InvoicePayment } from '../../../interface/invoice-payment';
import { InvoicePaymentService } from '../../../service/invoice-payment.service';
import { NgForm } from '@angular/forms';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-invoice-payments',
  templateUrl: './invoice-payments.component.html',
  styleUrls: ['./invoice-payments.component.css']
})
export class InvoicePaymentsComponent implements OnInit {
  @Input() invoiceId!: number;
  @Input() invoiceTotal!: number;
  @ViewChild('paymentForm') paymentForm!: NgForm;
  
  payments: InvoicePayment[] = [];
  showAddPayment = false;
  isLoading = false;
  totalPaid = 0;
  balanceDue = 0;
  
  newPayment: InvoicePayment = {
    invoiceId: 0,
    paymentDate: new Date().toISOString().split('T')[0],
    amount: 0,
    paymentMethod: 'CHECK',
    referenceNumber: '',
    notes: ''
  };
  
  paymentMethods = [
    { value: 'CHECK', label: 'Check' },
    { value: 'CREDIT_CARD', label: 'Credit Card' },
    { value: 'DEBIT_CARD', label: 'Debit Card' },
    { value: 'ACH', label: 'ACH Transfer' },
    { value: 'WIRE', label: 'Wire Transfer' },
    { value: 'CASH', label: 'Cash' },
    { value: 'OTHER', label: 'Other' }
  ];

  constructor(private paymentService: InvoicePaymentService) { }

  ngOnInit(): void {
    this.loadPayments();
  }

  loadPayments(): void {
    this.isLoading = true;
    this.paymentService.getPaymentsByInvoiceId(this.invoiceId).subscribe({
      next: (response) => {
        this.payments = response.data || [];
        this.calculateTotals();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading payments:', error);
        this.isLoading = false;
      }
    });
  }

  calculateTotals(): void {
    this.totalPaid = this.payments.reduce((sum, payment) => sum + payment.amount, 0);
    this.balanceDue = this.invoiceTotal - this.totalPaid;
  }

  toggleAddPayment(): void {
    this.showAddPayment = !this.showAddPayment;
    if (this.showAddPayment) {
      this.newPayment.invoiceId = this.invoiceId;
      this.newPayment.amount = this.balanceDue > 0 ? this.balanceDue : 0;
    }
  }

  addPayment(): void {
    if (!this.paymentForm.valid) {
      return;
    }

    this.isLoading = true;
    this.paymentService.createPayment(this.invoiceId, this.newPayment).subscribe({
      next: (response) => {
        Swal.fire({
          icon: 'success',
          title: 'Success',
          text: 'Payment recorded successfully',
          timer: 2000,
          showConfirmButton: false
        });
        
        this.payments.unshift(response.data);
        this.calculateTotals();
        this.resetForm();
        this.isLoading = false;
      },
      error: (error) => {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: error.error?.message || 'Failed to record payment'
        });
        this.isLoading = false;
      }
    });
  }

  deletePayment(payment: InvoicePayment): void {
    Swal.fire({
      title: 'Delete Payment?',
      text: `Are you sure you want to delete this payment of $${payment.amount}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
      if (result.isConfirmed && payment.id) {
        this.isLoading = true;
        this.paymentService.deletePayment(payment.id).subscribe({
          next: () => {
            Swal.fire({
              icon: 'success',
              title: 'Deleted!',
              text: 'Payment has been deleted.',
              timer: 2000,
              showConfirmButton: false
            });
            
            this.payments = this.payments.filter(p => p.id !== payment.id);
            this.calculateTotals();
            this.isLoading = false;
          },
          error: (error) => {
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: error.error?.message || 'Failed to delete payment'
            });
            this.isLoading = false;
          }
        });
      }
    });
  }

  resetForm(): void {
    this.showAddPayment = false;
    this.newPayment = {
      invoiceId: this.invoiceId,
      paymentDate: new Date().toISOString().split('T')[0],
      amount: 0,
      paymentMethod: 'CHECK',
      referenceNumber: '',
      notes: ''
    };
    if (this.paymentForm) {
      this.paymentForm.resetForm();
    }
  }

  getPaymentStatusClass(): string {
    if (this.balanceDue <= 0) {
      return 'text-success';
    } else if (this.totalPaid > 0) {
      return 'text-warning';
    } else {
      return 'text-danger';
    }
  }

  getPaymentStatus(): string {
    if (this.balanceDue <= 0) {
      return 'PAID';
    } else if (this.totalPaid > 0) {
      return 'PARTIAL';
    } else {
      return 'UNPAID';
    }
  }
}