package com.bostoneo.bostoneosolutions.service.ai;

import com.bostoneo.bostoneosolutions.dto.ai.DocumentTypeTemplate;
import com.bostoneo.bostoneosolutions.service.AiWorkspaceDocumentService.CitationLevel;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;

@Service
@Slf4j
public class DocumentTypeTemplateRegistry {

    private final Map<String, DocumentTypeTemplate> templates = new HashMap<>();
    private final ObjectMapper objectMapper = new ObjectMapper();
    private String systemPrompt;

    @PostConstruct
    public void init() {
        loadTemplates();
        loadSystemPrompt();

        if (templates.isEmpty()) {
            log.error("NO document type templates loaded — draft generation will use fallback heuristics only. Check classpath:templates/document-types/*.json");
        }
        if (systemPrompt == null || systemPrompt.isBlank()) {
            log.error("System prompt is EMPTY — draft generation will send no system message. Check classpath:templates/system-prompt.txt");
        }
    }

    private void loadTemplates() {
        try {
            PathMatchingResourcePatternResolver resolver = new PathMatchingResourcePatternResolver();
            Resource[] resources = resolver.getResources("classpath:templates/document-types/*.json");

            for (Resource resource : resources) {
                try (InputStream is = resource.getInputStream()) {
                    DocumentTypeTemplate template = objectMapper.readValue(is, DocumentTypeTemplate.class);
                    String normalizedType = normalize(template.getType());
                    templates.put(normalizedType, template);

                    // Also register each alias
                    if (template.getAliases() != null) {
                        for (String alias : template.getAliases()) {
                            templates.put(normalize(alias), template);
                        }
                    }

                    log.debug("Loaded template: {} (aliases: {})", template.getType(),
                            template.getAliases() != null ? template.getAliases() : "none");
                } catch (Exception e) {
                    log.error("Failed to load template from {}: {}", resource.getFilename(), e.getMessage());
                }
            }

            log.info("Loaded {} document type templates ({} entries including aliases)",
                    resources.length, templates.size());

        } catch (IOException e) {
            log.error("Failed to scan template directory: {}", e.getMessage());
        }
    }

    private void loadSystemPrompt() {
        try {
            PathMatchingResourcePatternResolver resolver = new PathMatchingResourcePatternResolver();
            Resource resource = resolver.getResource("classpath:templates/system-prompt.txt");
            try (InputStream is = resource.getInputStream()) {
                this.systemPrompt = new String(is.readAllBytes(), StandardCharsets.UTF_8);
                log.info("Loaded system prompt ({} chars)", systemPrompt.length());
            }
        } catch (IOException e) {
            log.error("Failed to load system prompt: {}", e.getMessage());
            this.systemPrompt = "";
        }
    }

    /** Normalize document type: lowercase, replace hyphens and spaces with underscores */
    private String normalize(String type) {
        if (type == null) return "";
        return type.toLowerCase().replace("-", "_").replace(" ", "_");
    }

    public String getSystemPrompt() {
        return systemPrompt;
    }

    public DocumentTypeTemplate getTemplate(String documentType) {
        if (documentType == null) return null;
        return templates.get(normalize(documentType));
    }

    public String getTemplateText(String documentType) {
        DocumentTypeTemplate t = getTemplate(documentType);
        return t != null && t.getTemplate() != null ? t.getTemplate() : "";
    }

    /** Try jurisdiction-specific template first (e.g., "motion_texas"), fall back to generic */
    public String getTemplateText(String documentType, String jurisdiction) {
        if (jurisdiction != null && !jurisdiction.isBlank()) {
            String jurisTemplate = getTemplateText(documentType + "_" + jurisdiction);
            if (!jurisTemplate.isEmpty()) return jurisTemplate;
        }
        return getTemplateText(documentType);
    }

    public String getHints(String documentType) {
        DocumentTypeTemplate t = getTemplate(documentType);
        if (t != null && t.getHints() != null) return t.getHints();
        // Default fallback for unknown types
        return "Include all standard legal elements appropriate for this document type. Address parties, key terms, obligations, and any jurisdiction-specific requirements.";
    }

    /** Try jurisdiction-specific hints first, fall back to generic */
    public String getHints(String documentType, String jurisdiction) {
        if (jurisdiction != null && !jurisdiction.isBlank()) {
            DocumentTypeTemplate t = getTemplate(documentType + "_" + jurisdiction);
            if (t != null && t.getHints() != null) return t.getHints();
        }
        return getHints(documentType);
    }

    public CitationLevel getCitationLevel(String documentType) {
        DocumentTypeTemplate t = getTemplate(documentType);
        if (t != null && t.getCitationLevel() != null) {
            try {
                return CitationLevel.valueOf(t.getCitationLevel());
            } catch (IllegalArgumentException e) {
                log.warn("Invalid citation level '{}' for type '{}', defaulting to COMPREHENSIVE",
                        t.getCitationLevel(), documentType);
            }
        }

        // Fallback: use the same heuristic as the old getCitationLevel() for unregistered types
        if (documentType == null) return CitationLevel.COMPREHENSIVE;
        String type = documentType.toLowerCase();

        // NO CITATIONS: Contracts and transactional documents
        if (type.contains("contract") || type.contains("nda") ||
            type.contains("amendment") ||
            (type.contains("clause") && !type.contains("legal")) ||
            (type.contains("employment") && type.contains("agreement")) ||
            (type.contains("purchase") && type.contains("agreement")) ||
            (type.contains("service") && type.contains("agreement"))) {
            return CitationLevel.NONE;
        }

        // MINIMAL CITATIONS: Correspondence, discovery, business documents
        if (type.contains("letter") || type.contains("demand") ||
            type.contains("email") || type.contains("correspondence") ||
            type.contains("settlement-offer") || type.contains("opinion-letter") ||
            type.contains("opposing-counsel") || type.contains("client-email") ||
            type.contains("interrogator") || type.contains("rfp") || type.contains("rfa") ||
            (type.contains("request") && type.contains("production")) ||
            (type.contains("request") && type.contains("admission")) ||
            type.contains("subpoena") ||
            (type.contains("deposition") && type.contains("notice")) ||
            type.contains("notice") || type.contains("stipulation") ||
            type.contains("affidavit") || type.contains("settlement-agreement")) {
            return CitationLevel.MINIMAL;
        }

        return CitationLevel.COMPREHENSIVE;
    }

    /** Try jurisdiction-specific citation level first, fall back to generic */
    public CitationLevel getCitationLevel(String documentType, String jurisdiction) {
        if (jurisdiction != null && !jurisdiction.isBlank()) {
            DocumentTypeTemplate t = getTemplate(documentType + "_" + jurisdiction);
            if (t != null && t.getCitationLevel() != null) {
                try {
                    return CitationLevel.valueOf(t.getCitationLevel());
                } catch (IllegalArgumentException e) {
                    log.warn("Invalid citation level '{}' for type '{}_{}', falling back",
                            t.getCitationLevel(), documentType, jurisdiction);
                }
            }
        }
        return getCitationLevel(documentType);
    }

    public boolean isLetterType(String documentType) {
        DocumentTypeTemplate t = getTemplate(documentType);
        if (t != null) return "letter".equals(t.getCategory());

        // Fallback for unregistered types
        String norm = documentType != null ? normalize(documentType) : "";
        return norm.contains("letter") || norm.contains("correspondence");
    }

    public boolean isDemandLetterType(String documentType) {
        if (documentType == null) return false;
        String norm = normalize(documentType);
        return "demand_letter".equals(norm) || "demand".equals(norm);
    }
}
