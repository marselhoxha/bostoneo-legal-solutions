package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.dto.ConflictMatchDTO;
import com.bostoneo.bostoneosolutions.model.ConflictCheck;
import com.bostoneo.bostoneosolutions.repository.ConflictCheckRepository;
import com.bostoneo.bostoneosolutions.service.ConflictCheckService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class ConflictCheckServiceImpl implements ConflictCheckService {

    private final ConflictCheckRepository conflictCheckRepository;
    private final ObjectMapper objectMapper;
    private final com.bostoneo.bostoneosolutions.multitenancy.TenantService tenantService;
    private final org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate jdbc;

    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    @Override
    public ConflictCheck save(ConflictCheck conflictCheck) {
        return conflictCheckRepository.save(conflictCheck);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<ConflictCheck> findById(Long id) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        return conflictCheckRepository.findByIdAndOrganizationId(id, orgId);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<ConflictCheck> findAll(Pageable pageable) {
        // Note: This method needs tenant filtering but Page return type requires custom query
        // For now, fetching all and filtering - consider adding pagination to repository
        Long orgId = getRequiredOrganizationId();
        List<ConflictCheck> filtered = conflictCheckRepository.findByOrganizationIdOrderByCreatedAtDesc(orgId);
        int start = (int) pageable.getOffset();
        int end = Math.min(start + pageable.getPageSize(), filtered.size());
        return new org.springframework.data.domain.PageImpl<>(
            filtered.subList(start, end), pageable, filtered.size());
    }

    @Override
    public void deleteById(Long id) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Verify ownership before deletion
        ConflictCheck conflictCheck = conflictCheckRepository.findByIdAndOrganizationId(id, orgId)
            .orElseThrow(() -> new RuntimeException("ConflictCheck not found or access denied: " + id));
        conflictCheckRepository.delete(conflictCheck);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ConflictCheck> findByEntityTypeAndEntityId(String entityType, Long entityId) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        return conflictCheckRepository.findByOrganizationIdAndEntityTypeAndEntityId(orgId, entityType, entityId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ConflictCheck> findByStatus(String status) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        return conflictCheckRepository.findByOrganizationIdAndStatus(orgId, status);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ConflictCheck> findByCheckType(String checkType) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        return conflictCheckRepository.findByOrganizationIdAndCheckType(orgId, checkType);
    }

    @Override
    public ConflictCheck performConflictCheck(String entityType, Long entityId, String checkType,
                                            List<String> searchTerms, Map<String, Object> searchParameters) {
        log.info("Performing conflict check for entity: {} with ID: {}, type: {}",
                entityType, entityId, checkType);

        Long orgId = getRequiredOrganizationId();

        try {
            ConflictCheck conflictCheck = ConflictCheck.builder()
                    .organizationId(orgId) // SECURITY: Set organization ID when creating
                    .entityType(entityType)
                    .entityId(entityId)
                    .checkType(checkType)
                    .searchTerms(objectMapper.writeValueAsString(searchTerms))
                    .searchParameters(objectMapper.writeValueAsString(searchParameters))
                    .status("PENDING")
                    .autoChecked(true)
                    .confidenceScore(BigDecimal.ZERO)
                    .build();

            // Perform the actual conflict search
            List<ConflictMatchDTO> matches = performConflictSearch(searchTerms, searchParameters, checkType);
            
            // Set results and update status
            conflictCheck.setResults(objectMapper.writeValueAsString(matches));
            
            // Determine status based on matches
            if (matches.isEmpty()) {
                conflictCheck.setStatus("CLEAR");
                conflictCheck.setConfidenceScore(new BigDecimal("100.00"));
            } else {
                // Calculate confidence score based on match scores
                BigDecimal maxScore = matches.stream()
                        .map(ConflictMatchDTO::getMatchScore)
                        .filter(Objects::nonNull)
                        .max(BigDecimal::compareTo)
                        .orElse(BigDecimal.ZERO);
                
                conflictCheck.setConfidenceScore(maxScore);
                
                if (maxScore.compareTo(new BigDecimal("80")) >= 0) {
                    conflictCheck.setStatus("CONFLICT_FOUND");
                } else if (maxScore.compareTo(new BigDecimal("50")) >= 0) {
                    conflictCheck.setStatus("POTENTIAL_CONFLICT");
                } else {
                    conflictCheck.setStatus("LOW_RISK");
                }
            }

            // Set expiration (30 days from now)
            conflictCheck.setExpiresAt(Timestamp.valueOf(LocalDateTime.now().plusDays(30)));

            return conflictCheckRepository.save(conflictCheck);

        } catch (JsonProcessingException e) {
            log.error("Error serializing conflict check data", e);
            throw new RuntimeException("Failed to perform conflict check", e);
        }
    }

    @Override
    public ConflictCheck performClientConflictCheck(Long leadId, Map<String, Object> clientData) {
        List<String> searchTerms = extractClientSearchTerms(clientData);
        Map<String, Object> searchParams = new HashMap<>(clientData);
        
        return performConflictCheck("LEAD", leadId, "CLIENT_ONLY", searchTerms, searchParams);
    }

    @Override
    public ConflictCheck performMatterConflictCheck(Long leadId, Map<String, Object> matterData) {
        List<String> searchTerms = extractMatterSearchTerms(matterData);
        Map<String, Object> searchParams = new HashMap<>(matterData);
        
        return performConflictCheck("LEAD", leadId, "MATTER_ONLY", searchTerms, searchParams);
    }

    @Override
    public ConflictCheck performFullConflictCheck(Long leadId, Map<String, Object> clientData, 
                                                Map<String, Object> matterData) {
        List<String> searchTerms = new ArrayList<>();
        searchTerms.addAll(extractClientSearchTerms(clientData));
        searchTerms.addAll(extractMatterSearchTerms(matterData));
        
        Map<String, Object> searchParams = new HashMap<>();
        searchParams.putAll(clientData);
        searchParams.putAll(matterData);
        
        return performConflictCheck("LEAD", leadId, "CLIENT_AND_MATTER", searchTerms, searchParams);
    }

    @Override
    public ConflictCheck reviewConflictCheck(Long conflictCheckId, Long reviewedBy, 
                                           String resolution, String resolutionNotes) {
        ConflictCheck conflictCheck = findById(conflictCheckId)
                .orElseThrow(() -> new RuntimeException("ConflictCheck not found: " + conflictCheckId));

        conflictCheck.setCheckedBy(reviewedBy);
        conflictCheck.setCheckedAt(new Timestamp(System.currentTimeMillis()));
        conflictCheck.setResolution(resolution);
        conflictCheck.setResolutionNotes(resolutionNotes);
        conflictCheck.setAutoChecked(false);

        // Update status based on resolution
        switch (resolution.toLowerCase()) {
            case "approved":
                conflictCheck.setStatus("APPROVED");
                break;
            case "rejected":
                conflictCheck.setStatus("REJECTED");
                break;
            case "requires_waiver":
                conflictCheck.setStatus("WAIVER_REQUIRED");
                break;
            default:
                conflictCheck.setStatus("REVIEWED");
                break;
        }

        return conflictCheckRepository.save(conflictCheck);
    }

    @Override
    public ConflictCheck resolveConflict(Long conflictCheckId, Long resolvedBy, String resolution,
                                       String resolutionNotes, String waiverDocumentPath) {
        ConflictCheck conflictCheck = findById(conflictCheckId)
                .orElseThrow(() -> new RuntimeException("ConflictCheck not found: " + conflictCheckId));

        conflictCheck.setResolvedBy(resolvedBy);
        conflictCheck.setResolvedAt(new Timestamp(System.currentTimeMillis()));
        conflictCheck.setResolution(resolution);
        conflictCheck.setResolutionNotes(resolutionNotes);
        conflictCheck.setWaiverDocumentPath(waiverDocumentPath);
        conflictCheck.setStatus("RESOLVED");

        return conflictCheckRepository.save(conflictCheck);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ConflictCheck> findPendingConflictChecks() {
        return findByStatus("PENDING");
    }

    @Override
    @Transactional(readOnly = true)
    public List<ConflictCheck> findUnresolvedConflicts() {
        Long orgId = getRequiredOrganizationId();
        List<String> unresolvedStatuses = Arrays.asList("CONFLICT_FOUND", "POTENTIAL_CONFLICT", "WAIVER_REQUIRED");
        // SECURITY: Use tenant-filtered query
        return conflictCheckRepository.findByOrganizationIdAndStatusIn(orgId, unresolvedStatuses);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ConflictCheck> findExpiredConflictChecks() {
        Long orgId = getRequiredOrganizationId();
        Timestamp now = new Timestamp(System.currentTimeMillis());
        // SECURITY: Use tenant-filtered query
        return conflictCheckRepository.findByOrganizationIdAndExpiresAtBefore(orgId, now);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean hasUnresolvedConflicts(String entityType, Long entityId) {
        List<ConflictCheck> conflicts = findByEntityTypeAndEntityId(entityType, entityId);
        return conflicts.stream()
                .anyMatch(cc -> Arrays.asList("CONFLICT_FOUND", "POTENTIAL_CONFLICT", "WAIVER_REQUIRED")
                        .contains(cc.getStatus()));
    }

    @Override
    @Transactional(readOnly = true)
    public boolean canProceedWithConversion(String entityType, Long entityId) {
        List<ConflictCheck> conflicts = findByEntityTypeAndEntityId(entityType, entityId);
        
        // No conflicts found
        if (conflicts.isEmpty()) {
            return true;
        }

        // All conflicts are resolved or cleared
        return conflicts.stream()
                .allMatch(cc -> Arrays.asList("CLEAR", "APPROVED", "RESOLVED", "LOW_RISK")
                        .contains(cc.getStatus()));
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Long> getConflictCheckStatsByStatus() {
        Long orgId = getRequiredOrganizationId();
        Map<String, Long> stats = new HashMap<>();
        // SECURITY: Use tenant-filtered query
        List<Object[]> results = conflictCheckRepository.countByOrganizationIdGroupedByStatus(orgId);

        for (Object[] result : results) {
            stats.put((String) result[0], (Long) result[1]);
        }

        return stats;
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Long> getConflictCheckStatsByType() {
        Long orgId = getRequiredOrganizationId();
        Map<String, Long> stats = new HashMap<>();
        // SECURITY: Use tenant-filtered query
        List<Object[]> results = conflictCheckRepository.countByOrganizationIdGroupedByCheckType(orgId);

        for (Object[] result : results) {
            stats.put((String) result[0], (Long) result[1]);
        }

        return stats;
    }

    @Override
    @Transactional(readOnly = true)
    public List<ConflictCheck> getRecentConflictChecks(int limit) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        List<ConflictCheck> all = conflictCheckRepository.findByOrganizationIdOrderByCreatedAtDesc(orgId);
        return all.stream().limit(limit).collect(java.util.stream.Collectors.toList());
    }

    // Private helper methods
    private List<String> extractClientSearchTerms(Map<String, Object> clientData) {
        List<String> terms = new ArrayList<>();
        
        addIfNotEmpty(terms, (String) clientData.get("firstName"));
        addIfNotEmpty(terms, (String) clientData.get("lastName"));
        addIfNotEmpty(terms, (String) clientData.get("companyName"));
        addIfNotEmpty(terms, (String) clientData.get("email"));
        addIfNotEmpty(terms, (String) clientData.get("phone"));
        
        return terms;
    }

    private List<String> extractMatterSearchTerms(Map<String, Object> matterData) {
        List<String> terms = new ArrayList<>();
        
        addIfNotEmpty(terms, (String) matterData.get("matterName"));
        addIfNotEmpty(terms, (String) matterData.get("description"));
        addIfNotEmpty(terms, (String) matterData.get("opposingParty"));
        addIfNotEmpty(terms, (String) matterData.get("referenceNumber"));
        
        return terms;
    }

    private void addIfNotEmpty(List<String> list, String value) {
        if (value != null && !value.trim().isEmpty()) {
            list.add(value.trim());
        }
    }

    private List<ConflictMatchDTO> performConflictSearch(List<String> searchTerms,
                                                       Map<String, Object> searchParameters,
                                                       String checkType) {
        Long orgId = getRequiredOrganizationId();
        List<ConflictMatchDTO> matches = new ArrayList<>();
        Set<String> seen = new HashSet<>();

        for (String term : searchTerms) {
            if (term == null || term.trim().length() < 2) continue;
            String cleanTerm = term.trim();

            // Search clients by fuzzy name match
            if (!"MATTER_ONLY".equals(checkType)) {
                searchClients(orgId, cleanTerm, matches, seen);
            }

            // Search legal cases by client name and title
            if (!"CLIENT_ONLY".equals(checkType)) {
                searchCases(orgId, cleanTerm, matches, seen);
            }

            // Search adverse parties
            searchAdverseParties(orgId, cleanTerm, matches, seen);
        }

        // Also do exact email match if provided
        String email = (String) searchParameters.get("email");
        if (email != null && !email.isBlank()) {
            searchByEmail(orgId, email, matches, seen);
        }

        return matches;
    }

    private void searchClients(Long orgId, String term, List<ConflictMatchDTO> matches, Set<String> seen) {
        try {
            String sql = "SELECT id, name, email, phone, " +
                    "GREATEST(similarity(name, :term), similarity(COALESCE(email,''), :term)) AS score " +
                    "FROM clients WHERE organization_id = :orgId " +
                    "AND (similarity(name, :term) > 0.3 OR name ILIKE '%' || :term || '%') " +
                    "ORDER BY score DESC LIMIT 10";
            var params = Map.of("orgId", orgId, "term", term);
            jdbc.query(sql, params, rs -> {
                String key = "CLIENT-" + rs.getLong("id");
                if (seen.add(key)) {
                    BigDecimal score = rs.getBigDecimal("score").multiply(new BigDecimal("100")).setScale(2, java.math.RoundingMode.HALF_UP);
                    matches.add(ConflictMatchDTO.builder()
                            .entityType("CLIENT").entityId(rs.getLong("id"))
                            .entityName(rs.getString("name"))
                            .matchType("NAME_SIMILARITY").matchScore(score)
                            .matchReason("Client name matches: " + rs.getString("name"))
                            .riskLevel(score.compareTo(new BigDecimal("80")) >= 0 ? "HIGH" : "MEDIUM")
                            .status("REQUIRES_REVIEW")
                            .recommendedAction("Review existing client relationship")
                            .lastUpdated(new Timestamp(System.currentTimeMillis()))
                            .build());
                }
            });
        } catch (Exception e) {
            log.error("Error searching clients for term '{}': {}", term, e.getMessage());
        }
    }

    private void searchCases(Long orgId, String term, List<ConflictMatchDTO> matches, Set<String> seen) {
        try {
            String sql = "SELECT id, title, client_name, case_number, " +
                    "GREATEST(similarity(client_name, :term), similarity(title, :term)) AS score " +
                    "FROM legal_cases WHERE organization_id = :orgId " +
                    "AND (similarity(client_name, :term) > 0.3 OR similarity(title, :term) > 0.3 " +
                    "OR client_name ILIKE '%' || :term || '%' OR title ILIKE '%' || :term || '%') " +
                    "ORDER BY score DESC LIMIT 10";
            var params = Map.of("orgId", orgId, "term", term);
            jdbc.query(sql, params, rs -> {
                String key = "CASE-" + rs.getLong("id");
                if (seen.add(key)) {
                    BigDecimal score = rs.getBigDecimal("score").multiply(new BigDecimal("100")).setScale(2, java.math.RoundingMode.HALF_UP);
                    matches.add(ConflictMatchDTO.builder()
                            .entityType("CASE").entityId(rs.getLong("id"))
                            .entityName(rs.getString("title") + " (" + rs.getString("case_number") + ")")
                            .matchType("CASE_SIMILARITY").matchScore(score)
                            .matchReason("Case client '" + rs.getString("client_name") + "' matches search term")
                            .riskLevel(score.compareTo(new BigDecimal("80")) >= 0 ? "HIGH" : "MEDIUM")
                            .status("REQUIRES_REVIEW")
                            .recommendedAction("Review case for conflict of interest")
                            .lastUpdated(new Timestamp(System.currentTimeMillis()))
                            .build());
                }
            });
        } catch (Exception e) {
            log.error("Error searching cases for term '{}': {}", term, e.getMessage());
        }
    }

    private void searchAdverseParties(Long orgId, String term, List<ConflictMatchDTO> matches, Set<String> seen) {
        try {
            String sql = "SELECT id, name, case_id, party_type, " +
                    "similarity(name, :term) AS score " +
                    "FROM adverse_parties WHERE organization_id = :orgId " +
                    "AND (similarity(name, :term) > 0.3 OR name ILIKE '%' || :term || '%') " +
                    "ORDER BY score DESC LIMIT 10";
            var params = Map.of("orgId", orgId, "term", term);
            jdbc.query(sql, params, rs -> {
                String key = "ADVERSE-" + rs.getLong("id");
                if (seen.add(key)) {
                    BigDecimal score = rs.getBigDecimal("score").multiply(new BigDecimal("100")).setScale(2, java.math.RoundingMode.HALF_UP);
                    matches.add(ConflictMatchDTO.builder()
                            .entityType("ADVERSE_PARTY").entityId(rs.getLong("id"))
                            .entityName(rs.getString("name") + " (" + rs.getString("party_type") + ")")
                            .matchType("ADVERSE_PARTY_MATCH").matchScore(score)
                            .matchReason("Adverse party name matches in case ID " + rs.getLong("case_id"))
                            .riskLevel("HIGH")
                            .status("REQUIRES_REVIEW")
                            .recommendedAction("Potential direct conflict — adverse party in existing case")
                            .lastUpdated(new Timestamp(System.currentTimeMillis()))
                            .build());
                }
            });
        } catch (Exception e) {
            log.error("Error searching adverse parties for term '{}': {}", term, e.getMessage());
        }
    }

    private void searchByEmail(Long orgId, String email, List<ConflictMatchDTO> matches, Set<String> seen) {
        try {
            String sql = "SELECT id, name, email FROM clients " +
                    "WHERE organization_id = :orgId AND LOWER(email) = LOWER(:email)";
            var params = Map.of("orgId", orgId, "email", email);
            jdbc.query(sql, params, rs -> {
                String key = "CLIENT-" + rs.getLong("id");
                if (seen.add(key)) {
                    matches.add(ConflictMatchDTO.builder()
                            .entityType("CLIENT").entityId(rs.getLong("id"))
                            .entityName(rs.getString("name"))
                            .matchType("EMAIL_EXACT_MATCH").matchScore(new BigDecimal("100.00"))
                            .matchReason("Exact email match: " + rs.getString("email"))
                            .riskLevel("HIGH")
                            .status("REQUIRES_REVIEW")
                            .recommendedAction("Existing client with same email address")
                            .lastUpdated(new Timestamp(System.currentTimeMillis()))
                            .build());
                }
            });
        } catch (Exception e) {
            log.error("Error searching by email '{}': {}", email, e.getMessage());
        }
    }
}