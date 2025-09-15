package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.CaseRoleAssignment;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.Set;

public interface CaseRoleAssignmentRepository<T extends CaseRoleAssignment> {
    T save(T assignment);
    Optional<T> findById(Long id);
    Set<T> findByUserId(Long userId);
    Set<T> findByCaseId(Long caseId);
    void deleteById(Long id);
    void deleteByCaseIdAndUserId(Long caseId, Long userId);
    
    /**
     * Get all case role assignments for a user
     * @param userId User ID
     * @return Set of case role assignments
     */
    Set<T> getCaseRoleAssignments(Long userId);
    
    /**
     * Create a new case role assignment
     * @param caseId Case ID
     * @param userId User ID
     * @param roleId Role ID
     * @param expiresAt Optional expiration date
     * @return The created case role assignment
     */
    T assignCaseRole(Long caseId, Long userId, Long roleId, LocalDateTime expiresAt);
    
    /**
     * Remove a case role assignment
     * @param assignmentId Case role assignment ID
     */
    void removeCaseRole(Long assignmentId);
    
    /**
     * Get all case role assignments for a case
     * @param caseId Case ID
     * @return Set of case role assignments
     */
    Set<T> getCaseRoleAssignmentsByCase(Long caseId);
    
    boolean userHasCaseAccess(Long userId, Long caseId);
} 