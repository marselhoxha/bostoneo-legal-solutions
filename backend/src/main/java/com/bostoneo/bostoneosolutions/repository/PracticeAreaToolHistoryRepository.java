package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.PracticeAreaToolHistory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository for Practice Area Tool History
 */
@Repository
public interface PracticeAreaToolHistoryRepository extends JpaRepository<PracticeAreaToolHistory, Long> {

    /**
     * Find all history items for a practice area within an organization
     */
    List<PracticeAreaToolHistory> findByOrganizationIdAndPracticeAreaOrderByCreatedAtDesc(
            Long organizationId, String practiceArea);

    /**
     * Find all history items for a practice area with pagination
     */
    Page<PracticeAreaToolHistory> findByOrganizationIdAndPracticeAreaOrderByCreatedAtDesc(
            Long organizationId, String practiceArea, Pageable pageable);

    /**
     * Find all history items for a specific tool type within a practice area
     */
    List<PracticeAreaToolHistory> findByOrganizationIdAndPracticeAreaAndToolTypeOrderByCreatedAtDesc(
            Long organizationId, String practiceArea, String toolType);

    /**
     * Find a specific history item by ID with organization filtering
     */
    Optional<PracticeAreaToolHistory> findByIdAndOrganizationId(Long id, Long organizationId);

    /**
     * Find a specific history item by ID, practice area, and organization
     */
    Optional<PracticeAreaToolHistory> findByIdAndOrganizationIdAndPracticeArea(
            Long id, Long organizationId, String practiceArea);

    /**
     * Find history items linked to a specific case
     */
    List<PracticeAreaToolHistory> findByOrganizationIdAndCaseIdOrderByCreatedAtDesc(
            Long organizationId, Long caseId);

    /**
     * Find user's history across all practice areas
     */
    List<PracticeAreaToolHistory> findByOrganizationIdAndUserIdOrderByCreatedAtDesc(
            Long organizationId, Long userId);

    /**
     * Count history items by practice area for analytics
     */
    @Query("SELECT h.toolType, COUNT(h) FROM PracticeAreaToolHistory h " +
           "WHERE h.organizationId = :orgId AND h.practiceArea = :practiceArea " +
           "GROUP BY h.toolType")
    List<Object[]> countByToolType(@Param("orgId") Long organizationId,
                                   @Param("practiceArea") String practiceArea);

    /**
     * Delete all history items for a practice area (admin only)
     */
    void deleteByOrganizationIdAndPracticeArea(Long organizationId, String practiceArea);
}
