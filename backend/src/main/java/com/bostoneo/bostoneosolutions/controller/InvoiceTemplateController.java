package com.***REMOVED***.***REMOVED***solutions.controller;

import com.***REMOVED***.***REMOVED***solutions.dto.CustomHttpResponse;
import com.***REMOVED***.***REMOVED***solutions.dto.InvoiceTemplateDTO;
import com.***REMOVED***.***REMOVED***solutions.service.InvoiceTemplateService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import java.util.List;

@RestController
@RequestMapping("/api/invoice-templates")
@RequiredArgsConstructor
@Slf4j
public class InvoiceTemplateController {
    
    private final InvoiceTemplateService templateService;
    
    @PostMapping
    public ResponseEntity<CustomHttpResponse<InvoiceTemplateDTO>> createTemplate(
            @Valid @RequestBody InvoiceTemplateDTO templateDto,
            @AuthenticationPrincipal UserDetails userDetails) {
        log.info("Creating invoice template: {}", templateDto.getName());
        
        // TODO: Get actual user ID from UserDetails
        Long userId = 1L; // Placeholder
        
        InvoiceTemplateDTO created = templateService.createTemplate(templateDto, userId);
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(new CustomHttpResponse<>("Template created successfully", created));
    }
    
    @GetMapping
    public ResponseEntity<CustomHttpResponse<Page<InvoiceTemplateDTO>>> getTemplates(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "name") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDirection) {
        
        log.info("Fetching templates - page: {}, size: {}", page, size);
        Page<InvoiceTemplateDTO> templates = templateService.getTemplates(page, size, sortBy, sortDirection);
        return ResponseEntity.ok(new CustomHttpResponse<>("Templates fetched successfully", templates));
    }
    
    @GetMapping("/active")
    public ResponseEntity<CustomHttpResponse<List<InvoiceTemplateDTO>>> getActiveTemplates() {
        log.info("Fetching active templates list");
        List<InvoiceTemplateDTO> templates = templateService.getActiveTemplatesList();
        return ResponseEntity.ok(new CustomHttpResponse<>("Active templates fetched successfully", templates));
    }
    
    @GetMapping("/default")
    public ResponseEntity<CustomHttpResponse<InvoiceTemplateDTO>> getDefaultTemplate() {
        log.info("Fetching default template");
        InvoiceTemplateDTO template = templateService.getDefaultTemplate();
        if (template == null) {
            return ResponseEntity.ok(new CustomHttpResponse<>("No default template found", null));
        }
        return ResponseEntity.ok(new CustomHttpResponse<>("Default template fetched successfully", template));
    }
    
    @GetMapping("/{id}")
    public ResponseEntity<CustomHttpResponse<InvoiceTemplateDTO>> getTemplateById(@PathVariable Long id) {
        log.info("Fetching template with id: {}", id);
        InvoiceTemplateDTO template = templateService.getTemplateById(id);
        return ResponseEntity.ok(new CustomHttpResponse<>("Template fetched successfully", template));
    }
    
    @PutMapping("/{id}")
    public ResponseEntity<CustomHttpResponse<InvoiceTemplateDTO>> updateTemplate(
            @PathVariable Long id,
            @Valid @RequestBody InvoiceTemplateDTO templateDto) {
        log.info("Updating template with id: {}", id);
        InvoiceTemplateDTO updated = templateService.updateTemplate(id, templateDto);
        return ResponseEntity.ok(new CustomHttpResponse<>("Template updated successfully", updated));
    }
    
    @DeleteMapping("/{id}")
    public ResponseEntity<CustomHttpResponse<Void>> deleteTemplate(@PathVariable Long id) {
        log.info("Deleting template with id: {}", id);
        templateService.deleteTemplate(id);
        return ResponseEntity.ok(new CustomHttpResponse<>("Template deleted successfully", null));
    }
}