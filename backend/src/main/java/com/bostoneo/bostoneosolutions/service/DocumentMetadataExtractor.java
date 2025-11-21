package com.bostoneo.bostoneosolutions.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Slf4j
public class DocumentMetadataExtractor {

    private final ObjectMapper objectMapper;

    // Regex patterns for metadata extraction
    private static final Pattern CASE_NUMBER_PATTERN = Pattern.compile(
        "(?i)(?:case\\s*[:#]\\s*([\\d]+:[\\d]+-[a-z]+-[\\d]+-[A-Z]+))|(?:(?:case\\s+(?:no\\.?|number)|civil\\s+action)\\s*[:#]?\\s*([\\w-]+(?:\\s+[\\w-]+){0,2}))",
        Pattern.CASE_INSENSITIVE
    );

    // Pattern to exclude (don't match these)
    private static final Pattern CASE_NUMBER_EXCLUDE_PATTERN = Pattern.compile(
        "(?i)docket\\s+entry",
        Pattern.CASE_INSENSITIVE
    );

    private static final Pattern DATE_PATTERN = Pattern.compile(
        "\\b(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\\.?\\s+\\d{1,2},?\\s+\\d{4}\\b|" +
        "\\b\\d{1,2}[-/]\\d{1,2}[-/]\\d{2,4}\\b|" +
        "\\b\\d{4}[-/]\\d{1,2}[-/]\\d{1,2}\\b"
    );

    // More flexible pattern to capture multi-line party names from captions
    private static final Pattern PARTY_PATTERN = Pattern.compile(
        "(?i)(?:plaintiff|defendant|petitioner|respondent|appellant|appellee)s?\\s*[:)]?\\s*([A-Z][A-Za-z\\s,.';&\\-()]+?)(?=\\s*(?:plaintiff|defendant|petitioner|respondent|appellant|appellee)s?\\s*[,.])",
        Pattern.CASE_INSENSITIVE | Pattern.MULTILINE | Pattern.DOTALL
    );

    private static final Pattern COURT_PATTERN = Pattern.compile(
        "(?i)(?:in\\s+the\\s+)?([A-Z][A-Za-z\\s]+(?:court|tribunal|commission))(?:\\s+of\\s+([A-Za-z\\s]+))?",
        Pattern.CASE_INSENSITIVE
    );

    /**
     * Extract comprehensive metadata from document text
     */
    public String extractMetadata(String content, String fileName) {
        Map<String, Object> metadata = new HashMap<>();

        try {
            // Extract case number
            List<String> caseNumbers = extractCaseNumbers(content);
            if (!caseNumbers.isEmpty()) {
                metadata.put("caseNumbers", caseNumbers);
                metadata.put("caseNumber", caseNumbers.get(0)); // Primary case number
            }

            // Extract dates
            List<String> dates = extractDates(content);
            if (!dates.isEmpty()) {
                metadata.put("dates", dates);
                metadata.put("primaryDate", dates.get(0)); // Most recent or first date
            }

            // Extract parties
            Map<String, List<String>> parties = extractParties(content);
            if (!parties.isEmpty()) {
                metadata.put("parties", parties);

                // Create formatted string for display
                StringBuilder partiesStr = new StringBuilder();
                if (parties.containsKey("plaintiffs") && !parties.get("plaintiffs").isEmpty()) {
                    List<String> plaintiffs = parties.get("plaintiffs");
                    partiesStr.append("Plaintiff: ").append(plaintiffs.get(0));
                    if (plaintiffs.size() > 1) {
                        partiesStr.append(", et al.");
                    }
                }
                if (parties.containsKey("defendants") && !parties.get("defendants").isEmpty()) {
                    if (partiesStr.length() > 0) partiesStr.append(" v. ");
                    List<String> defendants = parties.get("defendants");

                    // Show first 2 defendants, then "et al." if more
                    if (defendants.size() == 1) {
                        partiesStr.append("Defendant: ").append(defendants.get(0));
                    } else if (defendants.size() == 2) {
                        partiesStr.append("Defendants: ").append(defendants.get(0))
                                  .append("; ").append(defendants.get(1));
                    } else {
                        partiesStr.append("Defendants: ").append(defendants.get(0))
                                  .append("; ").append(defendants.get(1))
                                  .append(", et al.");
                    }
                }
                if (partiesStr.length() > 0) {
                    metadata.put("partiesDisplay", partiesStr.toString());
                }
            }

            // Extract court information
            String court = extractCourt(content);
            if (court != null && !court.isEmpty()) {
                metadata.put("court", court);
            }

            // Add filename-based hints
            metadata.put("fileName", fileName);
            metadata.put("extractedAt", LocalDate.now().toString());

            return objectMapper.writeValueAsString(metadata);

        } catch (JsonProcessingException e) {
            log.error("Error serializing metadata: {}", e.getMessage(), e);
            return "{}";
        }
    }

