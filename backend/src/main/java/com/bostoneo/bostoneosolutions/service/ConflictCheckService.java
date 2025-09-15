package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.model.ConflictCheck;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Map;
import java.util.Optional;

public interface ConflictCheckService {
    
    // Basic CRUD operations
    ConflictCheck save(ConflictCheck conflictCheck);
    
    Optional<ConflictCheck> findById(Long id);
    
    Page<ConflictCheck> findAll(Pageable pageable);
    
    void deleteById(Long id);
    
    // Entity-specific operations
    List<ConflictCheck> findByEntityTypeAndEntityId(String entityType, Long entityId);
    
    List<ConflictCheck> findByStatus(String status);
    
    List<ConflictCheck> findByCheckType(String checkType);
    
    // Conflict checking operations
    ConflictCheck performConflictCheck(String entityType, Long entityId, String checkType, 
                                     List<String> searchTerms, Map<String, Object> searchParameters);
    
    ConflictCheck performClientConflictCheck(Long leadId, Map<String, Object> clientData);
    
    ConflictCheck performMatterConflictCheck(Long leadId, Map<String, Object> matterData);
    
    ConflictCheck performFullConflictCheck(Long leadId, Map<String, Object> clientData, 
                                         Map<String, Object> matterData);
    
    // Conflict resolution operations
    ConflictCheck reviewConflictCheck(Long conflictCheckId, Long reviewedBy, String resolution, 
                                    String resolutionNotes);
    
    ConflictCheck resolveConflict(Long conflictCheckId, Long resolvedBy, String resolution, 
                                String resolutionNotes, String waiverDocumentPath);
    
    // Query operations
    List<ConflictCheck> findPendingConflictChecks();
    
    List<ConflictCheck> findUnresolvedConflicts();
    
    List<ConflictCheck> findExpiredConflictChecks();
    
    boolean hasUnresolvedConflicts(String entityType, Long entityId);
    
    boolean canProceedWithConversion(String entityType, Long entityId);
    
    // Analytics operations
    Map<String, Long> getConflictCheckStatsByStatus();
    
    Map<String, Long> getConflictCheckStatsByType();
    
    List<ConflictCheck> getRecentConflictChecks(int limit);
}