package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.Client;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.ListCrudRepository;
import org.springframework.data.repository.PagingAndSortingRepository;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ClientRepository extends PagingAndSortingRepository<Client, Long>, ListCrudRepository<Client, Long> {
    
    // Use custom query with proper parameter binding to fix the SQL parameter issue
    @Query("SELECT c FROM Client c WHERE c.name LIKE CONCAT('%', :name, '%')")
    Page<Client> findByNameContaining(@Param("name") String name, Pageable pageable);
    
    // Find client by email
    @Query("SELECT c FROM Client c WHERE c.email = :email")
    List<Client> findByEmail(@Param("email") String email);

    // Find client by user ID (for client portal)
    @Query("SELECT c FROM Client c WHERE c.userId = :userId")
    Client findByUserId(@Param("userId") Long userId);

    // Check if client exists by user ID
    boolean existsByUserId(Long userId);
    
    // Find client by exact name (case insensitive)
    @Query("SELECT c FROM Client c WHERE LOWER(c.name) = LOWER(:name)")
    List<Client> findByNameIgnoreCase(@Param("name") String name);
    
    // Get clients who have time entries
    @Query("SELECT DISTINCT c FROM Client c " +
           "JOIN LegalCase lc ON c.name = lc.clientName " +
           "JOIN TimeEntry te ON lc.id = te.legalCaseId " +
           "WHERE te.billable = true AND te.invoiceId IS NULL " +
           "ORDER BY c.name")
    List<Client> findClientsWithUnbilledTimeEntries();

    // ==================== TENANT-FILTERED METHODS ====================

    Page<Client> findByOrganizationId(Long organizationId, Pageable pageable);

    List<Client> findByOrganizationId(Long organizationId);

    @Query("SELECT c FROM Client c WHERE c.organizationId = :orgId AND c.name LIKE CONCAT('%', :name, '%')")
    Page<Client> findByOrganizationIdAndNameContaining(@Param("orgId") Long organizationId,
                                                       @Param("name") String name,
                                                       Pageable pageable);

    @Query("SELECT c FROM Client c WHERE c.organizationId = :orgId AND c.email = :email")
    List<Client> findByOrganizationIdAndEmail(@Param("orgId") Long organizationId,
                                              @Param("email") String email);

    @Query("SELECT c FROM Client c WHERE c.organizationId = :orgId AND c.userId = :userId")
    Client findByOrganizationIdAndUserId(@Param("orgId") Long organizationId,
                                         @Param("userId") Long userId);

    long countByOrganizationId(Long organizationId);

    @Query("SELECT DISTINCT c FROM Client c " +
           "JOIN LegalCase lc ON c.name = lc.clientName " +
           "JOIN TimeEntry te ON lc.id = te.legalCaseId " +
           "WHERE c.organizationId = :orgId AND te.billable = true AND te.invoiceId IS NULL " +
           "ORDER BY c.name")
    List<Client> findClientsWithUnbilledTimeEntriesByOrganization(@Param("orgId") Long organizationId);
}
