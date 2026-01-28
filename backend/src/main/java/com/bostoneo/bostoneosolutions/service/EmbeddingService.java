package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.model.DocumentChunk;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.repository.DocumentChunkRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Service for generating embeddings using OpenAI API.
 * Uses text-embedding-3-small model for cost efficiency.
 */
@Service
@Slf4j
public class EmbeddingService {

    private final DocumentChunkRepository chunkRepository;
    private final ObjectMapper objectMapper;
    private final WebClient openAiClient;
    private final TenantService tenantService;

    @Value("${openai.api.key:}")
    private String apiKey;

    private static final String EMBEDDING_MODEL = "text-embedding-3-small";

    public EmbeddingService(DocumentChunkRepository chunkRepository, ObjectMapper objectMapper, TenantService tenantService) {
        this.chunkRepository = chunkRepository;
        this.objectMapper = objectMapper;
        this.tenantService = tenantService;
        this.openAiClient = WebClient.builder()
                .baseUrl("https://api.openai.com/v1")
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .codecs(configurer -> configurer.defaultCodecs().maxInMemorySize(16 * 1024 * 1024))
                .build();
    }

    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    /**
     * Check if embedding service is available (API key configured).
     */
    public boolean isAvailable() {
        return apiKey != null && !apiKey.isEmpty();
    }

