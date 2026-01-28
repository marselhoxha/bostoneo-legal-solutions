package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.AIRealEstateDocument;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface AIRealEstateDocumentRepository extends JpaRepository<AIRealEstateDocument, Long> {

    // ==================== TENANT ISOLATION METHODS ====================

    /**
     * SECURITY: Get all real estate documents for an organization
     */
    List<AIRealEstateDocument> findByOrganizationId(Long organizationId);

    /**
     * SECURITY: Get document by ID with tenant verification
     */
    java.util.Optional<AIRealEstateDocument> findByIdAndOrganizationId(Long id, Long organizationId);

    /**
     * SECURITY: Get documents by transaction with tenant filter
     */
    List<AIRealEstateDocument> findByTransactionIdAndOrganizationIdOrderByCreatedAtDesc(Long transactionId, Long organizationId);

    /**
     * SECURITY: Paginated documents by type with tenant filter
     */
    Page<AIRealEstateDocument> findByDocumentTypeAndOrganizationId(String documentType, Long organizationId, Pageable pageable);

    // ==================== EXISTING METHODS (Use with caution) ====================

    List<AIRealEstateDocument> findByTransactionIdOrderByCreatedAtDesc(Long transactionId);
    
    Page<AIRealEstateDocument> findByDocumentType(String documentType, Pageable pageable);
    
    List<AIRealEstateDocument> findByDocumentType(String documentType);
    
    List<AIRealEstateDocument> findByDocumentNameContainingIgnoreCase(String documentName);
    
    List<AIRealEstateDocument> findByTransactionId(Long transactionId);
}
