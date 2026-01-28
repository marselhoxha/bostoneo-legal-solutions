package com.bostoneo.bostoneosolutions.controller;

import com.bostoneo.bostoneosolutions.model.EmailTemplate;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.repository.EmailTemplateRepository;
import com.bostoneo.bostoneosolutions.service.EmailService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/email-templates")
@RequiredArgsConstructor
@Slf4j
public class EmailTemplateController {

    private final EmailTemplateRepository emailTemplateRepository;
    private final EmailService emailService;
    private final TenantService tenantService;

    /**
     * Helper method to get the current organization ID (required for tenant isolation)
     */
    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    @GetMapping
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_MANAGING_PARTNER', 'ROLE_SENIOR_PARTNER', 'ROLE_EQUITY_PARTNER', 'ROLE_OF_COUNSEL', 'ROLE_SYSADMIN')")
    public ResponseEntity<List<EmailTemplate>> getAllTemplates() {
        Long orgId = getRequiredOrganizationId();
        return ResponseEntity.ok(emailTemplateRepository.findByOrganizationId(orgId));
    }

    @GetMapping("/active")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_MANAGING_PARTNER', 'ROLE_SENIOR_PARTNER', 'ROLE_EQUITY_PARTNER', 'ROLE_OF_COUNSEL', 'ROLE_SYSADMIN')")
    public ResponseEntity<List<EmailTemplate>> getActiveTemplates() {
        Long orgId = getRequiredOrganizationId();
        return ResponseEntity.ok(emailTemplateRepository.findByOrganizationIdAndIsActiveTrue(orgId));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_MANAGING_PARTNER', 'ROLE_SENIOR_PARTNER', 'ROLE_EQUITY_PARTNER', 'ROLE_OF_COUNSEL', 'ROLE_SYSADMIN')")
    public ResponseEntity<EmailTemplate> getTemplate(@PathVariable Long id) {
        Long orgId = getRequiredOrganizationId();
        Optional<EmailTemplate> template = emailTemplateRepository.findByIdAndOrganizationId(id, orgId);
        return template.map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_MANAGING_PARTNER', 'ROLE_SENIOR_PARTNER', 'ROLE_EQUITY_PARTNER', 'ROLE_OF_COUNSEL', 'ROLE_SYSADMIN')")
    public ResponseEntity<EmailTemplate> createTemplate(@Valid @RequestBody EmailTemplate template) {
        Long orgId = getRequiredOrganizationId();

        // Check if a template with the same name exists in this organization
        Optional<EmailTemplate> existingTemplate = emailTemplateRepository.findByNameAndOrganizationId(template.getName(), orgId);
        if (existingTemplate.isPresent()) {
            return ResponseEntity.status(HttpStatus.CONFLICT).build();
        }

        // If this is the default template, unset any other default templates for this event type
        if (Boolean.TRUE.equals(template.getIsDefault())) {
            List<EmailTemplate> existingDefaults = emailTemplateRepository.findByEventTypeAndOrganizationId(template.getEventType(), orgId);
            existingDefaults.stream()
                    .filter(t -> Boolean.TRUE.equals(t.getIsDefault()))
                    .forEach(t -> {
                        t.setIsDefault(false);
                        emailTemplateRepository.save(t);
                    });
        }

        // Set organization ID for tenant isolation
        template.setOrganizationId(orgId);

        EmailTemplate saved = emailTemplateRepository.save(template);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_MANAGING_PARTNER', 'ROLE_SENIOR_PARTNER', 'ROLE_EQUITY_PARTNER', 'ROLE_OF_COUNSEL', 'ROLE_SYSADMIN')")
    public ResponseEntity<EmailTemplate> updateTemplate(@PathVariable Long id,
                                                       @Valid @RequestBody EmailTemplate template) {
        Long orgId = getRequiredOrganizationId();

        if (!emailTemplateRepository.existsByIdAndOrganizationId(id, orgId)) {
            return ResponseEntity.notFound().build();
        }

        // Set the ID and organization to ensure we're updating the correct record
        template.setId(id);
        template.setOrganizationId(orgId);

        // If this is the default template, unset any other default templates for this event type
        if (Boolean.TRUE.equals(template.getIsDefault())) {
            List<EmailTemplate> existingDefaults = emailTemplateRepository.findByEventTypeAndOrganizationId(template.getEventType(), orgId);
            existingDefaults.stream()
                    .filter(t -> !t.getId().equals(id) && Boolean.TRUE.equals(t.getIsDefault()))
                    .forEach(t -> {
                        t.setIsDefault(false);
                        emailTemplateRepository.save(t);
                    });
        }

        EmailTemplate updated = emailTemplateRepository.save(template);
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_MANAGING_PARTNER', 'ROLE_SENIOR_PARTNER', 'ROLE_EQUITY_PARTNER', 'ROLE_OF_COUNSEL', 'ROLE_SYSADMIN')")
    public ResponseEntity<Void> deleteTemplate(@PathVariable Long id) {
        Long orgId = getRequiredOrganizationId();

        if (!emailTemplateRepository.existsByIdAndOrganizationId(id, orgId)) {
            return ResponseEntity.notFound().build();
        }

        emailTemplateRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/test")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_MANAGING_PARTNER', 'ROLE_SENIOR_PARTNER', 'ROLE_EQUITY_PARTNER', 'ROLE_OF_COUNSEL', 'ROLE_SYSADMIN')")
    public ResponseEntity<?> testTemplate(@PathVariable Long id,
                                        @RequestParam String testEmail) {
        Long orgId = getRequiredOrganizationId();
        Optional<EmailTemplate> templateOpt = emailTemplateRepository.findByIdAndOrganizationId(id, orgId);

        if (templateOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        EmailTemplate template = templateOpt.get();

        // Create sample template data
        Map<String, String> templateData = new HashMap<>();
        templateData.put("userName", "Test User");
        templateData.put("eventTitle", "Sample Event");
        templateData.put("eventDate", "January 1, 2023");
        templateData.put("eventTime", "10:00 AM");
        templateData.put("minutesBefore", "15");
        templateData.put("eventType", "HEARING");
        templateData.put("eventLocation", "Sample Location");

        // Send the test email
        boolean sent = emailService.sendTemplatedEmail(
                testEmail,
                "TEST: " + template.getSubject(),
                template.getBodyTemplate(),
                templateData
        );

        if (sent) {
            return ResponseEntity.ok(Map.of("message", "Test email sent successfully"));
        } else {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Failed to send test email"));
        }
    }

    @PostMapping("/{id}/send")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_MANAGING_PARTNER', 'ROLE_SENIOR_PARTNER', 'ROLE_EQUITY_PARTNER', 'ROLE_OF_COUNSEL', 'ROLE_SYSADMIN')")
    public ResponseEntity<String> sendEmail(@PathVariable Long id, @RequestParam String recipient) {
        Long orgId = getRequiredOrganizationId();
        // Verify template belongs to organization
        if (!emailTemplateRepository.existsByIdAndOrganizationId(id, orgId)) {
            return ResponseEntity.notFound().build();
        }
        // Implementation of sendEmail method
        return ResponseEntity.ok("Email sent");
    }

    @GetMapping("/categories")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_MANAGING_PARTNER', 'ROLE_SENIOR_PARTNER', 'ROLE_EQUITY_PARTNER', 'ROLE_OF_COUNSEL', 'ROLE_SYSADMIN')")
    public ResponseEntity<List<String>> getCategories() {
        // Implementation of getCategories method - categories are system-wide, no tenant filtering needed
        return ResponseEntity.ok(List.of("REMINDER", "NOTIFICATION", "ALERT", "REPORT"));
    }
}
