package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.NotificationToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface NotificationTokenRepository extends JpaRepository<NotificationToken, Long> {

    // ==================== TENANT-FILTERED METHODS ====================
    // SECURITY: Always use these methods for proper multi-tenant isolation.

    Optional<NotificationToken> findByIdAndOrganizationId(Long id, Long organizationId);

    Optional<NotificationToken> findByTokenAndOrganizationId(String token, Long organizationId);

    List<NotificationToken> findByOrganizationIdAndUserId(Long organizationId, Long userId);

    List<NotificationToken> findByOrganizationIdAndUserIdAndPlatform(Long organizationId, Long userId, String platform);

    List<NotificationToken> findByOrganizationIdAndUserIdIn(Long organizationId, List<Long> userIds);

    void deleteByIdAndOrganizationId(Long id, Long organizationId);

    // ==================== DEPRECATED METHODS ====================
    // WARNING: These methods bypass multi-tenant isolation.

    /**
     * @deprecated Use findByTokenAndOrganizationId for tenant isolation
     */
    @Deprecated
    Optional<NotificationToken> findByToken(String token);

    /**
     * @deprecated Use findByOrganizationIdAndUserId for tenant isolation
     */
    @Deprecated
    List<NotificationToken> findByUserId(Long userId);

    /**
     * @deprecated Use findByOrganizationIdAndUserIdAndPlatform for tenant isolation
     */
    @Deprecated
    List<NotificationToken> findByUserIdAndPlatform(Long userId, String platform);

    /**
     * @deprecated Use findByOrganizationIdAndUserIdIn for tenant isolation
     */
    @Deprecated
    List<NotificationToken> findByUserIdIn(List<Long> userIds);

} 
 