package com.***REMOVED***.***REMOVED***solutions.service.implementation;

import com.***REMOVED***.***REMOVED***solutions.dto.ConflictMatchDTO;
import com.***REMOVED***.***REMOVED***solutions.model.ConflictCheck;
import com.***REMOVED***.***REMOVED***solutions.repository.ConflictCheckRepository;
import com.***REMOVED***.***REMOVED***solutions.service.ConflictCheckService;
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

    @Override
    public ConflictCheck save(ConflictCheck conflictCheck) {
        return conflictCheckRepository.save(conflictCheck);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<ConflictCheck> findById(Long id) {
        return conflictCheckRepository.findById(id);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<ConflictCheck> findAll(Pageable pageable) {
        return conflictCheckRepository.findAll(pageable);
    }

    @Override
    public void deleteById(Long id) {
        conflictCheckRepository.deleteById(id);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ConflictCheck> findByEntityTypeAndEntityId(String entityType, Long entityId) {
        return conflictCheckRepository.findByEntityTypeAndEntityId(entityType, entityId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ConflictCheck> findByStatus(String status) {
        return conflictCheckRepository.findByStatus(status);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ConflictCheck> findByCheckType(String checkType) {
        return conflictCheckRepository.findByCheckType(checkType);
    }

    @Override
    public ConflictCheck performConflictCheck(String entityType, Long entityId, String checkType,
                                            List<String> searchTerms, Map<String, Object> searchParameters) {
        log.info("Performing conflict check for entity: {} with ID: {}, type: {}", 
                entityType, entityId, checkType);

        try {
            ConflictCheck conflictCheck = ConflictCheck.builder()
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
        List<String> unresolvedStatuses = Arrays.asList("CONFLICT_FOUND", "POTENTIAL_CONFLICT", "WAIVER_REQUIRED");
        return conflictCheckRepository.findByStatusIn(unresolvedStatuses);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ConflictCheck> findExpiredConflictChecks() {
        Timestamp now = new Timestamp(System.currentTimeMillis());
        return conflictCheckRepository.findByExpiresAtBefore(now);
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
        Map<String, Long> stats = new HashMap<>();
        List<Object[]> results = conflictCheckRepository.countByStatusGrouped();
        
        for (Object[] result : results) {
            stats.put((String) result[0], (Long) result[1]);
        }
        
        return stats;
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Long> getConflictCheckStatsByType() {
        Map<String, Long> stats = new HashMap<>();
        List<Object[]> results = conflictCheckRepository.countByCheckTypeGrouped();
        
        for (Object[] result : results) {
            stats.put((String) result[0], (Long) result[1]);
        }
        
        return stats;
    }

    @Override
    @Transactional(readOnly = true)
    public List<ConflictCheck> getRecentConflictChecks(int limit) {
        Pageable pageable = PageRequest.of(0, limit, Sort.by(Sort.Direction.DESC, "createdAt"));
        return conflictCheckRepository.findAll(pageable).getContent();
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
        // This is a simplified implementation
        // In a real system, this would:
        // 1. Search existing clients/matters in the database
        // 2. Check against external conflict databases
        // 3. Use fuzzy matching algorithms
        // 4. Apply business rules for conflict detection
        
        List<ConflictMatchDTO> matches = new ArrayList<>();
        
        // Simulate conflict search logic
        for (String term : searchTerms) {
            if (term.toLowerCase().contains("conflict")) {
                // Simulate a potential conflict
                ConflictMatchDTO match = ConflictMatchDTO.builder()
                        .entityType("CLIENT")
                        .entityId(999L)
                        .entityName("Existing Client with similar name")
                        .matchType("NAME_SIMILARITY")
                        .matchScore(new BigDecimal("75.50"))
                        .matchReason("Similar name pattern detected")
                        .riskLevel("MEDIUM")
                        .status("REQUIRES_REVIEW")
                        .recommendedAction("Manual review required")
                        .lastUpdated(new Timestamp(System.currentTimeMillis()))
                        .build();
                
                matches.add(match);
            }
        }
        
        return matches;
    }
}