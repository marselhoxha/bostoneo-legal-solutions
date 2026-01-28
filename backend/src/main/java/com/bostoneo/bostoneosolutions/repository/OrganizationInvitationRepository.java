package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.OrganizationInvitation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface OrganizationInvitationRepository extends JpaRepository<OrganizationInvitation, Long> {

    /**
     * Find invitation by token
     */
    Optional<OrganizationInvitation> findByToken(String token);

    /**
     * Find all invitations for an organization
     */
    List<OrganizationInvitation> findByOrganizationIdOrderByCreatedAtDesc(Long organizationId);

    /**
     * Find pending invitations for an organization (not accepted and not expired)
     */
    @Query("SELECT i FROM OrganizationInvitation i WHERE i.organizationId = :orgId " +
           "AND i.acceptedAt IS NULL AND i.expiresAt > :now ORDER BY i.createdAt DESC")
    List<OrganizationInvitation> findPendingByOrganizationId(
            @Param("orgId") Long organizationId,
            @Param("now") LocalDateTime now);

    /**
     * Find invitations by email
     */
    List<OrganizationInvitation> findByEmailOrderByCreatedAtDesc(String email);

    /**
     * Find pending invitation for email and organization
     */
    @Query("SELECT i FROM OrganizationInvitation i WHERE i.email = :email " +
           "AND i.organizationId = :orgId AND i.acceptedAt IS NULL AND i.expiresAt > :now")
    Optional<OrganizationInvitation> findPendingByEmailAndOrganization(
            @Param("email") String email,
            @Param("orgId") Long organizationId,
            @Param("now") LocalDateTime now);

    /**
     * Check if email has pending invitation for organization
     */
    @Query("SELECT COUNT(i) > 0 FROM OrganizationInvitation i WHERE i.email = :email " +
           "AND i.organizationId = :orgId AND i.acceptedAt IS NULL AND i.expiresAt > :now")
    boolean existsPendingByEmailAndOrganization(
            @Param("email") String email,
            @Param("orgId") Long organizationId,
            @Param("now") LocalDateTime now);

    /**
     * Delete expired invitations (cleanup job)
     */
    void deleteByExpiresAtBefore(LocalDateTime dateTime);

    // ==================== TENANT-FILTERED METHODS ====================

    Optional<OrganizationInvitation> findByIdAndOrganizationId(Long id, Long organizationId);

    boolean existsByIdAndOrganizationId(Long id, Long organizationId);
}
