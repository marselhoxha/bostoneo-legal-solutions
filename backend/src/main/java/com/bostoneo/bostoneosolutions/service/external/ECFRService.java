package com.bostoneo.bostoneosolutions.service.external;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;

/**
 * Service for retrieving federal regulations from eCFR (electronic Code of Federal Regulations)
 * API Docs: https://www.ecfr.gov/developers/documentation/api/v1
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ECFRService {

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final String ECFR_BASE_URL = "https://www.ecfr.gov/api/versioner/v1";

    /**
     * Get full text of a CFR section
     * Example: getCFRText("8", "1003", "23") for 8 CFR § 1003.23
     */
    public String getCFRText(String title, String part, String section) {
        try {
            String date = LocalDate.now().toString();
            String url = String.format("%s/full/%s/%s/%s.json",
                ECFR_BASE_URL, date, title, part);

            log.info("Fetching CFR: {} CFR § {}.{}", title, part, section);

            String response = restTemplate.getForObject(url, String.class);
            JsonNode root = objectMapper.readTree(response);

            // Navigate JSON to find specific section
            JsonNode content = root.path("content_html");
            String html = content.asText();

            // Extract section text (basic extraction - can be improved)
            String sectionMarker = "§ " + part + "." + section;
            int start = html.indexOf(sectionMarker);

            if (start == -1) {
                return "Section not found in CFR " + title + " Part " + part;
            }

            // Extract text until next section or end
            int nextSection = html.indexOf("§ " + part + ".", start + 10);
            int end = nextSection != -1 ? nextSection : Math.min(start + 5000, html.length());

            String sectionText = html.substring(start, end);

            // Strip HTML tags (basic)
            sectionText = sectionText.replaceAll("<[^>]+>", "")
                                     .replaceAll("\\s+", " ")
                                     .trim();

            log.info("Successfully retrieved {} CFR § {}.{} ({} chars)",
                title, part, section, sectionText.length());

            return sectionText;

        } catch (Exception e) {
            log.error("Error fetching CFR {}.{}.{}: {}", title, part, section, e.getMessage());
            return "Error retrieving CFR text: " + e.getMessage();
        }
    }

    /**
     * Search CFR by keyword
     */
    public String searchCFR(String query, String title) {
        try {
            String url = String.format("%s/search/%s?q=%s",
                ECFR_BASE_URL, title, query);

            log.info("Searching CFR {} for: {}", title, query);
            String response = restTemplate.getForObject(url, String.class);

            return response != null ? response : "No results found";

        } catch (Exception e) {
            log.error("Error searching CFR: {}", e.getMessage());
            return "Error searching CFR: " + e.getMessage();
        }
    }
}
