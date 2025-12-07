package com.bostoneo.bostoneosolutions.config;

import jakarta.annotation.PostConstruct;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

import java.util.Arrays;

/**
 * BoldSign e-signature configuration.
 * API key can be set globally or per-organization for multi-tenant support.
 */
@Configuration
@Getter
@Slf4j
public class BoldSignConfig {

    @Value("${boldsign.api-key:}")
    private String apiKey;

    @Value("${boldsign.api-url:https://api.boldsign.com/v1}")
    private String apiUrl;

    @Value("${boldsign.webhook-secret:}")
    private String webhookSecret;

    @Value("${boldsign.enabled:true}")
    private boolean enabled;

    @Value("${boldsign.default-expiry-days:30}")
    private int defaultExpiryDays;

    @Value("${boldsign.reminder-days:7,3,1}")
    private String reminderDays;

    @PostConstruct
    public void init() {
        if (enabled) {
            if (apiKey != null && !apiKey.isEmpty()) {
                log.info("BoldSign SDK configured. API URL: {}, Default Expiry: {} days, Reminders: {} days before",
                        apiUrl, defaultExpiryDays, reminderDays);
            } else {
                log.warn("BoldSign is enabled but API key is not configured. E-signature features will be limited.");
            }
        } else {
            log.info("BoldSign e-signature is disabled");
        }
    }

    /**
     * Check if BoldSign is properly configured
     */
    public boolean isConfigured() {
        return enabled && apiKey != null && !apiKey.isEmpty();
    }

    /**
     * Get reminder days as an integer array
     */
    public int[] getReminderDaysArray() {
        if (reminderDays == null || reminderDays.isEmpty()) {
            return new int[]{7, 3, 1};
        }
        return Arrays.stream(reminderDays.split(","))
                .map(String::trim)
                .mapToInt(Integer::parseInt)
                .toArray();
    }

    /**
     * Get the base URL for BoldSign API
     */
    public String getBaseUrl() {
        return apiUrl;
    }

    /**
     * Get the document send endpoint
     */
    public String getSendDocumentUrl() {
        return apiUrl + "/document/send";
    }

    /**
     * Get the embedded signing link endpoint
     */
    public String getEmbeddedSignLinkUrl() {
        return apiUrl + "/document/getEmbeddedSignLink";
    }

    /**
     * Get the document status endpoint
     */
    public String getDocumentStatusUrl(String documentId) {
        return apiUrl + "/document/properties?documentId=" + documentId;
    }

    /**
     * Get the download signed document endpoint
     */
    public String getDownloadDocumentUrl(String documentId) {
        return apiUrl + "/document/download?documentId=" + documentId;
    }

    /**
     * Get the audit trail download endpoint
     */
    public String getAuditTrailUrl(String documentId) {
        return apiUrl + "/document/downloadAuditLog?documentId=" + documentId;
    }

    // ==================== Embedded URLs ====================

    /**
     * Get the embedded request URL endpoint (for document preparation UI)
     */
    public String getEmbeddedRequestUrl() {
        return apiUrl + "/document/createEmbeddedRequestUrl";
    }

    /**
     * Get the embedded template create URL endpoint
     */
    public String getEmbeddedTemplateCreateUrl() {
        return apiUrl + "/template/createEmbeddedTemplateUrl";
    }

    /**
     * Get the embedded template edit URL endpoint
     */
    public String getEmbeddedTemplateEditUrl(String templateId) {
        return apiUrl + "/template/getEmbeddedTemplateEditUrl?templateId=" + templateId;
    }

    /**
     * Get the embedded request from template URL endpoint
     */
    public String getEmbeddedRequestFromTemplateUrl() {
        return apiUrl + "/template/createEmbeddedRequestUrl";
    }

    /**
     * Get the list documents endpoint
     */
    public String getListDocumentsUrl(int page, int pageSize) {
        return apiUrl + "/document/list?Page=" + page + "&PageSize=" + pageSize;
    }

    /**
     * Get the list templates endpoint
     */
    public String getListTemplatesUrl(int page, int pageSize) {
        return apiUrl + "/template/list?Page=" + page + "&PageSize=" + pageSize;
    }

    /**
     * RestTemplate bean for making HTTP requests to BoldSign API
     */
    @Bean
    public RestTemplate restTemplate() {
        return new RestTemplate();
    }
}
