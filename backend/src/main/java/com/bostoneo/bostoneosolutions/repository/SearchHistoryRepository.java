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

    // Find by user ID
    List<SearchHistory> findByUserIdOrderBySearchedAtDesc(Long userId);

    // Find recent searches for a user
    Page<SearchHistory> findByUserIdOrderBySearchedAtDesc(Long userId, Pageable pageable);

    // Find saved searches for a user
    List<SearchHistory> findByUserIdAndIsSavedTrueOrderBySearchedAtDesc(Long userId);

    // Find by session ID
    List<SearchHistory> findBySessionIdOrderBySearchedAtDesc(String sessionId);

    // Find by query type
    List<SearchHistory> findByUserIdAndQueryTypeOrderBySearchedAtDesc(Long userId, QueryType queryType);

    // Find searches within a date range
    @Query("SELECT s FROM SearchHistory s WHERE s.userId = :userId " +
           "AND s.searchedAt BETWEEN :startDate AND :endDate " +
           "ORDER BY s.searchedAt DESC")
    List<SearchHistory> findByUserIdAndDateRange(@Param("userId") Long userId,
                                                  @Param("startDate") LocalDateTime startDate,
                                                  @Param("endDate") LocalDateTime endDate);

    // Search history by search query text
    @Query("SELECT s FROM SearchHistory s WHERE s.userId = :userId " +
           "AND LOWER(s.searchQuery) LIKE LOWER(CONCAT('%', :query, '%')) " +
           "ORDER BY s.searchedAt DESC")
    List<SearchHistory> findByUserIdAndQueryContaining(@Param("userId") Long userId,
                                                        @Param("query") String query);

    // Get search statistics for a user
    @Query("SELECT COUNT(s), AVG(s.executionTimeMs), AVG(s.resultsCount) " +
           "FROM SearchHistory s WHERE s.userId = :userId")
    Object[] getSearchStatistics(@Param("userId") Long userId);

    // Find most frequent search queries for a user
    @Query("SELECT s.searchQuery, COUNT(s) as frequency FROM SearchHistory s " +
           "WHERE s.userId = :userId " +
           "GROUP BY s.searchQuery " +
           "ORDER BY frequency DESC")
    List<Object[]> findMostFrequentQueries(@Param("userId") Long userId, Pageable pageable);

    // Delete old search history (older than specified days)
    @Query("DELETE FROM SearchHistory s WHERE s.searchedAt < :cutoffDate AND s.isSaved = false")
    void deleteOldSearchHistory(@Param("cutoffDate") LocalDateTime cutoffDate);
}