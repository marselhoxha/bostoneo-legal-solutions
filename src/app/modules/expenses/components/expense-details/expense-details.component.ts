import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ExpensesService } from '../../../../service/expenses.service';
import { Expense, Receipt } from '../../../../interface/expense.interface';
import { CustomHttpResponse } from '../../../../interface/appstates';
import { map, switchMap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-expense-details',
  templateUrl: './expense-details.component.html',
  styleUrls: ['./expense-details.component.css']
})
export class ExpenseDetailsComponent implements OnInit {
  expense: Expense | null = null;
  loading = false;
  error: string | null = null;
  receiptUrl: SafeUrl | null = null;

  constructor(
    private expensesService: ExpensesService,
    private route: ActivatedRoute,
    private router: Router,
    private changeDetectorRef: ChangeDetectorRef,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.loadExpense();
  }

  loadExpense(): void {
    const id = this.route.snapshot.params['id'];
    if (!id) {
      this.router.navigate(['/expenses']);
      return;
    }

    this.loading = true;
    this.error = null;
    this.receiptUrl = null; // Reset receipt URL
    this.changeDetectorRef.detectChanges();

    this.expensesService.getExpense(id)
      .pipe(
        map(response => response.data),
        switchMap(expense => {
          this.expense = expense;

          // Check for receipt object directly in expense
          const receiptObject = expense?.receipt;

          if (receiptObject) {
            // If we have the receipt object directly embedded, use it immediately
            if (receiptObject.content) {
              try {
                // Create a blob URL for the receipt image
                const byteCharacters = atob(receiptObject.content);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                  byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: receiptObject.contentType || 'application/octet-stream' });
                this.receiptUrl = this.sanitizer.bypassSecurityTrustUrl(URL.createObjectURL(blob));

                return of(expense); // We already have the receipt, no need to fetch it
              } catch (error) {
                console.error('Error creating blob URL from embedded content:', error);
              }
            }

            // If content parsing failed or content is missing, try fetching by ID
            return this.expensesService.getReceipt(receiptObject.id).pipe(
              map(response => {
                const receipt = response.data;

                if (!receipt) {
                  console.error('Receipt data is null or undefined');
                  return expense;
                }

                if (receipt.content) {
                  try {
                    // Create a blob URL for the receipt image
                    const byteCharacters = atob(receipt.content);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) {
                      byteNumbers[i] = byteCharacters.charCodeAt(i);
                    }
                    const byteArray = new Uint8Array(byteNumbers);
                    const blob = new Blob([byteArray], { type: receipt.contentType || 'application/octet-stream' });
                    this.receiptUrl = this.sanitizer.bypassSecurityTrustUrl(URL.createObjectURL(blob));
                  } catch (error) {
                    console.error('Error creating blob URL:', error);
                  }
                }

                return expense;
              }),
              catchError(error => {
                console.error('Error loading receipt:', error);
                return of(expense); // Continue with the expense even if receipt fails
              })
            );
          }
          
          // Also check for receiptId if receipt object is not present
          else if (expense?.receiptId && !isNaN(Number(expense.receiptId))) {
            const receiptId = Number(expense.receiptId);

            return this.expensesService.getReceipt(receiptId).pipe(
              map(response => {
                const receipt = response.data;

                if (!receipt) {
                  console.error('Receipt data is null or undefined');
                  return expense;
                }

                if (receipt.content) {
                  try {
                    // Create a blob URL for the receipt image
                    const byteCharacters = atob(receipt.content);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) {
                      byteNumbers[i] = byteCharacters.charCodeAt(i);
                    }
                    const byteArray = new Uint8Array(byteNumbers);
                    const blob = new Blob([byteArray], { type: receipt.contentType || 'application/octet-stream' });
                    this.receiptUrl = this.sanitizer.bypassSecurityTrustUrl(URL.createObjectURL(blob));
                  } catch (error) {
                    console.error('Error creating blob URL:', error);
                  }
                }

                return expense;
              }),
              catchError(error => {
                console.error('Error loading receipt:', error);
                return of(expense); // Continue with the expense even if receipt fails
              })
            );
          } else {
            return of(expense);
          }
        })
      )
      .subscribe({
        next: () => {
          this.loading = false;
          this.changeDetectorRef.detectChanges();
        },
        error: (error) => {
          console.error('Error loading expense details:', error);
          this.error = 'Failed to load expense details. Please try again.';
          this.loading = false;
          this.changeDetectorRef.detectChanges();
        }
      });
  }

  downloadReceipt(): void {
    // First check if we have a receipt object directly embedded
    if (this.expense?.receipt) {
      const receipt = this.expense.receipt;

      if (!receipt.content) {
        this.error = 'Receipt content is missing';
        this.changeDetectorRef.detectChanges();
        return;
      }

      try {
        // Create a blob from the receipt content
        const byteCharacters = atob(receipt.content);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const contentType = receipt.contentType || 'application/octet-stream';
        const blob = new Blob([byteArray], { type: contentType });
        const url = URL.createObjectURL(blob);

        // Create a filename with extension based on content type
        let fileName = receipt.fileName || 'receipt';
        if (!fileName.includes('.')) {
          if (contentType.includes('jpeg') || contentType.includes('jpg')) {
            fileName += '.jpg';
          } else if (contentType.includes('png')) {
            fileName += '.png';
          } else if (contentType.includes('pdf')) {
            fileName += '.pdf';
          }
        }

        // Create a link and trigger download
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        return;
      } catch (err) {
        console.error('Error processing embedded receipt for download:', err);
        this.error = 'Error processing receipt: ' + (err.message || 'Unknown error');
        this.changeDetectorRef.detectChanges();
      }
    }

    // If we don't have an embedded receipt or it failed, try using the receiptId
    if (!this.expense?.receiptId && !this.expense?.receipt?.id) {
      this.error = 'No receipt ID available for this expense';
      this.changeDetectorRef.detectChanges();
      return;
    }

    const receiptId = Number(this.expense.receiptId || this.expense.receipt?.id);
    if (isNaN(receiptId)) {
      this.error = 'Invalid receipt ID';
      this.changeDetectorRef.detectChanges();
      return;
    }

    this.error = null;

    this.expensesService.getReceipt(receiptId)
      .pipe(map(response => response.data))
      .subscribe({
        next: (receipt) => {
          if (!receipt) {
            this.error = 'Receipt not found';
            this.changeDetectorRef.detectChanges();
            return;
          }

          if (!receipt.content) {
            this.error = 'Receipt content is missing';
            this.changeDetectorRef.detectChanges();
            return;
          }

          try {
            // Create a blob from the receipt content
            const byteCharacters = atob(receipt.content);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const contentType = receipt.contentType || 'application/octet-stream';
            const blob = new Blob([byteArray], { type: contentType });
            const url = URL.createObjectURL(blob);

            // Create a filename with extension based on content type
            let fileName = receipt.fileName || 'receipt';
            if (!fileName.includes('.')) {
              if (contentType.includes('jpeg') || contentType.includes('jpg')) {
                fileName += '.jpg';
              } else if (contentType.includes('png')) {
                fileName += '.png';
              } else if (contentType.includes('pdf')) {
                fileName += '.pdf';
              }
            }

            // Create a link and trigger download
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
          } catch (err) {
            console.error('Error processing receipt for download:', err);
            this.error = 'Error processing receipt: ' + (err.message || 'Unknown error');
            this.changeDetectorRef.detectChanges();
          }
        },
        error: (error) => {
          console.error('Error downloading receipt:', error);
          this.error = error.error?.message || 'Failed to download receipt. Please try again.';
          this.changeDetectorRef.detectChanges();
        }
      });
  }

  editExpense(): void {
    if (this.expense?.id) {
      this.router.navigate(['/expenses/edit', this.expense.id]);
    }
  }

  goBack(): void {
    this.router.navigate(['/expenses']);
  }
  
  testLoadReceipt(receiptId: string): void {
    if (!receiptId || isNaN(Number(receiptId))) {
      this.error = 'Please enter a valid receipt ID number';
      return;
    }

    const id = Number(receiptId);

    // Update the expense object to include the receipt ID
    if (this.expense) {
      if (this.expense.receipt) {
        this.expense.receipt.id = id;
      } else {
        this.expense.receiptId = id;
      }
    }

    // Try to load the receipt
    this.expensesService.getReceipt(id).subscribe({
      next: (response) => {
        const receipt = response.data;

        if (receipt) {
          if (this.expense) {
            if (this.expense.receipt) {
              this.expense.receipt = {
                ...this.expense.receipt,
                ...receipt
              };
            } else {
              this.expense.receipt = receipt;
            }
          }

          if (receipt.content) {
            try {
              // Create a blob URL for the receipt image
              const byteCharacters = atob(receipt.content);
              const byteNumbers = new Array(byteCharacters.length);
              for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
              }
              const byteArray = new Uint8Array(byteNumbers);
              const blob = new Blob([byteArray], { type: receipt.contentType || 'application/octet-stream' });
              this.receiptUrl = this.sanitizer.bypassSecurityTrustUrl(URL.createObjectURL(blob));
            } catch (error) {
              console.error('Error creating blob URL:', error);
              this.error = 'Error creating receipt preview: ' + error.message;
            }
          } else {
            this.error = 'Receipt found but no content available';
          }
        } else {
          this.error = 'Receipt not found with the provided ID';
        }

        this.changeDetectorRef.detectChanges();
      },
      error: (error) => {
        console.error('Error testing receipt load:', error);
        this.error = `Failed to load receipt: ${error.status} ${error.statusText}`;
        this.changeDetectorRef.detectChanges();
      }
    });
  }
} 