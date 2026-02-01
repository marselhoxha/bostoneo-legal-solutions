package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.dto.*;
import com.bostoneo.bostoneosolutions.exception.ResourceNotFoundException;
import com.bostoneo.bostoneosolutions.model.*;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.repository.*;
import com.bostoneo.bostoneosolutions.service.EmailService;
import com.bostoneo.bostoneosolutions.service.PIDocumentRequestService;
import com.bostoneo.bostoneosolutions.service.TwilioService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Implementation of PI Document Request Service.
 * Handles smart recipient resolution based on document type,
 * actual email/SMS sending, and request logging.
 */
@Service
@Transactional
@RequiredArgsConstructor
@Slf4j
public class PIDocumentRequestServiceImpl implements PIDocumentRequestService {

    private final PIDocumentRequestLogRepository requestLogRepository;
    private final PIDocumentRequestTemplateRepository templateRepository;
    private final PIProviderDirectoryRepository providerDirectoryRepository;
    private final PIDocumentChecklistRepository checklistRepository;
    private final PIMedicalRecordRepository medicalRecordRepository;
    private final LegalCaseRepository caseRepository;
    private final TenantService tenantService;
    private final EmailService emailService;
    private final TwilioService twilioService;

    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    // ========================
    // Recipient Resolution
    // ========================