    /**
     * Extract case numbers from text
     */
    private List<String> extractCaseNumbers(String content) {
        List<String> caseNumbers = new ArrayList<>();
        Matcher matcher = CASE_NUMBER_PATTERN.matcher(content);
        Matcher excludeMatcher = CASE_NUMBER_EXCLUDE_PATTERN.matcher(content);

        while (matcher.find() && caseNumbers.size() < 5) {
            // Check if this match should be excluded
            excludeMatcher.region(Math.max(0, matcher.start() - 20), matcher.end());
            if (excludeMatcher.find()) {
                continue; // Skip "Docket Entry" matches
            }

            // Try first capture group (federal format: 1:10-cv-12043-GAO)
            String caseNumber = matcher.group(1);
            if (caseNumber == null || caseNumber.isEmpty()) {
                // Try second capture group (general format)
                caseNumber = matcher.group(2);
            }

            if (caseNumber != null && !caseNumber.trim().isEmpty() && caseNumber.length() < 50) {
                caseNumbers.add(caseNumber.trim());
            }
        }

        return caseNumbers;
    }

    /**
     * Extract dates from text with smart heuristics to prefer document dates over referenced dates
     */
    private List<String> extractDates(String content) {
        List<String> dates = new ArrayList<>();
        Set<String> seenDates = new HashSet<>();
        Matcher matcher = DATE_PATTERN.matcher(content);

        // Store dates with their positions and scores
        List<DateMatch> dateMatches = new ArrayList<>();

        while (matcher.find()) {
            String dateStr = matcher.group().trim();
            String normalizedDate = normalizeDateString(dateStr);

            if (normalizedDate != null && !seenDates.contains(normalizedDate)) {
                seenDates.add(normalizedDate);

                // Score this date based on context
                int score = scoreDateMatch(content, matcher.start(), matcher.end(), dateStr);
                dateMatches.add(new DateMatch(normalizedDate, matcher.start(), score));
            }
        }

        // Sort by score (descending) and position
        dateMatches.sort((a, b) -> {
            int scoreCompare = Integer.compare(b.score, a.score);
            return scoreCompare != 0 ? scoreCompare : Integer.compare(a.position, b.position);
        });

        // Take top dates
        for (DateMatch dm : dateMatches) {
            if (dates.size() >= 10) break;
            dates.add(dm.date);
        }

        return dates;
    }

