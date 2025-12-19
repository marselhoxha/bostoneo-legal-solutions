package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.model.DocumentChunk;
import com.bostoneo.bostoneosolutions.repository.AIDocumentAnalysisRepository;
import com.bostoneo.bostoneosolutions.repository.CollectionDocumentRepository;
import com.bostoneo.bostoneosolutions.repository.DocumentChunkRepository;
import com.bostoneo.bostoneosolutions.service.ai.ClaudeSonnet4Service;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

/**
 * Service for extracting structured data from multiple documents in a collection.
 * Uses AI to extract specific fields like payment terms, parties, dates, etc.
 * into a structured table format.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class BatchExtractionService {

    private final DocumentChunkRepository chunkRepository;
    private final CollectionDocumentRepository collectionDocumentRepository;
    private final AIDocumentAnalysisRepository analysisRepository;
    private final ClaudeSonnet4Service claudeService;
    private final ObjectMapper objectMapper;

    /**
     * Predefined extraction templates for common legal document types.
     */
    public enum ExtractionTemplate {
        CONTRACT_KEY_TERMS("Contract Key Terms",
                List.of("parties", "effectiveDate", "termLength", "terminationNotice",
                        "paymentTerms", "paymentAmount", "jurisdiction", "governingLaw")),

        DEPOSITION_SUMMARY("Deposition Summary",
                List.of("witness", "depositionDate", "keyAdmissions", "topicsDiscussed",
                        "documentsReferenced", "objections", "followUpNeeded")),

        DISCOVERY_LOG("Discovery Log",
                List.of("date", "sender", "recipient", "documentType", "subject",
                        "responseRequired", "responseDeadline")),

        EMPLOYMENT_TERMS("Employment Terms",
                List.of("employeeName", "position", "startDate", "salary", "benefits",
                        "nonCompetePeriod", "nonCompeteScope", "confidentialityTerms")),

        LITIGATION_FACTS("Litigation Facts",
                List.of("incidentDate", "partiesInvolved", "location", "injuries",
                        "damages", "witnesses", "evidence")),

        CUSTOM("Custom", List.of());

        private final String displayName;
        private final List<String> defaultFields;

        ExtractionTemplate(String displayName, List<String> defaultFields) {
            this.displayName = displayName;
            this.defaultFields = defaultFields;
        }

        public String getDisplayName() { return displayName; }
        public List<String> getDefaultFields() { return defaultFields; }
    }

    /**
     * Represents extracted data for a single document.
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ExtractedDocumentData {
        private Long documentId;
        private String documentName;
        private String documentType;
        private Map<String, ExtractedField> fields;
    }

    /**
     * Represents a single extracted field with metadata.
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ExtractedField {
        private String value;
        private Double confidence;    // 0.0 to 1.0
        private String sourceChunk;   // Where this was found
        private Integer chunkIndex;
        private boolean notFound;     // True if field not found in document
    }

    /**
     * Response object for batch extraction.
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BatchExtractionResult {
        private List<ExtractedDocumentData> documents;
        private List<String> fields;              // Fields that were extracted
        private int totalDocuments;
        private long processingTimeMs;
        private String summary;
        private List<String> anomalies;           // Unusual findings
    }

    /**
     * Extract data from all documents in a collection using a template.
     *
     * @param collectionId The collection to analyze
     * @param template The extraction template to use
     * @param customFields Custom fields (used when template is CUSTOM)
     * @return BatchExtractionResult with extracted data
     */
    public CompletableFuture<BatchExtractionResult> extractData(
            Long collectionId,
            ExtractionTemplate template,
            List<String> customFields) {

        long startTime = System.currentTimeMillis();

        // Determine fields to extract
        List<String> fields = template == ExtractionTemplate.CUSTOM && customFields != null ?
                customFields : template.getDefaultFields();

        log.info("Starting batch extraction for collection {}, template: {}, fields: {}",
                collectionId, template, fields);

        // Get all analysis IDs in the collection
        List<Long> analysisIds = collectionDocumentRepository.findAnalysisIdsByCollectionId(collectionId);
        if (analysisIds.isEmpty()) {
            return CompletableFuture.completedFuture(BatchExtractionResult.builder()
                    .documents(new ArrayList<>())
                    .fields(fields)
                    .totalDocuments(0)
                    .processingTimeMs(System.currentTimeMillis() - startTime)
                    .summary("No documents in collection.")
                    .anomalies(new ArrayList<>())
                    .build());
        }

        // Get all chunks for the collection
        List<DocumentChunk> allChunks = chunkRepository.findByAnalysisIdIn(analysisIds);

        // Build document name and type map
        Map<Long, String> documentNames = new HashMap<>();
        Map<Long, String> documentTypes = new HashMap<>();
        for (Long analysisId : analysisIds) {
            analysisRepository.findById(analysisId).ifPresent(analysis -> {
                documentNames.put(analysisId, analysis.getFileName());
                documentTypes.put(analysisId, analysis.getDetectedType());
            });
        }

        // Build context for AI analysis
        StringBuilder contextBuilder = new StringBuilder();
        contextBuilder.append("DOCUMENTS TO ANALYZE:\n\n");

        for (Long analysisId : analysisIds) {
            String docName = documentNames.getOrDefault(analysisId, "Document " + analysisId);
            String docType = documentTypes.getOrDefault(analysisId, "Unknown");
            List<DocumentChunk> docChunks = allChunks.stream()
                    .filter(c -> c.getAnalysisId().equals(analysisId))
                    .sorted(Comparator.comparing(DocumentChunk::getChunkIndex))
                    .collect(Collectors.toList());

            contextBuilder.append("=== ").append(docName)
                    .append(" (ID: ").append(analysisId)
                    .append(", Type: ").append(docType)
                    .append(") ===\n");

            for (DocumentChunk chunk : docChunks) {
                String sectionInfo = chunk.getSectionTitle() != null ?
                        " [Section: " + chunk.getSectionTitle() + "]" : "";
                contextBuilder.append("[Chunk ").append(chunk.getChunkIndex()).append(sectionInfo).append("]\n");
                contextBuilder.append(chunk.getContent()).append("\n\n");
            }
            contextBuilder.append("\n");
        }

        // Build the prompt
        String systemMessage = buildExtractionSystemMessage(fields, template);
        String userPrompt = buildExtractionUserPrompt(contextBuilder.toString(), fields, analysisIds.size());

        // Call AI to extract data
        final List<String> finalFields = fields;
        return claudeService.generateCompletion(userPrompt, systemMessage, false)
                .thenApply(response -> {
                    List<ExtractedDocumentData> documents = parseExtractionResponse(
                            response, documentNames, documentTypes, finalFields);

                    long elapsed = System.currentTimeMillis() - startTime;

                    log.info("Batch extraction complete: {} documents processed in {}ms",
                            documents.size(), elapsed);

                    // Detect anomalies
                    List<String> anomalies = detectAnomalies(documents, finalFields);

                    // Generate summary
                    String summary = generateSummary(documents, finalFields, anomalies);

                    return BatchExtractionResult.builder()
                            .documents(documents)
                            .fields(finalFields)
                            .totalDocuments(analysisIds.size())
                            .processingTimeMs(elapsed)
                            .summary(summary)
                            .anomalies(anomalies)
                            .build();
                })
                .exceptionally(e -> {
                    log.error("Batch extraction failed for collection {}", collectionId, e);
                    return BatchExtractionResult.builder()
                            .documents(new ArrayList<>())
                            .fields(fields)
                            .totalDocuments(analysisIds.size())
                            .processingTimeMs(System.currentTimeMillis() - startTime)
                            .summary("Error extracting data: " + e.getMessage())
                            .anomalies(new ArrayList<>())
                            .build();
                });
    }

    /**
     * Build system message for batch extraction.
     */
    private String buildExtractionSystemMessage(List<String> fields, ExtractionTemplate template) {
        StringBuilder sb = new StringBuilder();
        sb.append("""
            You are a legal document analyst specialized in extracting structured data from legal documents.

            Your task is to extract specific fields from each document provided.

            EXTRACTION RULES:
            1. Extract ONLY the requested fields
            2. If a field is not found in a document, mark it as null
            3. Include the chunk index where the information was found
            4. Estimate confidence (0.0 to 1.0) based on how clearly the information was stated
            5. For dates, use ISO format (YYYY-MM-DD) when possible
            6. For money amounts, include currency symbol
            7. For multiple values, separate with semicolons

            OUTPUT FORMAT:
            You MUST respond with valid JSON array. One object per document:
            {
                "documentId": <numeric ID>,
                "fields": {
                    "<fieldName>": {
                        "value": "extracted value or null",
                        "confidence": 0.0-1.0,
                        "chunkIndex": <number where found>
                    },
                    ...
                }
            }

            FIELDS TO EXTRACT:
            """);

        for (String field : fields) {
            sb.append("- ").append(field).append("\n");
        }

        if (template != ExtractionTemplate.CUSTOM) {
            sb.append("\nTemplate context: ").append(template.getDisplayName());
        }

        return sb.toString();
    }

    /**
     * Build user prompt for batch extraction.
     */
    private String buildExtractionUserPrompt(String context, List<String> fields, int docCount) {
        return String.format("""
            Please extract the following fields from each of the %d documents:
            %s

            DOCUMENTS:
            %s

            Respond with a JSON array containing one object per document.
            """,
                docCount,
                String.join(", ", fields),
                context);
    }

    /**
     * Parse AI response to extract document data.
     */
    private List<ExtractedDocumentData> parseExtractionResponse(
            String response,
            Map<Long, String> documentNames,
            Map<Long, String> documentTypes,
            List<String> fields) {

        List<ExtractedDocumentData> documents = new ArrayList<>();

        try {
            String jsonStr = extractJsonFromResponse(response);
            List<Map<String, Object>> parsed = objectMapper.readValue(
                    jsonStr, new TypeReference<List<Map<String, Object>>>() {});

            for (Map<String, Object> docItem : parsed) {
                try {
                    Long docId = docItem.get("documentId") != null ?
                            ((Number) docItem.get("documentId")).longValue() : null;

                    Map<String, ExtractedField> fieldMap = new HashMap<>();

                    @SuppressWarnings("unchecked")
                    Map<String, Object> fieldsObj = (Map<String, Object>) docItem.get("fields");
                    if (fieldsObj != null) {
                        for (String fieldName : fields) {
                            @SuppressWarnings("unchecked")
                            Map<String, Object> fieldData = (Map<String, Object>) fieldsObj.get(fieldName);

                            ExtractedField field;
                            if (fieldData != null) {
                                Object valueObj = fieldData.get("value");
                                field = ExtractedField.builder()
                                        .value(valueObj != null ? valueObj.toString() : null)
                                        .confidence(fieldData.get("confidence") != null ?
                                                ((Number) fieldData.get("confidence")).doubleValue() : null)
                                        .chunkIndex(fieldData.get("chunkIndex") != null ?
                                                ((Number) fieldData.get("chunkIndex")).intValue() : null)
                                        .notFound(valueObj == null)
                                        .build();
                            } else {
                                field = ExtractedField.builder()
                                        .notFound(true)
                                        .build();
                            }
                            fieldMap.put(fieldName, field);
                        }
                    }

                    ExtractedDocumentData docData = ExtractedDocumentData.builder()
                            .documentId(docId)
                            .documentName(docId != null ? documentNames.get(docId) : null)
                            .documentType(docId != null ? documentTypes.get(docId) : null)
                            .fields(fieldMap)
                            .build();

                    documents.add(docData);
                } catch (Exception e) {
                    log.warn("Failed to parse document extraction: {}", docItem, e);
                }
            }
        } catch (Exception e) {
            log.error("Failed to parse extraction response: {}", response, e);
        }

        return documents;
    }

    /**
     * Extract JSON from AI response (handles markdown code blocks).
     */
    private String extractJsonFromResponse(String response) {
        if (response.contains("```json")) {
            int start = response.indexOf("```json") + 7;
            int end = response.indexOf("```", start);
            if (end > start) {
                return response.substring(start, end).trim();
            }
        }

        if (response.contains("```")) {
            int start = response.indexOf("```") + 3;
            int end = response.indexOf("```", start);
            if (end > start) {
                return response.substring(start, end).trim();
            }
        }

        int arrStart = response.indexOf('[');
        int arrEnd = response.lastIndexOf(']');
        if (arrStart >= 0 && arrEnd > arrStart) {
            return response.substring(arrStart, arrEnd + 1);
        }

        return response.trim();
    }

    /**
     * Detect anomalies/inconsistencies in extracted data.
     */
    private List<String> detectAnomalies(List<ExtractedDocumentData> documents, List<String> fields) {
        List<String> anomalies = new ArrayList<>();

        // Check for inconsistencies across documents
        for (String field : fields) {
            Map<String, List<String>> valueToDocuments = new HashMap<>();

            for (ExtractedDocumentData doc : documents) {
                ExtractedField extractedField = doc.getFields().get(field);
                if (extractedField != null && extractedField.getValue() != null && !extractedField.isNotFound()) {
                    String value = extractedField.getValue().toLowerCase().trim();
                    valueToDocuments.computeIfAbsent(value, k -> new ArrayList<>())
                            .add(doc.getDocumentName());
                }
            }

            // If we have multiple different values for the same field, flag it
            if (valueToDocuments.size() > 1 && isImportantField(field)) {
                StringBuilder anomaly = new StringBuilder();
                anomaly.append("⚠️ Inconsistent '").append(field).append("': ");
                List<String> parts = new ArrayList<>();
                for (Map.Entry<String, List<String>> entry : valueToDocuments.entrySet()) {
                    parts.add("\"" + entry.getKey() + "\" in " + String.join(", ", entry.getValue()));
                }
                anomaly.append(String.join(" vs ", parts));
                anomalies.add(anomaly.toString());
            }
        }

        return anomalies;
    }

    /**
     * Check if a field is important for inconsistency detection.
     */
    private boolean isImportantField(String field) {
        Set<String> importantFields = Set.of(
                "parties", "effectiveDate", "terminationNotice", "paymentAmount",
                "jurisdiction", "governingLaw", "witness", "incidentDate"
        );
        return importantFields.contains(field);
    }

    /**
     * Generate summary of extraction results.
     */
    private String generateSummary(List<ExtractedDocumentData> documents, List<String> fields, List<String> anomalies) {
        if (documents.isEmpty()) {
            return "No documents processed.";
        }

        // Count fields found per document
        int totalFields = 0;
        int foundFields = 0;
        for (ExtractedDocumentData doc : documents) {
            for (ExtractedField field : doc.getFields().values()) {
                totalFields++;
                if (!field.isNotFound() && field.getValue() != null) {
                    foundFields++;
                }
            }
        }

        double completeness = totalFields > 0 ? (double) foundFields / totalFields * 100 : 0;

        StringBuilder sb = new StringBuilder();
        sb.append("Extracted ").append(fields.size()).append(" fields from ")
                .append(documents.size()).append(" documents. ");
        sb.append(String.format("%.0f%% data completeness. ", completeness));

        if (!anomalies.isEmpty()) {
            sb.append(anomalies.size()).append(" inconsistencies detected.");
        }

        return sb.toString();
    }

    /**
     * Get available extraction templates.
     */
    public List<Map<String, Object>> getAvailableTemplates() {
        List<Map<String, Object>> templates = new ArrayList<>();
        for (ExtractionTemplate template : ExtractionTemplate.values()) {
            Map<String, Object> t = new HashMap<>();
            t.put("id", template.name());
            t.put("name", template.getDisplayName());
            t.put("fields", template.getDefaultFields());
            templates.add(t);
        }
        return templates;
    }
}
