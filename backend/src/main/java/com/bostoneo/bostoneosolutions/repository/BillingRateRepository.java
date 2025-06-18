package com.***REMOVED***.***REMOVED***solutions.repository;

import com.***REMOVED***.***REMOVED***solutions.enumeration.RateType;
import com.***REMOVED***.***REMOVED***solutions.model.BillingRate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.ListCrudRepository;
import org.springframework.data.repository.PagingAndSortingRepository;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface BillingRateRepository extends PagingAndSortingRepository<BillingRate, Long>, ListCrudRepository<BillingRate, Long> {
    
    // Basic finders
    Page<BillingRate> findByUserId(Long userId, Pageable pageable);
    
    List<BillingRate> findByUserIdAndIsActive(Long userId, Boolean isActive);
    
    List<BillingRate> findByMatterTypeId(Long matterTypeId);
    
    List<BillingRate> findByClientId(Long clientId);
    
    List<BillingRate> findByLegalCaseId(Long legalCaseId);
    
    List<BillingRate> findByRateType(RateType rateType);
    
    // Find effective rates
    @Query("SELECT br FROM BillingRate br WHERE br.userId = :userId AND br.isActive = true " +
           "AND (br.effectiveDate IS NULL OR br.effectiveDate <= :date) " +
           "AND (br.endDate IS NULL OR br.endDate >= :date) " +
           "ORDER BY br.legalCaseId DESC, br.clientId DESC, br.matterTypeId DESC, br.effectiveDate DESC")
    List<BillingRate> findEffectiveRatesForUser(@Param("userId") Long userId, @Param("date") LocalDate date);
    
    // Find most specific rate for a user, case, and date
    @Query("SELECT br FROM BillingRate br WHERE br.userId = :userId AND br.isActive = true " +
           "AND (br.effectiveDate IS NULL OR br.effectiveDate <= :date) " +
           "AND (br.endDate IS NULL OR br.endDate >= :date) " +
           "AND (:legalCaseId IS NULL OR br.legalCaseId = :legalCaseId OR br.legalCaseId IS NULL) " +
           "AND (:clientId IS NULL OR br.clientId = :clientId OR br.clientId IS NULL) " +
           "AND (:matterTypeId IS NULL OR br.matterTypeId = :matterTypeId OR br.matterTypeId IS NULL) " +
           "ORDER BY " +
           "CASE WHEN br.legalCaseId = :legalCaseId THEN 1 ELSE 2 END, " +
           "CASE WHEN br.clientId = :clientId THEN 1 ELSE 2 END, " +
           "CASE WHEN br.matterTypeId = :matterTypeId THEN 1 ELSE 2 END, " +
           "br.effectiveDate DESC")
    List<BillingRate> findMostSpecificRate(@Param("userId") Long userId,
                                          @Param("legalCaseId") Long legalCaseId,
                                          @Param("clientId") Long clientId,
                                          @Param("matterTypeId") Long matterTypeId,
                                          @Param("date") LocalDate date);
    
    // Find current rates (active and within date range)
    @Query("SELECT br FROM BillingRate br WHERE br.isActive = true " +
           "AND (br.effectiveDate IS NULL OR br.effectiveDate <= CURRENT_DATE) " +
           "AND (br.endDate IS NULL OR br.endDate >= CURRENT_DATE)")
    List<BillingRate> findCurrentActiveRates();
    
    // Find rates by user and matter type
    Optional<BillingRate> findByUserIdAndMatterTypeIdAndIsActiveAndEffectiveDateLessThanEqualAndEndDateGreaterThanEqual(
        Long userId, Long matterTypeId, Boolean isActive, LocalDate effectiveDate, LocalDate endDate);
    
    // Check for overlapping rates
    @Query("SELECT COUNT(br) > 0 FROM BillingRate br WHERE br.userId = :userId " +
           "AND br.isActive = true " +
           "AND (:id IS NULL OR br.id != :id) " +
           "AND (br.legalCaseId = :legalCaseId OR (br.legalCaseId IS NULL AND :legalCaseId IS NULL)) " +
           "AND (br.clientId = :clientId OR (br.clientId IS NULL AND :clientId IS NULL)) " +
           "AND (br.matterTypeId = :matterTypeId OR (br.matterTypeId IS NULL AND :matterTypeId IS NULL)) " +
           "AND NOT (br.endDate < :effectiveDate OR :endDate < br.effectiveDate)")
    boolean hasOverlappingRate(@Param("id") Long id,
                              @Param("userId") Long userId,
                              @Param("legalCaseId") Long legalCaseId,
                              @Param("clientId") Long clientId,
                              @Param("matterTypeId") Long matterTypeId,
                              @Param("effectiveDate") LocalDate effectiveDate,
                              @Param("endDate") LocalDate endDate);
    
    // Get rate history for a user
    @Query("SELECT br FROM BillingRate br WHERE br.userId = :userId ORDER BY br.effectiveDate DESC, br.createdAt DESC")
    List<BillingRate> getRateHistoryForUser(@Param("userId") Long userId);
} 
 
 
 
 
 
 