    /**
     * Score a date match based on context to prefer document dates over referenced dates
     */
    private int scoreDateMatch(String content, int start, int end, String dateStr) {
        int score = 0;

        // Context window before date
        int contextStart = Math.max(0, start - 50);
        String beforeContext = content.substring(contextStart, start).toLowerCase();

        // Context window after date
        int contextEnd = Math.min(content.length(), end + 30);
        String afterContext = content.substring(end, contextEnd).toLowerCase();

        // NEGATIVE SCORING: Referenced dates (don't want these)
        if (beforeContext.contains("on ") || beforeContext.contains("in this action") ||
            beforeContext.contains("filed") && beforeContext.contains("on")) {
            score -= 20; // Strong negative - this is a referenced date
        }

        if (beforeContext.contains("action on") || beforeContext.contains("complaint on")) {
            score -= 15;
        }

        // POSITIVE SCORING: Document dates (want these)
        // Dates in first 200 chars (header area)
        if (start < 200) {
            score += 10;
        }

        // Dates near signature/certificate area (last 1000 chars)
        if (start > content.length() - 1000) {
            score += 8;
        }

        // Dates near filing/signature keywords
        if (beforeContext.contains("filed") && !beforeContext.contains("action") ||
            beforeContext.contains("signed") || beforeContext.contains("dated")) {
            score += 12;
        }

        // Dates in certificate of service area
        if (beforeContext.contains("certificate") || afterContext.contains("certificate")) {
            score += 7;
        }

        return score;
    }

    /**
     * Helper class to store date matches with scoring
     */
    private static class DateMatch {
        String date;
        int position;
        int score;

        DateMatch(String date, int position, int score) {
            this.date = date;
            this.position = position;
            this.score = score;
        }
    }

    /**
     * Normalize date string to standard format
     */
    private String normalizeDateString(String dateStr) {
        List<DateTimeFormatter> formatters = Arrays.asList(
            DateTimeFormatter.ofPattern("MMMM d, yyyy"),
            DateTimeFormatter.ofPattern("MMM d, yyyy"),
            DateTimeFormatter.ofPattern("M/d/yyyy"),
            DateTimeFormatter.ofPattern("M-d-yyyy"),
            DateTimeFormatter.ofPattern("yyyy-M-d"),
            DateTimeFormatter.ofPattern("yyyy/M/d")
        );

        for (DateTimeFormatter formatter : formatters) {
            try {
                LocalDate date = LocalDate.parse(dateStr, formatter);
                return date.toString(); // ISO format: yyyy-MM-dd
            } catch (DateTimeParseException e) {
                // Try next formatter
            }
        }

        return dateStr; // Return original if cannot parse
    }

    /**
     * Extract party names (plaintiffs, defendants, etc.)
     */
    private Map<String, List<String>> extractParties(String content) {
        Map<String, List<String>> parties = new HashMap<>();
        parties.put("plaintiffs", new ArrayList<>());
        parties.put("defendants", new ArrayList<>());
        parties.put("petitioners", new ArrayList<>());
        parties.put("respondents", new ArrayList<>());

        // Search only in caption area (first 1500 chars)
        String captionArea = content.substring(0, Math.min(content.length(), 1500));
        Matcher matcher = PARTY_PATTERN.matcher(captionArea);

        // Patterns to exclude (action verbs indicating narrative text, not party names)
        Pattern excludePattern = Pattern.compile(
            "\\b(filed|alleges|claims|moves|seeks|requests|contends|argues|states)\\b",
            Pattern.CASE_INSENSITIVE
        );

        while (matcher.find()) {
            String fullMatch = matcher.group(0);
            String partyName = matcher.group(1).trim();

            // Skip if contains action verbs (narrative text, not actual party names)
            if (excludePattern.matcher(partyName).find()) {
                continue;
            }

            // Skip if too long or contains suspicious patterns
            if (partyName.length() > 100 || partyName.toLowerCase().contains("count")) {
                continue;
            }

            // Clean up party name
            partyName = cleanPartyName(partyName);

            if (!partyName.isEmpty() && partyName.length() > 3) { // Reasonable name length
                String lowerMatch = fullMatch.toLowerCase();

                // Split multiple parties by semicolon (common in legal captions)
                String[] individualParties = partyName.split(";");

                for (String party : individualParties) {
                    party = party.trim();
                    // Remove "and" prefix/suffix after splitting
                    party = party.replaceAll("^and\\s+", "").replaceAll("\\s+and$", "").trim();

                    if (!party.isEmpty() && party.length() > 3) {
                        if (lowerMatch.contains("plaintiff")) {
                            parties.get("plaintiffs").add(party);
                        } else if (lowerMatch.contains("defendant")) {
                            parties.get("defendants").add(party);
                        } else if (lowerMatch.contains("petitioner")) {
                            parties.get("petitioners").add(party);
                        } else if (lowerMatch.contains("respondent")) {
                            parties.get("respondents").add(party);
                        }
                    }
                }
            }
        }

        // Remove empty lists
        parties.entrySet().removeIf(entry -> entry.getValue().isEmpty());

        return parties;
    }

