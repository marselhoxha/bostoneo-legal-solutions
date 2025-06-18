package com.***REMOVED***.***REMOVED***solutions.controller;

import com.***REMOVED***.***REMOVED***solutions.dto.CustomHttpResponse;
import com.***REMOVED***.***REMOVED***solutions.model.Invoice;
import com.***REMOVED***.***REMOVED***solutions.model.InvoiceReminder;
import com.***REMOVED***.***REMOVED***solutions.model.InvoiceWorkflowExecution;
import com.***REMOVED***.***REMOVED***solutions.model.InvoiceWorkflowRule;
import com.***REMOVED***.***REMOVED***solutions.repository.ClientRepository;
import com.***REMOVED***.***REMOVED***solutions.repository.InvoiceReminderRepository;
import com.***REMOVED***.***REMOVED***solutions.repository.InvoiceRepository;
import com.***REMOVED***.***REMOVED***solutions.repository.InvoiceWorkflowExecutionRepository;
import com.***REMOVED***.***REMOVED***solutions.repository.InvoiceWorkflowRuleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/invoice-workflows")
@RequiredArgsConstructor
@Slf4j
public class InvoiceWorkflowController {
    
    private final InvoiceWorkflowRuleRepository workflowRuleRepository;
    private final InvoiceWorkflowExecutionRepository executionRepository;
    private final InvoiceReminderRepository reminderRepository;
    private final InvoiceRepository invoiceRepository;
    private final ClientRepository clientRepository;
    
    @GetMapping("/rules")
    public ResponseEntity<CustomHttpResponse<List<InvoiceWorkflowRule>>> getWorkflowRules() {
        List<InvoiceWorkflowRule> rules = workflowRuleRepository.findAll();
        CustomHttpResponse<List<InvoiceWorkflowRule>> response = new CustomHttpResponse<>();
        response.setMessage("Workflow rules fetched successfully");
        response.setData(rules);
        return ResponseEntity.ok(response);
    }
    
    @GetMapping("/rules/{id}")
    public ResponseEntity<CustomHttpResponse<InvoiceWorkflowRule>> getWorkflowRule(@PathVariable Long id) {
        return workflowRuleRepository.findById(id)
            .map(rule -> ResponseEntity.ok(new CustomHttpResponse<>("Workflow rule fetched successfully", rule)))
            .orElse(ResponseEntity.notFound().build());
    }
    
    @PutMapping("/rules/{id}/toggle")
    @Transactional
    public ResponseEntity<CustomHttpResponse<InvoiceWorkflowRule>> toggleWorkflowRule(@PathVariable Long id) {
        // Check authentication
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            return ResponseEntity.status(401).body(new CustomHttpResponse<>(401, "Authentication required", null));
        }
        
        // Check for BILLING:EDIT permission
        boolean hasPermission = auth.getAuthorities().stream()
            .anyMatch(a -> a.getAuthority().equals("BILLING:EDIT") || 
                          a.getAuthority().equals("BILLING:ADMIN") ||
                          a.getAuthority().equals("ROLE_ADMIN"));
        
        if (!hasPermission) {
            log.warn("User {} attempted to toggle workflow rule without permission", auth.getName());
            return ResponseEntity.status(403).body(new CustomHttpResponse<>(403, "Insufficient permissions", null));
        }
        
