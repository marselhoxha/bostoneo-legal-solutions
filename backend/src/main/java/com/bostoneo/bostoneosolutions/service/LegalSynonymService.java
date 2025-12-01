package com.bostoneo.bostoneosolutions.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Service for expanding search queries with legal terminology synonyms.
 * Improves semantic search results by including related legal terms.
 */
@Service
@Slf4j
public class LegalSynonymService {

    /**
     * Map of legal terms to their synonyms.
     * Key is the primary term, value is a set of synonyms.
     */
    private static final Map<String, Set<String>> LEGAL_SYNONYMS = new HashMap<>();

    static {
        // Contract terms
        LEGAL_SYNONYMS.put("termination", Set.of("cancellation", "end", "cessation", "discontinuation", "expiration", "terminate"));
        LEGAL_SYNONYMS.put("agreement", Set.of("contract", "covenant", "accord", "arrangement", "deal", "pact"));
        LEGAL_SYNONYMS.put("breach", Set.of("violation", "infringement", "default", "non-compliance", "breaking"));
        LEGAL_SYNONYMS.put("obligation", Set.of("duty", "responsibility", "requirement", "commitment", "covenant"));
        LEGAL_SYNONYMS.put("provision", Set.of("clause", "term", "condition", "stipulation", "requirement"));

        // Parties
        LEGAL_SYNONYMS.put("defendant", Set.of("accused", "respondent", "appellee", "defending party"));
        LEGAL_SYNONYMS.put("plaintiff", Set.of("claimant", "complainant", "petitioner", "appellant", "accuser"));
        LEGAL_SYNONYMS.put("party", Set.of("parties", "signatory", "signatories", "contracting party"));

        // Legal concepts
        LEGAL_SYNONYMS.put("liability", Set.of("responsibility", "accountability", "culpability", "obligation"));
        LEGAL_SYNONYMS.put("indemnification", Set.of("indemnity", "compensation", "reimbursement", "hold harmless", "indemnify"));
        LEGAL_SYNONYMS.put("jurisdiction", Set.of("authority", "venue", "forum", "competence", "legal authority"));
        LEGAL_SYNONYMS.put("arbitration", Set.of("mediation", "dispute resolution", "ADR", "alternative dispute resolution"));
        LEGAL_SYNONYMS.put("damages", Set.of("compensation", "remedy", "relief", "restitution", "monetary damages"));
        LEGAL_SYNONYMS.put("warranty", Set.of("guarantee", "assurance", "representation", "warranties"));
        LEGAL_SYNONYMS.put("confidentiality", Set.of("confidential", "non-disclosure", "NDA", "secrecy", "privacy"));

        // Actions
        LEGAL_SYNONYMS.put("execute", Set.of("sign", "enter into", "effectuate", "consummate"));
        LEGAL_SYNONYMS.put("amend", Set.of("modify", "change", "alter", "revise", "amendment"));
        LEGAL_SYNONYMS.put("waive", Set.of("relinquish", "forgo", "abandon", "surrender", "waiver"));
        LEGAL_SYNONYMS.put("enforce", Set.of("implement", "execute", "apply", "enforcement"));

        // Time-related
        LEGAL_SYNONYMS.put("deadline", Set.of("due date", "time limit", "expiration date", "cutoff date", "deadlines"));
        LEGAL_SYNONYMS.put("effective date", Set.of("commencement date", "start date", "inception date"));
        LEGAL_SYNONYMS.put("term", Set.of("duration", "period", "length", "tenure"));

        // Payment terms
        LEGAL_SYNONYMS.put("payment", Set.of("compensation", "remuneration", "fee", "consideration", "payments"));
        LEGAL_SYNONYMS.put("penalty", Set.of("fine", "sanction", "punitive damages", "liquidated damages"));

        // Property/IP
        LEGAL_SYNONYMS.put("intellectual property", Set.of("IP", "proprietary rights", "patents", "trademarks", "copyrights"));
        LEGAL_SYNONYMS.put("ownership", Set.of("title", "proprietorship", "possession"));

        // Dispute resolution
        LEGAL_SYNONYMS.put("dispute", Set.of("conflict", "controversy", "disagreement", "claim"));
        LEGAL_SYNONYMS.put("governing law", Set.of("applicable law", "choice of law", "jurisdiction"));
    }

    /**
     * Build reverse lookup map for faster synonym matching.
     */
    private static final Map<String, String> REVERSE_SYNONYM_MAP = new HashMap<>();

