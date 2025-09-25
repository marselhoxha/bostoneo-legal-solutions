package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.ResearchSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface ResearchSessionRepository extends JpaRepository<ResearchSession, Long> {

    // Find by session ID
    Optional<ResearchSession> findBySessionId(String sessionId);

    // Find by user ID
    List<ResearchSession> findByUserIdOrderByLastAccessedDesc(Long userId);

    // Find active sessions for a user
    List<ResearchSession> findByUserIdAndIsActiveTrueOrderByLastAccessedDesc(Long userId);

    // Find sessions by name pattern
    @Query("SELECT r FROM ResearchSession r WHERE r.userId = :userId " +
           "AND LOWER(r.sessionName) LIKE LOWER(CONCAT('%', :name, '%')) " +
           "ORDER BY r.lastAccessed DESC")
    List<ResearchSession> findByUserIdAndSessionNameContaining(@Param("userId") Long userId,
                                                                @Param("name") String name);

    // Find sessions within a date range
    @Query("SELECT r FROM ResearchSession r WHERE r.userId = :userId " +
           "AND r.createdAt BETWEEN :startDate AND :endDate " +
           "ORDER BY r.lastAccessed DESC")
    List<ResearchSession> findByUserIdAndDateRange(@Param("userId") Long userId,
                                                    @Param("startDate") LocalDateTime startDate,
                                                    @Param("endDate") LocalDateTime endDate);

    // Get session statistics for a user
    @Query("SELECT COUNT(r), AVG(r.totalSearches), AVG(r.totalDocumentsViewed) " +
           "FROM ResearchSession r WHERE r.userId = :userId AND r.isActive = true")
    Object[] getSessionStatistics(@Param("userId") Long userId);

    // Find most active sessions (by total searches)
    @Query("SELECT r FROM ResearchSession r WHERE r.userId = :userId " +
           "ORDER BY r.totalSearches DESC, r.lastAccessed DESC")
    List<ResearchSession> findMostActiveSessions(@Param("userId") Long userId);

    // Delete inactive sessions older than specified days
    @Query("DELETE FROM ResearchSession r WHERE r.lastAccessed < :cutoffDate AND r.isActive = false")
    void deleteInactiveSessions(@Param("cutoffDate") LocalDateTime cutoffDate);

    // Count active sessions for a user
    long countByUserIdAndIsActiveTrue(Long userId);
}