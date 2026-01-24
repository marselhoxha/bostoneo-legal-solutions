import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { InvoiceService } from '../../service/invoice.service';
import { PaymentService } from '../../service/payment.service';
import { AuthService } from '../../service/auth.service';
import { Invoice } from '../../interface/invoice';
import { PaymentIntentDTO } from '../../interface/payment-intent';

@Component({
  selector: 'app-client-portal',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './client-portal.component.html',
  styleUrls: ['./client-portal.component.css']
})
export class ClientPortalComponent implements OnInit {
  invoices: Invoice[] = [];
  selectedInvoice: Invoice | null = null;
  clientId: number | null = null;
  loading = false;
  paymentProcessing = false;
  
  // Payment form
  paymentAmount: number = 0;
  paymentMethod: string = 'card';
  
  // Stripe elements placeholder
  stripeCardElement: any;
  
  constructor(
    private invoiceService: InvoiceService,
    private paymentService: PaymentService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadClientData();
    this.initializeStripe();
  }

  loadClientData(): void {
    // Get client ID from authenticated user context
    const user = this.authService.getCurrentUser();
    if (user && user.clientId) {
      this.clientId = user.clientId;
      this.loadClientInvoices();
    }
  }

  loadClientInvoices(): void {
    if (!this.clientId) return;
    
    this.loading = true;
    this.invoiceService.getClientInvoices(this.clientId).subscribe({
      next: (invoices) => {
        this.invoices = invoices.filter(inv => 
          inv.status === 'ISSUED' || inv.status === 'OVERDUE'
        );
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading invoices:', error);
        this.loading = false;
      }
    });
  }

  selectInvoice(invoice: Invoice): void {
    this.selectedInvoice = invoice;
    this.paymentAmount = invoice.balanceDue || invoice.totalAmount;
  }

  initializeStripe(): void {
    // Initialize Stripe.js
    // This would be implemented with actual Stripe.js integration
  }

  async processPayment(): Promise<void> {
    if (!this.selectedInvoice || this.paymentProcessing) return;
    
    this.paymentProcessing = true;
    
    try {
      // Create payment intent
      const paymentIntent = await this.paymentService.createPaymentIntent(
        this.selectedInvoice.id!
      ).toPromise();
      
      // Process payment with Stripe
      // This would use actual Stripe.js confirmCardPayment
      // Simulate successful payment
      setTimeout(() => {
        this.paymentProcessing = false;
        this.selectedInvoice = null;
        this.loadClientInvoices();
        alert('Payment processed successfully!');
      }, 2000);
      
    } catch (error) {
      console.error('Payment error:', error);
      this.paymentProcessing = false;
      alert('Payment failed. Please try again.');
    }
  }

  downloadInvoice(invoice: Invoice): void {
    this.invoiceService.downloadInvoicePdf(invoice.id!).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `invoice-${invoice.invoiceNumber}.pdf`;
        link.click();
        window.URL.revokeObjectURL(url);
      },
      error: (error) => {
        console.error('Error downloading invoice:', error);
      }
    });
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'PAID': return 'text-success';
      case 'OVERDUE': return 'text-danger';
      case 'ISSUED': return 'text-warning';
      case 'DRAFT': return 'text-secondary';
      default: return 'text-info';
    }
  }
}