        try {
            return workflowRuleRepository.findById(id)
                .map(rule -> {
                    // Handle null isActive value
                    Boolean currentStatus = rule.getIsActive();
                    if (currentStatus == null) {
                        currentStatus = false;
                    }
                    
                    // Toggle the status
                    rule.setIsActive(!currentStatus);
                    
                    // Save and return
                    InvoiceWorkflowRule saved = workflowRuleRepository.save(rule);
                    String message = saved.getIsActive() ? "Workflow activated" : "Workflow deactivated";
                    
                    log.info("User {} toggled workflow rule '{}' to {}", 
                        auth.getName(), saved.getName(), saved.getIsActive() ? "active" : "inactive");
                    
                    return ResponseEntity.ok(new CustomHttpResponse<>(message, saved));
                })
                .orElse(ResponseEntity.status(404).body(
                    new CustomHttpResponse<>(404, "Workflow rule not found", null)
                ));
        } catch (Exception e) {
            log.error("Error toggling workflow rule {}: {}", id, e.getMessage(), e);
            return ResponseEntity.status(500).body(
                new CustomHttpResponse<>(500, "An error occurred while toggling the workflow rule", null)
            );
        }
    }
    
    @GetMapping("/executions")
    @PreAuthorize("hasAnyAuthority('BILLING:VIEW', 'BILLING:EDIT')")
    public ResponseEntity<CustomHttpResponse<Page<InvoiceWorkflowExecution>>> getExecutions(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<InvoiceWorkflowExecution> executions = executionRepository.findAll(
            PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "executedAt"))
        );
        
        // Workflow rules are already loaded via the entity relationship
        
        CustomHttpResponse<Page<InvoiceWorkflowExecution>> response = new CustomHttpResponse<>();
        response.setMessage("Workflow executions fetched successfully");
        response.setData(executions);
        return ResponseEntity.ok(response);
    }
    
    @GetMapping("/executions/invoice/{invoiceId}")
    public ResponseEntity<CustomHttpResponse<List<InvoiceWorkflowExecution>>> getInvoiceExecutions(
            @PathVariable Long invoiceId) {
        List<InvoiceWorkflowExecution> executions = executionRepository.findByInvoice_IdOrderByExecutedAtDesc(invoiceId);
        CustomHttpResponse<List<InvoiceWorkflowExecution>> response = new CustomHttpResponse<>();
        response.setMessage("Invoice workflow executions fetched successfully");
        response.setData(executions);
        return ResponseEntity.ok(response);
    }
    
    @GetMapping("/executions/workflow/{workflowId}")
    @PreAuthorize("hasAnyAuthority('BILLING:VIEW', 'BILLING:EDIT')")
    public ResponseEntity<CustomHttpResponse<List<InvoiceWorkflowExecution>>> getWorkflowExecutions(
            @PathVariable Long workflowId) {
        List<InvoiceWorkflowExecution> executions = executionRepository.findByWorkflowRule_IdOrderByExecutedAtDesc(workflowId);
        
        // Load invoice details with client information
        executions.forEach(execution -> {
            if (execution.getInvoiceId() != null) {
                invoiceRepository.findById(execution.getInvoiceId()).ifPresent(invoice -> {
                    // Create a minimal invoice object with just the needed data
                    Invoice minimalInvoice = new Invoice();
                    minimalInvoice.setId(invoice.getId());
                    minimalInvoice.setInvoiceNumber(invoice.getInvoiceNumber());
                    minimalInvoice.setClientId(invoice.getClientId());
                    
                    // Set client name if available
                    if (invoice.getClientId() != null) {
                        clientRepository.findById(invoice.getClientId()).ifPresent(client -> {
                            try {
                                String clientName = (String) client.getClass().getMethod("getName").invoke(client);
                                minimalInvoice.setClientName(clientName);
                            } catch (Exception e) {
                                log.error("Error getting client name", e);
                            }
                        });
                    }
                    
                    execution.setInvoice(minimalInvoice);
                });
            }
        });
        
        CustomHttpResponse<List<InvoiceWorkflowExecution>> response = new CustomHttpResponse<>();
        response.setMessage("Workflow executions fetched successfully");
        response.setData(executions);
        return ResponseEntity.ok(response);
    }
    
    @GetMapping("/reminders")
    public ResponseEntity<CustomHttpResponse<Page<InvoiceReminder>>> getReminders(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<InvoiceReminder> reminders = reminderRepository.findAll(PageRequest.of(page, size));
        return ResponseEntity.ok(new CustomHttpResponse<>("Invoice reminders fetched successfully", reminders));
    }
    
    @GetMapping("/reminders/invoice/{invoiceId}")
    public ResponseEntity<CustomHttpResponse<List<InvoiceReminder>>> getInvoiceReminders(
            @PathVariable Long invoiceId) {
        List<InvoiceReminder> reminders = reminderRepository.findByInvoiceId(invoiceId);
        return ResponseEntity.ok(new CustomHttpResponse<>("Invoice reminders fetched successfully", reminders));
    }
    
    @PostMapping("/test-email/{invoiceId}")
    @PreAuthorize("hasAnyAuthority('BILLING:EDIT')")
    public ResponseEntity<CustomHttpResponse<String>> testWorkflowEmail(@PathVariable Long invoiceId) {
        log.info("Testing email workflow for invoice {}", invoiceId);
        
        CustomHttpResponse<String> response = new CustomHttpResponse<>();
        response.setMessage("Test email workflow triggered for invoice " + invoiceId);
        response.setData("Check server logs for details");
        
        return ResponseEntity.ok(response);
    }
    
    @PutMapping("/rules/{id}/config")
    @PreAuthorize("hasAnyAuthority('BILLING:EDIT')")
    public ResponseEntity<CustomHttpResponse<InvoiceWorkflowRule>> updateWorkflowConfig(
            @PathVariable Long id,
            @RequestBody Map<String, Object> configUpdate) {
        return workflowRuleRepository.findById(id)
            .map(rule -> {
                // Update action config
                if (configUpdate.containsKey("actionConfig")) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> actionConfig = (Map<String, Object>) configUpdate.get("actionConfig");
                    rule.setActionConfig(actionConfig);
                }
                
                // Update schedule fields
                if (configUpdate.containsKey("daysBeforeDue")) {
                    rule.setDaysBeforeDue(configUpdate.get("daysBeforeDue") != null ? 
                        ((Number) configUpdate.get("daysBeforeDue")).intValue() : null);
                }
                
                if (configUpdate.containsKey("daysAfterDue")) {
                    rule.setDaysAfterDue(configUpdate.get("daysAfterDue") != null ? 
                        ((Number) configUpdate.get("daysAfterDue")).intValue() : null);
                }
                
                if (configUpdate.containsKey("executionTime")) {
                    rule.setExecutionTime(configUpdate.get("executionTime") != null ? 
                        java.time.LocalTime.parse((String) configUpdate.get("executionTime")) : null);
                }
                
                if (configUpdate.containsKey("maxExecutions")) {
                    rule.setMaxExecutions(((Number) configUpdate.get("maxExecutions")).intValue());
                }
                
                InvoiceWorkflowRule saved = workflowRuleRepository.save(rule);
                
                CustomHttpResponse<InvoiceWorkflowRule> response = new CustomHttpResponse<>();
                response.setMessage("Workflow configuration updated successfully");
                response.setData(saved);
                
                return ResponseEntity.ok(response);
            })
            .orElse(ResponseEntity.notFound().build());
    }
}