package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.AIImmigrationDocument;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface AIImmigrationDocumentRepository extends JpaRepository<AIImmigrationDocument, Long> {

    // ==================== TENANT ISOLATION METHODS ====================

    /**
     * SECURITY: Get all immigration documents for an organization
     */
    List<AIImmigrationDocument> findByOrganizationId(Long organizationId);

    /**
     * SECURITY: Get document by ID with tenant verification
     */
    java.util.Optional<AIImmigrationDocument> findByIdAndOrganizationId(Long id, Long organizationId);

    /**
     * SECURITY: Get documents by case with tenant filter
     */
    List<AIImmigrationDocument> findByCaseIdAndOrganizationIdOrderByCreatedAtDesc(Long caseId, Long organizationId);

    /**
     * SECURITY: Paginated documents by type with tenant filter
     */
    Page<AIImmigrationDocument> findByDocumentTypeAndOrganizationId(String documentType, Long organizationId, Pageable pageable);

    // ==================== EXISTING METHODS (Use with caution) ====================

    List<AIImmigrationDocument> findByCaseIdOrderByCreatedAtDesc(Long caseId);
    
    Page<AIImmigrationDocument> findByDocumentType(String documentType, Pageable pageable);
    
    List<AIImmigrationDocument> findByDocumentType(String documentType);
    
    List<AIImmigrationDocument> findByDocumentNameContainingIgnoreCase(String documentName);
    
    List<AIImmigrationDocument> findByCaseId(Long caseId);
}