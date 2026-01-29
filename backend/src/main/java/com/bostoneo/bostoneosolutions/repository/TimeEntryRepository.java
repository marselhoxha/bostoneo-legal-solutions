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
    
    /**
     * Complex filtering - using native query for PostgreSQL ILIKE support
     * @deprecated Use findByOrganizationIdWithFilters instead for tenant isolation
     */
    @Deprecated
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
    
    // ==================== LEGACY AGGREGATION QUERIES (DEPRECATED) ====================
    // Use tenant-filtered versions in the TENANT-FILTERED METHODS section

    /** @deprecated Use getTotalHoursByCaseAndOrganization for tenant isolation */
    @Deprecated
    @Query("SELECT SUM(te.hours) FROM TimeEntry te WHERE te.legalCaseId = :legalCaseId AND te.status = 'APPROVED'")
    BigDecimal getTotalHoursByCase(@Param("legalCaseId") Long legalCaseId);

    /** @deprecated Use getTotalAmountByCaseAndOrganization for tenant isolation */
    @Deprecated
    @Query("SELECT SUM(te.hours * te.rate) FROM TimeEntry te WHERE te.legalCaseId = :legalCaseId AND te.status = 'APPROVED'")
    BigDecimal getTotalAmountByCase(@Param("legalCaseId") Long legalCaseId);

    /** @deprecated Use getTotalHoursByUserAndDateRangeAndOrganization for tenant isolation */
    @Deprecated
    @Query("SELECT SUM(te.hours) FROM TimeEntry te WHERE te.userId = :userId AND te.date BETWEEN :startDate AND :endDate")
    BigDecimal getTotalHoursByUserAndDateRange(@Param("userId") Long userId,
                                              @Param("startDate") LocalDate startDate,
                                              @Param("endDate") LocalDate endDate);

    /** @deprecated Use getTotalBillableAmountByUserAndOrganization for tenant isolation */
    @Deprecated
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

    // ==================== LEGACY CASE SUMMARY QUERIES (DEPRECATED) ====================
    // Use tenant-filtered versions in the TENANT-FILTERED METHODS section

    /** @deprecated Use countByLegalCaseIdAndOrganizationId for tenant isolation */
    @Deprecated
    @Query("SELECT COUNT(te) FROM TimeEntry te WHERE te.legalCaseId = :legalCaseId")
    Long countByLegalCaseId(@Param("legalCaseId") Long legalCaseId);

    /** @deprecated Use countByLegalCaseIdAndStatusAndOrganizationId for tenant isolation */
    @Deprecated
    @Query("SELECT COUNT(te) FROM TimeEntry te WHERE te.legalCaseId = :legalCaseId AND te.status = :status")
    Long countByLegalCaseIdAndStatus(@Param("legalCaseId") Long legalCaseId, @Param("status") TimeEntryStatus status);

    /** @deprecated Use getTotalBillableHoursByCaseAndOrganization for tenant isolation */
    @Deprecated
    @Query("SELECT COALESCE(SUM(te.hours), 0) FROM TimeEntry te WHERE te.legalCaseId = :legalCaseId AND te.billable = true")
    BigDecimal getTotalBillableHoursByCase(@Param("legalCaseId") Long legalCaseId);

    /** @deprecated Use getTotalNonBillableHoursByCaseAndOrganization for tenant isolation */
    @Deprecated
    @Query("SELECT COALESCE(SUM(te.hours), 0) FROM TimeEntry te WHERE te.legalCaseId = :legalCaseId AND te.billable = false")
    BigDecimal getTotalNonBillableHoursByCase(@Param("legalCaseId") Long legalCaseId);

    /** @deprecated Use getTotalAllHoursByCaseAndOrganization for tenant isolation */
    @Deprecated
    @Query("SELECT COALESCE(SUM(te.hours), 0) FROM TimeEntry te WHERE te.legalCaseId = :legalCaseId")
    BigDecimal getTotalAllHoursByCase(@Param("legalCaseId") Long legalCaseId);

    /** @deprecated Use getTotalBillableAmountByCaseAndOrganization for tenant isolation */
    @Deprecated
    @Query("SELECT COALESCE(SUM(te.hours * te.rate), 0) FROM TimeEntry te WHERE te.legalCaseId = :legalCaseId AND te.billable = true")
    BigDecimal getTotalBillableAmountByCase(@Param("legalCaseId") Long legalCaseId);

    // ==================== TENANT-FILTERED METHODS ====================

    Page<TimeEntry> findByOrganizationId(Long organizationId, Pageable pageable);

    List<TimeEntry> findByOrganizationId(Long organizationId);

    Page<TimeEntry> findByOrganizationIdAndUserId(Long organizationId, Long userId, Pageable pageable);

    Page<TimeEntry> findByOrganizationIdAndLegalCaseId(Long organizationId, Long legalCaseId, Pageable pageable);

    Page<TimeEntry> findByOrganizationIdAndStatus(Long organizationId, TimeEntryStatus status, Pageable pageable);

    Page<TimeEntry> findByOrganizationIdAndDateBetween(Long organizationId, LocalDate startDate, LocalDate endDate, Pageable pageable);

    @Query(value = "SELECT * FROM time_entries te WHERE " +
           "te.organization_id = :orgId AND " +
           "(:userId IS NULL OR te.user_id = :userId) AND " +
           "(:legalCaseId IS NULL OR te.legal_case_id = :legalCaseId) AND " +
           "(CAST(:startDate AS DATE) IS NULL OR te.date >= :startDate) AND " +
           "(CAST(:endDate AS DATE) IS NULL OR te.date <= :endDate) AND " +
           "(:status IS NULL OR te.status = :status) AND " +
           "(:billable IS NULL OR te.billable = :billable)",
           countQuery = "SELECT COUNT(*) FROM time_entries te WHERE " +
           "te.organization_id = :orgId AND " +
           "(:userId IS NULL OR te.user_id = :userId) AND " +
           "(:legalCaseId IS NULL OR te.legal_case_id = :legalCaseId) AND " +
           "(CAST(:startDate AS DATE) IS NULL OR te.date >= :startDate) AND " +
           "(CAST(:endDate AS DATE) IS NULL OR te.date <= :endDate) AND " +
           "(:status IS NULL OR te.status = :status) AND " +
           "(:billable IS NULL OR te.billable = :billable)",
           nativeQuery = true)
    Page<TimeEntry> findByOrganizationIdWithFilters(@Param("orgId") Long organizationId,
                                                    @Param("userId") Long userId,
                                                    @Param("legalCaseId") Long legalCaseId,
                                                    @Param("startDate") LocalDate startDate,
                                                    @Param("endDate") LocalDate endDate,
                                                    @Param("status") String status,
                                                    @Param("billable") Boolean billable,
                                                    Pageable pageable);

    long countByOrganizationId(Long organizationId);

    @Query("SELECT SUM(te.hours) FROM TimeEntry te WHERE te.organizationId = :orgId AND te.status = 'APPROVED'")
    BigDecimal getTotalApprovedHoursByOrganization(@Param("orgId") Long organizationId);

    @Query("SELECT SUM(te.hours * te.rate) FROM TimeEntry te WHERE te.organizationId = :orgId AND te.billable = true AND te.status = 'APPROVED'")
    BigDecimal getTotalBillableAmountByOrganization(@Param("orgId") Long organizationId);

    @Query("SELECT te FROM TimeEntry te WHERE te.organizationId = :orgId AND te.userId = :userId AND te.date BETWEEN :startDate AND :endDate")
    Page<TimeEntry> findByOrganizationIdAndUserIdAndDateBetween(@Param("orgId") Long organizationId, @Param("userId") Long userId, @Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate, Pageable pageable);

    @Query("SELECT te FROM TimeEntry te WHERE te.organizationId = :orgId AND te.userId = :userId AND te.status = :status")
    List<TimeEntry> findByOrganizationIdAndUserIdAndStatus(@Param("orgId") Long organizationId, @Param("userId") Long userId, @Param("status") TimeEntryStatus status);

    @Query("SELECT te FROM TimeEntry te WHERE te.organizationId = :orgId AND te.legalCaseId = :legalCaseId AND te.status = 'BILLING_APPROVED' AND te.invoiceId IS NULL")
    List<TimeEntry> findUnbilledApprovedEntriesByCaseAndOrganization(@Param("orgId") Long organizationId, @Param("legalCaseId") Long legalCaseId);

    // Secure findById with org verification
    java.util.Optional<TimeEntry> findByIdAndOrganizationId(Long id, Long organizationId);

    boolean existsByIdAndOrganizationId(Long id, Long organizationId);

    // For bulk operations with org verification
    @Query("SELECT te FROM TimeEntry te WHERE te.id IN :ids AND te.organizationId = :orgId")
    List<TimeEntry> findAllByIdInAndOrganizationId(@Param("ids") List<Long> ids, @Param("orgId") Long organizationId);

    // Unbilled entries by case and org
    @Query("SELECT te FROM TimeEntry te WHERE te.organizationId = :orgId AND te.legalCaseId = :legalCaseId AND te.status = :status AND te.invoiceId IS NULL")
    List<TimeEntry> findByOrganizationIdAndLegalCaseIdAndStatusAndInvoiceIdIsNull(
        @Param("orgId") Long organizationId,
        @Param("legalCaseId") Long legalCaseId,
        @Param("status") TimeEntryStatus status);

    // Unbilled entries by client and org (join through legal case)
    @Query("SELECT te FROM TimeEntry te JOIN LegalCase lc ON te.legalCaseId = lc.id " +
           "WHERE te.organizationId = :orgId AND lc.clientId = :clientId AND te.status = :status AND te.invoiceId IS NULL")
    List<TimeEntry> findUnbilledByOrganizationIdAndClientId(
        @Param("orgId") Long organizationId,
        @Param("clientId") Long clientId,
        @Param("status") TimeEntryStatus status);

    // ==================== TENANT-FILTERED AGGREGATION METHODS ====================

    @Query("SELECT SUM(te.hours) FROM TimeEntry te WHERE te.organizationId = :orgId AND te.legalCaseId = :legalCaseId AND te.status = 'APPROVED'")
    BigDecimal getTotalHoursByCaseAndOrganization(@Param("orgId") Long organizationId, @Param("legalCaseId") Long legalCaseId);

    @Query("SELECT SUM(te.hours * te.rate) FROM TimeEntry te WHERE te.organizationId = :orgId AND te.legalCaseId = :legalCaseId AND te.status = 'APPROVED'")
    BigDecimal getTotalAmountByCaseAndOrganization(@Param("orgId") Long organizationId, @Param("legalCaseId") Long legalCaseId);

    @Query("SELECT SUM(te.hours) FROM TimeEntry te WHERE te.organizationId = :orgId AND te.userId = :userId AND te.date BETWEEN :startDate AND :endDate")
    BigDecimal getTotalHoursByUserAndDateRangeAndOrganization(@Param("orgId") Long organizationId, @Param("userId") Long userId,
                                                              @Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    @Query("SELECT SUM(te.hours * te.rate) FROM TimeEntry te WHERE te.organizationId = :orgId AND te.userId = :userId AND te.billable = true AND te.status = 'APPROVED'")
    BigDecimal getTotalBillableAmountByUserAndOrganization(@Param("orgId") Long organizationId, @Param("userId") Long userId);

    @Query("SELECT COUNT(te) FROM TimeEntry te WHERE te.organizationId = :orgId AND te.legalCaseId = :legalCaseId")
    Long countByLegalCaseIdAndOrganizationId(@Param("orgId") Long organizationId, @Param("legalCaseId") Long legalCaseId);

    @Query("SELECT COUNT(te) FROM TimeEntry te WHERE te.organizationId = :orgId AND te.legalCaseId = :legalCaseId AND te.status = :status")
    Long countByLegalCaseIdAndStatusAndOrganizationId(@Param("orgId") Long organizationId, @Param("legalCaseId") Long legalCaseId, @Param("status") TimeEntryStatus status);

    @Query("SELECT COALESCE(SUM(te.hours), 0) FROM TimeEntry te WHERE te.organizationId = :orgId AND te.legalCaseId = :legalCaseId AND te.billable = true")
    BigDecimal getTotalBillableHoursByCaseAndOrganization(@Param("orgId") Long organizationId, @Param("legalCaseId") Long legalCaseId);

    @Query("SELECT COALESCE(SUM(te.hours), 0) FROM TimeEntry te WHERE te.organizationId = :orgId AND te.legalCaseId = :legalCaseId AND te.billable = false")
    BigDecimal getTotalNonBillableHoursByCaseAndOrganization(@Param("orgId") Long organizationId, @Param("legalCaseId") Long legalCaseId);

    @Query("SELECT COALESCE(SUM(te.hours), 0) FROM TimeEntry te WHERE te.organizationId = :orgId AND te.legalCaseId = :legalCaseId")
    BigDecimal getTotalAllHoursByCaseAndOrganization(@Param("orgId") Long organizationId, @Param("legalCaseId") Long legalCaseId);

    @Query("SELECT COALESCE(SUM(te.hours * te.rate), 0) FROM TimeEntry te WHERE te.organizationId = :orgId AND te.legalCaseId = :legalCaseId AND te.billable = true")
    BigDecimal getTotalBillableAmountByCaseAndOrganization(@Param("orgId") Long organizationId, @Param("legalCaseId") Long legalCaseId);
} 
 
 
 
 
 
 