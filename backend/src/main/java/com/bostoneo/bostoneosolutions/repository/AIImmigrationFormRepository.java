package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.AIImmigrationForm;
import com.bostoneo.bostoneosolutions.enumeration.FormCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface AIImmigrationFormRepository extends JpaRepository<AIImmigrationForm, Long> {
    
    Optional<AIImmigrationForm> findByFormNumber(String formNumber);
    
    List<AIImmigrationForm> findByFormCategory(FormCategory formCategory);
    
    List<AIImmigrationForm> findByIsActiveTrueOrderByFormNumber();
    
    List<AIImmigrationForm> findByFormTitleContainingIgnoreCase(String title);
    
    List<AIImmigrationForm> findByFormNumberContaining(String formNumber);
    
    List<AIImmigrationForm> findByFormCategoryAndIsActiveTrue(FormCategory formCategory);
    
    @Query("SELECT f FROM AIImmigrationForm f WHERE f.filingFee BETWEEN :minFee AND :maxFee ORDER BY f.filingFee ASC")
    List<AIImmigrationForm> findByFilingFeeBetween(@Param("minFee") BigDecimal minFee, @Param("maxFee") BigDecimal maxFee);
    
    @Query("SELECT f FROM AIImmigrationForm f WHERE f.lastUpdated >= :date ORDER BY f.lastUpdated DESC")
    List<AIImmigrationForm> findRecentlyUpdated(@Param("date") LocalDate date);
    
    @Query("SELECT f FROM AIImmigrationForm f WHERE f.processingTimeRange IS NOT NULL AND f.isActive = true ORDER BY f.formNumber")
    List<AIImmigrationForm> findWithProcessingTimes();
    
    @Query("SELECT DISTINCT f.formCategory FROM AIImmigrationForm f WHERE f.isActive = true")
    List<FormCategory> findActiveFormCategories();
}