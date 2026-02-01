package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.PIProviderDirectory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository for PI Provider Directory entities.
 */
@Repository
public interface PIProviderDirectoryRepository extends JpaRepository<PIProviderDirectory, Long> {

    /**
     * Find all providers for an organization
     */
    List<PIProviderDirectory> findByOrganizationIdOrderByProviderNameAsc(Long organizationId);

    /**
     * Find provider by ID and organization
     */
    Optional<PIProviderDirectory> findByIdAndOrganizationId(Long id, Long organizationId);

    /**
     * Find provider by name (exact match)
     */
    Optional<PIProviderDirectory> findByOrganizationIdAndProviderName(Long organizationId, String providerName);

    /**
     * Search providers by name (partial match)
     */
    @Query("SELECT p FROM PIProviderDirectory p WHERE p.organizationId = :orgId " +
           "AND LOWER(p.providerName) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "ORDER BY p.providerName ASC")
    List<PIProviderDirectory> searchByName(@Param("orgId") Long organizationId, @Param("search") String search);

    /**
     * Find providers by type
     */
    List<PIProviderDirectory> findByOrganizationIdAndProviderTypeOrderByProviderNameAsc(
            Long organizationId, String providerType);

    /**
     * Find provider by NPI
     */
    Optional<PIProviderDirectory> findByOrganizationIdAndNpi(Long organizationId, String npi);

    /**
     * Search providers by name, address, or NPI
     */
    @Query("SELECT p FROM PIProviderDirectory p WHERE p.organizationId = :orgId AND " +
           "(LOWER(p.providerName) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(p.address) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(p.city) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "p.npi LIKE CONCAT('%', :search, '%')) " +
           "ORDER BY p.providerName ASC")
    List<PIProviderDirectory> search(@Param("orgId") Long organizationId, @Param("search") String search);

    /**
     * Find providers with records department contact info
     */
    @Query("SELECT p FROM PIProviderDirectory p WHERE p.organizationId = :orgId " +
           "AND (p.recordsEmail IS NOT NULL OR p.recordsPhone IS NOT NULL OR p.recordsFax IS NOT NULL) " +
           "ORDER BY p.providerName ASC")
    List<PIProviderDirectory> findWithRecordsContact(@Param("orgId") Long organizationId);

    /**
     * Find providers with billing department contact info
     */
    @Query("SELECT p FROM PIProviderDirectory p WHERE p.organizationId = :orgId " +
           "AND (p.billingEmail IS NOT NULL OR p.billingPhone IS NOT NULL OR p.billingFax IS NOT NULL) " +
           "ORDER BY p.providerName ASC")
    List<PIProviderDirectory> findWithBillingContact(@Param("orgId") Long organizationId);

    /**
     * Check if provider name exists for organization
     */
    boolean existsByOrganizationIdAndProviderName(Long organizationId, String providerName);

    /**
     * Count providers for organization
     */
    long countByOrganizationId(Long organizationId);
}
