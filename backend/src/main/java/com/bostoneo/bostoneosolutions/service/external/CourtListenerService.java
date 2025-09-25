package com.bostoneo.bostoneosolutions.service.external;

import com.bostoneo.bostoneosolutions.config.ExternalApiProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class CourtListenerService {

    private final ExternalApiProperties apiProperties;
    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

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
}