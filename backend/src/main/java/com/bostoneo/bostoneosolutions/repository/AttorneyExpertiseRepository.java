package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.enumeration.ExpertiseArea;
import com.bostoneo.bostoneosolutions.enumeration.ProficiencyLevel;
import com.bostoneo.bostoneosolutions.model.AttorneyExpertise;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface AttorneyExpertiseRepository extends JpaRepository<AttorneyExpertise, Long> {
    
    /**
     * Find all expertise areas for an attorney
     */
    List<AttorneyExpertise> findByAttorneyId(Long attorneyId);
    
    /**
     * Find specific expertise for an attorney
     */
    Optional<AttorneyExpertise> findByAttorneyIdAndExpertiseArea(
        Long attorneyId, 
        ExpertiseArea expertiseArea
    );
    
    /**
     * Find attorneys with specific expertise
     */
    @Query("SELECT ae FROM AttorneyExpertise ae WHERE ae.expertiseArea = :area " +
           "AND ae.proficiencyLevel IN :levels ORDER BY ae.successRate DESC")
    List<AttorneyExpertise> findByExpertiseAreaAndProficiencyLevels(
        @Param("area") ExpertiseArea area,
        @Param("levels") List<ProficiencyLevel> levels
    );
    
    /**
     * Find top attorneys by expertise area
     */
    @Query("SELECT ae FROM AttorneyExpertise ae WHERE ae.expertiseArea = :area " +
           "ORDER BY ae.successRate DESC, ae.casesHandled DESC")
    List<AttorneyExpertise> findTopAttorneysByExpertise(
        @Param("area") ExpertiseArea area,
        org.springframework.data.domain.Pageable pageable
    );
    
    /**
     * Find attorneys with minimum experience
     */
    @Query("SELECT ae FROM AttorneyExpertise ae WHERE ae.expertiseArea = :area " +
           "AND ae.yearsExperience >= :minYears")
    List<AttorneyExpertise> findByExpertiseAreaAndMinExperience(
        @Param("area") ExpertiseArea area,
        @Param("minYears") Integer minYears
    );
    
    /**
     * Count attorneys by expertise area
     */
    @Query("SELECT ae.expertiseArea, COUNT(ae) FROM AttorneyExpertise ae " +
           "GROUP BY ae.expertiseArea")
    List<Object[]> countAttorneysByExpertiseArea();
    
    /**
     * Find attorneys with recent case experience
     */
    @Query("SELECT ae FROM AttorneyExpertise ae WHERE ae.expertiseArea = :area " +
           "AND ae.lastCaseDate >= :sinceDate " +
           "ORDER BY COALESCE(ae.lastCaseDate, ae.createdAt) DESC")
    List<AttorneyExpertise> findRecentlyActiveInArea(
        @Param("area") ExpertiseArea area,
        @Param("sinceDate") LocalDate sinceDate
    );
    
    /**
     * Update expertise statistics after case completion
     */
    @Query("UPDATE AttorneyExpertise ae SET ae.casesHandled = ae.casesHandled + 1, " +
           "ae.lastCaseDate = CURRENT_DATE WHERE ae.id = :expertiseId")
    void incrementCaseCount(@Param("expertiseId") Long expertiseId);
    
    /**
     * Find attorneys with multiple expertise areas
     */
    @Query("SELECT ae.attorney.id, COUNT(ae) as expertiseCount FROM AttorneyExpertise ae " +
           "GROUP BY ae.attorney.id HAVING COUNT(ae) > 1")
    List<Object[]> findMultiExpertiseAttorneys();
    
    /**
     * Find expertise by user ID ordered by proficiency
     */
    @Query("SELECT ae FROM AttorneyExpertise ae WHERE ae.attorney.id = :userId " +
           "ORDER BY ae.proficiencyLevel DESC, ae.yearsExperience DESC")
    List<AttorneyExpertise> findByUserIdOrderByProficiencyDesc(@Param("userId") Long userId);
}