package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.CaseRoleAssignment;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.Set;

/**
 * WARNING: Entity CaseRoleAssignment lacks organization_id - requires migration.
 * All methods bypass multi-tenant isolation. Verify case ownership before calling.
 */
public interface CaseRoleAssignmentRepository<T extends CaseRoleAssignment> {

    // ==================== DEPRECATED METHODS ====================
    // WARNING: Entity lacks organization_id - requires migration for tenant isolation.
    // Verify case ownership through LegalCase.organizationId before calling.

    /** @deprecated Verify entity ownership before calling */
    @Deprecated
    T save(T assignment);

    /** @deprecated Verify entity ownership before calling */
    @Deprecated
    Optional<T> findById(Long id);

    /** @deprecated Entity lacks organization_id - verify user organization before calling */
    @Deprecated
    Set<T> findByUserId(Long userId);

    /** @deprecated Verify case ownership through LegalCase.organizationId before calling */
    @Deprecated
    Set<T> findByCaseId(Long caseId);

    /** @deprecated Verify entity ownership before calling */
    @Deprecated
    void deleteById(Long id);

    /** @deprecated Verify case ownership through LegalCase.organizationId before calling */
    @Deprecated
    void deleteByCaseIdAndUserId(Long caseId, Long userId);

    /**
     * @deprecated Entity lacks organization_id - verify user organization before calling
     */
    @Deprecated
    Set<T> getCaseRoleAssignments(Long userId);

    /**
     * @deprecated Verify case ownership through LegalCase.organizationId before calling
     */
    @Deprecated
    T assignCaseRole(Long caseId, Long userId, Long roleId, LocalDateTime expiresAt);

    /**
     * @deprecated Verify assignment ownership before calling
     */
    @Deprecated
    void removeCaseRole(Long assignmentId);

    /**
     * @deprecated Verify case ownership through LegalCase.organizationId before calling
     */
    @Deprecated
    Set<T> getCaseRoleAssignmentsByCase(Long caseId);

    /** @deprecated Verify case and user organization before calling */
    @Deprecated
    boolean userHasCaseAccess(Long userId, Long caseId);
} 