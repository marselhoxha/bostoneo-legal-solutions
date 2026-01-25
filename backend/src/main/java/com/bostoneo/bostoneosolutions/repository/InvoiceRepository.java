package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.enumeration.InvoiceStatus;
import com.bostoneo.bostoneosolutions.model.Invoice;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface InvoiceRepository extends JpaRepository<Invoice, Long> {
    
    Optional<Invoice> findByInvoiceNumber(String invoiceNumber);
    
    Page<Invoice> findByClientId(Long clientId, Pageable pageable);
    
    Page<Invoice> findByLegalCaseId(Long legalCaseId, Pageable pageable);
    
    Page<Invoice> findByStatus(InvoiceStatus status, Pageable pageable);
    
    Page<Invoice> findByClientIdAndStatus(Long clientId, InvoiceStatus status, Pageable pageable);
    
    @Query("SELECT i FROM Invoice i WHERE i.clientId = :clientId AND " +
           "(i.legalCaseId = :legalCaseId OR :legalCaseId IS NULL) AND " +
           "(:status IS NULL OR i.status = :status) AND " +
           "(:startDate IS NULL OR i.issueDate >= :startDate) AND " +
           "(:endDate IS NULL OR i.issueDate <= :endDate) AND " +
           "(:minAmount IS NULL OR i.totalAmount >= :minAmount) AND " +
           "(:maxAmount IS NULL OR i.totalAmount <= :maxAmount)")
    Page<Invoice> findByFilters(
            @Param("clientId") Long clientId,
            @Param("legalCaseId") Long legalCaseId,
            @Param("status") InvoiceStatus status,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            @Param("minAmount") Double minAmount,
            @Param("maxAmount") Double maxAmount,
            Pageable pageable);
    
    @Query("SELECT COUNT(i) FROM Invoice i WHERE i.status = :status")
    long countByStatus(@Param("status") InvoiceStatus status);
    
    @Query("SELECT SUM(i.totalAmount) FROM Invoice i WHERE i.status = :status")
    Double sumTotalAmountByStatus(@Param("status") InvoiceStatus status);
    
    @Query("SELECT SUM(i.totalAmount) FROM Invoice i WHERE i.clientId = :clientId")
    Double sumTotalAmountByClient(@Param("clientId") Long clientId);
    
    List<Invoice> findTop5ByOrderByCreatedAtDesc();

    @Query("SELECT i FROM Invoice i WHERE i.invoiceNumber LIKE CONCAT(:prefix, '%') ORDER BY i.id DESC LIMIT 1")
    List<Invoice> findTop1ByInvoiceNumberStartingWithOrderByIdDesc(@Param("prefix") String prefix);

    @Query("SELECT COUNT(i) FROM Invoice i WHERE i.invoiceNumber LIKE CONCAT(:prefix, '%')")
    long countByInvoiceNumberStartingWith(@Param("prefix") String prefix);
    
    @Query("SELECT i FROM Invoice i LEFT JOIN FETCH i.lineItems WHERE i.id = :id")
    Optional<Invoice> findByIdWithLineItems(@Param("id") Long id);
    
    // For workflows
    List<Invoice> findByDueDateAndStatusIn(LocalDate dueDate, List<InvoiceStatus> statuses);

    List<Invoice> findByDueDateLessThanEqualAndStatusIn(LocalDate dueDate, List<InvoiceStatus> statuses);

    // ==================== TENANT-FILTERED METHODS ====================

    Page<Invoice> findByOrganizationId(Long organizationId, Pageable pageable);

    List<Invoice> findByOrganizationId(Long organizationId);

    Page<Invoice> findByOrganizationIdAndStatus(Long organizationId, InvoiceStatus status, Pageable pageable);

    Page<Invoice> findByOrganizationIdAndClientId(Long organizationId, Long clientId, Pageable pageable);

    @Query("SELECT i FROM Invoice i WHERE i.organizationId = :orgId AND " +
           "(:clientId IS NULL OR i.clientId = :clientId) AND " +
           "(:status IS NULL OR i.status = :status) AND " +
           "(:startDate IS NULL OR i.issueDate >= :startDate) AND " +
           "(:endDate IS NULL OR i.issueDate <= :endDate)")
    Page<Invoice> findByOrganizationIdWithFilters(@Param("orgId") Long organizationId,
                                                  @Param("clientId") Long clientId,
                                                  @Param("status") InvoiceStatus status,
                                                  @Param("startDate") LocalDate startDate,
                                                  @Param("endDate") LocalDate endDate,
                                                  Pageable pageable);

    long countByOrganizationId(Long organizationId);

    long countByOrganizationIdAndStatus(Long organizationId, InvoiceStatus status);

    @Query("SELECT SUM(i.totalAmount) FROM Invoice i WHERE i.organizationId = :orgId AND i.status = :status")
    Double sumTotalAmountByOrganizationAndStatus(@Param("orgId") Long organizationId,
                                                  @Param("status") InvoiceStatus status);

    @Query("SELECT i FROM Invoice i WHERE i.organizationId = :orgId ORDER BY i.createdAt DESC")
    List<Invoice> findTop5ByOrganizationIdOrderByCreatedAtDesc(@Param("orgId") Long organizationId, Pageable pageable);
}
