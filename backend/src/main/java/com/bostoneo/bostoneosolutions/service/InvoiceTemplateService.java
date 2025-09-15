package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.InvoiceTemplateDTO;
import com.bostoneo.bostoneosolutions.dto.InvoiceTemplateItemDTO;
import com.bostoneo.bostoneosolutions.model.Invoice;
import com.bostoneo.bostoneosolutions.model.InvoiceTemplate;
import com.bostoneo.bostoneosolutions.model.InvoiceTemplateItem;
import com.bostoneo.bostoneosolutions.model.User;
import com.bostoneo.bostoneosolutions.repository.InvoiceTemplateRepository;
import com.bostoneo.bostoneosolutions.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class InvoiceTemplateService {
    
    private final InvoiceTemplateRepository templateRepository;
    private final UserRepository userRepository;
    
    public InvoiceTemplateDTO createTemplate(InvoiceTemplateDTO dto, Long userId) {
        log.info("Creating new invoice template: {}", dto.getName());
        
        // Check if name already exists
        if (templateRepository.findByName(dto.getName()).isPresent()) {
            throw new RuntimeException("Template with name '" + dto.getName() + "' already exists");
        }
        
        InvoiceTemplate template = mapToEntity(dto);
        
        // Set creator
        if (userId != null) {
            try {
                User user = userRepository.get(userId);
                template.setCreatedBy(user);
            } catch (Exception e) {
                log.warn("Could not find user with id: {}", userId);
            }
        }
        
        // If this is set as default, unset other defaults
        if (Boolean.TRUE.equals(dto.getIsDefault())) {
            templateRepository.findByIsDefaultTrue().ifPresent(existing -> {
                existing.setIsDefault(false);
                templateRepository.save(existing);
            });
        }
        
        InvoiceTemplate saved = templateRepository.save(template);
        return mapToDTO(saved);
    }
    
    public InvoiceTemplateDTO updateTemplate(Long id, InvoiceTemplateDTO dto) {
        log.info("Updating invoice template: {}", id);
        
        InvoiceTemplate template = templateRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Template not found with id: " + id));
        
        // Check if name is being changed and already exists
        if (!template.getName().equals(dto.getName()) && 
            templateRepository.existsByNameAndIdNot(dto.getName(), id)) {
            throw new RuntimeException("Template with name '" + dto.getName() + "' already exists");
        }
        
        // Update fields
        template.setName(dto.getName());
        template.setDescription(dto.getDescription());
        template.setIsActive(dto.getIsActive());
        template.setTaxRate(dto.getTaxRate());
        template.setPaymentTerms(dto.getPaymentTerms());
        template.setCurrencyCode(dto.getCurrencyCode());
        template.setHeaderText(dto.getHeaderText());
        template.setFooterText(dto.getFooterText());
        template.setNotesTemplate(dto.getNotesTemplate());
        template.setTermsAndConditions(dto.getTermsAndConditions());
        template.setLogoPosition(dto.getLogoPosition());
        template.setPrimaryColor(dto.getPrimaryColor());
        template.setSecondaryColor(dto.getSecondaryColor());
        template.setFontFamily(dto.getFontFamily());
        
        // Handle default flag
        if (Boolean.TRUE.equals(dto.getIsDefault()) && !template.getIsDefault()) {
            templateRepository.findByIsDefaultTrue().ifPresent(existing -> {
                if (!existing.getId().equals(id)) {
                    existing.setIsDefault(false);
                    templateRepository.save(existing);
                }
            });
            template.setIsDefault(true);
        }
        
        // Update template items
        template.getTemplateItems().clear();
        if (dto.getTemplateItems() != null) {
            for (InvoiceTemplateItemDTO itemDto : dto.getTemplateItems()) {
                InvoiceTemplateItem item = new InvoiceTemplateItem();
                item.setDescription(itemDto.getDescription());
                item.setDefaultQuantity(itemDto.getDefaultQuantity());
                item.setDefaultUnitPrice(itemDto.getDefaultUnitPrice());
                item.setCategory(itemDto.getCategory());
                item.setIsOptional(itemDto.getIsOptional());
                item.setSortOrder(itemDto.getSortOrder());
                template.addTemplateItem(item);
            }
        }
        
        InvoiceTemplate saved = templateRepository.save(template);
        return mapToDTO(saved);
    }
    
    public Page<InvoiceTemplateDTO> getTemplates(int page, int size, String sortBy, String sortDirection) {
        Sort sort = sortDirection.equalsIgnoreCase("ASC") ? 
            Sort.by(sortBy).ascending() : Sort.by(sortBy).descending();
        Pageable pageable = PageRequest.of(page, size, sort);
        
        return templateRepository.findAll(pageable).map(this::mapToDTO);
    }
    
    public Page<InvoiceTemplateDTO> getActiveTemplates(int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("name"));
        return templateRepository.findByIsActiveTrue(pageable).map(this::mapToDTO);
    }
    
    public List<InvoiceTemplateDTO> getActiveTemplatesList() {
        return templateRepository.findByIsActiveTrueOrderByName()
            .stream()
            .map(this::mapToDTO)
            .collect(Collectors.toList());
    }
    
    public InvoiceTemplateDTO getTemplateById(Long id) {
        return templateRepository.findById(id)
            .map(this::mapToDTO)
            .orElseThrow(() -> new RuntimeException("Template not found with id: " + id));
    }
    
    public InvoiceTemplateDTO getDefaultTemplate() {
        return templateRepository.findByIsDefaultTrue()
            .map(this::mapToDTO)
            .orElse(null);
    }
    
    public void deleteTemplate(Long id) {
        if (!templateRepository.existsById(id)) {
            throw new RuntimeException("Template not found with id: " + id);
        }
        templateRepository.deleteById(id);
    }
    
    public Invoice applyTemplateToInvoice(Invoice invoice, Long templateId) {
        InvoiceTemplate template = templateRepository.findById(templateId)
            .orElseThrow(() -> new RuntimeException("Template not found with id: " + templateId));
        
        // Apply template settings
        invoice.setTaxRate(template.getTaxRate());
        
        // Apply template content
        if (template.getNotesTemplate() != null) {
            invoice.setNotes(processTemplateVariables(template.getNotesTemplate(), invoice));
        }
        
        // Apply template items as line items (if invoice has no line items)
        if (invoice.getLineItems().isEmpty() && !template.getTemplateItems().isEmpty()) {
            for (InvoiceTemplateItem templateItem : template.getTemplateItems()) {
                if (!Boolean.TRUE.equals(templateItem.getIsOptional())) {
                    var lineItem = new com.bostoneo.bostoneosolutions.model.InvoiceLineItem();
                    lineItem.setDescription(templateItem.getDescription());
                    lineItem.setQuantity(templateItem.getDefaultQuantity());
                    lineItem.setUnitPrice(templateItem.getDefaultUnitPrice());
                    lineItem.setCategory(templateItem.getCategory());
                    lineItem.setLineOrder(templateItem.getSortOrder());
                    lineItem.setInvoice(invoice);
                    invoice.getLineItems().add(lineItem);
                }
            }
        }
        
        return invoice;
    }
    
    private String processTemplateVariables(String template, Invoice invoice) {
        if (template == null) return null;
        
        return template
            .replace("{invoice_number}", invoice.getInvoiceNumber() != null ? invoice.getInvoiceNumber() : "")
            .replace("{client_name}", invoice.getClientName() != null ? invoice.getClientName() : "")
            .replace("{issue_date}", invoice.getIssueDate() != null ? invoice.getIssueDate().toString() : "")
            .replace("{due_date}", invoice.getDueDate() != null ? invoice.getDueDate().toString() : "")
            .replace("{case_name}", invoice.getCaseName() != null ? invoice.getCaseName() : "");
    }
    
    private InvoiceTemplateDTO mapToDTO(InvoiceTemplate template) {
        InvoiceTemplateDTO dto = new InvoiceTemplateDTO();
        dto.setId(template.getId());
        dto.setName(template.getName());
        dto.setDescription(template.getDescription());
        dto.setIsActive(template.getIsActive());
        dto.setIsDefault(template.getIsDefault());
        dto.setTaxRate(template.getTaxRate());
        dto.setPaymentTerms(template.getPaymentTerms());
        dto.setCurrencyCode(template.getCurrencyCode());
        dto.setHeaderText(template.getHeaderText());
        dto.setFooterText(template.getFooterText());
        dto.setNotesTemplate(template.getNotesTemplate());
        dto.setTermsAndConditions(template.getTermsAndConditions());
        dto.setLogoPosition(template.getLogoPosition());
        dto.setPrimaryColor(template.getPrimaryColor());
        dto.setSecondaryColor(template.getSecondaryColor());
        dto.setFontFamily(template.getFontFamily());
        dto.setCreatedAt(template.getCreatedAt());
        dto.setUpdatedAt(template.getUpdatedAt());
        
        if (template.getCreatedBy() != null) {
            dto.setCreatedByName(template.getCreatedBy().getFirstName() + " " + template.getCreatedBy().getLastName());
        }
        
        // Map template items
        dto.setTemplateItems(template.getTemplateItems().stream()
            .map(this::mapItemToDTO)
            .collect(Collectors.toList()));
        
        return dto;
    }
    
    private InvoiceTemplateItemDTO mapItemToDTO(InvoiceTemplateItem item) {
        InvoiceTemplateItemDTO dto = new InvoiceTemplateItemDTO();
        dto.setId(item.getId());
        dto.setDescription(item.getDescription());
        dto.setDefaultQuantity(item.getDefaultQuantity());
        dto.setDefaultUnitPrice(item.getDefaultUnitPrice());
        dto.setCategory(item.getCategory());
        dto.setIsOptional(item.getIsOptional());
        dto.setSortOrder(item.getSortOrder());
        return dto;
    }
    
    private InvoiceTemplate mapToEntity(InvoiceTemplateDTO dto) {
        InvoiceTemplate template = new InvoiceTemplate();
        template.setName(dto.getName());
        template.setDescription(dto.getDescription());
        template.setIsActive(dto.getIsActive() != null ? dto.getIsActive() : true);
        template.setIsDefault(dto.getIsDefault() != null ? dto.getIsDefault() : false);
        template.setTaxRate(dto.getTaxRate());
        template.setPaymentTerms(dto.getPaymentTerms());
        template.setCurrencyCode(dto.getCurrencyCode());
        template.setHeaderText(dto.getHeaderText());
        template.setFooterText(dto.getFooterText());
        template.setNotesTemplate(dto.getNotesTemplate());
        template.setTermsAndConditions(dto.getTermsAndConditions());
        template.setLogoPosition(dto.getLogoPosition());
        template.setPrimaryColor(dto.getPrimaryColor());
        template.setSecondaryColor(dto.getSecondaryColor());
        template.setFontFamily(dto.getFontFamily());
        
        // Map template items
        if (dto.getTemplateItems() != null) {
            for (InvoiceTemplateItemDTO itemDto : dto.getTemplateItems()) {
                InvoiceTemplateItem item = new InvoiceTemplateItem();
                item.setDescription(itemDto.getDescription());
                item.setDefaultQuantity(itemDto.getDefaultQuantity());
                item.setDefaultUnitPrice(itemDto.getDefaultUnitPrice());
                item.setCategory(itemDto.getCategory());
                item.setIsOptional(itemDto.getIsOptional());
                item.setSortOrder(itemDto.getSortOrder());
                template.addTemplateItem(item);
            }
        }
        
        return template;
    }
}