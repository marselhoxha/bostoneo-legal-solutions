package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.DocumentCollection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository for Document Collections
 */
@Repository
public interface DocumentCollectionRepository extends JpaRepository<DocumentCollection, Long> {

    /**
     * Find all collections for a user, ordered by most recent first
     */
    List<DocumentCollection> findByUserIdAndIsArchivedFalseOrderByUpdatedAtDesc(Long userId);

    /**
     * Find all collections for a user (including archived)
     */
    List<DocumentCollection> findByUserIdOrderByUpdatedAtDesc(Long userId);

    /**
     * Find collections linked to a specific case
     */
    List<DocumentCollection> findByCaseIdAndIsArchivedFalse(Long caseId);

    /**
     * Find collection by ID and user (for security check)
     */
    Optional<DocumentCollection> findByIdAndUserId(Long id, Long userId);

    /**
     * Search collections by name
     */
    @Query("SELECT c FROM DocumentCollection c WHERE c.userId = :userId AND c.isArchived = false AND LOWER(c.name) LIKE LOWER(CONCAT('%', :query, '%'))")
    List<DocumentCollection> searchByName(@Param("userId") Long userId, @Param("query") String query);

    /**
     * Count collections for a user
     */
    long countByUserIdAndIsArchivedFalse(Long userId);
}