    static {
        for (Map.Entry<String, Set<String>> entry : LEGAL_SYNONYMS.entrySet()) {
            String primary = entry.getKey();
            for (String synonym : entry.getValue()) {
                REVERSE_SYNONYM_MAP.put(synonym.toLowerCase(), primary);
            }
            REVERSE_SYNONYM_MAP.put(primary.toLowerCase(), primary);
        }
    }

    /**
     * Expand a search query by adding relevant legal synonyms.
     * The expanded query can be used for more comprehensive semantic search.
     *
     * @param query Original search query
     * @return Expanded query with synonyms, or original query if no synonyms found
     */
    public String expandQueryWithSynonyms(String query) {
        if (query == null || query.isBlank()) {
            return query;
        }

        String lowerQuery = query.toLowerCase();
        Set<String> expansions = new LinkedHashSet<>();
        expansions.add(query); // Always include original query first

        // Check each legal term against the query
        for (Map.Entry<String, Set<String>> entry : LEGAL_SYNONYMS.entrySet()) {
            String primaryTerm = entry.getKey();

            // Check if query contains the primary term
            if (containsWord(lowerQuery, primaryTerm)) {
                // Add top 2-3 most relevant synonyms
                expansions.addAll(entry.getValue().stream().limit(3).collect(Collectors.toList()));
                log.debug("Found legal term '{}' - adding synonyms: {}", primaryTerm, entry.getValue());
            }

            // Check if query contains any synonym
            for (String synonym : entry.getValue()) {
                if (containsWord(lowerQuery, synonym.toLowerCase())) {
                    expansions.add(primaryTerm);
                    log.debug("Found synonym '{}' - adding primary term: {}", synonym, primaryTerm);
                    break;
                }
            }
        }

        // If we found expansions, combine them
        if (expansions.size() > 1) {
            String expandedQuery = String.join(" OR ", expansions.stream()
                    .limit(5) // Limit total expansions
                    .collect(Collectors.toList()));
            log.info("Expanded query '{}' to '{}'", query, expandedQuery);
            return expandedQuery;
        }

        return query;
    }

    /**
     * Get all synonyms for a given legal term.
     *
     * @param term Legal term to find synonyms for
     * @return Set of synonyms, or empty set if not a known legal term
     */
    public Set<String> getSynonymsForTerm(String term) {
        if (term == null || term.isBlank()) {
            return Collections.emptySet();
        }

        String lowerTerm = term.toLowerCase().trim();

        // Check if it's a primary term
        for (Map.Entry<String, Set<String>> entry : LEGAL_SYNONYMS.entrySet()) {
            if (entry.getKey().equalsIgnoreCase(lowerTerm)) {
                Set<String> result = new HashSet<>(entry.getValue());
                result.add(entry.getKey());
                return result;
            }

            // Check if it's a synonym
            for (String synonym : entry.getValue()) {
                if (synonym.equalsIgnoreCase(lowerTerm)) {
                    Set<String> result = new HashSet<>(entry.getValue());
                    result.add(entry.getKey());
                    return result;
                }
            }
        }

        return Collections.emptySet();
    }

    /**
     * Check if a term is a known legal term or synonym.
     *
     * @param term Term to check
     * @return true if it's a legal term or synonym
     */
    public boolean isLegalTerm(String term) {
        if (term == null || term.isBlank()) {
            return false;
        }
        return REVERSE_SYNONYM_MAP.containsKey(term.toLowerCase().trim());
    }

    /**
     * Get the primary legal term for a synonym.
     *
     * @param synonym Synonym to find primary term for
     * @return Primary legal term, or null if not found
     */
    public String getPrimaryTerm(String synonym) {
        if (synonym == null || synonym.isBlank()) {
            return null;
        }
        return REVERSE_SYNONYM_MAP.get(synonym.toLowerCase().trim());
    }

    /**
     * Check if text contains a word (case-insensitive, word boundary aware).
     */
    private boolean containsWord(String text, String word) {
        if (text == null || word == null) {
            return false;
        }
        // Use word boundary regex for accurate matching
        Pattern pattern = Pattern.compile("\\b" + Pattern.quote(word) + "\\b", Pattern.CASE_INSENSITIVE);
        Matcher matcher = pattern.matcher(text);
        return matcher.find();
    }

    /**
     * Get all available legal terms (for documentation/testing).
     */
    public Set<String> getAllLegalTerms() {
        return Collections.unmodifiableSet(LEGAL_SYNONYMS.keySet());
    }
}
