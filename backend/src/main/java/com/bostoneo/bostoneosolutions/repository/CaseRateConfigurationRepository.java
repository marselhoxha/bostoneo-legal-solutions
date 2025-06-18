package com.***REMOVED***.***REMOVED***solutions.repository;

import com.***REMOVED***.***REMOVED***solutions.model.CaseRateConfiguration;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.ListCrudRepository;
import org.springframework.data.repository.PagingAndSortingRepository;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

public interface CaseRateConfigurationRepository extends PagingAndSortingRepository<CaseRateConfiguration, Long>, ListCrudRepository<CaseRateConfiguration, Long> {
    
    // Find rate configuration by legal case ID
    Optional<CaseRateConfiguration> findByLegalCaseId(Long legalCaseId);
    
    // Find active rate configuration by legal case ID
    Optional<CaseRateConfiguration> findByLegalCaseIdAndIsActive(Long legalCaseId, Boolean isActive);
    
    // Find all active configurations
    List<CaseRateConfiguration> findByIsActive(Boolean isActive);
    
    // Find configurations by multiple legal case IDs
    List<CaseRateConfiguration> findByLegalCaseIdInAndIsActive(List<Long> legalCaseIds, Boolean isActive);
    
    // Check if configuration exists for a case
    boolean existsByLegalCaseIdAndIsActive(Long legalCaseId, Boolean isActive);
    
    // Find configurations by rate range
    List<CaseRateConfiguration> findByDefaultRateBetweenAndIsActive(BigDecimal minRate, BigDecimal maxRate, Boolean isActive);
    
    // Find configurations that allow multipliers
    List<CaseRateConfiguration> findByAllowMultipliersAndIsActive(Boolean allowMultipliers, Boolean isActive);
    
    // Analytics queries
    @Query("SELECT AVG(crc.defaultRate) FROM CaseRateConfiguration crc WHERE crc.isActive = true")
    BigDecimal getAverageDefaultRate();
    
    @Query("SELECT COUNT(crc) FROM CaseRateConfiguration crc WHERE crc.allowMultipliers = true AND crc.isActive = true")
    Long countWithMultipliersEnabled();
    
    @Query("SELECT COUNT(crc) FROM CaseRateConfiguration crc WHERE crc.isActive = true")
    Long countActiveConfigurations();
    
    // Find configurations with specific multiplier values
    @Query("SELECT crc FROM CaseRateConfiguration crc WHERE crc.weekendMultiplier = :multiplier AND crc.isActive = true")
    List<CaseRateConfiguration> findByWeekendMultiplier(@Param("multiplier") BigDecimal multiplier);
    
    @Query("SELECT crc FROM CaseRateConfiguration crc WHERE crc.afterHoursMultiplier = :multiplier AND crc.isActive = true")
    List<CaseRateConfiguration> findByAfterHoursMultiplier(@Param("multiplier") BigDecimal multiplier);
    
    @Query("SELECT crc FROM CaseRateConfiguration crc WHERE crc.emergencyMultiplier = :multiplier AND crc.isActive = true")
    List<CaseRateConfiguration> findByEmergencyMultiplier(@Param("multiplier") BigDecimal multiplier);
    
    // Find configurations for cases with specific patterns
    @Query("SELECT crc FROM CaseRateConfiguration crc WHERE crc.caseName LIKE %:pattern% AND crc.isActive = true")
    List<CaseRateConfiguration> findByCaseNameContaining(@Param("pattern") String pattern);
    
    @Query("SELECT crc FROM CaseRateConfiguration crc WHERE crc.caseNumber LIKE %:pattern% AND crc.isActive = true")
    List<CaseRateConfiguration> findByCaseNumberContaining(@Param("pattern") String pattern);
    
    // Find highest and lowest rates
    @Query("SELECT crc FROM CaseRateConfiguration crc WHERE crc.isActive = true ORDER BY crc.defaultRate DESC")
    List<CaseRateConfiguration> findAllOrderByDefaultRateDesc();
    
