package com.***REMOVED***.***REMOVED***solutions.repository;

import com.***REMOVED***.***REMOVED***solutions.model.InvoiceReminder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface InvoiceReminderRepository extends JpaRepository<InvoiceReminder, Long> {
    
    List<InvoiceReminder> findByInvoiceId(Long invoiceId);
    
    List<InvoiceReminder> findByStatusAndScheduledDate(InvoiceReminder.ReminderStatus status, LocalDate scheduledDate);
    
    List<InvoiceReminder> findByStatus(InvoiceReminder.ReminderStatus status);
    
    List<InvoiceReminder> findByScheduledDateBeforeAndStatus(LocalDate date, InvoiceReminder.ReminderStatus status);
}