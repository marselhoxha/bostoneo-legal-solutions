package com.***REMOVED***.***REMOVED***solutions.controller;

import com.***REMOVED***.***REMOVED***solutions.model.EmailTemplate;
import com.***REMOVED***.***REMOVED***solutions.repository.EmailTemplateRepository;
import com.***REMOVED***.***REMOVED***solutions.service.EmailService;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
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
@Slf4j
public class EmailTemplateController {

    @Autowired
    private EmailTemplateRepository emailTemplateRepository;
    
    @Autowired
    private EmailService emailService;

    @GetMapping
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN')")
    public ResponseEntity<List<EmailTemplate>> getAllTemplates() {
        return ResponseEntity.ok(emailTemplateRepository.findAll());
    }
    
    @GetMapping("/active")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN')")
    public ResponseEntity<List<EmailTemplate>> getActiveTemplates() {
        return ResponseEntity.ok(emailTemplateRepository.findByIsActiveTrue());
    }
    
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN')")
    public ResponseEntity<EmailTemplate> getTemplate(@PathVariable Long id) {
        Optional<EmailTemplate> template = emailTemplateRepository.findById(id);
        return template.map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
    
    @PostMapping
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN')")
    public ResponseEntity<EmailTemplate> createTemplate(@Valid @RequestBody EmailTemplate template) {
        // Check if a template with the same name exists
        Optional<EmailTemplate> existingTemplate = emailTemplateRepository.findByName(template.getName());
        if (existingTemplate.isPresent()) {
            return ResponseEntity.status(HttpStatus.CONFLICT).build();
        }
        
        // If this is the default template, unset any other default templates for this event type
        if (Boolean.TRUE.equals(template.getIsDefault())) {
            List<EmailTemplate> existingDefaults = emailTemplateRepository.findByEventType(template.getEventType());
            existingDefaults.stream()
                    .filter(t -> Boolean.TRUE.equals(t.getIsDefault()))
                    .forEach(t -> {
                        t.setIsDefault(false);
                        emailTemplateRepository.save(t);
                    });
        }
        
        EmailTemplate saved = emailTemplateRepository.save(template);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }
    
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN')")
    public ResponseEntity<EmailTemplate> updateTemplate(@PathVariable Long id, 
                                                       @Valid @RequestBody EmailTemplate template) {
        if (!emailTemplateRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        
        // Set the ID to ensure we're updating the correct record
        template.setId(id);
        
        // If this is the default template, unset any other default templates for this event type
        if (Boolean.TRUE.equals(template.getIsDefault())) {
            List<EmailTemplate> existingDefaults = emailTemplateRepository.findByEventType(template.getEventType());
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
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN')")
    public ResponseEntity<Void> deleteTemplate(@PathVariable Long id) {
        if (!emailTemplateRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        
        emailTemplateRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
    
    @PostMapping("/{id}/test")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN')")
    public ResponseEntity<?> testTemplate(@PathVariable Long id, 
                                        @RequestParam String testEmail) {
        Optional<EmailTemplate> templateOpt = emailTemplateRepository.findById(id);
        
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
} 