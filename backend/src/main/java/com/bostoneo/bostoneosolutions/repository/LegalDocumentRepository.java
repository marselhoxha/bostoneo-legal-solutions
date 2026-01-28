package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.LegalDocument;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LegalDocumentRepository extends JpaRepository<LegalDocument, Long> {

    /**
     * @deprecated Use findByCaseIdAndOrganizationId instead for tenant isolation
     */
    @Deprecated
    @Query(value = "SELECT * FROM documents WHERE case_id = :caseId ORDER BY updated_at DESC", nativeQuery = true)
    List<LegalDocument> findByCaseId(@Param("caseId") Long caseId);

    /**
     * @deprecated Use findByCaseIdAndOrganizationId instead for tenant isolation
     */
    @Deprecated
    @Query(value = "SELECT * FROM documents WHERE case_id = :caseId ORDER BY updated_at DESC", nativeQuery = true)
    Page<LegalDocument> findByCaseId(@Param("caseId") Long caseId, Pageable pageable);

    // ========== TENANT-FILTERED METHODS (SECURE) ==========

    @Query(value = "SELECT * FROM documents WHERE id = :id AND organization_id = :organizationId", nativeQuery = true)
    java.util.Optional<LegalDocument> findByIdAndOrganizationId(@Param("id") Long id, @Param("organizationId") Long organizationId);

    @Query(value = "SELECT * FROM documents WHERE organization_id = :organizationId ORDER BY updated_at DESC", nativeQuery = true)
    List<LegalDocument> findByOrganizationId(@Param("organizationId") Long organizationId);

    @Query(value = "SELECT * FROM documents WHERE organization_id = :organizationId ORDER BY updated_at DESC", nativeQuery = true)
    Page<LegalDocument> findByOrganizationId(@Param("organizationId") Long organizationId, Pageable pageable);

    @Query(value = "SELECT * FROM documents WHERE case_id = :caseId AND organization_id = :organizationId ORDER BY updated_at DESC", nativeQuery = true)
    List<LegalDocument> findByCaseIdAndOrganizationId(@Param("caseId") Long caseId, @Param("organizationId") Long organizationId);

    @Query(value = "SELECT * FROM documents WHERE case_id = :caseId AND organization_id = :organizationId ORDER BY updated_at DESC", nativeQuery = true)
    Page<LegalDocument> findByCaseIdAndOrganizationId(@Param("caseId") Long caseId, @Param("organizationId") Long organizationId, Pageable pageable);

    @Query(value = "SELECT COUNT(*) FROM documents WHERE organization_id = :organizationId", nativeQuery = true)
    Long countByOrganizationId(@Param("organizationId") Long organizationId);

    @Query(value = "SELECT COUNT(*) > 0 FROM documents WHERE id = :id AND organization_id = :organizationId", nativeQuery = true)
    boolean existsByIdAndOrganizationId(@Param("id") Long id, @Param("organizationId") Long organizationId);
} 
 
 