    @Override
    public DocumentRecipientDTO resolveRecipient(Long caseId, Long checklistItemId) {
        Long orgId = getRequiredOrganizationId();
        log.info("Resolving recipient for case: {}, checklist item: {}", caseId, checklistItemId);

        // Get the checklist item
        PIDocumentChecklist item = checklistRepository.findByIdAndOrganizationId(checklistItemId, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Checklist item not found"));

        // Get the case
        LegalCase legalCase = caseRepository.findByIdAndOrganizationId(caseId, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Case not found"));

        String documentType = item.getDocumentType();
        String providerName = item.getProviderName();

        return resolveRecipientByDocumentType(documentType, providerName, legalCase, orgId);
    }

    private DocumentRecipientDTO resolveRecipientByDocumentType(String documentType, String providerName,
                                                                  LegalCase legalCase, Long orgId) {
        DocumentRecipientDTO recipient = DocumentRecipientDTO.builder()
                .documentType(documentType)
                .resolved(false)
                .build();

        switch (documentType) {
            case "MEDICAL_RECORDS":
                return resolveMedicalRecordsRecipient(providerName, legalCase, orgId);

            case "MEDICAL_BILLS":
                return resolveBillingRecipient(providerName, legalCase, orgId);

            case "INSURANCE":
                return resolveInsuranceRecipient(legalCase);

            case "WAGE_DOCUMENTATION":
                return resolveEmployerRecipient(legalCase);

            case "POLICE_REPORT":
                return resolvePoliceRecipient();

            case "PHOTOGRAPHS":
            case "CLIENT_DOCUMENTS":
                return resolveClientRecipient(legalCase);

            case "WITNESS":
                return resolveWitnessRecipient();

            default:
                recipient.setRecipientType("UNKNOWN");
                recipient.setResolutionMessage("Manual entry required for document type: " + documentType);
                return recipient;
        }
    }

    private DocumentRecipientDTO resolveMedicalRecordsRecipient(String providerName, LegalCase legalCase, Long orgId) {
        DocumentRecipientDTO recipient = DocumentRecipientDTO.builder()
                .documentType("MEDICAL_RECORDS")
                .recipientType("MEDICAL_PROVIDER")
                .suggestedTemplateCode("MEDICAL_RECORDS_REQUEST")
                .build();

        // Try to find from medical records first
        if (providerName != null && !providerName.isEmpty()) {
            Optional<PIMedicalRecord> medicalRecord = medicalRecordRepository
                    .findByCaseIdAndOrganizationIdOrderByTreatmentDateAsc(legalCase.getId(), orgId)
                    .stream()
                    .filter(r -> providerName.equalsIgnoreCase(r.getProviderName()))
                    .findFirst();

            if (medicalRecord.isPresent()) {
                PIMedicalRecord record = medicalRecord.get();
                recipient.setRecipientName(record.getProviderName());
                recipient.setRecipientSource("MEDICAL_RECORD");
                recipient.setSourceId(record.getId());
                recipient.setSourceName(record.getProviderName());

                // Use records department contact if available
                if (record.getRecordsEmail() != null || record.getRecordsPhone() != null) {
                    recipient.setEmail(record.getRecordsEmail());
                    recipient.setPhone(record.getRecordsPhone());
                    recipient.setFax(record.getRecordsFax());
                } else {
                    // Fall back to main provider contact
                    recipient.setPhone(record.getProviderPhone());
                    recipient.setFax(record.getProviderFax());
                }

                if (recipient.hasEmail() || recipient.hasPhone() || recipient.hasFax()) {
                    recipient.setResolved(true);
                    recipient.setResolutionMessage("Contact resolved from medical record");
                }
            }
        }

        // If not resolved, try provider directory
        if (!Boolean.TRUE.equals(recipient.getResolved()) && providerName != null) {
            Optional<PIProviderDirectory> provider = providerDirectoryRepository
                    .findByOrganizationIdAndProviderName(orgId, providerName);

            if (provider.isPresent()) {
                PIProviderDirectory p = provider.get();
                recipient.setRecipientName(p.getProviderName());
                recipient.setRecipientSource("PROVIDER_DIRECTORY");
                recipient.setSourceId(p.getId());
                recipient.setProviderDirectoryId(p.getId());

                if (p.getRecordsEmail() != null || p.getRecordsPhone() != null) {
                    recipient.setEmail(p.getRecordsEmail());
                    recipient.setPhone(p.getRecordsPhone());
                    recipient.setFax(p.getRecordsFax());
                } else {
                    recipient.setEmail(p.getMainEmail());
                    recipient.setPhone(p.getMainPhone());
                    recipient.setFax(p.getMainFax());
                }

                if (recipient.hasEmail() || recipient.hasPhone() || recipient.hasFax()) {
                    recipient.setResolved(true);
                    recipient.setResolutionMessage("Contact resolved from provider directory");
                }
            }
        }

        if (!Boolean.TRUE.equals(recipient.getResolved())) {
            recipient.setRecipientName(providerName);
            recipient.setRecipientSource("MANUAL");
            recipient.setResolutionMessage("Manual entry required - no contact info found for " +
                    (providerName != null ? providerName : "provider"));
        }

        recipient.setAvailableChannels(getAvailableChannels(recipient));
        return recipient;
    }

    private DocumentRecipientDTO resolveBillingRecipient(String providerName, LegalCase legalCase, Long orgId) {
        DocumentRecipientDTO recipient = DocumentRecipientDTO.builder()
                .documentType("MEDICAL_BILLS")
                .recipientType("BILLING_DEPT")
                .suggestedTemplateCode("MEDICAL_BILLS_REQUEST")
                .build();

        // Try to find from medical records first
        if (providerName != null && !providerName.isEmpty()) {
            Optional<PIMedicalRecord> medicalRecord = medicalRecordRepository
                    .findByCaseIdAndOrganizationIdOrderByTreatmentDateAsc(legalCase.getId(), orgId)
                    .stream()
                    .filter(r -> providerName.equalsIgnoreCase(r.getProviderName()))
                    .findFirst();

            if (medicalRecord.isPresent()) {
                PIMedicalRecord record = medicalRecord.get();
                recipient.setRecipientName(record.getProviderName() + " - Billing");
                recipient.setRecipientSource("MEDICAL_RECORD");
                recipient.setSourceId(record.getId());

                // Use billing department contact
                if (record.getBillingEmail() != null || record.getBillingPhone() != null) {
                    recipient.setEmail(record.getBillingEmail());
                    recipient.setPhone(record.getBillingPhone());
                    recipient.setResolved(true);
                    recipient.setResolutionMessage("Contact resolved from medical record billing info");
                }
            }
        }

        // Try provider directory for billing contact
        if (!Boolean.TRUE.equals(recipient.getResolved()) && providerName != null) {
            Optional<PIProviderDirectory> provider = providerDirectoryRepository
                    .findByOrganizationIdAndProviderName(orgId, providerName);

            if (provider.isPresent()) {
                PIProviderDirectory p = provider.get();
                if (p.getBillingEmail() != null || p.getBillingPhone() != null) {
                    recipient.setRecipientName(p.getProviderName() + " - Billing");
                    recipient.setEmail(p.getBillingEmail());
                    recipient.setPhone(p.getBillingPhone());
                    recipient.setFax(p.getBillingFax());
                    recipient.setProviderDirectoryId(p.getId());
                    recipient.setResolved(true);
                    recipient.setResolutionMessage("Contact resolved from provider directory");
                }
            }
        }

        if (!Boolean.TRUE.equals(recipient.getResolved())) {
            recipient.setRecipientName(providerName != null ? providerName + " - Billing" : "Billing Department");
            recipient.setRecipientSource("MANUAL");
            recipient.setResolutionMessage("Manual entry required - no billing contact found");
        }

        recipient.setAvailableChannels(getAvailableChannels(recipient));
        return recipient;
    }

    private DocumentRecipientDTO resolveInsuranceRecipient(LegalCase legalCase) {
        DocumentRecipientDTO recipient = DocumentRecipientDTO.builder()
                .documentType("INSURANCE")
                .recipientType("INSURANCE_ADJUSTER")
                .suggestedTemplateCode("INSURANCE_POLICY_REQUEST")
                .build();

        if (legalCase.getInsuranceAdjusterName() != null || legalCase.getInsuranceCompany() != null) {
            recipient.setRecipientName(legalCase.getInsuranceAdjusterName() != null ?
                    legalCase.getInsuranceAdjusterName() : legalCase.getInsuranceCompany());
            recipient.setEmail(legalCase.getInsuranceAdjusterEmail());
            recipient.setPhone(legalCase.getInsuranceAdjusterPhone());
            recipient.setRecipientSource("CASE_DATA");

            if (recipient.hasEmail() || recipient.hasPhone()) {
                recipient.setResolved(true);
                recipient.setResolutionMessage("Contact resolved from case insurance info");
            } else {
                recipient.setResolutionMessage("Adjuster name on file but no email/phone - manual entry required");
            }
        } else {
            recipient.setRecipientSource("MANUAL");
            recipient.setResolutionMessage("No insurance adjuster info on case - manual entry required");
        }

        recipient.setAvailableChannels(getAvailableChannels(recipient));
        return recipient;
    }

    private DocumentRecipientDTO resolveEmployerRecipient(LegalCase legalCase) {
        DocumentRecipientDTO recipient = DocumentRecipientDTO.builder()
                .documentType("WAGE_DOCUMENTATION")
                .recipientType("EMPLOYER_HR")
                .suggestedTemplateCode("WAGE_DOCUMENTATION_REQUEST")
                .build();

        if (legalCase.getEmployerName() != null) {
            recipient.setRecipientName(legalCase.getEmployerHrContact() != null ?
                    legalCase.getEmployerHrContact() : legalCase.getEmployerName() + " HR");
            recipient.setEmail(legalCase.getEmployerEmail());
            recipient.setPhone(legalCase.getEmployerPhone());
            recipient.setRecipientSource("CASE_DATA");

            if (recipient.hasEmail() || recipient.hasPhone()) {
                recipient.setResolved(true);
                recipient.setResolutionMessage("Contact resolved from case employer info");
            } else {
                recipient.setResolutionMessage("Employer on file but no email/phone - manual entry required");
            }
        } else {
            recipient.setRecipientSource("MANUAL");
            recipient.setResolutionMessage("No employer info on case - manual entry required");
        }

        recipient.setAvailableChannels(getAvailableChannels(recipient));
        return recipient;
    }

    private DocumentRecipientDTO resolvePoliceRecipient() {
        return DocumentRecipientDTO.builder()
                .documentType("POLICE_REPORT")
                .recipientType("POLICE_DEPT")
                .suggestedTemplateCode("POLICE_REPORT_REQUEST")
                .recipientSource("MANUAL")
                .resolved(false)
                .resolutionMessage("Manual entry required - contact local police department records")
                .availableChannels(List.of("EMAIL", "FAX"))
                .build();
    }

    private DocumentRecipientDTO resolveClientRecipient(LegalCase legalCase) {
        DocumentRecipientDTO recipient = DocumentRecipientDTO.builder()
                .documentType("PHOTOGRAPHS")
                .recipientType("CLIENT")
                .suggestedTemplateCode("CLIENT_DOCUMENT_REQUEST")
                .recipientName(legalCase.getClientName())
                .email(legalCase.getClientEmail())
                .phone(legalCase.getClientPhone())
                .recipientSource("CASE_DATA")
                .build();

        if (recipient.hasEmail() || recipient.hasPhone()) {
            recipient.setResolved(true);
            recipient.setResolutionMessage("Contact resolved from case client info");
        } else {
            recipient.setResolutionMessage("No client contact info on case");
        }

        recipient.setAvailableChannels(getAvailableChannels(recipient));
        return recipient;
    }

    private DocumentRecipientDTO resolveWitnessRecipient() {
        return DocumentRecipientDTO.builder()
                .documentType("WITNESS")
                .recipientType("WITNESS")
                .suggestedTemplateCode("WITNESS_STATEMENT_REQUEST")
                .recipientSource("MANUAL")
                .resolved(false)
                .resolutionMessage("Manual entry required - enter witness contact information")
                .availableChannels(List.of("EMAIL", "SMS"))
                .build();
    }

    private List<String> getAvailableChannels(DocumentRecipientDTO recipient) {
        List<String> channels = new ArrayList<>();
        if (recipient.hasEmail()) channels.add("EMAIL");
        if (recipient.hasPhone()) channels.add("SMS");
        if (recipient.hasFax()) channels.add("FAX");
        if (channels.isEmpty()) channels.add("IN_APP");
        return channels;
    }

    // ========================
    // Request Sending
    // ========================

    @Override
    public PIDocumentRequestLogDTO sendRequest(Long caseId, Long checklistItemId, SendDocumentRequestDTO request) {
        Long orgId = getRequiredOrganizationId();
        log.info("Sending document request for case: {}, checklist item: {}, channel: {}",
                caseId, checklistItemId, request.getChannel());

        // Get checklist item
        PIDocumentChecklist item = checklistRepository.findByIdAndOrganizationId(checklistItemId, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Checklist item not found"));

        // Get case for template variables
        LegalCase legalCase = caseRepository.findByIdAndOrganizationId(caseId, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Case not found"));

        // Get template if specified
        PIDocumentRequestTemplate template = null;
        if (request.getTemplateId() != null) {
            template = templateRepository.findByIdAndOrganization(request.getTemplateId(), orgId)
                    .orElse(null);
        } else if (request.getTemplateCode() != null) {
            List<PIDocumentRequestTemplate> templates = templateRepository.findByTemplateCode(orgId, request.getTemplateCode());
            if (!templates.isEmpty()) {
                template = templates.get(0);
            }
        }

        // Build request subject and body
        String subject = request.getCustomSubject();
        String body = request.getCustomBody();

        if (template != null && (subject == null || body == null)) {
            Map<String, String> variables = buildTemplateVariables(legalCase, item, request);
            if (subject == null) {
                subject = replaceTemplateVariables(template.getEmailSubject(), variables);
            }
            if (body == null) {
                body = "EMAIL".equals(request.getChannel()) ?
                        replaceTemplateVariables(template.getEmailBody(), variables) :
                        replaceTemplateVariables(template.getSmsBody(), variables);
            }
        }

        // Send the actual communication
        String externalMessageId = null;
        String channelStatus = "SENT";

        try {
            if ("EMAIL".equals(request.getChannel()) && request.getRecipientEmail() != null) {
                boolean sent = emailService.sendEmail(request.getRecipientEmail(), subject, body);
                channelStatus = sent ? "SENT" : "FAILED";
            } else if ("SMS".equals(request.getChannel()) && request.getRecipientPhone() != null) {
                SmsResponseDTO smsResponse = twilioService.sendSms(request.getRecipientPhone(), body);
                externalMessageId = smsResponse.getMessageSid();
                channelStatus = smsResponse.isSuccess() ? "SENT" : "FAILED";
            }
        } catch (Exception e) {
            log.error("Error sending document request: {}", e.getMessage());
            channelStatus = "FAILED";
        }

        // Create log entry
        PIDocumentRequestLog logEntry = PIDocumentRequestLog.builder()
                .checklistItemId(checklistItemId)
                .caseId(caseId)
                .organizationId(orgId)
                .recipientType(request.getRecipientType())
                .recipientName(request.getRecipientName())
                .recipientEmail(request.getRecipientEmail())
                .recipientPhone(request.getRecipientPhone())
                .recipientFax(request.getRecipientFax())
                .channel(request.getChannel())
                .channelStatus(channelStatus)
                .externalMessageId(externalMessageId)
                .templateId(template != null ? template.getId() : null)
                .templateCode(template != null ? template.getTemplateCode() : null)
                .requestSubject(subject)
                .requestBody(body)
                .documentFee(request.getDocumentFee())
                .sentAt(LocalDateTime.now())
                .build();

        PIDocumentRequestLog saved = requestLogRepository.save(logEntry);

        // Update checklist item status
        if (!"RECEIVED".equals(item.getStatus())) {
            item.setStatus("REQUESTED");
            item.setRequestedDate(LocalDate.now());
            item.setRequestSentTo(request.getRecipientName());
            item.setFollowUpDate(LocalDate.now().plusDays(14));
            checklistRepository.save(item);
        }

        log.info("Document request sent successfully. Log ID: {}, Status: {}", saved.getId(), channelStatus);
        return mapToLogDTO(saved, template);
    }

    @Override
    public BulkDocumentRequestDTO sendBulkRequests(Long caseId, BulkDocumentRequestDTO bulkRequest) {
        Long orgId = getRequiredOrganizationId();
        log.info("Sending bulk document requests for case: {}, items: {}",
                caseId, bulkRequest.getChecklistItemIds().size());

        List<BulkDocumentRequestDTO.BulkRequestResultDTO> results = new ArrayList<>();
        int successCount = 0;
        int failedCount = 0;

        for (Long itemId : bulkRequest.getChecklistItemIds()) {
            try {
                // Resolve recipient
                DocumentRecipientDTO recipient = resolveRecipient(caseId, itemId);

                if (!Boolean.TRUE.equals(recipient.getResolved())) {
                    results.add(BulkDocumentRequestDTO.BulkRequestResultDTO.builder()
                            .checklistItemId(itemId)
                            .documentType(recipient.getDocumentType())
                            .success(false)
                            .errorMessage("Could not resolve recipient: " + recipient.getResolutionMessage())
                            .build());
                    failedCount++;
                    continue;
                }

                // Build request
                SendDocumentRequestDTO request = SendDocumentRequestDTO.builder()
                        .recipientType(recipient.getRecipientType())
                        .recipientName(recipient.getRecipientName())
                        .recipientEmail(recipient.getEmail())
                        .recipientPhone(recipient.getPhone())
                        .channel(bulkRequest.getDefaultChannel() != null ?
                                bulkRequest.getDefaultChannel() :
                                (recipient.hasEmail() ? "EMAIL" : "SMS"))
                        .templateCode(recipient.getSuggestedTemplateCode())
                        .build();

                // Send request
                PIDocumentRequestLogDTO logDTO = sendRequest(caseId, itemId, request);

                results.add(BulkDocumentRequestDTO.BulkRequestResultDTO.builder()
                        .checklistItemId(itemId)
                        .documentType(recipient.getDocumentType())
                        .documentSubtype(recipient.getDocumentSubtype())
                        .success("SENT".equals(logDTO.getChannelStatus()))
                        .channel(request.getChannel())
                        .recipientName(recipient.getRecipientName())
                        .recipientEmail(recipient.getEmail())
                        .requestLogId(logDTO.getId())
                        .build());

                if ("SENT".equals(logDTO.getChannelStatus())) {
                    successCount++;
                } else {
                    failedCount++;
                }

            } catch (Exception e) {
                log.error("Error processing bulk request for item {}: {}", itemId, e.getMessage());
                results.add(BulkDocumentRequestDTO.BulkRequestResultDTO.builder()
                        .checklistItemId(itemId)
                        .success(false)
                        .errorMessage(e.getMessage())
                        .build());
                failedCount++;
            }
        }

        bulkRequest.setTotalItems(bulkRequest.getChecklistItemIds().size());
        bulkRequest.setSuccessCount(successCount);
        bulkRequest.setFailedCount(failedCount);
        bulkRequest.setResults(results);

        log.info("Bulk request complete. Success: {}, Failed: {}", successCount, failedCount);
        return bulkRequest;
    }

    @Override
    public BulkRequestPreviewDTO previewBulkRequests(Long caseId, List<Long> checklistItemIds) {
        Long orgId = getRequiredOrganizationId();
        log.info("Previewing bulk requests for case: {}, items: {}", caseId, checklistItemIds.size());

        // Get case
        LegalCase legalCase = caseRepository.findByIdAndOrganizationId(caseId, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Case not found"));

        // Maps for grouping
        Map<String, BulkRequestPreviewDTO.RecipientGroup> groupMap = new LinkedHashMap<>();
        List<BulkRequestPreviewDTO.UnresolvedItem> unresolvedItems = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        int resolvedCount = 0;
        int unresolvedCount = 0;

        for (Long itemId : checklistItemIds) {
            PIDocumentChecklist item = checklistRepository.findByIdAndOrganizationId(itemId, orgId).orElse(null);
            if (item == null) continue;

            // Resolve recipient
            DocumentRecipientDTO recipient = resolveRecipient(caseId, itemId);

            // Check if already requested recently
            boolean alreadyRequested = item.getRequestCount() != null && item.getRequestCount() > 0;
            String lastRequestedDate = item.getRequestedDate() != null ? item.getRequestedDate().toString() : null;

            if (Boolean.TRUE.equals(recipient.getResolved())) {
                // Generate group key
                String groupKey = generateGroupKey(recipient);

                // Get or create group
                BulkRequestPreviewDTO.RecipientGroup group = groupMap.computeIfAbsent(groupKey, k ->
                        BulkRequestPreviewDTO.RecipientGroup.builder()
                                .groupKey(groupKey)
                                .recipientType(recipient.getRecipientType())
                                .recipientName(recipient.getRecipientName())
                                .email(recipient.getEmail())
                                .phone(recipient.getPhone())
                                .fax(recipient.getFax())
                                .availableChannels(recipient.getAvailableChannels())
                                .suggestedChannel(recipient.hasEmail() ? "EMAIL" : (recipient.hasPhone() ? "SMS" : "FAX"))
                                .providerDirectoryId(recipient.getProviderDirectoryId())
                                .recipientSource(recipient.getRecipientSource())
                                .items(new ArrayList<>())
                                .build()
                );

                // Add item to group
                group.getItems().add(BulkRequestPreviewDTO.GroupedChecklistItem.builder()
                        .checklistItemId(item.getId())
                        .documentType(item.getDocumentType())
                        .documentSubtype(item.getDocumentSubtype())
                        .providerName(item.getProviderName())
                        .notes(item.getNotes())
                        .alreadyRequested(alreadyRequested)
                        .lastRequestedDate(lastRequestedDate)
                        .requestCount(item.getRequestCount())
                        .build());

                resolvedCount++;

                if (alreadyRequested) {
                    warnings.add("Item '" + item.getDocumentType() + "' was already requested on " + lastRequestedDate);
                }
            } else {
                // Add to unresolved
                unresolvedItems.add(BulkRequestPreviewDTO.UnresolvedItem.builder()
                        .checklistItemId(item.getId())
                        .documentType(item.getDocumentType())
                        .documentSubtype(item.getDocumentSubtype())
                        .providerName(item.getProviderName())
                        .recipientType(recipient.getRecipientType())
                        .resolutionMessage(recipient.getResolutionMessage())
                        .suggestedName(recipient.getRecipientName())
                        .suggestedTemplateCode(recipient.getSuggestedTemplateCode())
                        .build());

                unresolvedCount++;
            }
        }

        // Add grouping info to warnings if applicable
        long groupsWithMultipleItems = groupMap.values().stream()
                .filter(g -> g.getItems().size() > 1)
                .count();
        if (groupsWithMultipleItems > 0) {
            int totalGroupedItems = groupMap.values().stream()
                    .filter(g -> g.getItems().size() > 1)
                    .mapToInt(g -> g.getItems().size())
                    .sum();
            warnings.add(0, totalGroupedItems + " documents will be combined into " + groupsWithMultipleItems + " emails");
        }

        return BulkRequestPreviewDTO.builder()
                .totalItems(checklistItemIds.size())
                .resolvedCount(resolvedCount)
                .unresolvedCount(unresolvedCount)
                .recipientGroups(new ArrayList<>(groupMap.values()))
                .unresolvedItems(unresolvedItems)
                .warnings(warnings)
                .build();
    }

    @Override
    public BulkRequestSubmitDTO.BulkSendResult sendConfirmedBulkRequests(Long caseId, BulkRequestSubmitDTO submitRequest) {
        Long orgId = getRequiredOrganizationId();
        log.info("Sending confirmed bulk requests for case: {}, items: {}",
                caseId, submitRequest.getChecklistItemIds().size());

        LegalCase legalCase = caseRepository.findByIdAndOrganizationId(caseId, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Case not found"));

        // Build override map for quick lookup
        Map<Long, BulkRequestSubmitDTO.RecipientOverride> overrideMap = new HashMap<>();
        if (submitRequest.getRecipientOverrides() != null) {
            for (BulkRequestSubmitDTO.RecipientOverride override : submitRequest.getRecipientOverrides()) {
                overrideMap.put(override.getChecklistItemId(), override);
            }
        }

        // Skip set
        Set<Long> skipSet = submitRequest.getSkipItemIds() != null ?
                new HashSet<>(submitRequest.getSkipItemIds()) : new HashSet<>();

        // Group items by recipient
        Map<String, List<PIDocumentChecklist>> groupedItems = new LinkedHashMap<>();
        Map<String, DocumentRecipientDTO> groupRecipients = new HashMap<>();

        for (Long itemId : submitRequest.getChecklistItemIds()) {
            if (skipSet.contains(itemId)) continue;

            PIDocumentChecklist item = checklistRepository.findByIdAndOrganizationId(itemId, orgId).orElse(null);
            if (item == null) continue;

            DocumentRecipientDTO recipient;

            // Check for override
            if (overrideMap.containsKey(itemId)) {
                BulkRequestSubmitDTO.RecipientOverride override = overrideMap.get(itemId);
                recipient = DocumentRecipientDTO.builder()
                        .recipientType(override.getRecipientType())
                        .recipientName(override.getRecipientName())
                        .email(override.getEmail())
                        .phone(override.getPhone())
                        .fax(override.getFax())
                        .resolved(true)
                        .documentType(item.getDocumentType())
                        .availableChannels(getAvailableChannels(override.getEmail(), override.getPhone(), override.getFax()))
                        .build();

                // Save to directory if requested
                if (Boolean.TRUE.equals(override.getSaveToDirectory()) && Boolean.TRUE.equals(submitRequest.getSaveNewContacts())) {
                    saveToProviderDirectory(override, orgId);
                }
            } else {
                recipient = resolveRecipient(caseId, itemId);
                if (!Boolean.TRUE.equals(recipient.getResolved())) {
                    continue; // Skip unresolved items without override
                }
            }

            String groupKey = generateGroupKey(recipient);
            groupedItems.computeIfAbsent(groupKey, k -> new ArrayList<>()).add(item);
            groupRecipients.put(groupKey, recipient);
        }

        // Send grouped requests
        List<BulkRequestSubmitDTO.GroupSendResult> groupResults = new ArrayList<>();
        List<String> errors = new ArrayList<>();
        int sentCount = 0;
        int failedCount = 0;
        int emailsSent = 0;
        int smsSent = 0;

        for (Map.Entry<String, List<PIDocumentChecklist>> entry : groupedItems.entrySet()) {
            String groupKey = entry.getKey();
            List<PIDocumentChecklist> items = entry.getValue();
            DocumentRecipientDTO recipient = groupRecipients.get(groupKey);

            // Determine channel
            String channel = "EMAIL";
            if (submitRequest.getChannelOverrides() != null && submitRequest.getChannelOverrides().containsKey(groupKey)) {
                channel = submitRequest.getChannelOverrides().get(groupKey);
            } else if (submitRequest.getDefaultChannel() != null) {
                channel = submitRequest.getDefaultChannel();
            } else if (!recipient.hasEmail() && recipient.hasPhone()) {
                channel = "SMS";
            }

            try {
                // Build consolidated request body
                String consolidatedBody = buildConsolidatedRequestBody(items, recipient, legalCase, channel);
                String subject = buildConsolidatedSubject(items, legalCase);

                // Send the communication
                String externalMessageId = null;
                String channelStatus = "SENT";

                if ("EMAIL".equals(channel) && recipient.hasEmail()) {
                    boolean sent = emailService.sendEmail(recipient.getEmail(), subject, consolidatedBody);
                    channelStatus = sent ? "SENT" : "FAILED";
                    if (sent) emailsSent++;
                } else if ("SMS".equals(channel) && recipient.hasPhone()) {
                    SmsResponseDTO smsResponse = twilioService.sendSms(recipient.getPhone(), consolidatedBody);
                    externalMessageId = smsResponse.getMessageSid();
                    channelStatus = smsResponse.isSuccess() ? "SENT" : "FAILED";
                    if (smsResponse.isSuccess()) smsSent++;
                }

                // Create log entries for each item in the group
                Long firstLogId = null;
                for (PIDocumentChecklist item : items) {
                    PIDocumentRequestLog logEntry = PIDocumentRequestLog.builder()
                            .checklistItemId(item.getId())
                            .caseId(caseId)
                            .organizationId(orgId)
                            .recipientType(recipient.getRecipientType())
                            .recipientName(recipient.getRecipientName())
                            .recipientEmail(recipient.getEmail())
                            .recipientPhone(recipient.getPhone())
                            .recipientFax(recipient.getFax())
                            .channel(channel)
                            .channelStatus(channelStatus)
                            .externalMessageId(externalMessageId)
                            .requestSubject(subject)
                            .requestBody(consolidatedBody)
                            .sentAt(LocalDateTime.now())
                            .build();

                    PIDocumentRequestLog saved = requestLogRepository.save(logEntry);
                    if (firstLogId == null) firstLogId = saved.getId();

                    // Update checklist item
                    if (!"RECEIVED".equals(item.getStatus())) {
                        item.setStatus("REQUESTED");
                        item.setRequestedDate(LocalDate.now());
                        item.setRequestSentTo(recipient.getRecipientName());
                        item.setFollowUpDate(LocalDate.now().plusDays(14));
                        checklistRepository.save(item);
                    }
                }

                if ("SENT".equals(channelStatus)) {
                    sentCount += items.size();
                } else {
                    failedCount += items.size();
                }

                groupResults.add(BulkRequestSubmitDTO.GroupSendResult.builder()
                        .groupKey(groupKey)
                        .recipientName(recipient.getRecipientName())
                        .channel(channel)
                        .success("SENT".equals(channelStatus))
                        .checklistItemIds(items.stream().map(PIDocumentChecklist::getId).collect(Collectors.toList()))
                        .requestLogId(firstLogId)
                        .build());

            } catch (Exception e) {
                log.error("Error sending grouped request for {}: {}", groupKey, e.getMessage());
                failedCount += items.size();
                errors.add("Failed to send to " + recipient.getRecipientName() + ": " + e.getMessage());

                groupResults.add(BulkRequestSubmitDTO.GroupSendResult.builder()
                        .groupKey(groupKey)
                        .recipientName(recipient.getRecipientName())
                        .channel(channel)
                        .success(false)
                        .errorMessage(e.getMessage())
                        .checklistItemIds(items.stream().map(PIDocumentChecklist::getId).collect(Collectors.toList()))
                        .build());
            }
        }

        return BulkRequestSubmitDTO.BulkSendResult.builder()
                .totalItems(submitRequest.getChecklistItemIds().size())
                .sentCount(sentCount)
                .skippedCount(skipSet.size())
                .failedCount(failedCount)
                .emailsSent(emailsSent)
                .smsSent(smsSent)
                .groupResults(groupResults)
                .errors(errors)
                .build();
    }

    /**
     * Generate a unique key for grouping items by recipient.
     * Format: TYPE|NAME|EMAIL|PHONE
     */
    private String generateGroupKey(DocumentRecipientDTO recipient) {
        return String.format("%s|%s|%s|%s",
                recipient.getRecipientType() != null ? recipient.getRecipientType() : "",
                recipient.getRecipientName() != null ? recipient.getRecipientName().toLowerCase().trim() : "",
                recipient.getEmail() != null ? recipient.getEmail().toLowerCase().trim() : "",
                recipient.getPhone() != null ? recipient.getPhone().replaceAll("[^0-9]", "") : ""
        );
    }

    /**
     * Get available channels from contact info.
     */
    private List<String> getAvailableChannels(String email, String phone, String fax) {
        List<String> channels = new ArrayList<>();
        if (email != null && !email.trim().isEmpty()) channels.add("EMAIL");
        if (phone != null && !phone.trim().isEmpty()) channels.add("SMS");
        if (fax != null && !fax.trim().isEmpty()) channels.add("FAX");
        if (channels.isEmpty()) channels.add("IN_APP");
        return channels;
    }

    /**
     * Build consolidated request body for multiple documents to same recipient.
     */
    private String buildConsolidatedRequestBody(List<PIDocumentChecklist> items, DocumentRecipientDTO recipient,
                                                 LegalCase legalCase, String channel) {
        StringBuilder body = new StringBuilder();

        body.append("RE: Records Request for ").append(legalCase.getClientName()).append("\n\n");
        body.append("Dear Records Department,\n\n");
        body.append("Our law firm represents ").append(legalCase.getClientName());
        body.append(" in connection with injuries sustained on ");
        if (legalCase.getInjuryDate() != null) {
            body.append(legalCase.getInjuryDate());
        } else {
            body.append("[date of injury]");
        }
        body.append(".\n\n");

        body.append("We are requesting the following documents:\n\n");

        for (PIDocumentChecklist item : items) {
            body.append("• ").append(formatDocumentType(item.getDocumentType()));
            if (item.getDocumentSubtype() != null && !item.getDocumentSubtype().isEmpty()) {
                body.append(" (").append(item.getDocumentSubtype()).append(")");
            }
            if (item.getNotes() != null && !item.getNotes().isEmpty()) {
                body.append(" - ").append(item.getNotes());
            }
            body.append("\n");
        }

        body.append("\nPlease provide these records at your earliest convenience. ");
        body.append("We have enclosed a signed medical authorization.\n\n");
        body.append("Thank you for your prompt attention to this request.\n\n");
        body.append("Sincerely,\n");
        body.append("Records Department");

        return body.toString();
    }

    /**
     * Build consolidated subject line for grouped request.
     */
    private String buildConsolidatedSubject(List<PIDocumentChecklist> items, LegalCase legalCase) {
        if (items.size() == 1) {
            return "Records Request - " + legalCase.getClientName() + " - " + formatDocumentType(items.get(0).getDocumentType());
        }
        return "Records Request - " + legalCase.getClientName() + " (" + items.size() + " documents)";
    }

    /**
     * Format document type for display.
     */
    private String formatDocumentType(String docType) {
        if (docType == null) return "";
        String readable = docType.replace("_", " ");
        String[] words = readable.toLowerCase().split(" ");
        StringBuilder result = new StringBuilder();
        for (String word : words) {
            if (!word.isEmpty()) {
                if (result.length() > 0) result.append(" ");
                result.append(word.substring(0, 1).toUpperCase()).append(word.substring(1));
            }
        }
        return result.toString();
    }

    /**
     * Save a recipient override to the provider directory.
     */
    private void saveToProviderDirectory(BulkRequestSubmitDTO.RecipientOverride override, Long orgId) {
        try {
            String name = override.getProviderDirectoryName() != null ?
                    override.getProviderDirectoryName() : override.getRecipientName();

            // Check if already exists
            Optional<PIProviderDirectory> existing = providerDirectoryRepository
                    .findByOrganizationIdAndProviderName(orgId, name);

            if (existing.isEmpty()) {
                PIProviderDirectory provider = PIProviderDirectory.builder()
                        .organizationId(orgId)
                        .providerName(name)
                        .providerType(mapRecipientTypeToProviderType(override.getRecipientType()))
                        .recordsEmail(override.getEmail())
                        .recordsPhone(override.getPhone())
                        .recordsFax(override.getFax())
                        .build();
                providerDirectoryRepository.save(provider);
                log.info("Saved new provider to directory: {}", name);
            }
        } catch (Exception e) {
            log.warn("Failed to save provider to directory: {}", e.getMessage());
        }
    }

    /**
     * Map recipient type to provider type for directory.
     */
    private String mapRecipientTypeToProviderType(String recipientType) {
        if (recipientType == null) return "OTHER";
        return switch (recipientType) {
            case "MEDICAL_PROVIDER" -> "MEDICAL";
            case "BILLING_DEPT" -> "MEDICAL";
            case "INSURANCE_ADJUSTER" -> "INSURANCE";
            case "EMPLOYER_HR" -> "EMPLOYER";
            case "POLICE_DEPT" -> "GOVERNMENT";
            default -> "OTHER";
        };
    }

    private Map<String, String> buildTemplateVariables(LegalCase legalCase, PIDocumentChecklist item,
                                                        SendDocumentRequestDTO request) {
        Map<String, String> vars = new HashMap<>();
        Long orgId = getRequiredOrganizationId();

        // Client info
        vars.put("clientName", legalCase.getClientName() != null ? legalCase.getClientName() : "");
        vars.put("clientDob", request.getClientDob() != null ? request.getClientDob() : "");
        vars.put("caseNumber", legalCase.getCaseNumber() != null ? legalCase.getCaseNumber() : "");

        // Accident/injury info
        if (legalCase.getInjuryDate() != null) {
            vars.put("accidentDate", legalCase.getInjuryDate().toString());
        } else {
            vars.put("accidentDate", request.getAccidentDate() != null ? request.getAccidentDate() : "");
        }
        vars.put("accidentLocation", legalCase.getAccidentLocation() != null ?
                legalCase.getAccidentLocation() : (request.getAccidentLocation() != null ? request.getAccidentLocation() : ""));

        // Insurance info
        vars.put("claimNumber", legalCase.getInsurancePolicyNumber() != null ?
                legalCase.getInsurancePolicyNumber() : (request.getClaimNumber() != null ? request.getClaimNumber() : ""));
        vars.put("adjusterName", legalCase.getInsuranceAdjusterName() != null ?
                legalCase.getInsuranceAdjusterName() : (request.getAdjusterName() != null ? request.getAdjusterName() : ""));
        vars.put("defendantName", legalCase.getDefendantName() != null ?
                legalCase.getDefendantName() : (request.getDefendantName() != null ? request.getDefendantName() : ""));

        // Try to get treatment dates and account number from medical record if not provided
        String treatmentDates = request.getTreatmentDates();
        String accountNumber = request.getAccountNumber();
        String providerName = item != null ? item.getProviderName() : null;

        // For medical-related requests, try to pull data from medical records
        if (item != null && providerName != null && !providerName.isEmpty()) {
            String docType = item.getDocumentType();
            if ("MEDICAL_RECORDS".equals(docType) || "MEDICAL_BILLS".equals(docType)) {
                Optional<PIMedicalRecord> medicalRecord = medicalRecordRepository
                        .findByCaseIdAndOrganizationIdOrderByTreatmentDateAsc(legalCase.getId(), orgId)
                        .stream()
                        .filter(r -> providerName.equalsIgnoreCase(r.getProviderName()))
                        .findFirst();

                if (medicalRecord.isPresent()) {
                    PIMedicalRecord record = medicalRecord.get();
                    // Get treatment dates from medical record
                    if ((treatmentDates == null || treatmentDates.isEmpty()) && record.getTreatmentDate() != null) {
                        treatmentDates = record.getTreatmentDate().toString();
                        if (record.getTreatmentEndDate() != null) {
                            treatmentDates += " to " + record.getTreatmentEndDate().toString();
                        }
                    }
                }
            }
        }

        // Request-specific variables
        vars.put("treatmentDates", treatmentDates != null ? treatmentDates : "All dates of treatment");
        vars.put("accountNumber", accountNumber != null ? accountNumber : "");
        vars.put("reportNumber", request.getReportNumber() != null ? request.getReportNumber() : "");
        vars.put("witnessName", request.getWitnessName() != null ? request.getWitnessName() : "");
        vars.put("providerName", providerName != null ? providerName : "");

        // Build requestedDocuments from checklist item if not provided in request
        String requestedDocs = request.getRequestedDocuments();
        if (requestedDocs == null || requestedDocs.isEmpty()) {
            requestedDocs = buildRequestedDocumentsFromChecklist(item);
        }
        vars.put("requestedDocuments", requestedDocs);

        vars.put("reportFee", request.getReportFee() != null ? request.getReportFee() : "");

        // Firm info (would come from organization settings in production)
        vars.put("firmName", "Law Firm");
        vars.put("firmPhone", "(617) 555-0100");
        vars.put("firmFax", "(617) 555-0101");
        vars.put("firmEmail", "records@lawfirm.com");
        vars.put("firmAddress", "123 Legal Way, Boston, MA 02101");
        vars.put("senderName", "Records Department");

        return vars;
    }

    private String replaceTemplateVariables(String template, Map<String, String> variables) {
        if (template == null) return null;

        String result = template;
        for (Map.Entry<String, String> entry : variables.entrySet()) {
            result = result.replace("{{" + entry.getKey() + "}}", entry.getValue());
        }
        return result;
    }

    /**
     * Build a human-readable description of requested documents from the checklist item
     */
    private String buildRequestedDocumentsFromChecklist(PIDocumentChecklist item) {
        if (item == null) return "";

        StringBuilder docs = new StringBuilder();

        // Format document type nicely
        String docType = item.getDocumentType();
        if (docType != null) {
            // Convert SNAKE_CASE to readable format
            String readable = docType.replace("_", " ");
            // Capitalize first letter of each word
            String[] words = readable.toLowerCase().split(" ");
            for (int i = 0; i < words.length; i++) {
                if (!words[i].isEmpty()) {
                    words[i] = words[i].substring(0, 1).toUpperCase() + words[i].substring(1);
                }
            }
            docs.append("• ").append(String.join(" ", words));
        }

        // Add subtype if available
        if (item.getDocumentSubtype() != null && !item.getDocumentSubtype().isEmpty()) {
            docs.append(" (").append(item.getDocumentSubtype()).append(")");
        }

        // Add provider if available
        if (item.getProviderName() != null && !item.getProviderName().isEmpty()) {
            docs.append(" from ").append(item.getProviderName());
        }

        // Add notes if available
        if (item.getNotes() != null && !item.getNotes().isEmpty()) {
            docs.append("\n\n").append("Additional details: ").append(item.getNotes());
        }

        return docs.toString();
    }

    // ========================
    // Request History
    // ========================

    @Override
    public List<PIDocumentRequestLogDTO> getRequestHistory(Long caseId, Long checklistItemId) {
        Long orgId = getRequiredOrganizationId();
        return requestLogRepository.findByChecklistItemIdAndOrganizationIdOrderBySentAtDesc(checklistItemId, orgId)
                .stream()
                .map(log -> mapToLogDTO(log, null))
                .collect(Collectors.toList());
    }

    @Override
    public List<PIDocumentRequestLogDTO> getCaseRequestHistory(Long caseId) {
        Long orgId = getRequiredOrganizationId();
        return requestLogRepository.findByCaseIdAndOrganizationIdOrderBySentAtDesc(caseId, orgId)
                .stream()
                .map(log -> mapToLogDTO(log, null))
                .collect(Collectors.toList());
    }

    @Override
    public Map<String, Object> getCaseRequestStats(Long caseId) {
        Long orgId = getRequiredOrganizationId();

        Map<String, Object> stats = new HashMap<>();
        List<PIDocumentRequestLog> logs = requestLogRepository.findByCaseIdAndOrganizationIdOrderBySentAtDesc(caseId, orgId);

        stats.put("totalRequests", logs.size());
        stats.put("sentCount", logs.stream().filter(l -> "SENT".equals(l.getChannelStatus())).count());
        stats.put("failedCount", logs.stream().filter(l -> "FAILED".equals(l.getChannelStatus())).count());
        stats.put("totalPaidFees", requestLogRepository.calculateTotalPaidFees(caseId, orgId));
        stats.put("totalPendingFees", requestLogRepository.calculateTotalPendingFees(caseId, orgId));

        // By channel
        Map<String, Long> byChannel = logs.stream()
                .collect(Collectors.groupingBy(PIDocumentRequestLog::getChannel, Collectors.counting()));
        stats.put("byChannel", byChannel);

        return stats;
    }

    // ========================
    // Templates
    // ========================

    @Override
    public List<PIDocumentRequestTemplateDTO> getTemplates() {
        Long orgId = getRequiredOrganizationId();
        return templateRepository.findActiveTemplates(orgId)
                .stream()
                .map(this::mapToTemplateDTO)
                .collect(Collectors.toList());
    }

    @Override
    public List<PIDocumentRequestTemplateDTO> getTemplatesByDocumentType(String documentType) {
        Long orgId = getRequiredOrganizationId();
        return templateRepository.findByDocumentType(orgId, documentType)
                .stream()
                .map(this::mapToTemplateDTO)
                .collect(Collectors.toList());
    }

    @Override
    public PIDocumentRequestTemplateDTO getTemplateById(Long templateId) {
        Long orgId = getRequiredOrganizationId();
        PIDocumentRequestTemplate template = templateRepository.findByIdAndOrganization(templateId, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Template not found"));
        return mapToTemplateDTO(template);
    }

    @Override
    public PIDocumentRequestTemplateDTO getTemplateByCode(String templateCode) {
        Long orgId = getRequiredOrganizationId();
        List<PIDocumentRequestTemplate> templates = templateRepository.findByTemplateCode(orgId, templateCode);
        if (templates.isEmpty()) {
            throw new ResourceNotFoundException("Template not found with code: " + templateCode);
        }
        return mapToTemplateDTO(templates.get(0));
    }

    @Override
    public PIDocumentRequestTemplateDTO previewTemplate(Long templateId, Long caseId, Long checklistItemId) {
        Long orgId = getRequiredOrganizationId();

        PIDocumentRequestTemplate template = templateRepository.findByIdAndOrganization(templateId, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Template not found"));

        LegalCase legalCase = caseRepository.findByIdAndOrganizationId(caseId, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Case not found"));

        PIDocumentChecklist item = checklistRepository.findByIdAndOrganizationId(checklistItemId, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Checklist item not found"));

        Map<String, String> variables = buildTemplateVariables(legalCase, item, new SendDocumentRequestDTO());

        PIDocumentRequestTemplateDTO dto = mapToTemplateDTO(template);
        dto.setPreviewSubject(replaceTemplateVariables(template.getEmailSubject(), variables));
        dto.setPreviewBody(replaceTemplateVariables(template.getEmailBody(), variables));

        return dto;
    }

    // ========================
    // Fee Tracking
    // ========================

    @Override
    public PIDocumentRequestLogDTO updateFeeStatus(Long requestLogId, String feeStatus) {
        Long orgId = getRequiredOrganizationId();

        PIDocumentRequestLog log = requestLogRepository.findById(requestLogId)
                .filter(l -> l.getOrganizationId().equals(orgId))
                .orElseThrow(() -> new ResourceNotFoundException("Request log not found"));

        log.setFeeStatus(feeStatus);
        PIDocumentRequestLog saved = requestLogRepository.save(log);

        return mapToLogDTO(saved, null);
    }

    // ========================
    // Mapping Helpers
    // ========================

    private PIDocumentRequestLogDTO mapToLogDTO(PIDocumentRequestLog entity, PIDocumentRequestTemplate template) {
        return PIDocumentRequestLogDTO.builder()
                .id(entity.getId())
                .checklistItemId(entity.getChecklistItemId())
                .caseId(entity.getCaseId())
                .organizationId(entity.getOrganizationId())
                .recipientType(entity.getRecipientType())
                .recipientName(entity.getRecipientName())
                .recipientEmail(entity.getRecipientEmail())
                .recipientPhone(entity.getRecipientPhone())
                .recipientFax(entity.getRecipientFax())
                .channel(entity.getChannel())
                .channelStatus(entity.getChannelStatus())
                .externalMessageId(entity.getExternalMessageId())
                .templateId(entity.getTemplateId())
                .templateCode(entity.getTemplateCode())
                .templateName(template != null ? template.getTemplateName() : null)
                .requestSubject(entity.getRequestSubject())
                .requestBody(entity.getRequestBody())
                .documentFee(entity.getDocumentFee())
                .feeStatus(entity.getFeeStatus())
                .sentAt(entity.getSentAt())
                .sentBy(entity.getSentBy())
                .createdAt(entity.getCreatedAt())
                .build();
    }

    private PIDocumentRequestTemplateDTO mapToTemplateDTO(PIDocumentRequestTemplate entity) {
        return PIDocumentRequestTemplateDTO.builder()
                .id(entity.getId())
                .organizationId(entity.getOrganizationId())
                .templateCode(entity.getTemplateCode())
                .templateName(entity.getTemplateName())
                .documentType(entity.getDocumentType())
                .recipientType(entity.getRecipientType())
                .emailSubject(entity.getEmailSubject())
                .emailBody(entity.getEmailBody())
                .smsBody(entity.getSmsBody())
                .isActive(entity.getIsActive())
                .isSystem(entity.getIsSystem())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}
