package com.bostoneo.bostoneosolutions.service.external;

import com.bostoneo.bostoneosolutions.dto.ai.CitationVerificationResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Service for verifying citations using Justia.com as a fallback source
 * Currently supports U.S. Supreme Court citations only
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class JustiaService {

    private final RestTemplate restTemplate = new RestTemplate();

    // Pattern to match U.S. Supreme Court citations (e.g., "411 U.S. 792")
    private static final Pattern US_SUPREME_COURT_PATTERN = Pattern.compile(
        "(\\d+)\\s+U\\.S\\.\\s+(\\d+)",
        Pattern.CASE_INSENSITIVE
    );

    /**
     * Try to verify a citation using Justia.com
     * Currently only supports U.S. Supreme Court citations
     *
     * @param citation Full citation string (may include case name)
     * @return CitationVerificationResult with Justia URL if found
     */
    public CitationVerificationResult tryVerifyCitation(String citation) {
        if (citation == null || citation.isBlank()) {
            return CitationVerificationResult.builder()
                    .found(false)
                    .citation(citation)
                    .build();
        }

        log.info("🔍 Trying Justia fallback for: {}", citation);

        // Currently only support U.S. Supreme Court citations
        if (!isSupremeCourtCitation(citation)) {
            log.debug("⚠️ Not a U.S. Supreme Court citation, Justia fallback not applicable");
            return CitationVerificationResult.builder()
                    .found(false)
                    .citation(citation)
                    .build();
        }

        try {
            // Extract case name if present
            String caseName = null;
            String citationNumber = citation;

            if (citation.contains(",") && citation.contains(" v. ")) {
                int commaIndex = citation.indexOf(",");
                caseName = citation.substring(0, commaIndex).trim();
                citationNumber = citation.substring(commaIndex + 1).trim();
            }

            // Construct Justia URL
            String justiaUrl = constructSupremeCourtUrl(citationNumber);
            if (justiaUrl == null) {
                return CitationVerificationResult.builder()
                        .found(false)
                        .citation(citation)
                        .build();
            }

            // Verify URL exists
            if (verifyUrlExists(justiaUrl)) {
                log.info("✅ FOUND on Justia: {}", justiaUrl);
                return CitationVerificationResult.builder()
                        .found(true)
                        .caseName(caseName)
                        .citation(citationNumber)
                        .url(justiaUrl)
                        .courtId("scotus")
                        .build();
            } else {
                log.warn("⚠️ Justia URL constructed but not accessible: {}", justiaUrl);
                return CitationVerificationResult.builder()
                        .found(false)
                        .citation(citation)
                        .build();
            }

        } catch (Exception e) {
            log.error("Error verifying citation with Justia: {}", citation, e);
            return CitationVerificationResult.builder()
                    .found(false)
                    .citation(citation)
                    .errorMessage("Justia verification failed: " + e.getMessage())
                    .build();
        }
    }

    /**
     * Check if citation is a U.S. Supreme Court citation
     * Pattern: "{volume} U.S. {page}"
     *
     * @param citation Citation to check
     * @return true if U.S. Supreme Court citation
     */
    private boolean isSupremeCourtCitation(String citation) {
        return US_SUPREME_COURT_PATTERN.matcher(citation).find();
    }

    /**
     * Construct Justia URL for U.S. Supreme Court citation
     * Format: https://supreme.justia.com/cases/federal/us/{volume}/{page}/
     *
     * @param citation Citation number (e.g., "411 U.S. 792")
     * @return Justia URL or null if cannot be constructed
     */
    private String constructSupremeCourtUrl(String citation) {
        Matcher matcher = US_SUPREME_COURT_PATTERN.matcher(citation);
        if (matcher.find()) {
            String volume = matcher.group(1);
            String page = matcher.group(2);
            String url = String.format("https://supreme.justia.com/cases/federal/us/%s/%s/", volume, page);
            log.debug("📋 Constructed Justia URL: {}", url);
            return url;
        }
        return null;
    }

    /**
     * Verify that a Justia URL exists using HTTP GET request with browser-like headers
     *
     * @param url Justia URL to verify
     * @return true if URL exists (returns 200 OK)
     */
    private boolean verifyUrlExists(String url) {
        try {
            // Add browser-like headers to avoid 403 Forbidden errors
            HttpHeaders headers = new HttpHeaders();
            headers.set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
            headers.set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
            headers.set("Accept-Language", "en-US,en;q=0.9");

            HttpEntity<String> entity = new HttpEntity<>(headers);

            ResponseEntity<String> response = restTemplate.exchange(
                    url,
                    HttpMethod.GET,  // Changed from HEAD - some servers block HEAD requests
                    entity,
                    String.class
            );
            return response.getStatusCode() == HttpStatus.OK;
        } catch (Exception e) {
            log.debug("URL verification failed for {}: {}", url, e.getMessage());
            return false;
        }
    }
}
