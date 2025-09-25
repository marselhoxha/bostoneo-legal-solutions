package com.bostoneo.bostoneosolutions.service.external;

import com.bostoneo.bostoneosolutions.config.ExternalApiProperties;
import com.bostoneo.bostoneosolutions.dto.FrDocument;
import com.bostoneo.bostoneosolutions.dto.FrAgency;
import com.bostoneo.bostoneosolutions.dto.FrSearchResult;
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
public class FederalRegisterService {

    private final ExternalApiProperties apiProperties;
    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public List<FrDocument> searchDocuments(String query, String documentType, LocalDate fromDate, LocalDate toDate) {
        try {
            String url = buildSearchUrl(query, documentType, fromDate, toDate);
            HttpHeaders headers = createHeaders();
            HttpEntity<String> entity = new HttpEntity<>(headers);

            log.info("Calling Federal Register API: {}", url);
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, entity, String.class);

            if (response.getStatusCode() == HttpStatus.OK) {
                return parseDocumentsResponse(response.getBody()).getResults();
            } else {
                log.error("Federal Register API returned error: {}", response.getStatusCode());
                return new ArrayList<>();
            }

        } catch (Exception e) {
            log.error("Error calling Federal Register API: ", e);
            return new ArrayList<>();
        }
    }

    public List<FrDocument> searchRules(String query, LocalDate fromDate, LocalDate toDate) {
        return searchDocuments(query, "RULE", fromDate, toDate);
    }

    public List<FrDocument> searchProposedRules(String query, LocalDate fromDate, LocalDate toDate) {
        return searchDocuments(query, "PRORULE", fromDate, toDate);
    }

    public List<FrDocument> searchNotices(String query, LocalDate fromDate, LocalDate toDate) {
        return searchDocuments(query, "NOTICE", fromDate, toDate);
    }

    public List<FrDocument> searchPresidentialDocuments(String query, LocalDate fromDate, LocalDate toDate) {
        return searchDocuments(query, "PRESDOCU", fromDate, toDate);
    }

    public Map<String, Object> getApiStatus() {
        Map<String, Object> status = new HashMap<>();
        status.put("service", "Federal Register");
        status.put("configured", true); // Public API, no key required
        status.put("baseUrl", apiProperties.getFederalRegister().getBaseUrl());

        try {
            String testUrl = apiProperties.getFederalRegister().getBaseUrl() + "documents.json?per_page=1";
            HttpHeaders headers = createHeaders();
            HttpEntity<String> entity = new HttpEntity<>(headers);

            ResponseEntity<String> response = restTemplate.exchange(testUrl, HttpMethod.GET, entity, String.class);
            status.put("available", response.getStatusCode() == HttpStatus.OK);
            status.put("lastChecked", new Date());

        } catch (Exception e) {
            status.put("available", false);
            status.put("error", e.getMessage());
            status.put("lastChecked", new Date());
        }

        return status;
    }

    public List<FrAgency> getAgencies() {
        try {
            String url = apiProperties.getFederalRegister().getBaseUrl() + "agencies.json";
            HttpHeaders headers = createHeaders();
            HttpEntity<String> entity = new HttpEntity<>(headers);

            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, entity, String.class);

            if (response.getStatusCode() == HttpStatus.OK) {
                return parseAgenciesResponse(response.getBody());
            } else {
                log.error("Federal Register Agencies API returned error: {}", response.getStatusCode());
                return new ArrayList<>();
            }

        } catch (Exception e) {
            log.error("Error calling Federal Register Agencies API: ", e);
            return new ArrayList<>();
        }
    }

    private String buildSearchUrl(String query, String documentType, LocalDate fromDate, LocalDate toDate) {
        StringBuilder url = new StringBuilder(apiProperties.getFederalRegister().getBaseUrl())
                .append("documents.json")
                .append("?per_page=20")
                .append("&order=relevance");

        if (StringUtils.hasText(query)) {
            url.append("&conditions[term]=").append(query);
        }

        if (StringUtils.hasText(documentType)) {
            url.append("&conditions[type][]=").append(documentType);
        }

        if (fromDate != null) {
            url.append("&conditions[publication_date][gte]=").append(fromDate.toString());
        }

        if (toDate != null) {
            url.append("&conditions[publication_date][lte]=").append(toDate.toString());
        }

        // Add fields to return (removed invalid federal_register_url field)
        url.append("&fields[]=title")
           .append("&fields[]=abstract")
           .append("&fields[]=document_number")
           .append("&fields[]=html_url")
           .append("&fields[]=pdf_url")
           .append("&fields[]=publication_date")
           .append("&fields[]=type")
           .append("&fields[]=agencies");

        return url.toString();
    }

    private HttpHeaders createHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("Accept", "application/json");
        headers.set("User-Agent", "BostoneoSolutions/1.0");
        return headers;
    }

    private FrSearchResult parseDocumentsResponse(String jsonResponse) {
        FrSearchResult searchResult = new FrSearchResult();
        List<FrDocument> results = new ArrayList<>();

        try {
            JsonNode root = objectMapper.readTree(jsonResponse);
            JsonNode resultsArray = root.get("results");

            if (resultsArray != null && resultsArray.isArray()) {
                for (JsonNode result : resultsArray) {
                    FrDocument document = new FrDocument();
                    document.setId(result.path("document_number").asText());
                    document.setDocumentNumber(result.path("document_number").asText());
                    document.setTitle(result.path("title").asText());
                    document.setAbstractText(result.path("abstract").asText());

                    // Parse publication date safely
                    String pubDateStr = result.path("publication_date").asText();
                    if (!pubDateStr.isEmpty()) {
                        try {
                            document.setPublicationDate(LocalDate.parse(pubDateStr));
                        } catch (Exception e) {
                            log.warn("Could not parse publication date: {}", pubDateStr);
                        }
                    }

                    document.setType(result.path("type").asText());
                    document.setHtmlUrl(result.path("html_url").asText());
                    document.setPdfUrl(result.path("pdf_url").asText());

                    // Construct Federal Register URL from document number
                    String docNumber = result.path("document_number").asText();
                    if (!docNumber.isEmpty()) {
                        document.setFederalRegisterUrl("https://www.federalregister.gov/documents/" + docNumber);
                    }

                    document.setSource("Federal Register");
                    document.setSummary(truncateText(result.path("abstract").asText(), 300));
                    document.setDocumentType(result.path("type").asText());

                    // Extract agencies
                    JsonNode agencies = result.get("agencies");
                    if (agencies != null && agencies.isArray()) {
                        List<FrAgency> agencyList = new ArrayList<>();
                        for (JsonNode agency : agencies) {
                            FrAgency frAgency = new FrAgency();
                            frAgency.setId(agency.path("id").asInt());
                            frAgency.setName(agency.path("name").asText());
                            frAgency.setShortName(agency.path("short_name").asText());
                            frAgency.setSlug(agency.path("slug").asText());
                            frAgency.setUrl(agency.path("url").asText());
                            agencyList.add(frAgency);
                        }
                        document.setAgencies(agencyList);
                    }

                    results.add(document);
                }
            }

            searchResult.setResults(results);
            searchResult.setCount(root.path("count").asInt());
            searchResult.setDescription(root.path("description").asText());
            searchResult.setNextPageUrl(root.path("next_page_url").asText());
            searchResult.setPreviousPageUrl(root.path("previous_page_url").asText());

        } catch (Exception e) {
            log.error("Error parsing Federal Register response: ", e);
            searchResult.setResults(new ArrayList<>());
        }

        return searchResult;
    }

    private List<FrAgency> parseAgenciesResponse(String jsonResponse) {
        List<FrAgency> agencies = new ArrayList<>();

        try {
            JsonNode root = objectMapper.readTree(jsonResponse);

            if (root.isArray()) {
                for (JsonNode agency : root) {
                    FrAgency frAgency = new FrAgency();
                    frAgency.setId(agency.path("id").asInt());
                    frAgency.setName(agency.path("name").asText());
                    frAgency.setShortName(agency.path("short_name").asText());
                    frAgency.setSlug(agency.path("slug").asText());
                    frAgency.setUrl(agency.path("url").asText());
                    agencies.add(frAgency);
                }
            }

        } catch (Exception e) {
            log.error("Error parsing Federal Register agencies response: ", e);
        }

        return agencies;
    }

    private String truncateText(String text, int maxLength) {
        if (text == null || text.length() <= maxLength) {
            return text;
        }
        return text.substring(0, maxLength) + "...";
    }
}