    /**
     * Clean up party name by removing trailing commas, "and", etc.
     */
    private String cleanPartyName(String name) {
        // Remove trailing comma, semicolon, "and", etc.
        name = name.replaceAll("[,;]\\s*$", "");
        name = name.replaceAll("\\s+and\\s*$", "");
        name = name.replaceAll("\\s+$", "");
        return name.trim();
    }

    /**
     * Extract court name from text
     */
    private String extractCourt(String content) {
        Matcher matcher = COURT_PATTERN.matcher(content.substring(0, Math.min(content.length(), 1000)));

        if (matcher.find()) {
            String court = matcher.group(1).trim();
            String jurisdiction = matcher.group(2);

            if (jurisdiction != null && !jurisdiction.trim().isEmpty()) {
                return court + " of " + jurisdiction.trim();
            }
            return court;
        }

        return null;
    }

    /**
     * Detect document type from content and filename
     */
    public String detectDocumentType(String content, String fileName) {
        String lowerContent = content.toLowerCase();
        String lowerFileName = fileName.toLowerCase();

        // Score-based detection
        Map<String, Integer> scores = new HashMap<>();
        scores.put("Complaint", 0);
        scores.put("Petition", 0);
        scores.put("Answer", 0);
        scores.put("Motion", 0);
        scores.put("Contract", 0);
        scores.put("Employment Agreement", 0);
        scores.put("Lease", 0);
        scores.put("NDA", 0);
        scores.put("Settlement Agreement", 0);
        scores.put("Agreement", 0);
        scores.put("Brief", 0);
        scores.put("Memorandum", 0);
        scores.put("Pleading", 0);
        scores.put("Discovery", 0);
        scores.put("Order", 0);

        // Filename-based scoring (higher weight) - includes common abbreviations
        if (lowerFileName.contains("complaint") || lowerFileName.contains("cmp")) {
            scores.put("Complaint", scores.get("Complaint") + 5);
        }
        if (lowerFileName.contains("petition") || lowerFileName.contains("pet")) {
            scores.put("Petition", scores.get("Petition") + 5);
        }
        if (lowerFileName.contains("answer") || lowerFileName.contains("ans")) {
            scores.put("Answer", scores.get("Answer") + 5);
        }
        if (lowerFileName.contains("motion") || lowerFileName.contains("mtn") || lowerFileName.contains("mot")) {
            scores.put("Motion", scores.get("Motion") + 5);
        }
        if (lowerFileName.contains("employment")) {
            scores.put("Employment Agreement", scores.get("Employment Agreement") + 5);
        }
        if (lowerFileName.contains("lease") || lowerFileName.contains("lse")) {
            scores.put("Lease", scores.get("Lease") + 5);
        }
        if (lowerFileName.contains("nda") || lowerFileName.contains("confidential")) {
            scores.put("NDA", scores.get("NDA") + 5);
        }
        if (lowerFileName.contains("settlement") || lowerFileName.contains("stlmt") || lowerFileName.contains("settle")) {
            scores.put("Settlement Agreement", scores.get("Settlement Agreement") + 5);
        }
        if (lowerFileName.contains("contract") || lowerFileName.contains("ctr")) {
            scores.put("Contract", scores.get("Contract") + 5);
        }
        if (lowerFileName.contains("agreement") || lowerFileName.contains("agr") || lowerFileName.contains("agmt")) {
            scores.put("Agreement", scores.get("Agreement") + 5);
        }
        if (lowerFileName.contains("brief") || lowerFileName.contains("brf")) {
            scores.put("Brief", scores.get("Brief") + 5);
        }
        if (lowerFileName.contains("memo") || lowerFileName.contains("memorandum")) {
            scores.put("Memorandum", scores.get("Memorandum") + 5);
        }
        if (lowerFileName.contains("pleading") || lowerFileName.contains("pld")) {
            scores.put("Pleading", scores.get("Pleading") + 5);
        }
        if (lowerFileName.contains("discovery") || lowerFileName.contains("disc") ||
            lowerFileName.contains("interrogator") || lowerFileName.contains("rog")) {
            scores.put("Discovery", scores.get("Discovery") + 5);
        }
        if (lowerFileName.contains("order") || lowerFileName.contains("ord")) {
            scores.put("Order", scores.get("Order") + 5);
        }

        // Content-based scoring (first 2000 chars)
        String contentSample = lowerContent.substring(0, Math.min(lowerContent.length(), 2000));

        // Complaint indicators (including government/federal complaints)
        if (contentSample.contains("comes now the plaintiff") ||
            contentSample.contains("plaintiff alleges") ||
            contentSample.contains("united states alleges") ||
            contentSample.contains("for its complaint") ||
            contentSample.contains("plaintiff, united states")) {
            scores.put("Complaint", scores.get("Complaint") + 4);
        }
        if (contentSample.contains("cause of action") ||
            contentSample.contains("wherefore, plaintiff") ||
            contentSample.contains("civil action") ||
            contentSample.contains("nature of the action")) {
            scores.put("Complaint", scores.get("Complaint") + 3);
        }
        // FTC/SEC/DOJ specific patterns
        if ((contentSample.contains("federal trade commission") ||
             contentSample.contains("securities and exchange commission") ||
             contentSample.contains("department of justice")) &&
            (contentSample.contains("complaint") || contentSample.contains("alleges"))) {
            scores.put("Complaint", scores.get("Complaint") + 3);
        }

        // Petition indicators
        if (contentSample.contains("petitioner respectfully") ||
            contentSample.contains("petition for") ||
            contentSample.contains("comes now petitioner")) {
            scores.put("Petition", scores.get("Petition") + 4);
        }

        // Answer indicators
        if (contentSample.contains("defendant admits") || contentSample.contains("defendant denies")) {
            scores.put("Answer", scores.get("Answer") + 4);
        }
        if (contentSample.contains("affirmative defense")) {
            scores.put("Answer", scores.get("Answer") + 3);
        }

        // Motion indicators
        if (contentSample.contains("motion to") || contentSample.contains("motion for")) {
            scores.put("Motion", scores.get("Motion") + 4);
        }
        if (contentSample.contains("respectfully moves") || contentSample.contains("for the reasons stated")) {
            scores.put("Motion", scores.get("Motion") + 2);
        }

        // Contract indicators
        if (contentSample.contains("whereas") && contentSample.contains("now therefore")) {
            scores.put("Contract", scores.get("Contract") + 4);
        }
        if (contentSample.contains("parties agree") || contentSample.contains("in consideration of")) {
            scores.put("Contract", scores.get("Contract") + 3);
        }

        // Agreement indicators (similar to contract)
        if (contentSample.contains("parties agree") || contentSample.contains("mutually agree")) {
            scores.put("Agreement", scores.get("Agreement") + 3);
        }

        // Employment Agreement indicators
        if (contentSample.contains("employee agrees") ||
            contentSample.contains("employer and employee") ||
            (contentSample.contains("employment") && contentSample.contains("position"))) {
            scores.put("Employment Agreement", scores.get("Employment Agreement") + 4);
        }
        if (contentSample.contains("non-compete") ||
            contentSample.contains("restrictive covenant") ||
            contentSample.contains("at-will employment")) {
            scores.put("Employment Agreement", scores.get("Employment Agreement") + 3);
        }

        // NDA/Confidentiality Agreement indicators
        if ((contentSample.contains("confidential information") ||
             contentSample.contains("proprietary information")) &&
            (contentSample.contains("non-disclosure") ||
             contentSample.contains("confidentiality"))) {
            scores.put("NDA", scores.get("NDA") + 4);
        }
        if (contentSample.contains("receiving party") &&
            contentSample.contains("disclosing party")) {
            scores.put("NDA", scores.get("NDA") + 3);
        }

        // Settlement Agreement indicators
        if (contentSample.contains("parties agree to settle") ||
            contentSample.contains("in full settlement") ||
            (contentSample.contains("settlement") && contentSample.contains("dispute"))) {
            scores.put("Settlement Agreement", scores.get("Settlement Agreement") + 4);
        }
        if (contentSample.contains("release all claims") ||
            (contentSample.contains("mutual release") && contentSample.contains("consideration"))) {
            scores.put("Settlement Agreement", scores.get("Settlement Agreement") + 3);
        }

        // Lease Agreement indicators
        if (contentSample.contains("landlord and tenant") ||
            (contentSample.contains("landlord") && contentSample.contains("tenant"))) {
            scores.put("Lease", scores.get("Lease") + 4);
        }
        if ((contentSample.contains("premises") && contentSample.contains("rent")) ||
            contentSample.contains("lease term") ||
            contentSample.contains("monthly rent")) {
            scores.put("Lease", scores.get("Lease") + 3);
        }

        // Brief indicators
        if (contentSample.contains("statement of facts") || contentSample.contains("argument")) {
            scores.put("Brief", scores.get("Brief") + 3);
        }
        if (contentSample.contains("table of authorities") || contentSample.contains("standard of review")) {
            scores.put("Brief", scores.get("Brief") + 4);
        }

        // Memorandum indicators
        if (contentSample.contains("memorandum of law") || contentSample.contains("legal memorandum")) {
            scores.put("Memorandum", scores.get("Memorandum") + 4);
        }

        // Discovery indicators
        if (contentSample.contains("interrogatories") || contentSample.contains("request for production")) {
            scores.put("Discovery", scores.get("Discovery") + 4);
        }
        if (contentSample.contains("request for admission")) {
            scores.put("Discovery", scores.get("Discovery") + 3);
        }

        // Order indicators
        if (contentSample.contains("it is hereby ordered") || contentSample.contains("the court orders")) {
            scores.put("Order", scores.get("Order") + 4);
        }

        // Find highest score
        String detectedType = "Document";
        int maxScore = 0;

        for (Map.Entry<String, Integer> entry : scores.entrySet()) {
            if (entry.getValue() > maxScore) {
                maxScore = entry.getValue();
                detectedType = entry.getKey();
            }
        }

        // Return "Document" if score is too low (no clear match)
        return maxScore >= 3 ? detectedType : "Document";
    }

    /**
     * Check if document likely needs OCR
     */
    public boolean requiresOCR(String content, long fileSize) {
        // If extracted text is very short compared to file size, likely needs OCR
        if (fileSize > 5_000_000 && content.length() < 500) { // 5MB file but < 500 chars extracted
            return true;
        }

        // If content is mostly gibberish or encoding artifacts
        long alphanumericCount = content.chars().filter(Character::isLetterOrDigit).count();
        double alphanumericRatio = (double) alphanumericCount / Math.max(content.length(), 1);

        return alphanumericRatio < 0.5; // Less than 50% alphanumeric suggests OCR needed
    }
}
