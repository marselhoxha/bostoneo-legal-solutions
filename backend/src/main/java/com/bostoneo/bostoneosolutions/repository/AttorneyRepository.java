package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.Attorney;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

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
}
