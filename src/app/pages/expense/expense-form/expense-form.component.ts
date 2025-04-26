loadExpense(expenseId: number) {
  this.isLoading = true;
  this.expenseService.getExpense(expenseId).subscribe({
    next: (expense) => {
      console.log('Raw expense data from API:', JSON.stringify(expense, null, 2));
      console.log('Detailed check of relationship IDs:');
      console.log('- vendorId:', expense.vendorId, typeof expense.vendorId);
      console.log('- customerId:', expense.customerId, typeof expense.customerId);
      console.log('- categoryId:', expense.categoryId, typeof expense.categoryId);
      console.log('- invoiceId:', expense.invoiceId, typeof expense.invoiceId);
      console.log('- legalCaseId:', expense.legalCaseId, typeof expense.legalCaseId);
      
      // Check nested relationship objects
      if (expense.vendor) console.log('- vendor.id:', expense.vendor.id, typeof expense.vendor.id);
      if (expense.customer) console.log('- customer.id:', expense.customer.id, typeof expense.customer.id);
      if (expense.category) console.log('- category.id:', expense.category.id, typeof expense.category.id);
      if (expense.invoice) console.log('- invoice.id:', expense.invoice.id, typeof expense.invoice.id);
      
      try {
        // ... existing code ...
      } catch (error) {
        console.error('Error loading expense:', error);
      }
    },
    error: (error) => {
      console.error('Error loading expense:', error);
    },
    complete: () => {
      this.isLoading = false;
    }
  });
} 