    /**
     * Generate embeddings for all chunks of a document.
     */
    public void generateEmbeddingsForDocument(Long analysisId) {
        if (!isAvailable()) {
            log.warn("OpenAI API key not configured - skipping embeddings for analysisId: {}", analysisId);
            return;
        }

        // SECURITY: Use tenant-filtered query
        Long orgId = getRequiredOrganizationId();
        List<DocumentChunk> chunks = chunkRepository.findByAnalysisIdAndOrganizationIdOrderByChunkIndexAsc(analysisId, orgId);
        if (chunks.isEmpty()) {
            log.warn("No chunks found for analysisId: {}", analysisId);
            return;
        }

        log.info("Generating embeddings for {} chunks (analysisId: {})", chunks.size(), analysisId);

        // Process chunks in smaller batches with longer delays to avoid rate limits
        int batchSize = 5; // Reduced from 20
        for (int i = 0; i < chunks.size(); i += batchSize) {
            List<DocumentChunk> batch = chunks.subList(i, Math.min(i + batchSize, chunks.size()));
            generateEmbeddingsForBatch(batch);

            // Longer delay between batches to avoid rate limits
            if (i + batchSize < chunks.size()) {
                try {
                    Thread.sleep(2000); // 2 seconds between batches
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }

        log.info("Completed embedding generation for analysisId: {}", analysisId);
    }

    // Max tokens for text-embedding-3-small is 8191 (~32000 chars)
    private static final int MAX_EMBEDDING_CHARS = 30000;

    /**
     * Generate embeddings for a batch of chunks.
     */
    private void generateEmbeddingsForBatch(List<DocumentChunk> chunks) {
        try {
            // Truncate texts that are too long for embedding API
            List<String> texts = chunks.stream()
                    .map(chunk -> {
                        String content = chunk.getContent();
                        if (content.length() > MAX_EMBEDDING_CHARS) {
                            log.warn("Truncating chunk {} from {} to {} chars for embedding",
                                    chunk.getId(), content.length(), MAX_EMBEDDING_CHARS);
                            return content.substring(0, MAX_EMBEDDING_CHARS);
                        }
                        return content;
                    })
                    .collect(Collectors.toList());

            List<float[]> embeddings = callOpenAIEmbeddings(texts);

            for (int i = 0; i < chunks.size() && i < embeddings.size(); i++) {
                DocumentChunk chunk = chunks.get(i);
                float[] embedding = embeddings.get(i);

                // Store embedding as JSON array
                chunk.setEmbedding(objectMapper.writeValueAsString(toDoubleList(embedding)));
                chunk.setEmbeddingModel(EMBEDDING_MODEL);
            }

            chunkRepository.saveAll(chunks);
            log.debug("Generated embeddings for {} chunks", chunks.size());

        } catch (Exception e) {
            log.error("Failed to generate embeddings for batch", e);
        }
    }

    private List<Double> toDoubleList(float[] arr) {
        List<Double> list = new ArrayList<>(arr.length);
        for (float f : arr) {
            list.add((double) f);
        }
        return list;
    }

    /**
     * Generate embedding for a single query.
     */
    public float[] generateQueryEmbedding(String query) {
        if (!isAvailable()) {
            return null;
        }

        try {
            List<float[]> embeddings = callOpenAIEmbeddings(List.of(query));
            return embeddings.isEmpty() ? null : embeddings.get(0);
        } catch (Exception e) {
            log.error("Failed to generate query embedding", e);
            return null;
        }
    }

    /**
     * Call OpenAI embeddings API with retry logic for rate limits.
     */
    private List<float[]> callOpenAIEmbeddings(List<String> texts) {
        if (!isAvailable()) {
            throw new IllegalStateException("OpenAI API key not configured");
        }

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("model", EMBEDDING_MODEL);
        requestBody.put("input", texts);

        int maxRetries = 5;
        int retryDelay = 5000; // Start with 5 seconds

        for (int attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                String response = openAiClient.post()
                        .uri("/embeddings")
                        .header("Authorization", "Bearer " + apiKey)
                        .bodyValue(requestBody)
                        .retrieve()
                        .bodyToMono(String.class)
                        .block();

                return parseEmbeddingsResponse(response);

            } catch (Exception e) {
                String errorMsg = e.getMessage();
                boolean isRateLimit = errorMsg != null && errorMsg.contains("429");
                boolean isBadRequest = errorMsg != null && errorMsg.contains("400");

                if (isRateLimit && attempt < maxRetries) {
                    log.warn("Rate limited (attempt {}/{}), waiting {}ms before retry...",
                            attempt, maxRetries, retryDelay);
                    try {
                        Thread.sleep(retryDelay);
                        retryDelay *= 2; // Exponential backoff
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        throw new RuntimeException("Interrupted during retry wait", ie);
                    }
                } else {
                    // Log detailed error info
                    log.error("OpenAI API call failed: {}", errorMsg);
                    if (isBadRequest) {
                        log.error("Bad request - texts count: {}, first text length: {}",
                                texts.size(), texts.isEmpty() ? 0 : texts.get(0).length());
                    }
                    throw new RuntimeException("Failed to call OpenAI embeddings API", e);
                }
            }
        }

        throw new RuntimeException("Failed after " + maxRetries + " retries");
    }

    /**
     * Parse embeddings from OpenAI response.
     */
    private List<float[]> parseEmbeddingsResponse(String response) throws JsonProcessingException {
        JsonNode root = objectMapper.readTree(response);
        JsonNode dataArray = root.get("data");

        List<float[]> embeddings = new ArrayList<>();
        for (JsonNode item : dataArray) {
            JsonNode embeddingArray = item.get("embedding");
            float[] embedding = new float[embeddingArray.size()];
            for (int i = 0; i < embeddingArray.size(); i++) {
                embedding[i] = (float) embeddingArray.get(i).asDouble();
            }
            embeddings.add(embedding);
        }

        return embeddings;
    }

    /**
     * Parse stored embedding from JSON string.
     */
    public float[] parseEmbedding(String embeddingJson) {
        if (embeddingJson == null || embeddingJson.isEmpty()) {
            return null;
        }

        try {
            List<Double> values = objectMapper.readValue(embeddingJson, new TypeReference<List<Double>>() {});
            float[] embedding = new float[values.size()];
            for (int i = 0; i < values.size(); i++) {
                embedding[i] = values.get(i).floatValue();
            }
            return embedding;
        } catch (JsonProcessingException e) {
            log.error("Failed to parse embedding JSON", e);
            return null;
        }
    }

    /**
     * Calculate cosine similarity between two vectors.
     */
    public double cosineSimilarity(float[] a, float[] b) {
        if (a == null || b == null || a.length != b.length) {
            return 0.0;
        }

        double dotProduct = 0.0;
        double normA = 0.0;
        double normB = 0.0;

        for (int i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        if (normA == 0 || normB == 0) {
            return 0.0;
        }

        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }
}
