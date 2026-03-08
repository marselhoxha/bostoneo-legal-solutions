package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.Attorney;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AttorneyRepository extends JpaRepository<Attorney, Long> {

    Optional<Attorney> findByUserId(Long userId);

    boolean existsByUserId(Long userId);

    // ==================== TENANT-FILTERED METHODS ====================

    Optional<Attorney> findByUserIdAndOrganizationId(Long userId, Long organizationId);

    boolean existsByUserIdAndOrganizationId(Long userId, Long organizationId);

    Optional<Attorney> findByIdAndOrganizationId(Long id, Long organizationId);

    java.util.List<Attorney> findByOrganizationId(Long organizationId);

    java.util.List<Attorney> findByOrganizationIdAndIsActiveTrue(Long organizationId);

    @Query(value = "SELECT a.id, u.first_name, u.last_name, a.bar_number, a.license_state " +
           "FROM attorneys a JOIN users u ON a.user_id = u.id " +
           "WHERE a.organization_id = :orgId AND a.is_active = true " +
           "ORDER BY u.last_name, u.first_name", nativeQuery = true)
    List<Object[]> findAttorneyInfoByOrganizationId(@Param("orgId") Long orgId);
}
