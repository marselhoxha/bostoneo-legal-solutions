package com.bostoneo.bostoneosolutions.service.external;

import com.bostoneo.bostoneosolutions.config.ExternalApiProperties;
import com.bostoneo.bostoneosolutions.dto.ai.CitationVerificationResult;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestTemplate;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Slf4j
public class CourtListenerService {

    private final ExternalApiProperties apiProperties;
    private final JustiaService justiaService;
    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    // Universal citation pattern - matches ANY standard legal citation format
    // Format: Volume Reporter Page
    // Examples: "217 F.R.D. 309", "411 U.S. 792", "10 N.Y.3d 44", "685 F. Supp. 2d 456"
    private static final Pattern UNIVERSAL_CITATION = Pattern.compile(
        "(\\d+)\\s+([A-Z](?:[A-Za-z.\\s]){1,20}?)\\s+(\\d+(?:st|nd|rd|th)?)",
        Pattern.CASE_INSENSITIVE
    );

    public List<Map<String, Object>> searchOpinions(String query, String jurisdiction, LocalDate fromDate, LocalDate toDate) {
        if (!StringUtils.hasText(apiProperties.getCourtlistener().getApiKey())) {
            log.warn("Court Listener API key not configured, skipping external search");
            return Collections.emptyList();
        }

        try {
            String url = buildSearchUrl("opinions", query, jurisdiction, fromDate, toDate);
            HttpHeaders headers = createHeaders();
            HttpEntity<String> entity = new HttpEntity<>(headers);

            log.info("Calling Court Listener API: {}", url);
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, entity, String.class);

            if (response.getStatusCode() == HttpStatus.OK) {
                return parseOpinionsResponse(response.getBody());
            } else {
                log.error("Court Listener API returned error: {}", response.getStatusCode());
                return Collections.emptyList();
            }

        } catch (Exception e) {
            log.error("Error calling Court Listener API: ", e);
            return Collections.emptyList();
        }
    }

    public List<Map<String, Object>> searchDockets(String query, String court) {
        if (!StringUtils.hasText(apiProperties.getCourtlistener().getApiKey())) {
            log.warn("Court Listener API key not configured, skipping docket search");
            return Collections.emptyList();
        }

        try {
            StringBuilder urlBuilder = new StringBuilder(apiProperties.getCourtlistener().getBaseUrl())
                    .append("dockets/")
                    .append("?format=json")
                    .append("&q=").append(query);

            if (StringUtils.hasText(court)) {
                urlBuilder.append("&court=").append(court);
            }

            String url = urlBuilder.toString();
            HttpHeaders headers = createHeaders();
            HttpEntity<String> entity = new HttpEntity<>(headers);

            log.info("Calling Court Listener Dockets API: {}", url);
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, entity, String.class);

            if (response.getStatusCode() == HttpStatus.OK) {
                return parseDocketsResponse(response.getBody());
            } else {
                log.error("Court Listener Dockets API returned error: {}", response.getStatusCode());
                return Collections.emptyList();
            }

        } catch (Exception e) {
            log.error("Error calling Court Listener Dockets API: ", e);
            return Collections.emptyList();
        }
    }

    public Map<String, Object> getApiStatus() {
        Map<String, Object> status = new HashMap<>();
        status.put("service", "Court Listener");
        status.put("configured", StringUtils.hasText(apiProperties.getCourtlistener().getApiKey()));
        status.put("baseUrl", apiProperties.getCourtlistener().getBaseUrl());

        if (StringUtils.hasText(apiProperties.getCourtlistener().getApiKey())) {
            try {
                String url = apiProperties.getCourtlistener().getBaseUrl() + "?format=json&limit=1";
                HttpHeaders headers = createHeaders();
                HttpEntity<String> entity = new HttpEntity<>(headers);

                ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, entity, String.class);
                status.put("available", response.getStatusCode() == HttpStatus.OK);
                status.put("lastChecked", new Date());

            } catch (Exception e) {
                status.put("available", false);
                status.put("error", e.getMessage());
                status.put("lastChecked", new Date());
            }
        } else {
            status.put("available", false);
            status.put("error", "API key not configured");
        }

        return status;
    }

    private String buildSearchUrl(String endpoint, String query, String jurisdiction, LocalDate fromDate, LocalDate toDate) {
        StringBuilder url = new StringBuilder(apiProperties.getCourtlistener().getBaseUrl())
                .append(endpoint).append("/")
                .append("?format=json")
                .append("&q=").append(query)
                .append("&limit=20");

        if (StringUtils.hasText(jurisdiction)) {
            url.append("&court=").append(jurisdiction);
        }

        if (fromDate != null) {
            url.append("&filed_after=").append(fromDate.toString());
        }

        if (toDate != null) {
            url.append("&filed_before=").append(toDate.toString());
        }

        return url.toString();
    }

    private HttpHeaders createHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "Token " + apiProperties.getCourtlistener().getApiKey());
        headers.set("Accept", "application/json");
        headers.set("User-Agent", "BostoneoSolutions/1.0");
        return headers;
    }

    private List<Map<String, Object>> parseOpinionsResponse(String jsonResponse) {
        List<Map<String, Object>> results = new ArrayList<>();

        try {
            JsonNode root = objectMapper.readTree(jsonResponse);
            JsonNode resultsArray = root.get("results");

            if (resultsArray != null && resultsArray.isArray()) {
                for (JsonNode result : resultsArray) {
                    Map<String, Object> opinion = new HashMap<>();
                    opinion.put("id", result.path("id").asText());
                    opinion.put("type", "court_opinion");
                    opinion.put("title", result.path("case_name").asText());
                    opinion.put("citation", result.path("citation").asText());
                    opinion.put("court", result.path("court").asText());
                    opinion.put("dateFiled", result.path("date_filed").asText());
                    opinion.put("judge", result.path("author_str").asText());
                    opinion.put("summary", truncateText(result.path("plain_text").asText(), 300));
                    opinion.put("url", result.path("absolute_url").asText());
                    opinion.put("source", "Court Listener");

                    results.add(opinion);
                }
            }

        } catch (Exception e) {
            log.error("Error parsing Court Listener opinions response: ", e);
        }

        return results;
    }

    private List<Map<String, Object>> parseDocketsResponse(String jsonResponse) {
        List<Map<String, Object>> results = new ArrayList<>();

        try {
            JsonNode root = objectMapper.readTree(jsonResponse);
            JsonNode resultsArray = root.get("results");

            if (resultsArray != null && resultsArray.isArray()) {
                for (JsonNode result : resultsArray) {
                    Map<String, Object> docket = new HashMap<>();
                    docket.put("id", result.path("id").asText());
                    docket.put("type", "docket");
                    docket.put("title", result.path("case_name").asText());
                    docket.put("docketNumber", result.path("docket_number").asText());
                    docket.put("court", result.path("court").asText());
                    docket.put("dateFiled", result.path("date_filed").asText());
                    docket.put("summary", "Docket for " + result.path("case_name").asText());
                    docket.put("url", result.path("absolute_url").asText());
                    docket.put("source", "Court Listener");

                    results.add(docket);
                }
            }

        } catch (Exception e) {
            log.error("Error parsing Court Listener dockets response: ", e);
        }

        return results;
    }

    private String truncateText(String text, int maxLength) {
        if (text == null || text.length() <= maxLength) {
            return text;
        }
        return text.substring(0, maxLength) + "...";
    }

    // ========================================================================
    // CITATION VERIFICATION METHODS (for hallucination prevention)
    // ========================================================================

    /**
     * Verify a legal citation against CourtListener database
     * Used to prevent AI hallucinations by validating all case citations
     *
     * @param citation Citation to verify (e.g., "550 U.S. 544", "Bell Atlantic v. Twombly")
     * @return CitationVerificationResult with verification status and case details
     */
    public CitationVerificationResult verifyCitation(String citation) {
        if (citation == null || citation.isBlank()) {
            return CitationVerificationResult.builder()
                    .found(false)
                    .citation(citation)
                    .errorMessage("Citation is empty")
                    .build();
        }

        log.info("🔍 Verifying citation: {}", citation);

        try {
            // Strategy 1: Try /search/ API (better citation matching)
            CitationVerificationResult result = searchUsingSearchApi(citation);

            if (result.isFound()) {
                log.info("✅ Citation verified via /search/ API");
                return result;
            }

            // Strategy 2: Fallback to /opinions/ API with case name filtering
            log.info("🔄 /search/ failed, trying /opinions/ fallback...");
            result = searchByCitationNumber(citation);

            if (result.isFound()) {
                log.info("✅ Citation verified via /opinions/ API fallback");
                return result;
            }

            // Strategy 3: Try Justia for Supreme Court cases
            log.info("🔄 CourtListener failed, trying Justia fallback...");
            return justiaService.tryVerifyCitation(citation);

        } catch (Exception e) {
            log.error("Error verifying citation: {}", citation, e);
            return CitationVerificationResult.builder()
                    .found(false)
                    .citation(citation)
                    .errorMessage("Verification failed: " + e.getMessage())
                    .build();
        }
    }

    /**
     * Search CourtListener using /search/ API endpoint (better citation matching)
     * This is the preferred method as it has better citation parsing than /opinions/
     */
    private CitationVerificationResult searchUsingSearchApi(String citation) {
        if (!StringUtils.hasText(apiProperties.getCourtlistener().getApiKey())) {
            return CitationVerificationResult.builder()
                    .found(false)
                    .citation(citation)
                    .errorMessage("CourtListener API key not configured")
                    .build();
        }

        try {
            // Extract citation number for search
            String citationNumber = citation;
            String targetCaseName = null;

            Pattern citationPattern = Pattern.compile("(\\d+)\\s+([A-Z](?:[A-Za-z.\\d\\s]){1,30})\\s+(\\d+(?:st|nd|rd|th)?)");
            Matcher citationMatcher = citationPattern.matcher(citation);

            if (citationMatcher.find()) {
                citationNumber = citationMatcher.group().trim();

                int citationStart = citationMatcher.start();
                if (citationStart > 0 && citation.substring(0, citationStart).contains(" v. ")) {
                    targetCaseName = citation.substring(0, citationStart).trim();
                    if (targetCaseName.endsWith(",")) {
                        targetCaseName = targetCaseName.substring(0, targetCaseName.length() - 1).trim();
                    }
                }
            } else {
                return CitationVerificationResult.builder()
                        .found(false)
                        .citation(citation)
                        .errorMessage("Could not parse citation format")
                        .build();
            }

            // Use /search/ endpoint with citation-specific query
            // Try multiple query formats since v4 API might have different syntax
            String encodedQuery = URLEncoder.encode(citationNumber, StandardCharsets.UTF_8);

            // Format 1: Try with citation: prefix (field-specific search)
            String url = "https://www.courtlistener.com/api/rest/v4/search/?type=o&q=citation:" + encodedQuery + "&format=json";

            HttpHeaders headers = createHeaders();
            HttpEntity<String> entity = new HttpEntity<>(headers);

            log.info("🔍 SEARCH API - Searching for: '{}' via /search/ endpoint (citation: prefix)", citationNumber);
            log.info("🔍 Search URL: {}", url);

            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, entity, String.class);

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                JsonNode results = root.path("results");

                int resultCount = results.isArray() ? results.size() : 0;
                log.info("🔍 SEARCH API - Results count: {}", resultCount);

                if (resultCount > 0) {
                    log.debug("📊 First 500 chars of response: {}", response.getBody().substring(0, Math.min(500, response.getBody().length())));

                    // Filter by case name if provided
                    JsonNode matchingResult = null;
                    if (targetCaseName != null) {
                        for (int i = 0; i < results.size(); i++) {
                            JsonNode result = results.get(i);
                            String foundCaseName = result.path("caseName").asText("");

                            log.debug("🔍 Result {}: Case='{}', Citation='{}'",
                                i, foundCaseName, result.path("citation").asText(""));

                            if (normalizedCaseNameMatch(foundCaseName, targetCaseName)) {
                                matchingResult = result;
                                log.info("🎯 MATCHED case name: '{}'", foundCaseName);
                                break;
                            }
                        }

                        if (matchingResult == null) {
                            log.warn("⚠️ No case name match in {} /search/ results for: '{}'", resultCount, targetCaseName);
                            return CitationVerificationResult.builder()
                                    .found(false)
                                    .citation(citation)
                                    .build();
                        }
                    } else {
                        // No case name to filter by - DON'T return first result blindly
                        // This prevents returning wrong URLs when called with just citation number
                        log.warn("⚠️ No case name provided for /search/ filtering - cannot verify citation accurately");
                        log.warn("🔍 NOT FOUND - Need case name to filter {} /search/ results for: '{}'", results.size(), citationNumber);
                        return CitationVerificationResult.builder()
                                .found(false)
                                .citation(citation)
                                .errorMessage("Need case name to verify citation (got " + results.size() + " potential matches)")
                                .build();
                    }

                    // Parse result from /search/ API (different structure than /opinions/)
                    return parseSearchApiResult(matchingResult, citation);
                } else {
                    log.info("🔍 NOT FOUND in /search/ API for: '{}'", citationNumber);
                    return CitationVerificationResult.builder()
                            .found(false)
                            .citation(citation)
                            .build();
                }
            }

            return CitationVerificationResult.builder()
                    .found(false)
                    .citation(citation)
                    .build();

        } catch (Exception e) {
            log.error("Error searching via /search/ API: {}", citation, e);
            return CitationVerificationResult.builder()
                    .found(false)
                    .citation(citation)
                    .errorMessage(e.getMessage())
                    .build();
        }
    }

    /**
     * Parse result from /search/ API (has different structure than /opinions/ API)
     */
    private CitationVerificationResult parseSearchApiResult(JsonNode result, String originalCitation) {
        try {
            String caseName = result.path("caseName").asText("");
            String citation = result.path("citation").asText("");
            String url = result.path("absolute_url").asText("");
            String courtId = result.path("court_id").asText("");

            if (!url.startsWith("http")) {
                url = "https://www.courtlistener.com" + url;
            }

            log.info("✅ VERIFIED via /search/ - Case: '{}', URL: '{}'", caseName, url);

            return CitationVerificationResult.builder()
                    .found(true)
                    .citation(citation.isBlank() ? originalCitation : citation)
                    .caseName(caseName)
                    .url(url)
                    .courtId(courtId)
                    .confidenceScore(1.0)
                    .build();

        } catch (Exception e) {
            log.error("Error parsing /search/ API result", e);
            return CitationVerificationResult.builder()
                    .found(false)
                    .citation(originalCitation)
                    .errorMessage("Error parsing result: " + e.getMessage())
                    .build();
        }
    }

    /**
     * Search CourtListener by citation number (e.g., "550 U.S. 544")
     * FALLBACK METHOD - /search/ API is preferred
     */
    private CitationVerificationResult searchByCitationNumber(String citation) {
        if (!StringUtils.hasText(apiProperties.getCourtlistener().getApiKey())) {
            return CitationVerificationResult.builder()
                    .found(false)
                    .citation(citation)
                    .errorMessage("CourtListener API key not configured")
                    .build();
        }

        try {
            // Extract case name (if present) and citation number from input
            // Examples:
            // - "McDonnell Douglas Corp. v. Green, 411 U.S. 792" → case name + number
            // - "Sal's Beverages, Inc. v. Pepsi Cola Bottling Co., 402 Mass. 324" → case name with commas + number
            // - "411 U.S. 792" → just number
            String targetCaseName = null;
            String citationNumber = citation;

            // Smart extraction: Find citation number pattern first, then split around it
            // This handles case names with commas (Inc., Ltd., Corp., etc.)
            // Pattern allows digits in reporter name for federal citations (F.3d, F.2d, F. Supp. 2d, etc.)
            // Using greedy quantifier {1,30} - regex backtracking ensures it doesn't consume page number
            Pattern citationPattern = Pattern.compile("(\\d+)\\s+([A-Z](?:[A-Za-z.\\d\\s]){1,30})\\s+(\\d+(?:st|nd|rd|th)?)");
            Matcher citationMatcher = citationPattern.matcher(citation);

            if (citationMatcher.find()) {
                // Found citation number pattern (e.g., "402 Mass. 324", "411 U.S. 792", "373 F.3d 57")
                citationNumber = citationMatcher.group().trim();

                // Check if there's a case name before the citation number
                int citationStart = citationMatcher.start();
                if (citationStart > 0 && citation.substring(0, citationStart).contains(" v. ")) {
                    // Extract everything before the citation number as case name
                    // Trim any trailing comma or whitespace
                    targetCaseName = citation.substring(0, citationStart).trim();
                    if (targetCaseName.endsWith(",")) {
                        targetCaseName = targetCaseName.substring(0, targetCaseName.length() - 1).trim();
                    }
                    log.info("📋 Extracted from input - Case name: '{}', Citation: '{}'", targetCaseName, citationNumber);
                } else {
                    log.info("📋 Extracted citation number: '{}'", citationNumber);
                }
            } else {
                // Pattern extraction failed - invalid citation format
                log.warn("⚠️ Could not extract citation pattern from: '{}'", citation);
                log.warn("🔍 NOT FOUND - Invalid citation format");
                return CitationVerificationResult.builder()
                        .found(false)
                        .citation(citation)
                        .errorMessage("Could not parse citation format")
                        .build();
            }

            // Search CourtListener by citation number
            // Use clusters endpoint instead of opinions to get case_name directly
            String encodedCitation = URLEncoder.encode(citationNumber, StandardCharsets.UTF_8);
            String url = apiProperties.getCourtlistener().getBaseUrl() + "clusters/?cite=" + encodedCitation + "&format=json";

            HttpHeaders headers = createHeaders();
            HttpEntity<String> entity = new HttpEntity<>(headers);

            log.info("🔍 CITATION VERIFICATION DEBUG - Searching for: '{}' via /clusters/", citationNumber);
            log.info("🔍 CourtListener API URL: {}", url);

            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, entity, String.class);

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                JsonNode results = root.get("results");

                int resultCount = results != null && results.isArray() ? results.size() : 0;
                log.info("🔍 CourtListener Response - Results count: {}", resultCount);

                if (results != null && results.isArray() && results.size() > 0) {
                    log.debug("📊 First 500 chars of /clusters/ response: {}", response.getBody().substring(0, Math.min(500, response.getBody().length())));

                    // If we have a target case name, filter results by case name match
                    JsonNode matchingCluster = null;
                    if (targetCaseName != null) {
                        log.debug("🔍 Filtering {} cluster results by case name: '{}'", resultCount, targetCaseName);

                        for (int i = 0; i < results.size(); i++) {
                            JsonNode cluster = results.get(i);
                            String foundCaseName = cluster.has("case_name") ? cluster.get("case_name").asText() : "";
                            String foundUrl = cluster.has("absolute_url") ? cluster.get("absolute_url").asText() : "N/A";

                            log.debug("🔍 Cluster {}: Case='{}', URL='{}'", i, foundCaseName, foundUrl);

                            if (normalizedCaseNameMatch(foundCaseName, targetCaseName)) {
                                matchingCluster = cluster;
                                log.info("🎯 MATCHED case name at position {}: '{}', URL: '{}'", i, foundCaseName, foundUrl);
                                break;
                            }
                        }

                        if (matchingCluster == null) {
                            log.warn("⚠️ No case name match found in {} clusters for: '{}'", results.size(), targetCaseName);
                            return CitationVerificationResult.builder()
                                    .found(false)
                                    .citation(citation)
                                    .build();
                        }
                    } else {
                        // No case name to filter by - DON'T return first result blindly
                        // This prevents returning wrong URLs when called with just citation number
                        log.warn("⚠️ No case name provided for filtering - cannot verify citation accurately");
                        log.warn("🔍 NOT FOUND - Need case name to filter {} cluster results for: '{}'", results.size(), citationNumber);
                        return CitationVerificationResult.builder()
                                .found(false)
                                .citation(citation)
                                .errorMessage("Need case name to verify citation (got " + results.size() + " potential matches)")
                                .build();
                    }

                    return parseClusterVerificationResult(matchingCluster, citation);
                } else {
                    log.warn("🔍 NOT FOUND in CourtListener database for citation: '{}'", citationNumber);
                    log.info("🔄 Trying Justia.com fallback...");
                    return justiaService.tryVerifyCitation(citation);
                }
            }

            // Not found in CourtListener, try Justia fallback
            log.warn("🔍 NOT FOUND in CourtListener, trying Justia fallback...");
            return justiaService.tryVerifyCitation(citation);

        } catch (Exception e) {
            log.error("Error searching by citation number: {}", citation, e);
            return CitationVerificationResult.builder()
                    .found(false)
                    .citation(citation)
                    .errorMessage(e.getMessage())
                    .build();
        }
    }

    /**
     * Normalize and match case names (handles variations in formatting)
     * Examples:
     * - "McDonnell Douglas Corp. v. Green" matches "MCDONNELL DOUGLAS CORP. V. GREEN"
     * - "St. Mary's Honor Center v. Hicks" matches "St. Mary's Honor Ctr. v. Hicks"
     * - "Texas Dep't of Community Affairs v. Burdine" matches "Texas Department of Community Affairs v. Burdine"
     */
    private boolean normalizedCaseNameMatch(String caseName1, String caseName2) {
        if (caseName1 == null || caseName2 == null) {
            return false;
        }

        // Normalize: lowercase, remove extra spaces, expand common abbreviations
        String normalized1 = caseName1.toLowerCase()
                .replaceAll("\\s+", " ")
                .replaceAll("corp\\.", "corporation")
                .replaceAll("co\\.", "company")
                .replaceAll("inc\\.", "incorporated")
                .replaceAll("dept\\.", "department")
                .replaceAll("dep't", "department")
                .replaceAll("ctr\\.", "center")
                .replaceAll("dist\\.", "district")
                .replaceAll("gov't", "government")
                .replaceAll("nat'l", "national")
                .replaceAll("'", "") // Remove apostrophes
                .trim();

        String normalized2 = caseName2.toLowerCase()
                .replaceAll("\\s+", " ")
                .replaceAll("corp\\.", "corporation")
                .replaceAll("co\\.", "company")
                .replaceAll("inc\\.", "incorporated")
                .replaceAll("dept\\.", "department")
                .replaceAll("dep't", "department")
                .replaceAll("ctr\\.", "center")
                .replaceAll("dist\\.", "district")
                .replaceAll("gov't", "government")
                .replaceAll("nat'l", "national")
                .replaceAll("'", "") // Remove apostrophes
                .trim();

        return normalized1.equals(normalized2);
    }

    /**
     * Search CourtListener by case name (for verification)
     */
    private CitationVerificationResult searchByCaseNameForVerification(String caseName, String court) {
        if (!StringUtils.hasText(apiProperties.getCourtlistener().getApiKey())) {
            return CitationVerificationResult.builder()
                    .found(false)
                    .citation(caseName)
                    .errorMessage("CourtListener API key not configured")
                    .build();
        }

        try {
            String encodedCaseName = URLEncoder.encode(caseName, StandardCharsets.UTF_8);
            StringBuilder urlBuilder = new StringBuilder(apiProperties.getCourtlistener().getBaseUrl())
                    .append("clusters/?case_name__icontains=").append(encodedCaseName)
                    .append("&format=json");

            if (court != null && !court.isBlank()) {
                urlBuilder.append("&docket__court=").append(court);
            }

            String url = urlBuilder.toString();
            HttpHeaders headers = createHeaders();
            HttpEntity<String> entity = new HttpEntity<>(headers);

            log.debug("Searching by case name: {}", url);

            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, entity, String.class);

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                JsonNode results = root.get("results");

                if (results != null && results.isArray() && results.size() > 0) {
                    JsonNode firstResult = results.get(0);
                    return parseClusterVerificationResult(firstResult, caseName);
                }
            }

            return CitationVerificationResult.builder()
                    .found(false)
                    .citation(caseName)
                    .partialMatch(false)
                    .build();

        } catch (Exception e) {
            log.error("Error searching by case name: {}", caseName, e);
            return CitationVerificationResult.builder()
                    .found(false)
                    .citation(caseName)
                    .errorMessage(e.getMessage())
                    .build();
        }
    }

    /**
     * Get full opinion text from CourtListener
     *
     * @param opinionId CourtListener opinion ID
     * @return Opinion text in HTML format with citations linked
     */
    public String getOpinionText(String opinionId) {
        if (!StringUtils.hasText(apiProperties.getCourtlistener().getApiKey())) {
            log.warn("CourtListener API key not configured");
            return null;
        }

        try {
            String url = apiProperties.getCourtlistener().getBaseUrl() + "opinions/" + opinionId + "/?fields=html_with_citations,plain_text&format=json";

            HttpHeaders headers = createHeaders();
            HttpEntity<String> entity = new HttpEntity<>(headers);

            log.debug("Fetching opinion text: {}", url);

            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, entity, String.class);

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());

                // Prefer html_with_citations (has linked citations)
                if (root.has("html_with_citations") && !root.get("html_with_citations").isNull()) {
                    return root.get("html_with_citations").asText();
                }

                // Fallback to plain_text
                if (root.has("plain_text") && !root.get("plain_text").isNull()) {
                    return root.get("plain_text").asText();
                }
            }

            return null;
        } catch (Exception e) {
            log.error("Error fetching opinion text for ID: {}", opinionId, e);
            return null;
        }
    }

    /**
     * Extract all citations from text using regex patterns
     *
     * @param text Text containing potential citations
     * @return List of extracted citations
     */
    public List<String> extractCitations(String text) {
        List<String> citations = new ArrayList<>();

        if (text == null || text.isBlank()) {
            return citations;
        }

        // Use universal pattern to match ALL standard legal citation formats
        // Matches: "217 F.R.D. 309", "411 U.S. 792", "10 N.Y.3d 44", etc.
        Matcher matcher = UNIVERSAL_CITATION.matcher(text);

        while (matcher.find()) {
            String fullCitation = matcher.group().trim();

            // Filter out false positives (numbers that aren't legal citations)
            // Must have at least one letter between volume and page numbers
            String reporter = matcher.group(2);
            if (reporter != null && reporter.matches(".*[A-Za-z].*")) {
                citations.add(fullCitation);
                log.debug("Extracted citation: {}", fullCitation);
            }
        }

        log.info("Extracted {} citations from text", citations.size());
        return citations;
    }

    /**
     * Parse opinion result from CourtListener API for verification
     */
    private CitationVerificationResult parseVerificationResult(JsonNode opinion, String originalCitation, boolean isCluster) {
        try {
            String caseName = opinion.has("case_name") ? opinion.get("case_name").asText() : "Unknown Case";
            String opinionId = opinion.has("id") ? opinion.get("id").asText() : null;
            String absoluteUrl = opinion.has("absolute_url") ? opinion.get("absolute_url").asText() : null;
            String courtId = opinion.has("court") ? opinion.get("court").asText() : null;

            String courtListenerUrl = absoluteUrl != null ?
                    "https://www.courtlistener.com" + absoluteUrl : null;

            return CitationVerificationResult.builder()
                    .found(true)
                    .citation(originalCitation)
                    .caseName(caseName)
                    .url(courtListenerUrl)
                    .opinionId(opinionId)
                    .courtId(courtId)
                    .partialMatch(false)
                    .confidenceScore(1.0)
                    .build();

        } catch (Exception e) {
            log.error("Error parsing verification result", e);
            return CitationVerificationResult.builder()
                    .found(false)
                    .citation(originalCitation)
                    .errorMessage("Error parsing result: " + e.getMessage())
                    .build();
        }
    }

    /**
     * Parse cluster result from CourtListener API for verification
     */
    private CitationVerificationResult parseClusterVerificationResult(JsonNode cluster, String originalQuery) {
        try {
            String caseName = cluster.has("case_name") ? cluster.get("case_name").asText() : "Unknown Case";
            String clusterId = cluster.has("id") ? cluster.get("id").asText() : null;
            String absoluteUrl = cluster.has("absolute_url") ? cluster.get("absolute_url").asText() : null;
            String dateFiled = cluster.has("date_filed") ? cluster.get("date_filed").asText() : null;

            // Get first citation if available
            String citation = null;
            if (cluster.has("citations") && cluster.get("citations").isArray() && cluster.get("citations").size() > 0) {
                citation = cluster.get("citations").get(0).asText();
            }

            String courtListenerUrl = absoluteUrl != null ?
                    "https://www.courtlistener.com" + absoluteUrl : null;

            return CitationVerificationResult.builder()
                    .found(true)
                    .citation(citation != null ? citation : originalQuery)
                    .caseName(caseName)
                    .url(courtListenerUrl)
                    .clusterId(clusterId)
                    .dateFiled(dateFiled)
                    .partialMatch(citation == null)
                    .confidenceScore(citation != null ? 1.0 : 0.7)
                    .build();

        } catch (Exception e) {
            log.error("Error parsing cluster verification result", e);
            return CitationVerificationResult.builder()
                    .found(false)
                    .citation(originalQuery)
                    .errorMessage("Error parsing result: " + e.getMessage())
                    .build();
        }
    }
}