    @Query("SELECT crc FROM CaseRateConfiguration crc WHERE crc.isActive = true ORDER BY crc.defaultRate ASC")
    List<CaseRateConfiguration> findAllOrderByDefaultRateAsc();
    
    // Find configurations with extreme multipliers
    @Query("SELECT crc FROM CaseRateConfiguration crc WHERE crc.emergencyMultiplier > 2.0 AND crc.isActive = true")
    List<CaseRateConfiguration> findConfigurationsWithHighEmergencyMultipliers();
    
    @Query("SELECT crc FROM CaseRateConfiguration crc WHERE crc.weekendMultiplier > 1.5 AND crc.isActive = true")
    List<CaseRateConfiguration> findConfigurationsWithHighWeekendMultipliers();
    
    // Bulk operations
    @Query("UPDATE CaseRateConfiguration crc SET crc.isActive = false WHERE crc.legalCaseId IN :legalCaseIds")
    void deactivateConfigurationsByLegalCaseIds(@Param("legalCaseIds") List<Long> legalCaseIds);
    
    @Query("UPDATE CaseRateConfiguration crc SET crc.allowMultipliers = :allowMultipliers WHERE crc.legalCaseId IN :legalCaseIds AND crc.isActive = true")
    void updateMultipliersEnabledByLegalCaseIds(@Param("legalCaseIds") List<Long> legalCaseIds, @Param("allowMultipliers") Boolean allowMultipliers);
    
    // Statistics for reporting
    @Query("SELECT " +
           "MIN(crc.defaultRate) as minRate, " +
           "MAX(crc.defaultRate) as maxRate, " +
           "AVG(crc.defaultRate) as avgRate, " +
           "COUNT(crc) as totalConfigurations " +
           "FROM CaseRateConfiguration crc WHERE crc.isActive = true")
    Object[] getRateStatistics();
    
    // Find configurations that need attention (no multipliers or very low/high rates)
    @Query("SELECT crc FROM CaseRateConfiguration crc WHERE " +
           "(crc.allowMultipliers = false OR crc.defaultRate < 100 OR crc.defaultRate > 1000) " +
           "AND crc.isActive = true")
    List<CaseRateConfiguration> findConfigurationsNeedingAttention();
    
    // Custom search with multiple criteria
    @Query("SELECT crc FROM CaseRateConfiguration crc WHERE " +
           "(:legalCaseId IS NULL OR crc.legalCaseId = :legalCaseId) AND " +
           "(:minRate IS NULL OR crc.defaultRate >= :minRate) AND " +
           "(:maxRate IS NULL OR crc.defaultRate <= :maxRate) AND " +
           "(:allowMultipliers IS NULL OR crc.allowMultipliers = :allowMultipliers) AND " +
           "crc.isActive = true")
    List<CaseRateConfiguration> findByCriteria(
        @Param("legalCaseId") Long legalCaseId,
        @Param("minRate") BigDecimal minRate,
        @Param("maxRate") BigDecimal maxRate,
        @Param("allowMultipliers") Boolean allowMultipliers
    );
    
    // Find configurations created in a date range
    @Query("SELECT crc FROM CaseRateConfiguration crc WHERE " +
           "crc.createdAt >= :startDate AND crc.createdAt <= :endDate AND crc.isActive = true")
    List<CaseRateConfiguration> findByCreatedAtBetween(
        @Param("startDate") java.util.Date startDate,
        @Param("endDate") java.util.Date endDate
    );
    
    // Find configurations recently updated
    @Query("SELECT crc FROM CaseRateConfiguration crc WHERE " +
           "crc.updatedAt >= :since AND crc.isActive = true ORDER BY crc.updatedAt DESC")
    List<CaseRateConfiguration> findRecentlyUpdated(@Param("since") java.util.Date since);
} 