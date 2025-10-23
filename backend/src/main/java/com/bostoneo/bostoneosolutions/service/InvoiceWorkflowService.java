package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.enumeration.InvoiceStatus;
import com.bostoneo.bostoneosolutions.model.*;
import com.bostoneo.bostoneosolutions.repository.InvoiceReminderRepository;
import com.bostoneo.bostoneosolutions.repository.InvoiceRepository;
import com.bostoneo.bostoneosolutions.repository.InvoiceWorkflowExecutionRepository;
import com.bostoneo.bostoneosolutions.repository.InvoiceWorkflowRuleRepository;
import com.bostoneo.bostoneosolutions.repository.ClientRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class InvoiceWorkflowService {
    
    private final InvoiceWorkflowRuleRepository workflowRuleRepository;
    private final InvoiceWorkflowExecutionRepository executionRepository;
    private final InvoiceReminderRepository reminderRepository;
    private final InvoiceRepository invoiceRepository;
    private final EmailService emailService;
    private final ClientRepository clientRepository;
    
    /**
     * Trigger workflows for a specific event
     */
    public void triggerWorkflows(Invoice invoice, InvoiceWorkflowRule.TriggerEvent event, String oldStatus) {
        log.info("Triggering workflows for invoice {} with event {}", invoice.getInvoiceNumber(), event);
        
        List<InvoiceWorkflowRule> rules;
        try {
            rules = workflowRuleRepository.findByTriggerEventAndIsActiveTrue(event);
        } catch (Exception e) {
            log.warn("Workflow tables not available or accessible, skipping workflow execution: {}", e.getMessage());
            return;
        }
        
        for (InvoiceWorkflowRule rule : rules) {
            try {
                // Check if rule applies
                if (!shouldExecuteRule(rule, invoice, oldStatus)) {
                    continue;
                }
                
                // Check execution limit
                long executionCount = executionRepository.countByWorkflowRule_IdAndInvoice_Id(rule.getId(), invoice.getId());
                if (executionCount >= rule.getMaxExecutions()) {
                    log.debug("Workflow {} reached max executions for invoice {}", rule.getName(), invoice.getInvoiceNumber());
                    continue;
                }
                
                // Execute workflow
                executeWorkflow(rule, invoice);
                
            } catch (Exception e) {
                log.error("Error executing workflow {} for invoice {}", rule.getName(), invoice.getInvoiceNumber(), e);
                logExecution(rule, invoice, "FAILED", e.getMessage());
            }
        }
    }
    
    /**
     * Process scheduled workflows (runs every hour)
     */
    @Scheduled(cron = "0 0 * * * *") // Every hour
    public void processScheduledWorkflows() {
        
        List<InvoiceWorkflowRule> scheduledRules = workflowRuleRepository
            .findByTriggerEventAndIsActiveTrue(InvoiceWorkflowRule.TriggerEvent.SCHEDULED);
        
        for (InvoiceWorkflowRule rule : scheduledRules) {
            processScheduledRule(rule);
        }
    }
    
    private void processScheduledRule(InvoiceWorkflowRule rule) {
        Map<String, Object> config = rule.getActionConfig();
        
        if (config.containsKey("days_before_due")) {
            int daysBefore = ((Number) config.get("days_before_due")).intValue();
            LocalDate targetDate = LocalDate.now().plusDays(daysBefore);
            
            List<Invoice> invoices = invoiceRepository.findByDueDateAndStatusIn(
                targetDate, 
                Arrays.asList(InvoiceStatus.ISSUED, InvoiceStatus.PENDING)
            );
            
            for (Invoice invoice : invoices) {
                if (!hasExecutedRecently(rule, invoice, 24)) { // Check if executed in last 24 hours
                    executeWorkflow(rule, invoice);
                }
            }
        }
        
        if (config.containsKey("days_after_due")) {
            int daysAfter = ((Number) config.get("days_after_due")).intValue();
            LocalDate targetDate = LocalDate.now().minusDays(daysAfter);
            
            List<Invoice> invoices = invoiceRepository.findByDueDateLessThanEqualAndStatusIn(
                targetDate,
                Arrays.asList(InvoiceStatus.ISSUED, InvoiceStatus.PENDING)
            );
            
            for (Invoice invoice : invoices) {
                if (!hasExecutedRecently(rule, invoice, 24)) {
                    executeWorkflow(rule, invoice);
                }
            }
        }
    }
    
    public void executeWorkflowRule(InvoiceWorkflowRule rule, Invoice invoice) {
        executeWorkflow(rule, invoice);
    }
    
    private void executeWorkflow(InvoiceWorkflowRule rule, Invoice invoice) {
        
        try {
            switch (rule.getActionType()) {
                case SEND_EMAIL:
                    executeEmailAction(rule, invoice);
                    break;
                case UPDATE_STATUS:
                    executeStatusUpdateAction(rule, invoice);
                    break;
                case CREATE_REMINDER:
                    executeCreateReminderAction(rule, invoice);
                    break;
                case APPLY_LATE_FEE:
                    executeLateFeeAction(rule, invoice);
                    break;
            }
            
            logExecution(rule, invoice, "SUCCESS", "Workflow executed successfully");
            
        } catch (Exception e) {
            throw new RuntimeException("Failed to execute workflow: " + e.getMessage(), e);
        }
    }
    
    private void executeEmailAction(InvoiceWorkflowRule rule, Invoice invoice) {
        Map<String, Object> config = rule.getActionConfig();
        String templateName = (String) config.get("email_template");
        boolean sendToClient = (Boolean) config.getOrDefault("send_to_client", true);
        boolean attachPdf = (Boolean) config.getOrDefault("attach_pdf", false);
        
        // Get client email
        final String[] clientEmailHolder = {null};
        if (invoice.getClientId() != null) {
            clientRepository.findById(invoice.getClientId()).ifPresent(client -> {
                // Assuming client has getEmail() method
                try {
                    clientEmailHolder[0] = (String) client.getClass().getMethod("getEmail").invoke(client);
                } catch (Exception e) {
                    log.error("Error getting client email", e);
                }
            });
        }
        
        String clientEmail = clientEmailHolder[0];
        if (clientEmail == null || clientEmail.isEmpty()) {
            log.warn("No client email found for invoice {}, using fallback email", invoice.getInvoiceNumber());
            clientEmail = "admin@bostoneo.com"; // Fallback for testing
        }
        
        // Generate email content
        String subject = generateEmailSubject(templateName, invoice);
        String message = generateEmailMessage(templateName, invoice);
        
        // Send the actual email
        boolean emailSent = false;
        if (sendToClient) {
            try {
                emailSent = emailService.sendEmail(clientEmail, subject, message);
                if (emailSent) {
                    log.info("Email sent successfully for invoice {} to {}", invoice.getInvoiceNumber(), clientEmail);
                } else {
                    log.error("Failed to send email for invoice {}", invoice.getInvoiceNumber());
                }
            } catch (Exception e) {
                log.error("Error sending email for invoice {}", invoice.getInvoiceNumber(), e);
            }
        }
        
        // Create reminder record
        InvoiceReminder reminder = new InvoiceReminder();
        reminder.setInvoice(invoice);
        reminder.setReminderType(determineReminderType(templateName));
        reminder.setScheduledDate(LocalDate.now());
        reminder.setStatus(emailSent ? InvoiceReminder.ReminderStatus.SENT : InvoiceReminder.ReminderStatus.CANCELLED);
        reminder.setSentAt(emailSent ? LocalDateTime.now() : null);
        reminder.setSubject(subject);
        reminder.setMessage(message);
        reminder.setRecipients(Arrays.asList(clientEmail));
        reminder.setCreatedByWorkflow(rule);
        
        reminderRepository.save(reminder);
    }
    
    private void executeStatusUpdateAction(InvoiceWorkflowRule rule, Invoice invoice) {
        Map<String, Object> config = rule.getActionConfig();
        String newStatus = (String) config.get("new_status");
        
        if (newStatus != null) {
            InvoiceStatus status = InvoiceStatus.valueOf(newStatus);
            invoice.setStatus(status);
            invoiceRepository.save(invoice);
            log.info("Updated invoice {} status to {}", invoice.getInvoiceNumber(), status);
        }
    }
    
    private void executeCreateReminderAction(InvoiceWorkflowRule rule, Invoice invoice) {
        Map<String, Object> config = rule.getActionConfig();
        
        InvoiceReminder reminder = new InvoiceReminder();
        reminder.setInvoice(invoice);
        reminder.setReminderType(InvoiceReminder.ReminderType.CUSTOM);
        reminder.setScheduledDate(LocalDate.now().plusDays(1)); // Default to tomorrow
        reminder.setStatus(InvoiceReminder.ReminderStatus.PENDING);
        reminder.setSubject((String) config.getOrDefault("subject", "Invoice Reminder"));
        reminder.setMessage((String) config.getOrDefault("message", ""));
        reminder.setCreatedByWorkflow(rule);
        
        reminderRepository.save(reminder);
    }
    
    private void executeLateFeeAction(InvoiceWorkflowRule rule, Invoice invoice) {
        Map<String, Object> config = rule.getActionConfig();
        BigDecimal feePercentage = new BigDecimal(config.getOrDefault("fee_percentage", "1.5").toString());
        BigDecimal maxFee = new BigDecimal(config.getOrDefault("max_fee_amount", "500").toString());
        String feeDescription = (String) config.getOrDefault("fee_description", "Late payment fee");
        
        // Calculate late fee
        BigDecimal lateFee = invoice.getTotalAmount()
            .multiply(feePercentage)
            .divide(new BigDecimal("100"), 2, BigDecimal.ROUND_HALF_UP);
        
        if (lateFee.compareTo(maxFee) > 0) {
            lateFee = maxFee;
        }
        
        // Add late fee as a line item
        InvoiceLineItem feeItem = new InvoiceLineItem();
        feeItem.setInvoice(invoice);
        feeItem.setDescription(feeDescription);
        feeItem.setQuantity(BigDecimal.ONE);
        feeItem.setUnitPrice(lateFee);
        feeItem.setAmount(lateFee);
        feeItem.setCategory("FEE");
        feeItem.setLineOrder(invoice.getLineItems().size());
        
        invoice.getLineItems().add(feeItem);
        invoice.setSubtotal(invoice.getSubtotal().add(lateFee));
        invoice.setTotalAmount(invoice.getTotalAmount().add(lateFee));
        
        invoiceRepository.save(invoice);
        log.info("Applied late fee of {} to invoice {}", lateFee, invoice.getInvoiceNumber());
    }
    
    private boolean shouldExecuteRule(InvoiceWorkflowRule rule, Invoice invoice, String oldStatus) {
        // Check trigger status for STATUS_CHANGED events
        if (rule.getTriggerEvent() == InvoiceWorkflowRule.TriggerEvent.STATUS_CHANGED) {
            String triggerStatus = rule.getTriggerStatus();
            return triggerStatus != null && triggerStatus.equals(invoice.getStatus().toString());
        }
        
        return true;
    }
    
    private boolean hasExecutedRecently(InvoiceWorkflowRule rule, Invoice invoice, int hours) {
        LocalDateTime since = LocalDateTime.now().minusHours(hours);
        return executionRepository.existsByWorkflowRule_IdAndInvoice_IdAndExecutedAtAfter(
            rule.getId(), invoice.getId(), since
        );
    }
    
    private void logExecution(InvoiceWorkflowRule rule, Invoice invoice, String status, String message) {
        InvoiceWorkflowExecution execution = new InvoiceWorkflowExecution();
        execution.setWorkflowRule(rule);
        execution.setInvoice(invoice);
        execution.setStatus(status);
        execution.setResultMessage(message);
        execution.setExecutedAt(LocalDateTime.now());
        
        executionRepository.save(execution);
    }
    
    private InvoiceReminder.ReminderType determineReminderType(String templateName) {
        if (templateName.contains("overdue")) {
            return InvoiceReminder.ReminderType.OVERDUE;
        } else if (templateName.contains("payment_received")) {
            return InvoiceReminder.ReminderType.PAYMENT_RECEIVED;
        } else if (templateName.contains("reminder")) {
            return InvoiceReminder.ReminderType.DUE_SOON;
        }
        return InvoiceReminder.ReminderType.CUSTOM;
    }
    
    private String generateEmailSubject(String templateName, Invoice invoice) {
        switch (templateName) {
            case "invoice_created":
                return String.format("Invoice %s - %s", invoice.getInvoiceNumber(), invoice.getClientName());
            case "payment_reminder":
                return String.format("Payment Reminder: Invoice %s", invoice.getInvoiceNumber());
            case "payment_reminder_urgent":
                return String.format("Urgent: Invoice %s Due Tomorrow", invoice.getInvoiceNumber());
            case "overdue_notice":
                return String.format("Overdue Notice: Invoice %s", invoice.getInvoiceNumber());
            case "payment_received":
                return String.format("Payment Received - Thank You!", invoice.getInvoiceNumber());
            default:
                return String.format("Invoice %s", invoice.getInvoiceNumber());
        }
    }
    
    private String generateEmailMessage(String templateName, Invoice invoice) {
        StringBuilder html = new StringBuilder();
        html.append("<!DOCTYPE html><html><head><style>");
        html.append("body{font-family:Arial,sans-serif;line-height:1.6;color:#333;}");
        html.append(".container{max-width:600px;margin:0 auto;padding:20px;}");
        html.append(".header{background:#0d6efd;color:white;padding:20px;text-align:center;border-radius:5px 5px 0 0;}");
        html.append(".content{background:#f8f9fa;padding:20px;border:1px solid #dee2e6;}");
        html.append(".invoice-details{background:white;padding:15px;margin:15px 0;border-radius:5px;}");
        html.append(".amount{font-size:24px;color:#0d6efd;font-weight:bold;}");
        html.append(".footer{text-align:center;padding:20px;color:#6c757d;font-size:14px;}");
        html.append("</style></head><body>");
        html.append("<div class='container'>");
        
        // Header
        html.append("<div class='header'>");
        html.append("<h1>Bostoneo Solutions</h1>");
        html.append("</div>");
        
        // Content
        html.append("<div class='content'>");
        
        String clientName = invoice.getClientName() != null ? invoice.getClientName() : "Valued Client";
        
        switch (templateName) {
            case "invoice_created":
                html.append(String.format("<h2>New Invoice Created</h2>"));
                html.append(String.format("<p>Dear %s,</p>", clientName));
                html.append("<p>We have created a new invoice for the services provided. Please find the details below:</p>");
                break;
                
            case "payment_reminder":
                html.append(String.format("<h2>Payment Reminder</h2>"));
                html.append(String.format("<p>Dear %s,</p>", clientName));
                html.append("<p>This is a friendly reminder that the following invoice will be due soon:</p>");
                break;
                
            case "payment_reminder_urgent":
                html.append(String.format("<h2 style='color:#dc3545;'>Urgent Payment Reminder</h2>"));
                html.append(String.format("<p>Dear %s,</p>", clientName));
                html.append("<p><strong>This invoice is due tomorrow!</strong> Please ensure payment is made to avoid any late fees.</p>");
                break;
                
            case "overdue_notice":
                html.append(String.format("<h2 style='color:#dc3545;'>Overdue Notice</h2>"));
                html.append(String.format("<p>Dear %s,</p>", clientName));
                html.append("<p>The following invoice is now <strong>overdue</strong>. Please make payment as soon as possible to avoid additional charges.</p>");
                break;
                
            case "payment_received":
                html.append(String.format("<h2 style='color:#28a745;'>Payment Received - Thank You!</h2>"));
                html.append(String.format("<p>Dear %s,</p>", clientName));
                html.append("<p>We have received your payment. Thank you for your prompt payment!</p>");
                break;
                
            default:
                html.append(String.format("<h2>Invoice Notification</h2>"));
                html.append(String.format("<p>Dear %s,</p>", clientName));
                html.append("<p>This is regarding the following invoice:</p>");
        }
        
        // Invoice details
        html.append("<div class='invoice-details'>");
        html.append(String.format("<p><strong>Invoice Number:</strong> %s</p>", invoice.getInvoiceNumber()));
        html.append(String.format("<p><strong>Issue Date:</strong> %s</p>", invoice.getIssueDate()));
        html.append(String.format("<p><strong>Due Date:</strong> %s</p>", invoice.getDueDate()));
        if (invoice.getCaseName() != null) {
            html.append(String.format("<p><strong>Legal Case:</strong> %s</p>", invoice.getCaseName()));
        }
        html.append(String.format("<p class='amount'>Total Amount: $%.2f</p>", invoice.getTotalAmount()));
        html.append("</div>");
        
        // Payment instructions
        if (!templateName.equals("payment_received")) {
            html.append("<p><strong>Payment Instructions:</strong></p>");
            html.append("<p>Please remit payment via wire transfer or check to:</p>");
            html.append("<ul>");
            html.append("<li>Bank: First National Bank</li>");
            html.append("<li>Account: Bostoneo Solutions LLC</li>");
            html.append("<li>Reference: " + invoice.getInvoiceNumber() + "</li>");
            html.append("</ul>");
        }
        
        html.append("<p>If you have any questions, please don't hesitate to contact us.</p>");
        html.append("<p>Best regards,<br>Bostoneo Solutions Team</p>");
        html.append("</div>");
        
        // Footer
        html.append("<div class='footer'>");
        html.append("<p>Bostoneo Solutions LLC<br>");
        html.append("68 Harrison Ave, Boston MA<br>");
        html.append("Phone: (123) 456-7890 | Email: info@bostoneo.com</p>");
        html.append("</div>");
        
        html.append("</div></body></html>");
        
        return html.toString();
    }
}