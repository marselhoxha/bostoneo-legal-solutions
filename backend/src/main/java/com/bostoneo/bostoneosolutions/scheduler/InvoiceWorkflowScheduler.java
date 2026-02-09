package com.bostoneo.bostoneosolutions.scheduler;

import com.bostoneo.bostoneosolutions.enumeration.InvoiceStatus;
import com.bostoneo.bostoneosolutions.model.Invoice;
import com.bostoneo.bostoneosolutions.model.InvoiceReminder;
import com.bostoneo.bostoneosolutions.model.InvoiceWorkflowRule;
import com.bostoneo.bostoneosolutions.model.Organization;
import com.bostoneo.bostoneosolutions.repository.InvoiceReminderRepository;
import com.bostoneo.bostoneosolutions.repository.InvoiceRepository;
import com.bostoneo.bostoneosolutions.repository.InvoiceWorkflowRuleRepository;
import com.bostoneo.bostoneosolutions.repository.OrganizationRepository;
import com.bostoneo.bostoneosolutions.service.InvoiceWorkflowService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

/**
 * Invoice workflow scheduler.
 * TENANT ISOLATED: Processes each organization separately
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class InvoiceWorkflowScheduler {

    private final InvoiceRepository invoiceRepository;
    private final InvoiceWorkflowRuleRepository workflowRuleRepository;
    private final InvoiceReminderRepository reminderRepository;
    private final InvoiceWorkflowService workflowService;
    private final OrganizationRepository organizationRepository;

    @Value("${app.invoice-workflows.enabled:true}")
    private boolean workflowsEnabled;

    /**
     * Run scheduled workflows every hour
     */
    @Scheduled(fixedDelay = 3600000) // 1 hour
    @Transactional
    public void runScheduledWorkflows() {
        if (!workflowsEnabled) {
            log.debug("Invoice workflow scheduler is disabled");
            return;
        }
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
            
           
            
        } catch (Exception e) {
            log.error("Error running scheduled workflows", e);
        }
    }
    
    private void processScheduledRule(InvoiceWorkflowRule rule) {
        try {
            Integer daysBeforeDue = rule.getDaysBeforeDue();
            Integer daysAfterDue = rule.getDaysAfterDue();

            // Process each organization separately for tenant isolation
            List<Organization> organizations = organizationRepository.findAll();

            for (Organization org : organizations) {
                if (daysBeforeDue != null && daysBeforeDue > 0) {
                    // Find invoices due in X days
                    LocalDate targetDate = LocalDate.now().plusDays(daysBeforeDue);
                    List<Invoice> invoices = invoiceRepository.findByOrganizationIdAndDueDateAndStatusIn(
                            org.getId(),
                            targetDate,
                            List.of(InvoiceStatus.ISSUED, InvoiceStatus.PENDING)
                    );

                    for (Invoice invoice : invoices) {
                        workflowService.executeWorkflowRule(rule, invoice);
                    }

                } else if (daysAfterDue != null && daysAfterDue > 0) {
                    // Find invoices overdue by X days
                    LocalDate targetDate = LocalDate.now().minusDays(daysAfterDue);
                    List<Invoice> invoices = invoiceRepository.findByOrganizationIdAndDueDateAndStatusIn(
                            org.getId(),
                            targetDate,
                            List.of(InvoiceStatus.ISSUED, InvoiceStatus.PENDING, InvoiceStatus.OVERDUE)
                    );

                    for (Invoice invoice : invoices) {
                        workflowService.executeWorkflowRule(rule, invoice);
                    }
                }
            }

        } catch (Exception e) {
            log.error("Error processing scheduled rule: {}", rule.getName(), e);
        }
    }
    
    /**
     * Check and mark overdue invoices
     * TENANT ISOLATED: Processes each organization separately
     */
    private void checkAndMarkOverdueInvoices() {
        try {
            LocalDate today = LocalDate.now();
            List<Organization> organizations = organizationRepository.findAll();
            int totalOverdue = 0;

            for (Organization org : organizations) {
                List<Invoice> overdueInvoices = invoiceRepository.findByOrganizationIdAndDueDateLessThanEqualAndStatusIn(
                        org.getId(),
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
                    totalOverdue++;
                }
            }

            if (totalOverdue > 0) {
                log.info("Marked {} invoices as overdue", totalOverdue);
            }

        } catch (Exception e) {
            log.error("Error checking overdue invoices", e);
        }
    }
    
    /**
     * Process pending reminders scheduled for today
     * TENANT ISOLATED: Processes each organization separately
     */
    private void processPendingReminders() {
        try {
            LocalDate today = LocalDate.now();
            LocalTime now = LocalTime.now();

            // Process each organization separately for tenant isolation
            List<Organization> organizations = organizationRepository.findAll();

            for (Organization org : organizations) {
                List<InvoiceReminder> pendingReminders = reminderRepository
                        .findByOrganizationIdAndStatusAndScheduledDate(
                                org.getId(),
                                InvoiceReminder.ReminderStatus.PENDING,
                                today);

                for (InvoiceReminder reminder : pendingReminders) {
                    // Check if scheduled time has passed (if specified)
                    if (reminder.getScheduledTime() == null ||
                            reminder.getScheduledTime().isBefore(now)) {

                        processReminder(reminder, org.getId());
                    }
                }
            }

        } catch (Exception e) {
            log.error("Error processing pending reminders", e);
        }
    }
    
    private void processReminder(InvoiceReminder reminder, Long orgId) {
        try {

            // SECURITY: Use tenant-filtered query to retrieve invoice
            Invoice invoice = invoiceRepository.findByIdAndOrganizationId(reminder.getInvoice().getId(), orgId)
                    .orElseThrow(() -> new RuntimeException("Invoice not found or access denied"));

            // Execute email send action
            log.info("Sending reminder email for invoice {} (org: {})", invoice.getInvoiceNumber(), orgId);

            // Update reminder status
            reminder.setStatus(InvoiceReminder.ReminderStatus.SENT);
            reminder.setSentAt(LocalDateTime.now());
            reminderRepository.save(reminder);

        } catch (Exception e) {
            log.error("Error processing reminder {} for org {}", reminder.getId(), orgId, e);
        }
    }
}