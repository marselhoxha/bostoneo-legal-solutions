package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.AIClosingDocument;
import com.bostoneo.bostoneosolutions.enumeration.DocumentType;
import com.bostoneo.bostoneosolutions.enumeration.CompletionStatus;
import com.bostoneo.bostoneosolutions.enumeration.ResponsibleParty;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface AIClosingDocumentRepository extends JpaRepository<AIClosingDocument, Long> {

    // ==================== TENANT ISOLATION METHODS ====================

    /**
     * SECURITY: Get all closing documents for an organization
     */
    List<AIClosingDocument> findByOrganizationId(Long organizationId);

    /**
     * SECURITY: Get closing document by ID with tenant verification
     */
    java.util.Optional<AIClosingDocument> findByIdAndOrganizationId(Long id, Long organizationId);

    /**
     * SECURITY: Get closing documents by transaction with tenant filter
     */
    List<AIClosingDocument> findByTransactionIdAndOrganizationIdOrderByCreatedAtDesc(Long transactionId, Long organizationId);

    // ==================== EXISTING METHODS (Use with caution) ====================

    List<AIClosingDocument> findByTransactionIdOrderByCreatedAtDesc(Long transactionId);
    
    List<AIClosingDocument> findByDocumentType(DocumentType documentType);
    
    List<AIClosingDocument> findByCompletionStatus(CompletionStatus completionStatus);
    
    List<AIClosingDocument> findByResponsibleParty(ResponsibleParty responsibleParty);
    
    List<AIClosingDocument> findByIsRequiredTrue();
    
    List<AIClosingDocument> findByTransactionIdAndCompletionStatus(Long transactionId, CompletionStatus status);
    
    List<AIClosingDocument> findByTransactionIdAndIsRequiredTrue(Long transactionId);
    
    List<AIClosingDocument> findByDueDateBefore(LocalDate date);
    
    List<AIClosingDocument> findByDueDateBetween(LocalDate startDate, LocalDate endDate);
    
    @Query("SELECT cd FROM AIClosingDocument cd WHERE cd.transactionId = :transactionId AND cd.completionStatus = 'PENDING' AND cd.isRequired = true ORDER BY cd.dueDate ASC")
    List<AIClosingDocument> findPendingRequiredDocuments(@Param("transactionId") Long transactionId);
    
    @Query("SELECT cd FROM AIClosingDocument cd WHERE cd.dueDate <= :date AND cd.completionStatus IN ('PENDING', 'IN_PROGRESS') ORDER BY cd.dueDate ASC")
    List<AIClosingDocument> findOverdueDocuments(@Param("date") LocalDate date);
    
    @Query("SELECT cd FROM AIClosingDocument cd WHERE cd.responsibleParty = :party AND cd.completionStatus = 'PENDING' ORDER BY cd.dueDate ASC")
    List<AIClosingDocument> findPendingDocumentsByParty(@Param("party") ResponsibleParty party);
    
    @Query("SELECT COUNT(cd) FROM AIClosingDocument cd WHERE cd.transactionId = :transactionId AND cd.completionStatus = 'COMPLETED'")
    Long countCompletedDocuments(@Param("transactionId") Long transactionId);
    
    @Query("SELECT COUNT(cd) FROM AIClosingDocument cd WHERE cd.transactionId = :transactionId AND cd.isRequired = true")
    Long countRequiredDocuments(@Param("transactionId") Long transactionId);
}