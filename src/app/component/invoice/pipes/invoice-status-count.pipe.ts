import { Pipe, PipeTransform } from '@angular/core';
import { Invoice } from 'src/app/interface/invoice';

@Pipe({
  name: 'invoiceStatusCount'
})
export class InvoiceStatusCountPipe implements PipeTransform {
  transform(invoices: Invoice[], ...statuses: string[]): number {
    if (!invoices || !Array.isArray(invoices) || invoices.length === 0) {
      return 0;
    }

    if (!statuses || statuses.length === 0) {
      return invoices.length;
    }

    const validStatuses = statuses.filter(s => s != null).map(s => s.toUpperCase());

    // Special handling for OVERDUE - check due date, not just status
    if (validStatuses.includes('OVERDUE')) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      return invoices.filter(invoice => {
        // Skip paid and cancelled invoices
        const status = invoice.status?.toUpperCase();
        if (status === 'PAID' || status === 'CANCELLED') {
          return false;
        }

        // Check if already marked as OVERDUE
        if (status === 'OVERDUE') {
          return true;
        }

        // Check if due date has passed
        if (invoice.dueDate) {
          const dueDate = new Date(invoice.dueDate);
          dueDate.setHours(0, 0, 0, 0);
          return dueDate < today;
        }

        return false;
      }).length;
    }

    // Standard status filtering
    return invoices.filter(invoice =>
      validStatuses.includes(invoice.status?.toUpperCase())
    ).length;
  }
}
