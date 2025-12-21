import { Pipe, PipeTransform } from '@angular/core';
import { Invoice } from 'src/app/interface/invoice';

@Pipe({
  name: 'invoiceTotalAmount'
})
export class InvoiceTotalAmountPipe implements PipeTransform {
  transform(invoices: Invoice[], type: 'total' | 'pending' | 'paid' | 'overdue' | 'outstanding'): number {
    if (!invoices || !Array.isArray(invoices) || invoices.length === 0) {
      return 0;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (type) {
      case 'total':
        return invoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);

      case 'paid':
        return invoices
          .filter(inv => inv.status?.toUpperCase() === 'PAID')
          .reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);

      case 'pending':
        return invoices
          .filter(inv => {
            const status = inv.status?.toUpperCase();
            return status === 'PENDING' || status === 'DRAFT' || status === 'SENT' || status === 'ISSUED';
          })
          .filter(inv => {
            // Exclude overdue ones from pending
            if (inv.dueDate) {
              const dueDate = new Date(inv.dueDate);
              dueDate.setHours(0, 0, 0, 0);
              return dueDate >= today;
            }
            return true;
          })
          .reduce((sum, inv) => sum + (inv.balanceDue || inv.totalAmount || 0), 0);

      case 'overdue':
        return invoices
          .filter(inv => {
            const status = inv.status?.toUpperCase();
            if (status === 'PAID' || status === 'CANCELLED') return false;
            if (status === 'OVERDUE') return true;
            if (inv.dueDate) {
              const dueDate = new Date(inv.dueDate);
              dueDate.setHours(0, 0, 0, 0);
              return dueDate < today;
            }
            return false;
          })
          .reduce((sum, inv) => sum + (inv.balanceDue || inv.totalAmount || 0), 0);

      case 'outstanding':
        // All unpaid invoices (pending + overdue)
        return invoices
          .filter(inv => {
            const status = inv.status?.toUpperCase();
            return status !== 'PAID' && status !== 'CANCELLED';
          })
          .reduce((sum, inv) => sum + (inv.balanceDue || inv.totalAmount || 0), 0);

      default:
        return 0;
    }
  }
}
