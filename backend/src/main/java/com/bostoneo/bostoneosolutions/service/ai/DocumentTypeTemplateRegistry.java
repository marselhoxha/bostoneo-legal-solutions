package com.bostoneo.bostoneosolutions.service.ai;

import com.bostoneo.bostoneosolutions.dto.ai.DocumentTypeTemplate;
import com.bostoneo.bostoneosolutions.dto.ai.JurisdictionPack;
import com.bostoneo.bostoneosolutions.enumeration.PracticeArea;
import com.bostoneo.bostoneosolutions.service.AiWorkspaceDocumentService.CitationLevel;
import com.bostoneo.bostoneosolutions.service.JurisdictionResolver;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

@Service
@Slf4j
@RequiredArgsConstructor
public class DocumentTypeTemplateRegistry {

    private final JurisdictionResolver jurisdictionResolver;

    private final Map<String, DocumentTypeTemplate> templates = new HashMap<>();
    private final Map<String, JurisdictionPack> jurisdictionPacks = new HashMap<>();
    private final ObjectMapper objectMapper = new ObjectMapper();
    private String systemPrompt;

    @PostConstruct
    public void init() {
        loadTemplates();
        loadJurisdictionPacks();
        loadSystemPrompt();

        if (templates.isEmpty()) {
            log.error("NO document type templates loaded — draft generation will use fallback heuristics only. Check classpath:templates/document-types/*.json");
        }
        if (jurisdictionPacks.isEmpty()) {
            log.warn("NO jurisdiction packs loaded — AI will not have state-specific citation context. Check classpath:templates/jurisdictions/*.json");
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

    private void loadJurisdictionPacks() {
        try {
            PathMatchingResourcePatternResolver resolver = new PathMatchingResourcePatternResolver();
            Resource[] resources = resolver.getResources("classpath:templates/jurisdictions/*.json");

            for (Resource resource : resources) {
                try (InputStream is = resource.getInputStream()) {
                    JurisdictionPack pack = objectMapper.readValue(is, JurisdictionPack.class);
                    String key = normalize(pack.getStateCode());
                    jurisdictionPacks.put(key, pack);
                    log.debug("Loaded jurisdiction pack: {} ({})", pack.getName(), key);
                } catch (Exception e) {
                    log.error("Failed to load jurisdiction pack from {}: {}", resource.getFilename(), e.getMessage());
                }
            }

            log.info("Loaded {} jurisdiction packs: {}", jurisdictionPacks.size(), jurisdictionPacks.keySet());
        } catch (IOException e) {
            log.error("Failed to scan jurisdictions directory: {}", e.getMessage());
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

    /**
     * Normalize a jurisdiction input to an ISO-like lowercase code used in template filenames.
     * Accepts: "Massachusetts" / "MA" / "ma" → "ma"; "Federal" / "federal" / "US" → "federal".
     * Returns null when input is blank so the cascade skips the jurisdiction branches.
     */
    private String normalizeJurisdiction(String jurisdiction) {
        if (jurisdiction == null || jurisdiction.isBlank()) return null;
        String trimmed = jurisdiction.trim();
        String lower = trimmed.toLowerCase();

        // Already an ISO code like "ma" or our "federal" alias
        if (lower.equals("federal") || lower.equals("us")) return "federal";
        if (trimmed.length() == 2) return lower;

        // Full name like "Massachusetts" — delegate to JurisdictionResolver
        String code = jurisdictionResolver.getStateCode(trimmed);
        if (code != null) return code.toLowerCase();

        // Unknown format — return as-is so unusual packs (custom jurisdictions) still resolve
        return lower;
    }

    /**
     * Normalize a practice-area input (free-text or slug) to a lowercase slug.
     * Returns null when the input cannot be resolved so callers skip the practice-area branch.
     */
    private String normalizePracticeArea(String practiceArea) {
        return PracticeArea.slugOrNull(practiceArea);
    }

    public String getSystemPrompt() {
        return systemPrompt;
    }

    public JurisdictionPack getJurisdictionPack(String jurisdiction) {
        String code = normalizeJurisdiction(jurisdiction);
        return code != null ? jurisdictionPacks.get(code) : null;
    }

    public DocumentTypeTemplate getTemplate(String documentType) {
        if (documentType == null) return null;
        return templates.get(normalize(documentType));
    }

    /**
     * Keys of every loaded template (filename-derived, aliases included).
     * Used by {@link PracticeAreaCatalogService} to check 4-way cascade coverage without
     * re-running {@link #cascade} for every candidate doc type.
     */
    public java.util.Set<String> getLoadedKeys() {
        return java.util.Collections.unmodifiableSet(templates.keySet());
    }

    public JurisdictionPack getJurisdictionPackByCode(String stateCode) {
        if (stateCode == null) return null;
        return jurisdictionPacks.get(stateCode.toLowerCase());
    }

    /** Accessor for {@link PracticeAreaCatalogService} — returns normalized state code or null. */
    public String normalizeJurisdictionCode(String jurisdiction) {
        return normalizeJurisdiction(jurisdiction);
    }

    /**
     * 4-way cascade: most-specific to most-generic.
     * {type}_{pa}_{state} → {type}_{state} → {type}_{pa} → {type}
     * Returns the first template whose matcher returns non-null.
     */
    private <T> T cascade(String documentType, String practiceArea, String jurisdiction, java.util.function.Function<DocumentTypeTemplate, T> extractor) {
        if (documentType == null) return null;
        String type = normalize(documentType);
        String pa = normalizePracticeArea(practiceArea);
        String state = normalizeJurisdiction(jurisdiction);

        String[] keys = new String[]{
                (pa != null && state != null) ? type + "_" + pa + "_" + state : null,
                (state != null) ? type + "_" + state : null,
                (pa != null) ? type + "_" + pa : null,
                type
        };

        for (String key : keys) {
            if (key == null) continue;
            DocumentTypeTemplate t = templates.get(key);
            if (t != null) {
                T value = extractor.apply(t);
                if (value != null) {
                    log.debug("Template cascade hit: {} (doc={}, pa={}, state={})", key, type, pa, state);
                    return value;
                }
            }
        }
        return null;
    }

    public String getTemplateText(String documentType) {
        return getTemplateText(documentType, null, null);
    }

    /** Backward-compat overload: practice area unknown. Delegates to 3-arg cascade. */
    public String getTemplateText(String documentType, String jurisdiction) {
        return getTemplateText(documentType, null, jurisdiction);
    }

    public String getTemplateText(String documentType, String practiceArea, String jurisdiction) {
        String text = cascade(documentType, practiceArea, jurisdiction, DocumentTypeTemplate::getTemplate);
        return text != null ? text : "";
    }

    public String getHints(String documentType) {
        return getHints(documentType, null, null);
    }

    public String getHints(String documentType, String jurisdiction) {
        return getHints(documentType, null, jurisdiction);
    }

    public String getHints(String documentType, String practiceArea, String jurisdiction) {
        String hints = cascade(documentType, practiceArea, jurisdiction, DocumentTypeTemplate::getHints);
        if (hints != null) return hints;
        return "Include all standard legal elements appropriate for this document type. Address parties, key terms, obligations, and any jurisdiction-specific requirements.";
    }

    public CitationLevel getCitationLevel(String documentType) {
        return getCitationLevel(documentType, null, null);
    }

    public CitationLevel getCitationLevel(String documentType, String jurisdiction) {
        return getCitationLevel(documentType, null, jurisdiction);
    }

    public CitationLevel getCitationLevel(String documentType, String practiceArea, String jurisdiction) {
        String raw = cascade(documentType, practiceArea, jurisdiction, DocumentTypeTemplate::getCitationLevel);
        if (raw != null) {
            try {
                return CitationLevel.valueOf(raw);
            } catch (IllegalArgumentException e) {
                log.warn("Invalid citation level '{}' for type '{}' (pa={}, state={}), falling back to heuristic",
                        raw, documentType, practiceArea, jurisdiction);
            }
        }
        return heuristicCitationLevel(documentType);
    }

    /** Legacy heuristic used when no template matches — preserves old behavior for unregistered types. */
    private CitationLevel heuristicCitationLevel(String documentType) {
        if (documentType == null) return CitationLevel.COMPREHENSIVE;
        String type = documentType.toLowerCase();

        if (type.contains("contract") || type.contains("nda") ||
            type.contains("amendment") ||
            (type.contains("settlement") && type.contains("agreement")) ||
            (type.contains("clause") && !type.contains("legal")) ||
            (type.contains("employment") && type.contains("agreement")) ||
            (type.contains("purchase") && type.contains("agreement")) ||
            (type.contains("service") && type.contains("agreement"))) {
            return CitationLevel.NONE;
        }

        if (type.contains("letter") || type.contains("demand") ||
            type.contains("email") || type.contains("correspondence") ||
            type.contains("settlement-offer") || type.contains("opinion-letter") ||
            type.contains("opposing-counsel") || type.contains("client-email") ||
            type.contains("discovery") ||
            type.contains("interrogator") || type.contains("rfp") || type.contains("rfa") ||
            (type.contains("request") && type.contains("production")) ||
            (type.contains("request") && type.contains("admission")) ||
            type.contains("subpoena") ||
            (type.contains("deposition") && type.contains("notice")) ||
            type.contains("notice") || type.contains("stipulation") ||
            type.contains("affidavit")) {
            return CitationLevel.MINIMAL;
        }

        return CitationLevel.COMPREHENSIVE;
    }

    public boolean isLetterType(String documentType) {
        DocumentTypeTemplate t = getTemplate(documentType);
        if (t != null) return "letter".equals(t.getCategory());

        String norm = documentType != null ? normalize(documentType) : "";
        return norm.contains("letter") || norm.contains("correspondence");
    }

    public boolean isDemandLetterType(String documentType) {
        if (documentType == null) return false;
        String norm = normalize(documentType);
        return "demand_letter".equals(norm) || "demand".equals(norm);
    }
}
