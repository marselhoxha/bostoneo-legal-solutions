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
import java.util.ArrayList;
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
    public byte[] downloadAuditTrail(String boldsignDocumentId) {
        validateBoldSignEnabled();

        HttpHeaders headers = new HttpHeaders();
        headers.set("X-API-KEY", boldSignConfig.getApiKey());

        try {
            ResponseEntity<byte[]> response = restTemplate.exchange(
                    boldSignConfig.getAuditTrailUrl(boldsignDocumentId),
                    HttpMethod.GET,
                    new HttpEntity<>(headers),
                    byte[].class
            );
            return response.getBody();

        } catch (Exception e) {
            log.error("Failed to download audit trail from BoldSign: {}", e.getMessage());
            throw new ApiException("Failed to download audit trail: " + e.getMessage());
        }
    }

    @Override
    public byte[] downloadDocumentFromBoldSign(String boldsignDocumentId) {
        return downloadFromBoldSign(boldsignDocumentId);
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
        headers.setContentType(MediaType.APPLICATION_JSON);

        // BoldSign requires POST with JSON body for embedded template edit
        var requestBody = new java.util.HashMap<String, Object>();
        requestBody.put("ShowToolbar", true);
        requestBody.put("ShowSaveButton", true);
        requestBody.put("ShowPreviewButton", true);
        requestBody.put("ShowNavigationButtons", true);

        HttpEntity<java.util.Map<String, Object>> request = new HttpEntity<>(requestBody, headers);

        try {
            ResponseEntity<String> response = restTemplate.postForEntity(
                    boldSignConfig.getEmbeddedTemplateEditUrl(boldsignTemplateId),
                    request,
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

    // ==================== Dashboard ====================

    // Cache for dashboard data to reduce API calls (50 calls/hour limit)
    private BoldSignDashboardDTO cachedDashboard = null;
    private Long cachedDashboardOrgId = null;
    private LocalDateTime cachedDashboardTime = null;
    private static final int DASHBOARD_CACHE_MINUTES = 5;

    @Override
    @Transactional(readOnly = true)
    public BoldSignDashboardDTO getDashboard(Long organizationId) {
        validateBoldSignEnabled();

        // Check cache first (5 minute cache to reduce API calls)
        if (cachedDashboard != null
                && organizationId.equals(cachedDashboardOrgId)
                && cachedDashboardTime != null
                && LocalDateTime.now().isBefore(cachedDashboardTime.plusMinutes(DASHBOARD_CACHE_MINUTES))) {
            log.debug("Returning cached dashboard for organization {}", organizationId);
            return cachedDashboard;
        }

        HttpHeaders headers = new HttpHeaders();
        headers.set("X-API-KEY", boldSignConfig.getApiKey());

        try {
            // Use a single API call to fetch all documents and categorize them locally
            // This reduces from 7+ API calls to just 1
            var allDocsResponse = fetchAllDocuments(headers, 50);

            int waitingForMe = 0;
            int waitingForOthers = 0;
            int needsAttention = 0;
            int completed = 0;
            int revoked = 0;

            List<BoldSignDashboardDTO.DocumentSummaryDTO> waitingForOthersList = new ArrayList<>();
            List<BoldSignDashboardDTO.DocumentSummaryDTO> needsAttentionList = new ArrayList<>();
            List<BoldSignDashboardDTO.DocumentSummaryDTO> recentActivityList = new ArrayList<>();

            // Categorize documents locally
            for (var doc : allDocsResponse) {
                String status = doc.getStatus();
                switch (status.toUpperCase()) {
                    case "WAITINGFORME" -> waitingForMe++;
                    case "WAITINGFOROTHERS", "SENT", "INPROGRESS" -> {
                        waitingForOthers++;
                        if (waitingForOthersList.size() < 5) {
                            waitingForOthersList.add(doc);
                        }
                    }
                    case "NEEDSATTENTION", "EXPIRED", "DECLINED" -> {
                        needsAttention++;
                        if (needsAttentionList.size() < 5) {
                            needsAttentionList.add(doc);
                        }
                    }
                    case "COMPLETED" -> {
                        completed++;
                        if (recentActivityList.size() < 5) {
                            recentActivityList.add(doc);
                        }
                    }
                    case "REVOKED", "VOIDED" -> {
                        revoked++;
                        if (recentActivityList.size() < 5) {
                            recentActivityList.add(0, doc); // Add revoked at the beginning
                        }
                    }
                }
            }

            BoldSignDashboardDTO dashboard = BoldSignDashboardDTO.builder()
                    .waitingForMe(waitingForMe)
                    .waitingForOthers(waitingForOthers)
                    .needsAttention(needsAttention)
                    .completed(completed)
                    .revoked(revoked)
                    .totalDocuments(waitingForMe + waitingForOthers + completed + revoked)
                    .waitingForOthersList(waitingForOthersList)
                    .needsAttentionList(needsAttentionList)
                    .recentActivityList(recentActivityList)
                    .build();

            // Cache the result
            cachedDashboard = dashboard;
            cachedDashboardOrgId = organizationId;
            cachedDashboardTime = LocalDateTime.now();

            return dashboard;

        } catch (Exception e) {
            log.error("Failed to fetch dashboard from BoldSign: {}", e.getMessage());
            // Return empty dashboard on error
            return BoldSignDashboardDTO.builder()
                    .waitingForMe(0)
                    .waitingForOthers(0)
                    .needsAttention(0)
                    .completed(0)
                    .revoked(0)
                    .totalDocuments(0)
                    .waitingForOthersList(new ArrayList<>())
                    .needsAttentionList(new ArrayList<>())
                    .recentActivityList(new ArrayList<>())
                    .build();
        }
    }

    /**
     * Fetch all recent documents in a single API call and return them categorized.
     * This is much more efficient than making separate calls for each status.
     */
    private List<BoldSignDashboardDTO.DocumentSummaryDTO> fetchAllDocuments(HttpHeaders headers, int limit) {
        List<BoldSignDashboardDTO.DocumentSummaryDTO> documents = new ArrayList<>();

        try {
            ResponseEntity<String> response = restTemplate.exchange(
                    boldSignConfig.getBaseUrl() + "/document/list?PageSize=" + limit,
                    HttpMethod.GET,
                    new HttpEntity<>(headers),
                    String.class
            );
            JsonNode body = objectMapper.readTree(response.getBody());
            JsonNode results = body.path("result");

            if (results.isArray()) {
                for (JsonNode doc : results) {
                    String signerName = "";
                    String signerEmail = "";
                    String statusMessage = "";
                    String status = doc.path("status").asText("Unknown");

                    // Get first signer info
                    JsonNode signers = doc.path("signerDetails");
                    if (signers.isArray() && signers.size() > 0) {
                        JsonNode firstSigner = signers.get(0);
                        signerName = firstSigner.path("signerName").asText("");
                        signerEmail = firstSigner.path("signerEmail").asText("");
                        statusMessage = firstSigner.path("status").asText("");
                    }

                    documents.add(BoldSignDashboardDTO.DocumentSummaryDTO.builder()
                            .documentId(doc.path("documentId").asText())
                            .title(doc.path("messageTitle").asText(doc.path("documentId").asText()))
                            .signerName(signerName)
                            .signerEmail(signerEmail)
                            .status(status)
                            .statusMessage(statusMessage)
                            .createdDate(doc.path("createdDate").asText())
                            .build());
                }
            }
        } catch (Exception e) {
            log.warn("Failed to fetch documents: {}", e.getMessage());
        }

        return documents;
    }

    @Override
    public BoldSignDocumentListDTO listDocumentsFromBoldSign(String status, int page, int pageSize) {
        validateBoldSignEnabled();

        HttpHeaders headers = new HttpHeaders();
        headers.set("X-API-KEY", boldSignConfig.getApiKey());

        try {
            StringBuilder urlBuilder = new StringBuilder(boldSignConfig.getBaseUrl())
                    .append("/document/list?Page=").append(page)
                    .append("&PageSize=").append(pageSize);

            // Add status filter if provided
            if (status != null && !status.isEmpty() && !status.equalsIgnoreCase("All")) {
                urlBuilder.append("&Status=").append(status);
            }

            ResponseEntity<String> response = restTemplate.exchange(
                    urlBuilder.toString(),
                    HttpMethod.GET,
                    new HttpEntity<>(headers),
                    String.class
            );

            JsonNode body = objectMapper.readTree(response.getBody());
            int totalCount = body.path("pageDetails").path("totalRecordsCount").asInt(0);

            List<BoldSignDocumentDTO> documents = new ArrayList<>();
            JsonNode results = body.path("result");

            if (results.isArray()) {
                for (JsonNode doc : results) {
                    String signerName = "";
                    String signerEmail = "";
                    String signerStatus = "";

                    // Get first signer info
                    JsonNode signers = doc.path("signerDetails");
                    if (signers.isArray() && signers.size() > 0) {
                        JsonNode firstSigner = signers.get(0);
                        signerName = firstSigner.path("signerName").asText("");
                        signerEmail = firstSigner.path("signerEmail").asText("");
                        signerStatus = firstSigner.path("status").asText("");
                    }

                    // Get activity info - activityDate is a Unix timestamp (seconds since epoch)
                    String lastActivityDate = "";
                    String lastActivityBy = doc.path("activityBy").asText("");
                    String lastActivityAction = doc.path("activity").asText("");

                    // Parse activityDate - it's a Unix timestamp (long)
                    JsonNode activityDateNode = doc.path("activityDate");
                    if (!activityDateNode.isMissingNode() && activityDateNode.isNumber()) {
                        long timestamp = activityDateNode.asLong();
                        if (timestamp > 0) {
                            // Convert Unix timestamp to ISO date string
                            java.time.Instant instant = java.time.Instant.ofEpochSecond(timestamp);
                            lastActivityDate = instant.atZone(java.time.ZoneId.systemDefault())
                                    .format(java.time.format.DateTimeFormatter.ofPattern("MM/dd/yyyy hh:mm a"));
                        }
                    }

                    // Build the activity description from action and actor
                    if (lastActivityAction.isEmpty() && !lastActivityBy.isEmpty()) {
                        // Try to infer action from status
                        String docStatus = doc.path("status").asText("").toLowerCase();
                        if (docStatus.contains("completed")) {
                            lastActivityAction = "has completed the document";
                        } else if (docStatus.contains("sent") || docStatus.contains("inprogress") || docStatus.contains("waitingforothers")) {
                            lastActivityAction = "has sent the document";
                        } else if (docStatus.contains("viewed")) {
                            lastActivityAction = "has viewed the document";
                        } else if (docStatus.contains("revoked") || docStatus.contains("voided")) {
                            lastActivityAction = "has revoked the document";
                        } else if (docStatus.contains("declined")) {
                            lastActivityAction = "has declined the document";
                        }
                    }

                    // Fallback: use createdDate if no activity date
                    if (lastActivityDate.isEmpty()) {
                        String createdDate = doc.path("createdDate").asText("");
                        if (!createdDate.isEmpty()) {
                            try {
                                java.time.ZonedDateTime zdt = java.time.ZonedDateTime.parse(createdDate);
                                lastActivityDate = zdt.format(java.time.format.DateTimeFormatter.ofPattern("MM/dd/yyyy hh:mm a"));
                            } catch (Exception e) {
                                lastActivityDate = createdDate;
                            }
                        }
                    }

                    documents.add(new BoldSignDocumentDTO(
                            doc.path("documentId").asText(),
                            doc.path("messageTitle").asText("Untitled Document"),
                            doc.path("status").asText("Unknown"),
                            doc.path("createdDate").asText(""),
                            doc.path("expiryDate").asText(null),
                            doc.path("senderDetail").path("name").asText(""),
                            doc.path("senderDetail").path("emailAddress").asText(""),
                            signerName,
                            signerEmail,
                            signerStatus,
                            lastActivityDate,
                            lastActivityBy,
                            lastActivityAction
                    ));
                }
            }

            return new BoldSignDocumentListDTO(documents, totalCount, page, pageSize);

        } catch (Exception e) {
            log.error("Failed to list documents from BoldSign: {}", e.getMessage());
            return new BoldSignDocumentListDTO(new ArrayList<>(), 0, page, pageSize);
        }
    }

    @Override
    public DocumentPropertiesDTO getDocumentProperties(String boldsignDocumentId) {
        validateBoldSignEnabled();

        HttpHeaders headers = new HttpHeaders();
        headers.set("X-API-KEY", boldSignConfig.getApiKey());

        try {
            ResponseEntity<String> response = restTemplate.exchange(
                    boldSignConfig.getBaseUrl() + "/document/properties?documentId=" + boldsignDocumentId,
                    HttpMethod.GET,
                    new HttpEntity<>(headers),
                    String.class
            );

            JsonNode body = objectMapper.readTree(response.getBody());

            // Parse sender details
            JsonNode senderNode = body.path("senderDetail");
            SenderDetailDTO senderDetail = new SenderDetailDTO(
                    senderNode.path("name").asText(""),
                    senderNode.path("emailAddress").asText("")
            );

            // Get first signer name for status description
            String firstSignerName = "";
            JsonNode signersNode = body.path("signerDetails");
            if (signersNode.isArray() && signersNode.size() > 0) {
                firstSignerName = signersNode.get(0).path("signerName").asText("");
            }

            // Build status description
            String status = body.path("status").asText("");
            String statusDescription = buildStatusDescription(status, firstSignerName);

            // Format dates - use formatBoldSignDateNode to handle both Unix timestamps and ISO strings
            String createdDate = body.path("createdDate").asText("");
            String sentOn = formatBoldSignDateNode(body.path("createdDate"));

            // Get last activity from document history
            // BoldSign API fields: timestamp (Unix epoch), name, action, ipaddress (lowercase)
            String lastActivityDate = "";
            String lastActivityDescription = "";
            JsonNode historyNode = body.path("documentHistory");
            if (historyNode.isArray() && historyNode.size() > 0) {
                JsonNode lastActivity = historyNode.get(0);
                // BoldSign uses "timestamp" (Unix epoch)
                lastActivityDate = formatBoldSignDateNode(lastActivity.path("timestamp"));
                // BoldSign uses "name" for actor
                String activityBy = lastActivity.path("name").asText("");
                // BoldSign uses "action" for action description
                String activityAction = lastActivity.path("action").asText("");
                if (!activityBy.isEmpty()) {
                    lastActivityDescription = activityBy + " " + activityAction.toLowerCase();
                }
            }

            // Parse files - try multiple paths
            List<String> files = new ArrayList<>();
            // Try "files" array
            JsonNode filesNode = body.path("files");
            if (filesNode.isArray()) {
                for (JsonNode file : filesNode) {
                    String fileName = file.path("fileName").asText(file.path("name").asText(""));
                    if (!fileName.isEmpty()) {
                        files.add(fileName);
                    }
                }
            }
            // Try "documentDetails" array
            if (files.isEmpty()) {
                JsonNode docDetailsNode = body.path("documentDetails");
                if (docDetailsNode.isArray()) {
                    for (JsonNode doc : docDetailsNode) {
                        String fileName = doc.path("documentName").asText(doc.path("fileName").asText(""));
                        if (!fileName.isEmpty()) {
                            files.add(fileName);
                        }
                    }
                }
            }
            // Try single fileName field
            if (files.isEmpty()) {
                String fileName = body.path("fileName").asText("");
                if (!fileName.isEmpty()) {
                    files.add(fileName);
                }
            }
            // Fallback: use messageTitle + .pdf
            if (files.isEmpty()) {
                String title = body.path("messageTitle").asText("");
                if (!title.isEmpty()) {
                    files.add(title + ".pdf");
                }
            }

            // Get brand name - try brandName first, then look up by brandId
            String brandName = body.path("brandName").asText("");
            String brandId = body.path("brandId").asText("");
            if (brandName.isEmpty() && !brandId.isEmpty()) {
                // Try to get brand name from our cached brands or make API call
                brandName = getBrandNameById(brandId);
            }

            // Parse signer details with additional fields
            List<SignerDetailDTO> signerDetails = new ArrayList<>();
            if (signersNode.isArray()) {
                for (JsonNode signer : signersNode) {
                    String signerStatus = signer.path("status").asText("");
                    String deliveryMode = signer.path("deliveryMode").asText("Email");
                    String authenticationType = signer.path("authenticationType").asText("-");

                    // Get signer's last activity
                    String signerLastActivity = "";
                    JsonNode signerActivityNode = signer.path("lastActivityDate");
                    if (!signerActivityNode.isMissingNode()) {
                        signerLastActivity = formatBoldSignDate(signerActivityNode.asText(""));
                    }

                    signerDetails.add(new SignerDetailDTO(
                            signer.path("signerName").asText(""),
                            signer.path("signerEmail").asText(""),
                            signer.path("signerType").asText("Signer"),
                            signerStatus,
                            signer.path("signedDate").asText(null),
                            signer.path("signerOrder").asInt(1),
                            deliveryMode,
                            signerLastActivity,
                            authenticationType
                    ));
                }
            }

            // Parse document history with all fields
            // BoldSign API fields: timestamp (Unix epoch), name, action, ipaddress (lowercase), email
            List<ActivityDTO> documentHistory = new ArrayList<>();
            if (historyNode.isArray()) {
                for (JsonNode activityNode : historyNode) {
                    // BoldSign uses "timestamp" (Unix epoch)
                    String activityDate = formatBoldSignDateNode(activityNode.path("timestamp"));
                    // BoldSign uses "action" for the action description (e.g., "Signed", "Viewed", "Sent")
                    String activityAction = activityNode.path("action").asText("");
                    // BoldSign uses "name" for the actor
                    String activityBy = activityNode.path("name").asText("");
                    // BoldSign uses "ipaddress" (lowercase!)
                    String ipAddress = activityNode.path("ipaddress").asText("-");
                    // The action field IS the short action type
                    String action = activityAction;

                    documentHistory.add(new ActivityDTO(
                            activityBy,
                            activityDate,
                            activityAction,
                            ipAddress,
                            action
                    ));
                }
            }

            // Format expiry date
            String expiryDate = formatBoldSignDateNode(body.path("expiryDate"));

            return new DocumentPropertiesDTO(
                    body.path("documentId").asText(),
                    body.path("messageTitle").asText(""),
                    body.path("documentDescription").asText(""),
                    status,
                    statusDescription,
                    createdDate,
                    sentOn,
                    lastActivityDate,
                    lastActivityDescription,
                    expiryDate.isEmpty() ? null : expiryDate,
                    body.path("expiryDays").asInt(0),
                    body.path("enableSigningOrder").asBoolean(false),
                    files,
                    brandName,
                    senderDetail,
                    signerDetails,
                    documentHistory
            );

        } catch (Exception e) {
            log.error("Failed to get document properties for {}: {}", boldsignDocumentId, e.getMessage());
            throw new ApiException("Failed to get document properties: " + e.getMessage());
        }
    }

    /**
     * Build a human-readable status description
     */
    private String buildStatusDescription(String status, String signerName) {
        if (status == null || status.isEmpty()) return "";

        String statusLower = status.toLowerCase();
        if (statusLower.contains("waitingforothers") || statusLower.equals("inprogress") || statusLower.equals("sent")) {
            return "Needs to be signed by " + (signerName.isEmpty() ? "recipient" : signerName);
        } else if (statusLower.equals("completed")) {
            return "Signed by all parties";
        } else if (statusLower.equals("declined")) {
            return "Declined by " + (signerName.isEmpty() ? "recipient" : signerName);
        } else if (statusLower.equals("expired")) {
            return "Document has expired";
        } else if (statusLower.contains("revoked") || statusLower.equals("voided")) {
            return "Revoked by sender";
        }
        return "";
    }

    /**
     * Format a BoldSign date for display - handles both Unix timestamps and ISO date strings
     */
    private String formatBoldSignDate(String dateString) {
        if (dateString == null || dateString.isEmpty()) return "";

        try {
            // First, check if it's a Unix timestamp (all digits)
            if (dateString.matches("\\d+")) {
                long timestamp = Long.parseLong(dateString);
                // BoldSign uses seconds, not milliseconds
                java.time.Instant instant = java.time.Instant.ofEpochSecond(timestamp);
                return instant.atZone(java.time.ZoneId.systemDefault())
                        .format(java.time.format.DateTimeFormatter.ofPattern("MM/dd/yyyy hh:mm a"));
            }

            // Try parsing as ISO date string
            java.time.ZonedDateTime zdt = java.time.ZonedDateTime.parse(dateString);
            return zdt.format(java.time.format.DateTimeFormatter.ofPattern("MM/dd/yyyy hh:mm a"));
        } catch (Exception e) {
            // Try other common formats
            try {
                java.time.LocalDateTime ldt = java.time.LocalDateTime.parse(dateString,
                        java.time.format.DateTimeFormatter.ISO_LOCAL_DATE_TIME);
                return ldt.format(java.time.format.DateTimeFormatter.ofPattern("MM/dd/yyyy hh:mm a"));
            } catch (Exception e2) {
                // Return as-is if all parsing fails
                return dateString;
            }
        }
    }

    /**
     * Format a BoldSign date from JsonNode - handles both number and string types
     */
    private String formatBoldSignDateNode(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) return "";

        if (node.isNumber()) {
            long timestamp = node.asLong();
            if (timestamp > 0) {
                java.time.Instant instant = java.time.Instant.ofEpochSecond(timestamp);
                return instant.atZone(java.time.ZoneId.systemDefault())
                        .format(java.time.format.DateTimeFormatter.ofPattern("MM/dd/yyyy hh:mm a"));
            }
            return "";
        }

        return formatBoldSignDate(node.asText(""));
    }

    /**
     * Extract short action type from activity action description
     */
    private String extractActionType(String activityAction) {
        if (activityAction == null || activityAction.isEmpty()) return "-";
        String lower = activityAction.toLowerCase();
        if (lower.contains("sent")) return "Sent";
        if (lower.contains("viewed")) return "Viewed";
        if (lower.contains("signed") || lower.contains("completed")) return "Signed";
        if (lower.contains("reminder")) return "Reminder";
        if (lower.contains("declined")) return "Declined";
        if (lower.contains("revoked") || lower.contains("voided")) return "Revoked";
        if (lower.contains("created")) return "Created";
        if (lower.contains("downloaded")) return "Downloaded";
        return "-";
    }

    /**
     * Get brand name by brand ID from BoldSign API
     */
    private String getBrandNameById(String brandId) {
        if (brandId == null || brandId.isEmpty()) return "";
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("X-API-KEY", boldSignConfig.getApiKey());

            ResponseEntity<String> response = restTemplate.exchange(
                    boldSignConfig.getBaseUrl() + "/brand/get?brandId=" + brandId,
                    HttpMethod.GET,
                    new HttpEntity<>(headers),
                    String.class
            );

            JsonNode body = objectMapper.readTree(response.getBody());
            return body.path("brandName").asText(brandId);
        } catch (Exception e) {
            log.debug("Could not fetch brand name for {}: {}", brandId, e.getMessage());
            return brandId; // Return brandId as fallback
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

    // ==================== Branding (Multi-Tenant) ====================

    @Override
    public BrandDTO createBrand(Long organizationId, BrandDTO brand) {
        validateBoldSignEnabled();

        // Validate required fields
        if (brand.brandName() == null || brand.brandName().trim().isEmpty()) {
            throw new ApiException("Brand name is required");
        }
        if (brand.brandLogoBase64() == null || brand.brandLogoBase64().trim().isEmpty()) {
            throw new ApiException("Brand logo is required. Please upload a logo file (JPG, JPEG, PNG, or SVG).");
        }

        HttpHeaders headers = new HttpHeaders();
        headers.set("X-API-KEY", boldSignConfig.getApiKey());
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();

        // Required fields
        body.add("BrandName", brand.brandName());

        // Add logo file from base64
        byte[] logoBytes = java.util.Base64.getDecoder().decode(brand.brandLogoBase64());
        String logoFileName = brand.brandLogoFileName() != null ? brand.brandLogoFileName() : "logo.png";
        org.springframework.core.io.ByteArrayResource logoResource = new org.springframework.core.io.ByteArrayResource(logoBytes) {
            @Override
            public String getFilename() {
                return logoFileName;
            }
        };
        body.add("BrandLogo", logoResource);

        // Optional fields
        if (brand.backgroundColor() != null) {
            body.add("BackgroundColor", brand.backgroundColor());
        }
        if (brand.buttonColor() != null) {
            body.add("ButtonColor", brand.buttonColor());
        }
        if (brand.buttonTextColor() != null) {
            body.add("ButtonTextColor", brand.buttonTextColor());
        }
        if (brand.emailDisplayName() != null) {
            body.add("EmailDisplayName", brand.emailDisplayName());
        }
        // Note: BoldSign uses "brandColor" for primary color in branding
        if (brand.primaryColor() != null) {
            body.add("BrandColor", brand.primaryColor());
        }

        HttpEntity<MultiValueMap<String, Object>> request = new HttpEntity<>(body, headers);

        try {
            ResponseEntity<String> response = restTemplate.postForEntity(
                    boldSignConfig.getBaseUrl() + "/brand/create",
                    request,
                    String.class
            );

            JsonNode responseBody = objectMapper.readTree(response.getBody());
            String brandId = responseBody.path("brandId").asText();

            log.info("Created brand {} for organization {}", brandId, organizationId);

            return new BrandDTO(
                    brandId,
                    brand.brandName(),
                    brand.brandLogoUrl(),
                    null,  // Don't return the base64 back
                    brand.brandLogoFileName(),
                    brand.primaryColor(),
                    brand.backgroundColor(),
                    brand.buttonColor(),
                    brand.buttonTextColor(),
                    brand.emailDisplayName(),
                    brand.disclaimerTitle(),
                    brand.disclaimerDescription()
            );

        } catch (Exception e) {
            log.error("Failed to create brand: {}", e.getMessage());
            throw new ApiException("Failed to create brand: " + e.getMessage());
        }
    }

    @Override
    public BrandDTO getBrand(Long organizationId) {
        validateBoldSignEnabled();

        HttpHeaders headers = new HttpHeaders();
        headers.set("X-API-KEY", boldSignConfig.getApiKey());

        try {
            ResponseEntity<String> response = restTemplate.exchange(
                    boldSignConfig.getBaseUrl() + "/brand/list",
                    HttpMethod.GET,
                    new HttpEntity<>(headers),
                    String.class
            );

            JsonNode responseBody = objectMapper.readTree(response.getBody());
            JsonNode brands = responseBody.path("result");

            if (brands.isArray() && brands.size() > 0) {
                // Return the first brand (or you could match by organizationId if stored)
                JsonNode brand = brands.get(0);
                return new BrandDTO(
                        brand.path("brandId").asText(),
                        brand.path("brandName").asText(),
                        brand.path("brandLogo").asText(null),
                        null,  // brandLogoBase64 - not returned from API
                        null,  // brandLogoFileName - not returned from API
                        brand.path("brandColor").asText(null),
                        brand.path("backgroundColor").asText(null),
                        brand.path("buttonColor").asText(null),
                        brand.path("buttonTextColor").asText(null),
                        brand.path("emailDisplayName").asText(null),
                        brand.path("disclaimerTitle").asText(null),
                        brand.path("disclaimerDescription").asText(null)
                );
            }

            return null;

        } catch (Exception e) {
            log.error("Failed to get brand: {}", e.getMessage());
            // Return null instead of throwing - brand may not exist yet
            return null;
        }
    }

    @Override
    public BrandDTO updateBrand(Long organizationId, BrandDTO brand) {
        validateBoldSignEnabled();

        // Validate required fields
        if (brand.brandId() == null || brand.brandId().trim().isEmpty()) {
            throw new ApiException("Brand ID is required for update");
        }
        if (brand.brandName() == null || brand.brandName().trim().isEmpty()) {
            throw new ApiException("Brand name is required");
        }

        HttpHeaders headers = new HttpHeaders();
        headers.set("X-API-KEY", boldSignConfig.getApiKey());
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();

        // brandId is passed as query parameter, not in body
        // Add brandName to body
        body.add("BrandName", brand.brandName());

        // Add logo file from base64 if provided
        if (brand.brandLogoBase64() != null && !brand.brandLogoBase64().trim().isEmpty()) {
            byte[] logoBytes = java.util.Base64.getDecoder().decode(brand.brandLogoBase64());
            String logoFileName = brand.brandLogoFileName() != null ? brand.brandLogoFileName() : "logo.png";
            org.springframework.core.io.ByteArrayResource logoResource = new org.springframework.core.io.ByteArrayResource(logoBytes) {
                @Override
                public String getFilename() {
                    return logoFileName;
                }
            };
            body.add("BrandLogo", logoResource);
        }

        // Optional fields
        if (brand.backgroundColor() != null) {
            body.add("BackgroundColor", brand.backgroundColor());
        }
        if (brand.buttonColor() != null) {
            body.add("ButtonColor", brand.buttonColor());
        }
        if (brand.buttonTextColor() != null) {
            body.add("ButtonTextColor", brand.buttonTextColor());
        }
        if (brand.emailDisplayName() != null) {
            body.add("EmailDisplayName", brand.emailDisplayName());
        }
        if (brand.primaryColor() != null) {
            body.add("BrandColor", brand.primaryColor());
        }

        HttpEntity<MultiValueMap<String, Object>> request = new HttpEntity<>(body, headers);

        try {
            // BoldSign uses POST (not PATCH) for brand edit, with brandId as query parameter
            restTemplate.postForEntity(
                    boldSignConfig.getBaseUrl() + "/brand/edit?brandId=" + brand.brandId(),
                    request,
                    String.class
            );

            log.info("Updated brand {} for organization {}", brand.brandId(), organizationId);

            return new BrandDTO(
                    brand.brandId(),
                    brand.brandName(),
                    brand.brandLogoUrl(),
                    null,  // Don't return the base64 back
                    brand.brandLogoFileName(),
                    brand.primaryColor(),
                    brand.backgroundColor(),
                    brand.buttonColor(),
                    brand.buttonTextColor(),
                    brand.emailDisplayName(),
                    brand.disclaimerTitle(),
                    brand.disclaimerDescription()
            );

        } catch (Exception e) {
            log.error("Failed to update brand: {}", e.getMessage());
            throw new ApiException("Failed to update brand: " + e.getMessage());
        }
    }

    @Override
    public void deleteBrand(Long organizationId) {
        validateBoldSignEnabled();

        // First get the brand to get its ID
        BrandDTO brand = getBrand(organizationId);
        if (brand == null || brand.brandId() == null) {
            log.warn("No brand found for organization {}", organizationId);
            return;
        }

        HttpHeaders headers = new HttpHeaders();
        headers.set("X-API-KEY", boldSignConfig.getApiKey());

        try {
            restTemplate.exchange(
                    boldSignConfig.getBaseUrl() + "/brand/delete?brandId=" + brand.brandId(),
                    HttpMethod.DELETE,
                    new HttpEntity<>(headers),
                    String.class
            );

            log.info("Deleted brand {} for organization {}", brand.brandId(), organizationId);

        } catch (Exception e) {
            log.error("Failed to delete brand: {}", e.getMessage());
            throw new ApiException("Failed to delete brand: " + e.getMessage());
        }
    }
}
