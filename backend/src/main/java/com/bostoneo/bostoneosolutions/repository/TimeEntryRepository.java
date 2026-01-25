package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.enumeration.TimeEntryStatus;
import com.bostoneo.bostoneosolutions.model.TimeEntry;
import com.bostoneo.bostoneosolutions.model.Invoice;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.ListCrudRepository;
import org.springframework.data.repository.PagingAndSortingRepository;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public interface TimeEntryRepository extends PagingAndSortingRepository<TimeEntry, Long>, ListCrudRepository<TimeEntry, Long> {
    
    // Basic finders
    Page<TimeEntry> findByUserId(Long userId, Pageable pageable);
    
    Page<TimeEntry> findByLegalCaseId(Long legalCaseId, Pageable pageable);
    
    Page<TimeEntry> findByUserIdAndLegalCaseId(Long userId, Long legalCaseId, Pageable pageable);
    
    Page<TimeEntry> findByStatus(TimeEntryStatus status, Pageable pageable);
    
    Page<TimeEntry> findByBillable(Boolean billable, Pageable pageable);
    
    // Date-based queries
    Page<TimeEntry> findByDateBetween(LocalDate startDate, LocalDate endDate, Pageable pageable);
    
    Page<TimeEntry> findByUserIdAndDateBetween(Long userId, LocalDate startDate, LocalDate endDate, Pageable pageable);
    
    Page<TimeEntry> findByLegalCaseIdAndDateBetween(Long legalCaseId, LocalDate startDate, LocalDate endDate, Pageable pageable);
    
    // Status-based queries
    List<TimeEntry> findByUserIdAndStatus(Long userId, TimeEntryStatus status);
    
    List<TimeEntry> findByLegalCaseIdAndStatus(Long legalCaseId, TimeEntryStatus status);
    
    List<TimeEntry> findByStatusIn(List<TimeEntryStatus> statuses);
    
    // Complex filtering - using native query for PostgreSQL ILIKE support
    @Query(value = "SELECT * FROM time_entries te WHERE " +
           "(:userId IS NULL OR te.user_id = :userId) AND " +
           "(:legalCaseId IS NULL OR te.legal_case_id = :legalCaseId) AND " +
           "(CAST(:startDate AS DATE) IS NULL OR te.date >= :startDate) AND " +
           "(CAST(:endDate AS DATE) IS NULL OR te.date <= :endDate) AND " +
           "(:status IS NULL OR te.status = :status) AND " +
           "(:billable IS NULL OR te.billable = :billable) AND " +
           "(CAST(:description AS TEXT) IS NULL OR te.description ILIKE '%' || CAST(:description AS TEXT) || '%')",
           countQuery = "SELECT COUNT(*) FROM time_entries te WHERE " +
           "(:userId IS NULL OR te.user_id = :userId) AND " +
           "(:legalCaseId IS NULL OR te.legal_case_id = :legalCaseId) AND " +
           "(CAST(:startDate AS DATE) IS NULL OR te.date >= :startDate) AND " +
           "(CAST(:endDate AS DATE) IS NULL OR te.date <= :endDate) AND " +
           "(:status IS NULL OR te.status = :status) AND " +
           "(:billable IS NULL OR te.billable = :billable) AND " +
           "(CAST(:description AS TEXT) IS NULL OR te.description ILIKE '%' || CAST(:description AS TEXT) || '%')",
           nativeQuery = true)
    Page<TimeEntry> findWithFilters(@Param("userId") Long userId,
                                   @Param("legalCaseId") Long legalCaseId,
                                   @Param("startDate") LocalDate startDate,
                                   @Param("endDate") LocalDate endDate,
                                   @Param("status") String status,
                                   @Param("billable") Boolean billable,
                                   @Param("description") String description,
                                   Pageable pageable);
    
    // Aggregation queries
    @Query("SELECT SUM(te.hours) FROM TimeEntry te WHERE te.legalCaseId = :legalCaseId AND te.status = 'APPROVED'")
    BigDecimal getTotalHoursByCase(@Param("legalCaseId") Long legalCaseId);
    
    @Query("SELECT SUM(te.hours * te.rate) FROM TimeEntry te WHERE te.legalCaseId = :legalCaseId AND te.status = 'APPROVED'")
    BigDecimal getTotalAmountByCase(@Param("legalCaseId") Long legalCaseId);
    
    @Query("SELECT SUM(te.hours) FROM TimeEntry te WHERE te.userId = :userId AND te.date BETWEEN :startDate AND :endDate")
    BigDecimal getTotalHoursByUserAndDateRange(@Param("userId") Long userId, 
                                              @Param("startDate") LocalDate startDate, 
                                              @Param("endDate") LocalDate endDate);
    
    @Query("SELECT SUM(te.hours * te.rate) FROM TimeEntry te WHERE te.userId = :userId AND te.billable = true AND te.status = 'APPROVED'")
    BigDecimal getTotalBillableAmountByUser(@Param("userId") Long userId);
    
    // Invoice-related queries
    List<TimeEntry> findByInvoiceId(Long invoiceId);
    
    List<TimeEntry> findByInvoiceIdIsNull();
    
    @Query("SELECT te FROM TimeEntry te WHERE te.legalCaseId = :legalCaseId AND te.status = 'APPROVED' AND te.invoiceId IS NULL")
    List<TimeEntry> findUnbilledApprovedEntriesByCase(@Param("legalCaseId") Long legalCaseId);
    
    List<TimeEntry> findByLegalCaseIdAndStatusAndInvoiceIdIsNull(Long legalCaseId, TimeEntryStatus status);
    
    List<TimeEntry> findByLegalCaseIdInAndStatusAndInvoiceIdIsNull(List<Long> legalCaseIds, TimeEntryStatus status);
    
    // Check if an invoice exists in the invoices table
    @Query("SELECT CASE WHEN COUNT(i) > 0 THEN true ELSE false END FROM Invoice i WHERE i.id = :invoiceId")
    boolean existsInvoiceById(@Param("invoiceId") Long invoiceId);

    // Case summary queries
    @Query("SELECT COUNT(te) FROM TimeEntry te WHERE te.legalCaseId = :legalCaseId")
    Long countByLegalCaseId(@Param("legalCaseId") Long legalCaseId);

    @Query("SELECT COUNT(te) FROM TimeEntry te WHERE te.legalCaseId = :legalCaseId AND te.status = :status")
    Long countByLegalCaseIdAndStatus(@Param("legalCaseId") Long legalCaseId, @Param("status") TimeEntryStatus status);

    @Query("SELECT COALESCE(SUM(te.hours), 0) FROM TimeEntry te WHERE te.legalCaseId = :legalCaseId AND te.billable = true")
    BigDecimal getTotalBillableHoursByCase(@Param("legalCaseId") Long legalCaseId);

    @Query("SELECT COALESCE(SUM(te.hours), 0) FROM TimeEntry te WHERE te.legalCaseId = :legalCaseId AND te.billable = false")
    BigDecimal getTotalNonBillableHoursByCase(@Param("legalCaseId") Long legalCaseId);

    @Query("SELECT COALESCE(SUM(te.hours), 0) FROM TimeEntry te WHERE te.legalCaseId = :legalCaseId")
    BigDecimal getTotalAllHoursByCase(@Param("legalCaseId") Long legalCaseId);

    @Query("SELECT COALESCE(SUM(te.hours * te.rate), 0) FROM TimeEntry te WHERE te.legalCaseId = :legalCaseId AND te.billable = true")
    BigDecimal getTotalBillableAmountByCase(@Param("legalCaseId") Long legalCaseId);
} 
 
 
 
 
 
 