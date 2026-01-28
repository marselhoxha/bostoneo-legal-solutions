package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.Vendor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface VendorRepository extends JpaRepository<Vendor, Long> {

    // ==================== TENANT-FILTERED METHODS ====================

    List<Vendor> findByOrganizationId(Long organizationId);

    Page<Vendor> findByOrganizationId(Long organizationId, Pageable pageable);

    Optional<Vendor> findByIdAndOrganizationId(Long id, Long organizationId);

    @Query("SELECT v FROM Vendor v WHERE v.organizationId = :orgId AND LOWER(v.name) LIKE LOWER(CONCAT('%', :name, '%'))")
    List<Vendor> findByOrganizationIdAndNameContaining(@Param("orgId") Long organizationId, @Param("name") String name);

    long countByOrganizationId(Long organizationId);

    // ==================== LEGACY METHODS (KEPT FOR BACKWARD COMPATIBILITY) ====================
    // Add custom query methods here if needed
} 