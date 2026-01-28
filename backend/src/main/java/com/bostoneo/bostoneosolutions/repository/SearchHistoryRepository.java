package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.enumeration.QueryType;
import com.bostoneo.bostoneosolutions.model.SearchHistory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface SearchHistoryRepository extends JpaRepository<SearchHistory, Long> {

    // ==================== DEPRECATED METHODS (use tenant-filtered versions) ====================

    /**
     * @deprecated Use findByUserIdAndOrganizationIdOrderBySearchedAtDesc instead for tenant isolation
     */
    @Deprecated
    List<SearchHistory> findByUserIdOrderBySearchedAtDesc(Long userId);

    /**
     * @deprecated Use findByUserIdAndOrganizationIdOrderBySearchedAtDesc(userId, orgId, pageable) instead for tenant isolation
     */
    @Deprecated
    Page<SearchHistory> findByUserIdOrderBySearchedAtDesc(Long userId, Pageable pageable);

    /**
     * @deprecated Use findByUserIdAndOrganizationIdAndIsSavedTrueOrderBySearchedAtDesc instead for tenant isolation
     */
    @Deprecated
    List<SearchHistory> findByUserIdAndIsSavedTrueOrderBySearchedAtDesc(Long userId);

    /**
     * @deprecated Use tenant-filtered version instead for tenant isolation
     */
    @Deprecated
    List<SearchHistory> findBySessionIdOrderBySearchedAtDesc(String sessionId);

    /**
     * @deprecated Use tenant-filtered version instead for tenant isolation
     */
    @Deprecated
    List<SearchHistory> findByUserIdAndQueryTypeOrderBySearchedAtDesc(Long userId, QueryType queryType);

    /**
     * @deprecated Use tenant-filtered version instead for tenant isolation
     */
    @Deprecated
    @Query("SELECT s FROM SearchHistory s WHERE s.userId = :userId " +
           "AND s.searchedAt BETWEEN :startDate AND :endDate " +
           "ORDER BY s.searchedAt DESC")
    List<SearchHistory> findByUserIdAndDateRange(@Param("userId") Long userId,
                                                  @Param("startDate") LocalDateTime startDate,
                                                  @Param("endDate") LocalDateTime endDate);

    /**
     * @deprecated Use tenant-filtered version instead for tenant isolation
     */
    @Deprecated
    @Query("SELECT s FROM SearchHistory s WHERE s.userId = :userId " +
           "AND LOWER(s.searchQuery) LIKE LOWER(CONCAT('%', :query, '%')) " +
           "ORDER BY s.searchedAt DESC")
    List<SearchHistory> findByUserIdAndQueryContaining(@Param("userId") Long userId,
                                                        @Param("query") String query);

    /**
     * @deprecated Use tenant-filtered version instead for tenant isolation
     */
    @Deprecated
    @Query("SELECT COUNT(s), AVG(s.executionTimeMs), AVG(s.resultsCount) " +
           "FROM SearchHistory s WHERE s.userId = :userId")
    Object[] getSearchStatistics(@Param("userId") Long userId);

    /**
     * @deprecated Use tenant-filtered version instead for tenant isolation
     */
    @Deprecated
    @Query("SELECT s.searchQuery, COUNT(s) as frequency FROM SearchHistory s " +
           "WHERE s.userId = :userId " +
           "GROUP BY s.searchQuery " +
           "ORDER BY frequency DESC")
    List<Object[]> findMostFrequentQueries(@Param("userId") Long userId, Pageable pageable);

    /**
     * @deprecated CAUTION: This deletes across ALL organizations - only use in scheduled cleanup with care
     */
    @Deprecated
    @Query("DELETE FROM SearchHistory s WHERE s.searchedAt < :cutoffDate AND s.isSaved = false")
    void deleteOldSearchHistory(@Param("cutoffDate") LocalDateTime cutoffDate);

    // Tenant-filtered methods
    java.util.Optional<SearchHistory> findByIdAndOrganizationId(Long id, Long organizationId);

    List<SearchHistory> findByUserIdAndOrganizationIdOrderBySearchedAtDesc(Long userId, Long organizationId);

    Page<SearchHistory> findByUserIdAndOrganizationIdOrderBySearchedAtDesc(Long userId, Long organizationId, Pageable pageable);

    List<SearchHistory> findByUserIdAndOrganizationIdAndIsSavedTrueOrderBySearchedAtDesc(Long userId, Long organizationId);
}