package com.bostoneo.bostoneosolutions.service.search;

import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@Slf4j
public class BooleanSearchParser {

    public ParsedQuery parseQuery(String query) {
        if (query == null || query.trim().isEmpty()) {
            return new ParsedQuery();
        }

        String normalizedQuery = normalizeQuery(query.trim());
        return parseExpression(normalizedQuery);
    }

    private String normalizeQuery(String query) {
        // Replace case-insensitive operators
        query = query.replaceAll("(?i)\\bAND\\b", "AND");
        query = query.replaceAll("(?i)\\bOR\\b", "OR");
        query = query.replaceAll("(?i)\\bNOT\\b", "NOT");

        // Handle quoted phrases
        query = query.replaceAll("\"([^\"]+)\"", "PHRASE:$1");

        return query;
    }

    private ParsedQuery parseExpression(String query) {
        ParsedQuery parsedQuery = new ParsedQuery();

        try {
            // Split by AND/OR operators while preserving them
            List<String> tokens = tokenize(query);

            String currentOperator = "AND"; // Default operator
            List<String> mustTerms = new ArrayList<>();
            List<String> shouldTerms = new ArrayList<>();
            List<String> mustNotTerms = new ArrayList<>();
            List<String> phrases = new ArrayList<>();

            boolean isNegated = false;

            for (String token : tokens) {
                token = token.trim();

                if (token.equals("AND")) {
                    currentOperator = "AND";
                    isNegated = false;
                } else if (token.equals("OR")) {
                    currentOperator = "OR";
                    isNegated = false;
                } else if (token.equals("NOT")) {
                    isNegated = true;
                } else if (!token.isEmpty()) {
                    // Process the term
                    if (token.startsWith("PHRASE:")) {
                        String phrase = token.substring(7); // Remove PHRASE: prefix
                        phrases.add(phrase);
                        if (!isNegated) {
                            if ("OR".equals(currentOperator)) {
                                shouldTerms.add(phrase);
                            } else {
                                mustTerms.add(phrase);
                            }
                        } else {
                            mustNotTerms.add(phrase);
                        }
                    } else {
                        if (isNegated) {
                            mustNotTerms.add(token);
                        } else if ("OR".equals(currentOperator)) {
                            shouldTerms.add(token);
                        } else {
                            mustTerms.add(token);
                        }
                    }
                    isNegated = false;
                }
            }

            // If no explicit OR terms, treat all terms as AND
            if (shouldTerms.isEmpty() && !mustTerms.isEmpty()) {
                parsedQuery.setMustTerms(mustTerms);
            } else {
                parsedQuery.setMustTerms(mustTerms);
                parsedQuery.setShouldTerms(shouldTerms);
            }

            parsedQuery.setMustNotTerms(mustNotTerms);
            parsedQuery.setPhrases(phrases);
            parsedQuery.setOriginalQuery(query);

        } catch (Exception e) {
            log.error("Error parsing boolean query: {}", query, e);
            // Fallback to simple search
            parsedQuery.setMustTerms(Arrays.asList(query.split("\\s+")));
        }

        return parsedQuery;
    }

    private List<String> tokenize(String query) {
        List<String> tokens = new ArrayList<>();

        // Regex to split by operators while keeping them
        Pattern pattern = Pattern.compile("\\s+(AND|OR|NOT)\\s+|\\s+");
        Matcher matcher = pattern.matcher(query);

        int lastEnd = 0;
        while (matcher.find()) {
            // Add text before the operator
            if (matcher.start() > lastEnd) {
                String token = query.substring(lastEnd, matcher.start()).trim();
                if (!token.isEmpty()) {
                    tokens.add(token);
                }
            }

            // Add the operator if it's AND/OR/NOT
            String operator = matcher.group(1);
            if (operator != null) {
                tokens.add(operator);
            }

            lastEnd = matcher.end();
        }

        // Add remaining text
        if (lastEnd < query.length()) {
            String token = query.substring(lastEnd).trim();
            if (!token.isEmpty()) {
                tokens.add(token);
            }
        }

        return tokens;
    }

    public String buildSqlWhere(ParsedQuery parsedQuery, String titleColumn, String contentColumn) {
        if (parsedQuery.isEmpty()) {
            return "1=1";
        }

        List<String> conditions = new ArrayList<>();

        // Handle MUST terms (AND logic)
        if (!parsedQuery.getMustTerms().isEmpty()) {
            List<String> mustConditions = new ArrayList<>();
            for (String term : parsedQuery.getMustTerms()) {
                String condition = String.format("(LOWER(%s) LIKE LOWER('%%%s%%') OR LOWER(%s) LIKE LOWER('%%%s%%'))",
                    titleColumn, term, contentColumn, term);
                mustConditions.add(condition);
            }
            conditions.add("(" + String.join(" AND ", mustConditions) + ")");
        }

        // Handle SHOULD terms (OR logic)
        if (!parsedQuery.getShouldTerms().isEmpty()) {
            List<String> shouldConditions = new ArrayList<>();
            for (String term : parsedQuery.getShouldTerms()) {
                String condition = String.format("(LOWER(%s) LIKE LOWER('%%%s%%') OR LOWER(%s) LIKE LOWER('%%%s%%'))",
                    titleColumn, term, contentColumn, term);
                shouldConditions.add(condition);
            }
            conditions.add("(" + String.join(" OR ", shouldConditions) + ")");
        }

        // Handle MUST_NOT terms (NOT logic)
        if (!parsedQuery.getMustNotTerms().isEmpty()) {
            List<String> mustNotConditions = new ArrayList<>();
            for (String term : parsedQuery.getMustNotTerms()) {
                String condition = String.format("NOT (LOWER(%s) LIKE LOWER('%%%s%%') OR LOWER(%s) LIKE LOWER('%%%s%%'))",
                    titleColumn, term, contentColumn, term);
                mustNotConditions.add(condition);
            }
            conditions.add("(" + String.join(" AND ", mustNotConditions) + ")");
        }

        return conditions.isEmpty() ? "1=1" : String.join(" AND ", conditions);
    }

    @Data
    public static class ParsedQuery {
        private String originalQuery = "";
        private List<String> mustTerms = new ArrayList<>();
        private List<String> shouldTerms = new ArrayList<>();
        private List<String> mustNotTerms = new ArrayList<>();
        private List<String> phrases = new ArrayList<>();

        public boolean isEmpty() {
            return mustTerms.isEmpty() && shouldTerms.isEmpty() && mustNotTerms.isEmpty();
        }

        public boolean hasAdvancedOperators() {
            return !shouldTerms.isEmpty() || !mustNotTerms.isEmpty() || !phrases.isEmpty();
        }
    }
}