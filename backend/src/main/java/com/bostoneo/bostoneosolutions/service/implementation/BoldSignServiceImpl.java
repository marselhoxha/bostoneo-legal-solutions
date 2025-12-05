package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.config.BoldSignConfig;
import com.bostoneo.bostoneosolutions.dto.*;
import com.bostoneo.bostoneosolutions.enumeration.SignatureStatus;
import com.bostoneo.bostoneosolutions.exception.ApiException;
import com.bostoneo.bostoneosolutions.model.SignatureAuditLog;
import com.bostoneo.bostoneosolutions.model.SignatureRequest;
import com.bostoneo.bostoneosolutions.model.SignatureTemplate;
import com.bostoneo.bostoneosolutions.repository.OrganizationRepository;
import com.bostoneo.bostoneosolutions.repository.SignatureAuditLogRepository;
import com.bostoneo.bostoneosolutions.repository.SignatureRequestRepository;
import com.bostoneo.bostoneosolutions.repository.SignatureTemplateRepository;
import com.bostoneo.bostoneosolutions.service.BoldSignService;
import com.bostoneo.bostoneosolutions.service.SignatureReminderService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class BoldSignServiceImpl implements BoldSignService {

    private final BoldSignConfig boldSignConfig;
    private final SignatureRequestRepository signatureRequestRepository;
    private final SignatureAuditLogRepository signatureAuditLogRepository;
    private final SignatureTemplateRepository signatureTemplateRepository;
    private final OrganizationRepository organizationRepository;
    private final SignatureReminderService signatureReminderService;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    // ==================== Signature Requests ====================

    @Override
    public SignatureRequestDTO createSignatureRequest(CreateSignatureRequestDTO request, Long userId) {
        validateBoldSignEnabled();

        SignatureRequest signatureRequest = buildSignatureRequest(request, userId);

        // Send to BoldSign
        String boldsignDocumentId = sendToBoldSign(signatureRequest, request);
        signatureRequest.setBoldsignDocumentId(boldsignDocumentId);
        signatureRequest.setStatus(SignatureStatus.SENT);
        signatureRequest.setSentAt(LocalDateTime.now());

        signatureRequest = signatureRequestRepository.save(signatureRequest);

        // Log audit event
        logAuditEvent(signatureRequest, SignatureAuditLog.EVENT_CREATED, userId, null);
        logAuditEvent(signatureRequest, SignatureAuditLog.EVENT_SENT, userId, null);

        // Schedule reminders
        signatureReminderService.scheduleReminders(signatureRequest);

        log.info("Created and sent signature request {} for organization {}",
                signatureRequest.getId(), signatureRequest.getOrganizationId());

        return toDTO(signatureRequest);
    }

    @Override
    public SignatureRequestDTO createDraftSignatureRequest(CreateSignatureRequestDTO request, Long userId) {
        SignatureRequest signatureRequest = buildSignatureRequest(request, userId);
        signatureRequest.setStatus(SignatureStatus.DRAFT);
        signatureRequest = signatureRequestRepository.save(signatureRequest);

        logAuditEvent(signatureRequest, SignatureAuditLog.EVENT_CREATED, userId, null);

        log.info("Created draft signature request {} for organization {}",
                signatureRequest.getId(), signatureRequest.getOrganizationId());

        return toDTO(signatureRequest);
    }

    @Override
    public SignatureRequestDTO sendSignatureRequest(Long requestId, Long userId) {
        validateBoldSignEnabled();

        SignatureRequest signatureRequest = signatureRequestRepository.findById(requestId)
                .orElseThrow(() -> new ApiException("Signature request not found"));

        if (signatureRequest.getStatus() != SignatureStatus.DRAFT) {
            throw new ApiException("Only draft requests can be sent");
        }

        // Send to BoldSign
        String boldsignDocumentId = sendToBoldSign(signatureRequest, null);
        signatureRequest.setBoldsignDocumentId(boldsignDocumentId);
        signatureRequest.setStatus(SignatureStatus.SENT);
        signatureRequest.setSentAt(LocalDateTime.now());

        signatureRequest = signatureRequestRepository.save(signatureRequest);

        logAuditEvent(signatureRequest, SignatureAuditLog.EVENT_SENT, userId, null);

        // Schedule reminders
        signatureReminderService.scheduleReminders(signatureRequest);

        log.info("Sent signature request {} to BoldSign", signatureRequest.getId());

        return toDTO(signatureRequest);
    }

    @Override
    @Transactional(readOnly = true)
    public SignatureRequestDTO getSignatureRequest(Long id) {
        SignatureRequest request = signatureRequestRepository.findById(id)
                .orElseThrow(() -> new ApiException("Signature request not found"));
        return toDTO(request);
    }

    @Override
    @Transactional(readOnly = true)
    public SignatureRequestDTO getSignatureRequestByBoldsignId(String boldsignDocumentId) {
        SignatureRequest request = signatureRequestRepository.findByBoldsignDocumentId(boldsignDocumentId)
                .orElseThrow(() -> new ApiException("Signature request not found"));
        return toDTO(request);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<SignatureRequestDTO> getSignatureRequestsByOrganization(Long organizationId, Pageable pageable) {
        return signatureRequestRepository.findByOrganizationId(organizationId, pageable)
                .map(this::toDTO);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<SignatureRequestDTO> getSignatureRequestsByCase(Long caseId, Long organizationId, Pageable pageable) {
        return signatureRequestRepository.findByCaseIdAndOrganizationId(caseId, organizationId, pageable)
                .map(this::toDTO);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<SignatureRequestDTO> getSignatureRequestsByClient(Long clientId, Long organizationId, Pageable pageable) {
        return signatureRequestRepository.findByClientIdAndOrganizationId(clientId, organizationId, pageable)
                .map(this::toDTO);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<SignatureRequestDTO> searchSignatureRequests(Long organizationId, String search, Pageable pageable) {
        return signatureRequestRepository.searchByOrganization(organizationId, search, pageable)
                .map(this::toDTO);
    }

    @Override
    public SignatureRequestDTO voidSignatureRequest(Long requestId, String reason, Long userId) {
        SignatureRequest request = signatureRequestRepository.findById(requestId)
                .orElseThrow(() -> new ApiException("Signature request not found"));

        if (request.isCompleted() || request.isCancelled()) {
            throw new ApiException("Cannot void a completed or cancelled request");
        }

        // Void in BoldSign if sent
        if (request.getBoldsignDocumentId() != null) {
            voidInBoldSign(request.getBoldsignDocumentId(), reason);
        }

        request.setStatus(SignatureStatus.VOIDED);
        request.setDeclineReason(reason);
        request = signatureRequestRepository.save(request);

        // Cancel any pending reminders
        signatureReminderService.cancelReminders(requestId);

        logAuditEvent(request, SignatureAuditLog.EVENT_VOIDED, userId, "{\"reason\":\"" + reason + "\"}");

        log.info("Voided signature request {}", requestId);

        return toDTO(request);
    }

    @Override
    public SignatureRequestDTO sendReminder(Long requestId, Long userId) {
        SignatureRequest request = signatureRequestRepository.findById(requestId)
                .orElseThrow(() -> new ApiException("Signature request not found"));

        if (!request.canSendReminder()) {
            throw new ApiException("Cannot send reminder for this request");
        }

        // Send reminder via BoldSign
        if (request.getBoldsignDocumentId() != null) {
            sendReminderViaBoldSign(request.getBoldsignDocumentId());
        }

        request.setLastReminderSentAt(LocalDateTime.now());
        request.setReminderCount(request.getReminderCount() + 1);
        request = signatureRequestRepository.save(request);

        logAuditEvent(request, SignatureAuditLog.EVENT_REMINDER_SENT, userId, null);

        log.info("Sent reminder for signature request {}", requestId);

        return toDTO(request);
    }

    @Override
    public String getEmbeddedSigningUrl(Long requestId, String signerEmail) {
        SignatureRequest request = signatureRequestRepository.findById(requestId)
                .orElseThrow(() -> new ApiException("Signature request not found"));

        if (!request.isPending()) {
            throw new ApiException("Cannot get signing URL for non-pending request");
        }

        return getEmbeddedSigningUrlFromBoldSign(request.getBoldsignDocumentId(), signerEmail);
    }

    @Override
    public byte[] downloadSignedDocument(Long requestId) {
        SignatureRequest request = signatureRequestRepository.findById(requestId)
                .orElseThrow(() -> new ApiException("Signature request not found"));

        if (!request.isCompleted()) {
            throw new ApiException("Document is not yet signed");
        }

        return downloadFromBoldSign(request.getBoldsignDocumentId());
    }

    @Override
    public SignatureRequestDTO refreshStatus(Long requestId) {
        SignatureRequest request = signatureRequestRepository.findById(requestId)
                .orElseThrow(() -> new ApiException("Signature request not found"));

        if (request.getBoldsignDocumentId() == null) {
            return toDTO(request);
        }

        // Get status from BoldSign
        JsonNode status = getStatusFromBoldSign(request.getBoldsignDocumentId());
        updateRequestFromBoldSignStatus(request, status);

        request = signatureRequestRepository.save(request);
        return toDTO(request);
    }

    // ==================== Embedded URLs ====================

    @Override
    public EmbeddedUrlDTO getEmbeddedSendDocumentUrl(EmbeddedRequestOptions options) {
        validateBoldSignEnabled();

        HttpHeaders headers = new HttpHeaders();
        headers.set("X-API-KEY", boldSignConfig.getApiKey());
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();

        // Document title and message
        if (options.title() != null) {
            body.add("Title", options.title());
        }
        if (options.message() != null) {
            body.add("Message", options.message());
        }

        // Add signer info - required by BoldSign
        if (options.signerName() != null && options.signerEmail() != null) {
            body.add("Signers[0][Name]", options.signerName());
            body.add("Signers[0][EmailAddress]", options.signerEmail());
            body.add("Signers[0][SignerOrder]", "1");
            body.add("Signers[0][SignerType]", "Signer");
        }

        // Add file as base64
        if (options.fileBase64() != null && options.fileName() != null) {
            // Decode base64 to bytes and create a ByteArrayResource
            byte[] fileBytes = java.util.Base64.getDecoder().decode(options.fileBase64());
            org.springframework.core.io.ByteArrayResource fileResource = new org.springframework.core.io.ByteArrayResource(fileBytes) {
                @Override
                public String getFilename() {
                    return options.fileName();
                }
            };
            body.add("Files", fileResource);
        }

        // Embedded UI options
        body.add("ShowToolbar", String.valueOf(options.showToolbar()));
        body.add("ShowSendButton", String.valueOf(options.showSendButton()));
        body.add("ShowSaveButton", String.valueOf(options.showSaveButton()));
        body.add("ShowPreviewButton", String.valueOf(options.showPreviewButton()));
        body.add("ShowNavigationButtons", String.valueOf(options.showNavigationButtons()));
        body.add("SendViewOption", options.sendViewOption());
        body.add("Locale", options.locale());

        if (options.redirectUrl() != null) {
            body.add("RedirectUrl", options.redirectUrl());
        }
        if (options.linkValidForDays() != null) {
            body.add("LinkValidTill", java.time.LocalDateTime.now()
                    .plusDays(options.linkValidForDays())
                    .format(java.time.format.DateTimeFormatter.ISO_DATE_TIME));
        }

        HttpEntity<MultiValueMap<String, Object>> request = new HttpEntity<>(body, headers);

        try {
            ResponseEntity<String> response = restTemplate.postForEntity(
                    boldSignConfig.getEmbeddedRequestUrl(),
                    request,
                    String.class
            );

            log.debug("BoldSign response: {}", response.getBody());
            JsonNode responseBody = objectMapper.readTree(response.getBody());
            String url = responseBody.path("sendUrl").asText();
            String documentId = responseBody.path("documentId").asText();

            log.info("Generated embedded send document URL for organization {}: documentId={}", options.organizationId(), documentId);

            // Create a SignatureRequest record in SENT status
            // The document is created in BoldSign and will be sent when user clicks Send in the UI
            if (documentId != null && !documentId.isEmpty() && options.createdBy() != null) {
                SignatureRequest signatureRequest = SignatureRequest.builder()
                        .organizationId(options.organizationId())
                        .boldsignDocumentId(documentId)
                        .title(options.title() != null ? options.title() : "Untitled Document")
                        .message(options.message())
                        .fileName(options.fileName())
                        .signerName(options.signerName() != null ? options.signerName() : "Unknown")
                        .signerEmail(options.signerEmail() != null ? options.signerEmail() : "unknown@example.com")
                        .status(SignatureStatus.SENT)
                        .sentAt(LocalDateTime.now())
                        .expiresAt(LocalDateTime.now().plusDays(options.linkValidForDays() != null ? options.linkValidForDays() : 30))
                        .createdBy(options.createdBy())
                        .clientId(options.clientId())
                        .caseId(options.caseId())
                        .reminderEmail(true)
                        .reminderSms(false)
                        .reminderWhatsapp(false)
                        .reminderCount(0)
                        .build();

                signatureRequest = signatureRequestRepository.save(signatureRequest);
                log.info("Created SignatureRequest id={} for BoldSign documentId={}", signatureRequest.getId(), documentId);

                // Log audit event
                logAuditEvent(signatureRequest, SignatureAuditLog.EVENT_CREATED, options.createdBy(), null);
            }

            return new EmbeddedUrlDTO(url, documentId, null, null);

        } catch (Exception e) {
            log.error("Failed to get embedded send document URL: {}", e.getMessage());
            throw new ApiException("Failed to get embedded document URL: " + e.getMessage());
        }
    }

    @Override
    public EmbeddedUrlDTO getEmbeddedCreateTemplateUrl(EmbeddedTemplateOptions options) {
        validateBoldSignEnabled();

        // BoldSign requires multipart/form-data with at least one file
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-API-KEY", boldSignConfig.getApiKey());
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();

        // Template title
        body.add("Title", options.title() != null ? options.title() : "New Template");
        body.add("Description", options.description() != null ? options.description() : "");
        body.add("DocumentTitle", options.title() != null ? options.title() : "New Template");

        // Roles - at least one required
        body.add("Roles[0][name]", "Signer");
        body.add("Roles[0][index]", "1");
        body.add("Roles[0][signerOrder]", "1");
        body.add("Roles[0][signerType]", "Signer");

        // Use user's file if provided, otherwise use placeholder PDF
        byte[] pdfBytes;
        String pdfFileName;

        if (options.fileBase64() != null && !options.fileBase64().isEmpty()) {
            // User provided their own file
            pdfBytes = java.util.Base64.getDecoder().decode(options.fileBase64());
            pdfFileName = options.fileName() != null ? options.fileName() : "template-document.pdf";
            log.debug("Using user-provided file: {}", pdfFileName);
        } else {
            // Provide a valid blank PDF as placeholder
            String blankPdfBase64 = "JVBERi0xLjcKCjEgMCBvYmogICUgZW50cnkgcG9pbnQKPDwKICAvVHlwZSAvQ2F0YWxvZwog" +
                    "IC9QYWdlcyAyIDAgUgo+PgplbmRvYmoKCjIgMCBvYmoKPDwKICAvVHlwZSAvUGFnZXMKICAv" +
                    "TWVkaWFCb3ggWyAwIDAgNjEyIDc5MiBdCiAgL0NvdW50IDEKICAvS2lkcyBbIDMgMCBSIF0K" +
                    "Pj4KZW5kb2JqCgozIDAgb2JqCjw8CiAgL1R5cGUgL1BhZ2UKICAvUGFyZW50IDIgMCBSCiAg" +
                    "L1Jlc291cmNlcyA8PAogICAgL0ZvbnQgPDwKICAgICAgL0YxIDQgMCBSIAogICAgPj4KICA+" +
                    "PgogIC9Db250ZW50cyA1IDAgUgo+PgplbmRvYmoKCjQgMCBvYmoKPDwKICAvVHlwZSAvRm9u" +
                    "dAogIC9TdWJ0eXBlIC9UeXBlMQogIC9CYXNlRm9udCAvVGltZXMtUm9tYW4KPj4KZW5kb2Jq" +
                    "Cgo1IDAgb2JqICAlIHBhZ2UgY29udGVudAo8PAogIC9MZW5ndGggNDQKPj4Kc3RyZWFtCkJU" +
                    "CjcwIDUwIFRECi9GMSAxMiBUZgooVGVtcGxhdGUgRG9jdW1lbnQpIFRqCkVUCmVuZHN0cmVh" +
                    "bQplbmRvYmoKCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAxMCAwMDAw" +
                    "MCBuIAowMDAwMDAwMDc5IDAwMDAwIG4gCjAwMDAwMDAxNzMgMDAwMDAgbiAKMDAwMDAwMDMw" +
                    "MSAwMDAwMCBuIAowMDAwMDAwMzgwIDAwMDAwIG4gCnRyYWlsZXIKPDwKICAvU2l6ZSA2CiAg" +
                    "L1Jvb3QgMSAwIFIKPj4Kc3RhcnR4cmVmCjQ5MgolJUVPRgo=";
            pdfBytes = java.util.Base64.getDecoder().decode(blankPdfBase64);
            pdfFileName = "template-placeholder.pdf";
            log.debug("Using placeholder PDF");
        }

        final String finalPdfFileName = pdfFileName;
        org.springframework.core.io.ByteArrayResource fileResource = new org.springframework.core.io.ByteArrayResource(pdfBytes) {
            @Override
            public String getFilename() {
                return finalPdfFileName;
            }
        };
        body.add("Files", fileResource);

        // UI options
        body.add("ShowToolbar", String.valueOf(options.showToolbar()));
        body.add("ShowSaveButton", String.valueOf(options.showSaveButton()));
        body.add("ShowSendButton", "true");
        body.add("ShowPreviewButton", String.valueOf(options.showPreviewButton()));
        body.add("ShowNavigationButtons", "true");
        body.add("ViewOption", options.viewOption());
        body.add("AllowNewFiles", "true");
        body.add("AllowModifyFiles", "true");

        if (options.redirectUrl() != null) {
            body.add("RedirectUrl", options.redirectUrl());
        }
        if (options.linkValidForDays() != null) {
            body.add("LinkValidTill", java.time.LocalDateTime.now()
                    .plusDays(options.linkValidForDays())
                    .format(java.time.format.DateTimeFormatter.ISO_DATE_TIME));
        }

        HttpEntity<MultiValueMap<String, Object>> request = new HttpEntity<>(body, headers);

        try {
            log.debug("BoldSign create template request with placeholder PDF");
            ResponseEntity<String> response = restTemplate.postForEntity(
                    boldSignConfig.getEmbeddedTemplateCreateUrl(),
                    request,
                    String.class
            );

            JsonNode responseBody = objectMapper.readTree(response.getBody());
            String url = responseBody.path("createUrl").asText();
            String templateId = responseBody.path("templateId").asText();

            log.info("Generated embedded create template URL for organization {}", options.organizationId());

            return new EmbeddedUrlDTO(url, null, templateId, null);

        } catch (Exception e) {
            log.error("Failed to get embedded create template URL: {}", e.getMessage());
            throw new ApiException("Failed to get embedded template URL: " + e.getMessage());
        }
    }

    @Override
    public EmbeddedUrlDTO getEmbeddedEditTemplateUrl(String boldsignTemplateId) {
        validateBoldSignEnabled();

        HttpHeaders headers = new HttpHeaders();
        headers.set("X-API-KEY", boldSignConfig.getApiKey());

        try {
            ResponseEntity<String> response = restTemplate.exchange(
                    boldSignConfig.getEmbeddedTemplateEditUrl(boldsignTemplateId),
                    HttpMethod.GET,
                    new HttpEntity<>(headers),
                    String.class
            );

            JsonNode responseBody = objectMapper.readTree(response.getBody());
            String url = responseBody.path("editUrl").asText();

            log.info("Generated embedded edit template URL for template {}", boldsignTemplateId);

            return new EmbeddedUrlDTO(url, null, boldsignTemplateId, null);

        } catch (Exception e) {
            log.error("Failed to get embedded edit template URL: {}", e.getMessage());
            throw new ApiException("Failed to get embedded template edit URL: " + e.getMessage());
        }
    }

    @Override
    public EmbeddedUrlDTO getEmbeddedSendFromTemplateUrl(String boldsignTemplateId, EmbeddedRequestFromTemplateOptions options) {
        validateBoldSignEnabled();

        HttpHeaders headers = new HttpHeaders();
        headers.set("X-API-KEY", boldSignConfig.getApiKey());
        headers.setContentType(MediaType.APPLICATION_JSON);

        var requestBody = new java.util.HashMap<String, Object>();
        requestBody.put("ShowToolbar", options.showToolbar());
        requestBody.put("ShowSendButton", options.showSendButton());
        requestBody.put("ShowPreviewButton", options.showPreviewButton());
        requestBody.put("Locale", options.locale());

        // Add signer info if provided
        if (options.signerName() != null && options.signerEmail() != null) {
            var roles = new java.util.ArrayList<java.util.Map<String, Object>>();
            var role = new java.util.HashMap<String, Object>();
            role.put("roleIndex", 1);
            role.put("signerName", options.signerName());
            role.put("signerEmail", options.signerEmail());
            roles.add(role);
            requestBody.put("Roles", roles);
        }

        if (options.redirectUrl() != null) {
            requestBody.put("RedirectUrl", options.redirectUrl());
        }

        HttpEntity<java.util.Map<String, Object>> request = new HttpEntity<>(requestBody, headers);

        try {
            String url = boldSignConfig.getEmbeddedRequestFromTemplateUrl() + "?templateId=" + boldsignTemplateId;
            ResponseEntity<String> response = restTemplate.postForEntity(
                    url,
                    request,
                    String.class
            );

            JsonNode responseBody = objectMapper.readTree(response.getBody());
            String embeddedUrl = responseBody.path("sendUrl").asText();
            String documentId = responseBody.path("documentId").asText();

            log.info("Generated embedded send from template URL for template {}", boldsignTemplateId);

            return new EmbeddedUrlDTO(embeddedUrl, documentId, boldsignTemplateId, null);

        } catch (Exception e) {
            log.error("Failed to get embedded send from template URL: {}", e.getMessage());
            throw new ApiException("Failed to get embedded template send URL: " + e.getMessage());
        }
    }

    // ==================== Templates ====================

    @Override
    @Transactional(readOnly = true)
    public List<SignatureTemplateDTO> getTemplatesForOrganization(Long organizationId) {
        return signatureTemplateRepository.findAvailableForOrganization(organizationId)
                .stream()
                .map(this::toTemplateDTO)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<SignatureTemplateDTO> getTemplatesByCategory(Long organizationId, String category) {
        return signatureTemplateRepository.findAvailableByCategoryForOrganization(organizationId, category)
                .stream()
                .map(this::toTemplateDTO)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public SignatureTemplateDTO getTemplate(Long id) {
        SignatureTemplate template = signatureTemplateRepository.findById(id)
                .orElseThrow(() -> new ApiException("Template not found"));
        return toTemplateDTO(template);
    }

    @Override
    public SignatureTemplateDTO createTemplate(SignatureTemplateDTO dto, Long userId) {
        SignatureTemplate template = SignatureTemplate.builder()
                .organizationId(dto.getOrganizationId())
                .name(dto.getName())
                .description(dto.getDescription())
                .category(dto.getCategory())
                .fileName(dto.getFileName())
                .fileUrl(dto.getFileUrl())
                .fieldConfig(dto.getFieldConfig())
                .defaultExpiryDays(dto.getDefaultExpiryDays() != null ? dto.getDefaultExpiryDays() : 30)
                .defaultReminderEmail(dto.getDefaultReminderEmail() != null ? dto.getDefaultReminderEmail() : true)
                .defaultReminderSms(dto.getDefaultReminderSms() != null ? dto.getDefaultReminderSms() : true)
                .isActive(true)
                .isGlobal(false)
                .createdBy(userId)
                .build();

        template = signatureTemplateRepository.save(template);
        log.info("Created signature template {} for organization {}", template.getId(), template.getOrganizationId());

        return toTemplateDTO(template);
    }

    @Override
    public SignatureTemplateDTO updateTemplate(Long id, SignatureTemplateDTO dto) {
        SignatureTemplate template = signatureTemplateRepository.findById(id)
                .orElseThrow(() -> new ApiException("Template not found"));

        if (template.getIsGlobal()) {
            throw new ApiException("Cannot modify global templates");
        }

        if (dto.getName() != null) template.setName(dto.getName());
        if (dto.getDescription() != null) template.setDescription(dto.getDescription());
        if (dto.getCategory() != null) template.setCategory(dto.getCategory());
        if (dto.getFileName() != null) template.setFileName(dto.getFileName());
        if (dto.getFileUrl() != null) template.setFileUrl(dto.getFileUrl());
        if (dto.getFieldConfig() != null) template.setFieldConfig(dto.getFieldConfig());
        if (dto.getDefaultExpiryDays() != null) template.setDefaultExpiryDays(dto.getDefaultExpiryDays());
        if (dto.getDefaultReminderEmail() != null) template.setDefaultReminderEmail(dto.getDefaultReminderEmail());
        if (dto.getDefaultReminderSms() != null) template.setDefaultReminderSms(dto.getDefaultReminderSms());

        template = signatureTemplateRepository.save(template);
        return toTemplateDTO(template);
    }

    @Override
    public void deleteTemplate(Long id) {
        SignatureTemplate template = signatureTemplateRepository.findById(id)
                .orElseThrow(() -> new ApiException("Template not found"));

        if (template.getIsGlobal()) {
            throw new ApiException("Cannot delete global templates");
        }

        template.setIsActive(false);
        signatureTemplateRepository.save(template);
        log.info("Deactivated signature template {}", id);
    }

    @Override
    @Transactional(readOnly = true)
    public List<String> getTemplateCategories(Long organizationId) {
        return signatureTemplateRepository.findDistinctCategoriesForOrganization(organizationId);
    }

    // ==================== Audit Logs ====================

    @Override
    @Transactional(readOnly = true)
    public List<SignatureAuditLogDTO> getAuditLogs(Long signatureRequestId) {
        return signatureAuditLogRepository.findBySignatureRequestIdOrderByCreatedAtDesc(signatureRequestId)
                .stream()
                .map(this::toAuditLogDTO)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Page<SignatureAuditLogDTO> getAuditLogsByOrganization(Long organizationId, Pageable pageable) {
        return signatureAuditLogRepository.findByOrganizationId(organizationId, pageable)
                .map(this::toAuditLogDTO);
    }

    // ==================== Webhooks ====================

    @Override
    public void processWebhookEvent(String eventType, String payload, String signature) {
        // Validate webhook signature
        if (boldSignConfig.getWebhookSecret() != null && !boldSignConfig.getWebhookSecret().isEmpty()) {
            // TODO: Implement signature validation
        }

        try {
            JsonNode eventData = objectMapper.readTree(payload);
            String documentId = eventData.path("documentId").asText();

            if (documentId == null || documentId.isEmpty()) {
                log.warn("Webhook event missing documentId: {}", eventType);
                return;
            }

            SignatureRequest request = signatureRequestRepository.findByBoldsignDocumentId(documentId)
                    .orElse(null);

            if (request == null) {
                log.warn("Signature request not found for BoldSign document: {}", documentId);
                return;
            }

            handleWebhookEvent(request, eventType, eventData);

        } catch (JsonProcessingException e) {
            log.error("Failed to parse webhook payload: {}", e.getMessage());
            throw new ApiException("Invalid webhook payload");
        }
    }

    // ==================== Statistics ====================

    @Override
    @Transactional(readOnly = true)
    public SignatureStatsDTO getStatistics(Long organizationId) {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime monthStart = now.withDayOfMonth(1).withHour(0).withMinute(0).withSecond(0);

        long total = signatureRequestRepository.countByOrganizationIdAndStatus(organizationId, SignatureStatus.COMPLETED)
                + signatureRequestRepository.countByOrganizationIdAndStatus(organizationId, SignatureStatus.SENT)
                + signatureRequestRepository.countByOrganizationIdAndStatus(organizationId, SignatureStatus.VIEWED)
                + signatureRequestRepository.countByOrganizationIdAndStatus(organizationId, SignatureStatus.PARTIALLY_SIGNED)
                + signatureRequestRepository.countByOrganizationIdAndStatus(organizationId, SignatureStatus.DECLINED)
                + signatureRequestRepository.countByOrganizationIdAndStatus(organizationId, SignatureStatus.EXPIRED)
                + signatureRequestRepository.countByOrganizationIdAndStatus(organizationId, SignatureStatus.VOIDED);

        long pending = signatureRequestRepository.countByOrganizationIdAndStatus(organizationId, SignatureStatus.SENT)
                + signatureRequestRepository.countByOrganizationIdAndStatus(organizationId, SignatureStatus.VIEWED)
                + signatureRequestRepository.countByOrganizationIdAndStatus(organizationId, SignatureStatus.PARTIALLY_SIGNED);

        long completed = signatureRequestRepository.countByOrganizationIdAndStatus(organizationId, SignatureStatus.COMPLETED)
                + signatureRequestRepository.countByOrganizationIdAndStatus(organizationId, SignatureStatus.SIGNED);

        long declined = signatureRequestRepository.countByOrganizationIdAndStatus(organizationId, SignatureStatus.DECLINED);
        long expired = signatureRequestRepository.countByOrganizationIdAndStatus(organizationId, SignatureStatus.EXPIRED);

        long completedThisMonth = signatureRequestRepository.countCompletedInPeriod(organizationId, monthStart, now);
        long sentThisMonth = signatureRequestRepository.countCreatedInPeriod(organizationId, monthStart, now);

        double completionRate = total > 0 ? (double) completed / total * 100 : 0;

        return new SignatureStatsDTO(total, pending, completed, declined, expired,
                completedThisMonth, sentThisMonth, Math.round(completionRate * 100.0) / 100.0);
    }

    // ==================== Private Helper Methods ====================

    private void validateBoldSignEnabled() {
        if (!boldSignConfig.isConfigured()) {
            throw new ApiException("BoldSign is not configured. Please set up the API key.");
        }
    }

    private SignatureRequest buildSignatureRequest(CreateSignatureRequestDTO dto, Long userId) {
        int expiryDays = dto.getExpiryDays() != null ? dto.getExpiryDays() : boldSignConfig.getDefaultExpiryDays();

        SignatureRequest.SignatureRequestBuilder builder = SignatureRequest.builder()
                .organizationId(dto.getOrganizationId())
                .caseId(dto.getCaseId())
                .clientId(dto.getClientId())
                .documentId(dto.getDocumentId())
                .title(dto.getTitle())
                .message(dto.getMessage())
                .fileName(dto.getFileName())
                .fileUrl(dto.getFileUrl())
                .signerName(dto.getSignerName())
                .signerEmail(dto.getSignerEmail())
                .signerPhone(dto.getSignerPhone())
                .reminderEmail(dto.getReminderEmail())
                .reminderSms(dto.getReminderSms())
                .reminderWhatsapp(dto.getReminderWhatsapp())
                .expiresAt(LocalDateTime.now().plusDays(expiryDays))
                .createdBy(userId);

        // Handle additional signers
        if (dto.getAdditionalSigners() != null && !dto.getAdditionalSigners().isEmpty()) {
            try {
                builder.additionalSigners(objectMapper.writeValueAsString(dto.getAdditionalSigners()));
            } catch (JsonProcessingException e) {
                log.error("Failed to serialize additional signers", e);
            }
        }

        return builder.build();
    }

    private String sendToBoldSign(SignatureRequest request, CreateSignatureRequestDTO dto) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-API-KEY", boldSignConfig.getApiKey());
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("Title", request.getTitle());
        body.add("Message", request.getMessage());
        body.add("Signers[0][Name]", request.getSignerName());
        body.add("Signers[0][EmailAddress]", request.getSignerEmail());
        body.add("ExpiryDays", String.valueOf(ChronoUnit.DAYS.between(LocalDateTime.now(), request.getExpiresAt())));
        body.add("EnableSigningOrder", "false");
        body.add("DisableEmails", "false");

        // Add file URL if available
        if (request.getFileUrl() != null) {
            body.add("FileUrls[0]", request.getFileUrl());
        }

        HttpEntity<MultiValueMap<String, Object>> httpRequest = new HttpEntity<>(body, headers);

        try {
            ResponseEntity<String> response = restTemplate.postForEntity(
                    boldSignConfig.getSendDocumentUrl(),
                    httpRequest,
                    String.class
            );

            JsonNode responseBody = objectMapper.readTree(response.getBody());
            return responseBody.path("documentId").asText();

        } catch (Exception e) {
            log.error("Failed to send document to BoldSign: {}", e.getMessage());
            throw new ApiException("Failed to send document for signature: " + e.getMessage());
        }
    }

    private void voidInBoldSign(String documentId, String reason) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-API-KEY", boldSignConfig.getApiKey());
        headers.setContentType(MediaType.APPLICATION_JSON);

        String body = "{\"voidReason\":\"" + reason + "\"}";
        HttpEntity<String> request = new HttpEntity<>(body, headers);

        try {
            restTemplate.exchange(
                    boldSignConfig.getBaseUrl() + "/document/void?documentId=" + documentId,
                    HttpMethod.PATCH,
                    request,
                    String.class
            );
        } catch (Exception e) {
            log.error("Failed to void document in BoldSign: {}", e.getMessage());
            // Don't throw - we still want to void locally
        }
    }

    private void sendReminderViaBoldSign(String documentId) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-API-KEY", boldSignConfig.getApiKey());

        HttpEntity<String> request = new HttpEntity<>(headers);

        try {
            restTemplate.postForEntity(
                    boldSignConfig.getBaseUrl() + "/document/remind?documentId=" + documentId,
                    request,
                    String.class
            );
        } catch (Exception e) {
            log.error("Failed to send reminder via BoldSign: {}", e.getMessage());
            throw new ApiException("Failed to send reminder: " + e.getMessage());
        }
    }

    private String getEmbeddedSigningUrlFromBoldSign(String documentId, String signerEmail) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-API-KEY", boldSignConfig.getApiKey());

        try {
            ResponseEntity<String> response = restTemplate.exchange(
                    boldSignConfig.getEmbeddedSignLinkUrl() + "?documentId=" + documentId + "&signerEmail=" + signerEmail,
                    HttpMethod.GET,
                    new HttpEntity<>(headers),
                    String.class
            );

            JsonNode responseBody = objectMapper.readTree(response.getBody());
            return responseBody.path("signLink").asText();

        } catch (Exception e) {
            log.error("Failed to get embedded signing URL: {}", e.getMessage());
            throw new ApiException("Failed to get signing URL: " + e.getMessage());
        }
    }

    private byte[] downloadFromBoldSign(String documentId) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-API-KEY", boldSignConfig.getApiKey());

        try {
            ResponseEntity<byte[]> response = restTemplate.exchange(
                    boldSignConfig.getDownloadDocumentUrl(documentId),
                    HttpMethod.GET,
                    new HttpEntity<>(headers),
                    byte[].class
            );
            return response.getBody();

        } catch (Exception e) {
            log.error("Failed to download document from BoldSign: {}", e.getMessage());
            throw new ApiException("Failed to download document: " + e.getMessage());
        }
    }

    private JsonNode getStatusFromBoldSign(String documentId) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-API-KEY", boldSignConfig.getApiKey());

        try {
            ResponseEntity<String> response = restTemplate.exchange(
                    boldSignConfig.getDocumentStatusUrl(documentId),
                    HttpMethod.GET,
                    new HttpEntity<>(headers),
                    String.class
            );
            return objectMapper.readTree(response.getBody());

        } catch (Exception e) {
            log.error("Failed to get document status from BoldSign: {}", e.getMessage());
            throw new ApiException("Failed to get document status: " + e.getMessage());
        }
    }

    private void updateRequestFromBoldSignStatus(SignatureRequest request, JsonNode status) {
        String boldsignStatus = status.path("status").asText().toUpperCase();

        switch (boldsignStatus) {
            case "SENT" -> request.setStatus(SignatureStatus.SENT);
            case "INPROGRESS", "VIEWED" -> {
                request.setStatus(SignatureStatus.VIEWED);
                if (request.getViewedAt() == null) {
                    request.setViewedAt(LocalDateTime.now());
                }
            }
            case "PARTIALLYCOMPLETED" -> request.setStatus(SignatureStatus.PARTIALLY_SIGNED);
            case "COMPLETED" -> {
                request.setStatus(SignatureStatus.COMPLETED);
                if (request.getCompletedAt() == null) {
                    request.setCompletedAt(LocalDateTime.now());
                }
            }
            case "DECLINED" -> {
                request.setStatus(SignatureStatus.DECLINED);
                if (request.getDeclinedAt() == null) {
                    request.setDeclinedAt(LocalDateTime.now());
                }
                request.setDeclineReason(status.path("declineReason").asText(null));
            }
            case "EXPIRED" -> request.setStatus(SignatureStatus.EXPIRED);
            case "VOIDED", "REVOKED" -> request.setStatus(SignatureStatus.VOIDED);
        }
    }

    private void handleWebhookEvent(SignatureRequest request, String eventType, JsonNode eventData) {
        log.info("Processing webhook event {} for document {}", eventType, request.getBoldsignDocumentId());

        switch (eventType.toLowerCase()) {
            case "document.sent" -> {
                request.setStatus(SignatureStatus.SENT);
                request.setSentAt(LocalDateTime.now());
            }
            case "document.viewed" -> {
                request.setStatus(SignatureStatus.VIEWED);
                request.setViewedAt(LocalDateTime.now());
            }
            case "document.signed", "signer.signed" -> {
                request.setStatus(SignatureStatus.PARTIALLY_SIGNED);
                request.setSignedAt(LocalDateTime.now());
            }
            case "document.completed" -> {
                request.setStatus(SignatureStatus.COMPLETED);
                request.setCompletedAt(LocalDateTime.now());
                signatureReminderService.cancelReminders(request.getId());
            }
            case "document.declined", "signer.declined" -> {
                request.setStatus(SignatureStatus.DECLINED);
                request.setDeclinedAt(LocalDateTime.now());
                request.setDeclineReason(eventData.path("declineReason").asText(null));
                signatureReminderService.cancelReminders(request.getId());
            }
            case "document.expired" -> {
                request.setStatus(SignatureStatus.EXPIRED);
                signatureReminderService.cancelReminders(request.getId());
            }
            case "document.voided", "document.revoked" -> {
                request.setStatus(SignatureStatus.VOIDED);
                signatureReminderService.cancelReminders(request.getId());
            }
        }

        signatureRequestRepository.save(request);

        // Log audit event
        SignatureAuditLog auditLog = SignatureAuditLog.builder()
                .organizationId(request.getOrganizationId())
                .signatureRequestId(request.getId())
                .eventType(eventType.toUpperCase().replace(".", "_"))
                .eventData(eventData.toString())
                .actorType(SignatureAuditLog.ActorType.WEBHOOK)
                .channel(SignatureAuditLog.Channel.API)
                .build();

        // Extract signer info if available
        if (eventData.has("signerEmail")) {
            auditLog.setActorEmail(eventData.path("signerEmail").asText());
            auditLog.setActorName(eventData.path("signerName").asText());
            auditLog.setActorType(SignatureAuditLog.ActorType.SIGNER);
        }

        signatureAuditLogRepository.save(auditLog);
    }

    private void logAuditEvent(SignatureRequest request, String eventType, Long userId, String eventData) {
        SignatureAuditLog auditLog = SignatureAuditLog.builder()
                .organizationId(request.getOrganizationId())
                .signatureRequestId(request.getId())
                .eventType(eventType)
                .eventData(eventData)
                .actorType(userId != null ? SignatureAuditLog.ActorType.USER : SignatureAuditLog.ActorType.SYSTEM)
                .actorId(userId)
                .channel(SignatureAuditLog.Channel.WEB)
                .build();

        signatureAuditLogRepository.save(auditLog);
    }

    // ==================== DTO Mappers ====================

    private SignatureRequestDTO toDTO(SignatureRequest request) {
        SignatureRequestDTO.SignatureRequestDTOBuilder builder = SignatureRequestDTO.builder()
                .id(request.getId())
                .organizationId(request.getOrganizationId())
                .boldsignDocumentId(request.getBoldsignDocumentId())
                .caseId(request.getCaseId())
                .clientId(request.getClientId())
                .documentId(request.getDocumentId())
                .title(request.getTitle())
                .message(request.getMessage())
                .fileName(request.getFileName())
                .fileUrl(request.getFileUrl())
                .status(request.getStatus())
                .statusDisplay(formatStatus(request.getStatus()))
                .signerName(request.getSignerName())
                .signerEmail(request.getSignerEmail())
                .signerPhone(request.getSignerPhone())
                .reminderEmail(request.getReminderEmail())
                .reminderSms(request.getReminderSms())
                .reminderWhatsapp(request.getReminderWhatsapp())
                .lastReminderSentAt(request.getLastReminderSentAt())
                .reminderCount(request.getReminderCount())
                .expiresAt(request.getExpiresAt())
                .sentAt(request.getSentAt())
                .viewedAt(request.getViewedAt())
                .signedAt(request.getSignedAt())
                .completedAt(request.getCompletedAt())
                .declinedAt(request.getDeclinedAt())
                .declineReason(request.getDeclineReason())
                .createdBy(request.getCreatedBy())
                .createdAt(request.getCreatedAt())
                .updatedAt(request.getUpdatedAt())
                .signedDocumentUrl(request.getSignedDocumentUrl())
                .isPending(request.isPending())
                .isCompleted(request.isCompleted())
                .canSendReminder(request.canSendReminder());

        // Calculate days until expiry
        if (request.getExpiresAt() != null) {
            long days = ChronoUnit.DAYS.between(LocalDateTime.now(), request.getExpiresAt());
            builder.daysUntilExpiry((int) days);
        }

        return builder.build();
    }

    private SignatureTemplateDTO toTemplateDTO(SignatureTemplate template) {
        return SignatureTemplateDTO.builder()
                .id(template.getId())
                .organizationId(template.getOrganizationId())
                .boldsignTemplateId(template.getBoldsignTemplateId())
                .name(template.getName())
                .description(template.getDescription())
                .category(template.getCategory())
                .fileName(template.getFileName())
                .fileUrl(template.getFileUrl())
                .fieldConfig(template.getFieldConfig())
                .defaultExpiryDays(template.getDefaultExpiryDays())
                .defaultReminderEmail(template.getDefaultReminderEmail())
                .defaultReminderSms(template.getDefaultReminderSms())
                .isActive(template.getIsActive())
                .isGlobal(template.getIsGlobal())
                .createdBy(template.getCreatedBy())
                .createdAt(template.getCreatedAt())
                .updatedAt(template.getUpdatedAt())
                .build();
    }

    private SignatureAuditLogDTO toAuditLogDTO(SignatureAuditLog log) {
        return SignatureAuditLogDTO.builder()
                .id(log.getId())
                .organizationId(log.getOrganizationId())
                .signatureRequestId(log.getSignatureRequestId())
                .eventType(log.getEventType())
                .eventTypeDisplay(formatEventType(log.getEventType()))
                .eventData(log.getEventData())
                .actorType(log.getActorType())
                .actorId(log.getActorId())
                .actorName(log.getActorName())
                .actorEmail(log.getActorEmail())
                .channel(log.getChannel())
                .ipAddress(log.getIpAddress())
                .userAgent(log.getUserAgent())
                .createdAt(log.getCreatedAt())
                .build();
    }

    private String formatStatus(SignatureStatus status) {
        if (status == null) return "Unknown";
        return switch (status) {
            case DRAFT -> "Draft";
            case SENT -> "Sent";
            case VIEWED -> "Viewed";
            case PARTIALLY_SIGNED -> "Partially Signed";
            case SIGNED -> "Signed";
            case COMPLETED -> "Completed";
            case DECLINED -> "Declined";
            case EXPIRED -> "Expired";
            case VOIDED -> "Voided";
        };
    }

    private String formatEventType(String eventType) {
        if (eventType == null) return "Unknown";
        return eventType.replace("_", " ").toLowerCase();
    }

    // ==================== Sync from BoldSign ====================

    @Override
    @Transactional
    public SyncResultDTO syncDocumentsFromBoldSign(Long organizationId, Long userId) {
        validateBoldSignEnabled();

        int imported = 0;
        int skipped = 0;
        int failed = 0;

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("X-API-KEY", boldSignConfig.getApiKey());

            // Fetch documents from BoldSign (page by page)
            int page = 1;
            int pageSize = 50;
            boolean hasMore = true;

            while (hasMore) {
                ResponseEntity<String> response = restTemplate.exchange(
                        boldSignConfig.getListDocumentsUrl(page, pageSize),
                        HttpMethod.GET,
                        new HttpEntity<>(headers),
                        String.class
                );

                JsonNode responseBody = objectMapper.readTree(response.getBody());
                JsonNode documents = responseBody.path("result");

                if (documents.isEmpty() || !documents.isArray()) {
                    hasMore = false;
                    continue;
                }

                for (JsonNode doc : documents) {
                    String documentId = doc.path("documentId").asText();
                    if (documentId == null || documentId.isEmpty()) {
                        failed++;
                        continue;
                    }

                    // Check if document already exists in our database
                    if (signatureRequestRepository.findByBoldsignDocumentId(documentId).isPresent()) {
                        skipped++;
                        continue;
                    }

                    try {
                        // Create new SignatureRequest from BoldSign document
                        SignatureRequest request = SignatureRequest.builder()
                                .organizationId(organizationId)
                                .boldsignDocumentId(documentId)
                                .title(doc.path("messageTitle").asText("Untitled Document"))
                                .message(doc.path("messageBody").asText(null))
                                .fileName(doc.path("name").asText(null))
                                .status(mapBoldSignStatus(doc.path("status").asText()))
                                .signerName(getFirstSignerName(doc))
                                .signerEmail(getFirstSignerEmail(doc))
                                .createdBy(userId)
                                .build();

                        // Set timestamps based on status
                        String createdDate = doc.path("createdDate").asText();
                        if (createdDate != null && !createdDate.isEmpty()) {
                            request.setSentAt(parseDateTime(createdDate));
                        }

                        signatureRequestRepository.save(request);
                        imported++;
                    } catch (Exception e) {
                        log.error("Failed to import document {}: {}", documentId, e.getMessage());
                        failed++;
                    }
                }

                page++;
                hasMore = documents.size() == pageSize;
            }

            log.info("Sync completed for organization {}: imported={}, skipped={}, failed={}",
                    organizationId, imported, skipped, failed);

            return new SyncResultDTO(imported, skipped, failed,
                    String.format("Sync completed: %d imported, %d skipped, %d failed", imported, skipped, failed));

        } catch (Exception e) {
            log.error("Failed to sync documents from BoldSign: {}", e.getMessage());
            throw new ApiException("Failed to sync documents: " + e.getMessage());
        }
    }

    @Override
    @Transactional
    public SyncResultDTO syncTemplatesFromBoldSign(Long organizationId, Long userId) {
        validateBoldSignEnabled();

        int imported = 0;
        int skipped = 0;
        int failed = 0;

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("X-API-KEY", boldSignConfig.getApiKey());

            // Fetch templates from BoldSign
            int page = 1;
            int pageSize = 50;
            boolean hasMore = true;

            while (hasMore) {
                ResponseEntity<String> response = restTemplate.exchange(
                        boldSignConfig.getListTemplatesUrl(page, pageSize),
                        HttpMethod.GET,
                        new HttpEntity<>(headers),
                        String.class
                );

                JsonNode responseBody = objectMapper.readTree(response.getBody());
                JsonNode templates = responseBody.path("result");

                if (templates.isEmpty() || !templates.isArray()) {
                    hasMore = false;
                    continue;
                }

                for (JsonNode tpl : templates) {
                    String templateId = tpl.path("templateId").asText();
                    if (templateId == null || templateId.isEmpty()) {
                        failed++;
                        continue;
                    }

                    // Check if template already exists
                    if (signatureTemplateRepository.findByBoldsignTemplateId(templateId).isPresent()) {
                        skipped++;
                        continue;
                    }

                    try {
                        // Create new SignatureTemplate from BoldSign
                        SignatureTemplate template = SignatureTemplate.builder()
                                .organizationId(organizationId)
                                .boldsignTemplateId(templateId)
                                .name(tpl.path("templateName").asText("Untitled Template"))
                                .description(tpl.path("description").asText(null))
                                .category("General")
                                .isActive(true)
                                .isGlobal(false)
                                .createdBy(userId)
                                .build();

                        signatureTemplateRepository.save(template);
                        imported++;
                    } catch (Exception e) {
                        log.error("Failed to import template {}: {}", templateId, e.getMessage());
                        failed++;
                    }
                }

                page++;
                hasMore = templates.size() == pageSize;
            }

            log.info("Template sync completed for organization {}: imported={}, skipped={}, failed={}",
                    organizationId, imported, skipped, failed);

            return new SyncResultDTO(imported, skipped, failed,
                    String.format("Sync completed: %d imported, %d skipped, %d failed", imported, skipped, failed));

        } catch (Exception e) {
            log.error("Failed to sync templates from BoldSign: {}", e.getMessage());
            throw new ApiException("Failed to sync templates: " + e.getMessage());
        }
    }

    private SignatureStatus mapBoldSignStatus(String status) {
        if (status == null) return SignatureStatus.SENT;
        return switch (status.toUpperCase()) {
            case "SENT", "WAITINGFORSIGNERS" -> SignatureStatus.SENT;
            case "INPROGRESS", "VIEWED" -> SignatureStatus.VIEWED;
            case "PARTIALLYCOMPLETED" -> SignatureStatus.PARTIALLY_SIGNED;
            case "COMPLETED" -> SignatureStatus.COMPLETED;
            case "DECLINED" -> SignatureStatus.DECLINED;
            case "EXPIRED" -> SignatureStatus.EXPIRED;
            case "VOIDED", "REVOKED" -> SignatureStatus.VOIDED;
            default -> SignatureStatus.SENT;
        };
    }

    private String getFirstSignerName(JsonNode doc) {
        JsonNode signers = doc.path("signerDetails");
        if (signers.isArray() && signers.size() > 0) {
            return signers.get(0).path("signerName").asText("Unknown");
        }
        return "Unknown";
    }

    private String getFirstSignerEmail(JsonNode doc) {
        JsonNode signers = doc.path("signerDetails");
        if (signers.isArray() && signers.size() > 0) {
            return signers.get(0).path("signerEmail").asText("unknown@example.com");
        }
        return "unknown@example.com";
    }

    private LocalDateTime parseDateTime(String dateStr) {
        try {
            return LocalDateTime.parse(dateStr.replace("Z", ""),
                    java.time.format.DateTimeFormatter.ISO_DATE_TIME);
        } catch (Exception e) {
            return LocalDateTime.now();
        }
    }
}
