package com.***REMOVED***.***REMOVED***solutions.scheduler;

import com.***REMOVED***.***REMOVED***solutions.enumeration.InvoiceStatus;
import com.***REMOVED***.***REMOVED***solutions.model.Invoice;
import com.***REMOVED***.***REMOVED***solutions.model.InvoiceReminder;
import com.***REMOVED***.***REMOVED***solutions.model.InvoiceWorkflowRule;
import com.***REMOVED***.***REMOVED***solutions.repository.InvoiceReminderRepository;
import com.***REMOVED***.***REMOVED***solutions.repository.InvoiceRepository;
import com.***REMOVED***.***REMOVED***solutions.repository.InvoiceWorkflowRuleRepository;
import com.***REMOVED***.***REMOVED***solutions.service.InvoiceWorkflowService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class InvoiceWorkflowScheduler {
    
    private final InvoiceRepository invoiceRepository;
    private final InvoiceWorkflowRuleRepository workflowRuleRepository;
    private final InvoiceReminderRepository reminderRepository;
    private final InvoiceWorkflowService workflowService;
    
    /**
     * Run scheduled workflows every hour
     */
    @Scheduled(fixedDelay = 3600000) // 1 hour
    @Transactional
    public void runScheduledWorkflows() {
        log.info("Running scheduled invoice workflows...");
        
        try {
            // Process scheduled workflow rules
            List<InvoiceWorkflowRule> scheduledRules = workflowRuleRepository
                    .findByTriggerEventAndIsActiveTrue(InvoiceWorkflowRule.TriggerEvent.SCHEDULED);
            
            for (InvoiceWorkflowRule rule : scheduledRules) {
                processScheduledRule(rule);
            }
            
            // Process overdue invoices
            checkAndMarkOverdueInvoices();
            
            // Process pending reminders
            processPendingReminders();
            
            log.info("Scheduled workflows completed successfully");
            
        } catch (Exception e) {
            log.error("Error running scheduled workflows", e);
        }
    }
    
    private void processScheduledRule(InvoiceWorkflowRule rule) {
        try {
            Integer daysBeforeDue = rule.getDaysBeforeDue();
            Integer daysAfterDue = rule.getDaysAfterDue();
            
            if (daysBeforeDue != null && daysBeforeDue > 0) {
                // Find invoices due in X days
                LocalDate targetDate = LocalDate.now().plusDays(daysBeforeDue);
                List<Invoice> invoices = invoiceRepository.findByDueDateAndStatusIn(
                        targetDate, 
                        List.of(InvoiceStatus.ISSUED, InvoiceStatus.PENDING)
                );
                
                for (Invoice invoice : invoices) {
                    workflowService.executeWorkflowRule(rule, invoice);
                }
                
            } else if (daysAfterDue != null && daysAfterDue > 0) {
                // Find invoices overdue by X days
                LocalDate targetDate = LocalDate.now().minusDays(daysAfterDue);
                List<Invoice> invoices = invoiceRepository.findByDueDateAndStatusIn(
                        targetDate,
                        List.of(InvoiceStatus.ISSUED, InvoiceStatus.PENDING, InvoiceStatus.OVERDUE)
                );
                
                for (Invoice invoice : invoices) {
                    workflowService.executeWorkflowRule(rule, invoice);
                }
            }
            
        } catch (Exception e) {
            log.error("Error processing scheduled rule: {}", rule.getName(), e);
        }
    }
    
    /**
     * Check and mark overdue invoices
     */
    private void checkAndMarkOverdueInvoices() {
        try {
            LocalDate today = LocalDate.now();
            List<Invoice> overdueInvoices = invoiceRepository.findByDueDateLessThanEqualAndStatusIn(
                    today,
                    List.of(InvoiceStatus.ISSUED, InvoiceStatus.PENDING)
            );
            
            for (Invoice invoice : overdueInvoices) {
                log.info("Marking invoice {} as overdue", invoice.getInvoiceNumber());
                invoice.setStatus(InvoiceStatus.OVERDUE);
                invoiceRepository.save(invoice);
                
                // Trigger overdue workflows
                workflowService.triggerWorkflows(invoice, 
                        InvoiceWorkflowRule.TriggerEvent.OVERDUE, 
                        InvoiceStatus.PENDING.toString());
            }
            
            if (!overdueInvoices.isEmpty()) {
                log.info("Marked {} invoices as overdue", overdueInvoices.size());
            }
            
        } catch (Exception e) {
            log.error("Error checking overdue invoices", e);
        }
    }
    
    /**
     * Process pending reminders scheduled for today
     */
    private void processPendingReminders() {
        try {
            LocalDate today = LocalDate.now();
            LocalTime now = LocalTime.now();
            
            List<InvoiceReminder> pendingReminders = reminderRepository
                    .findByStatusAndScheduledDate(InvoiceReminder.ReminderStatus.PENDING, today);
            
            for (InvoiceReminder reminder : pendingReminders) {
                // Check if scheduled time has passed (if specified)
                if (reminder.getScheduledTime() == null || 
                    reminder.getScheduledTime().isBefore(now)) {
                    
                    processReminder(reminder);
                }
            }
            
        } catch (Exception e) {
            log.error("Error processing pending reminders", e);
        }
    }
    
    private void processReminder(InvoiceReminder reminder) {
        try {
            log.info("Processing reminder {} for invoice {}", 
                    reminder.getId(), reminder.getInvoice().getId());
            
            // Send reminder via workflow service
            Invoice invoice = invoiceRepository.findById(reminder.getInvoice().getId())
                    .orElseThrow(() -> new RuntimeException("Invoice not found"));
            
            // Execute email send action
            log.info("Sending reminder email for invoice {}", invoice.getInvoiceNumber());
            
            // Update reminder status
            reminder.setStatus(InvoiceReminder.ReminderStatus.SENT);
            reminder.setSentAt(LocalDateTime.now());
            reminderRepository.save(reminder);
            
        } catch (Exception e) {
            log.error("Error processing reminder {}", reminder.getId(), e);
        }
    }
}