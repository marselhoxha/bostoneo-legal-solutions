package com.***REMOVED***.***REMOVED***solutions.repository;

import com.***REMOVED***.***REMOVED***solutions.enumeration.InvoiceStatus;
import com.***REMOVED***.***REMOVED***solutions.model.Invoice;
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
    
    List<Invoice> findTop1ByInvoiceNumberStartingWithOrderByIdDesc(String prefix);
    
    long countByInvoiceNumberStartingWith(String prefix);
    
    // For workflows
    List<Invoice> findByDueDateAndStatusIn(LocalDate dueDate, List<InvoiceStatus> statuses);
    
    List<Invoice> findByDueDateLessThanEqualAndStatusIn(LocalDate dueDate, List<InvoiceStatus> statuses);
}
