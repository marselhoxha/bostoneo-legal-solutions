package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.enumeration.CaseStatus;
import com.bostoneo.bostoneosolutions.model.LegalCase;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.ListCrudRepository;
import org.springframework.data.repository.PagingAndSortingRepository;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface LegalCaseRepository extends PagingAndSortingRepository<LegalCase, Long>, ListCrudRepository<LegalCase, Long> {
    Optional<LegalCase> findByCaseNumber(String caseNumber);
    
    Page<LegalCase> findByTitleContainingIgnoreCase(String title, Pageable pageable);

    @Query("SELECT c FROM LegalCase c WHERE LOWER(c.clientName) LIKE LOWER(CONCAT('%', :clientName, '%'))")
    Page<LegalCase> findByClientNameContainingIgnoreCase(@Param("clientName") String clientName, Pageable pageable);
    
    Page<LegalCase> findByStatus(CaseStatus status, Pageable pageable);
    
    List<LegalCase> findByStatus(CaseStatus status);
    
    Page<LegalCase> findByType(String type, Pageable pageable);
    
    Page<LegalCase> findByIdIn(List<Long> ids, Pageable pageable);
    
    Page<LegalCase> findAll(Pageable pageable);
    
    @Query("SELECT c FROM LegalCase c WHERE " +
           "(LOWER(c.caseNumber) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(c.title) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(c.clientName) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(c.type) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<LegalCase> searchCases(@Param("search") String search, Pageable pageable);
    
    @Query("SELECT c FROM LegalCase c WHERE " +
           "c.status IN :statuses AND " +
           "(LOWER(c.caseNumber) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(c.title) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(c.clientName) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<LegalCase> searchCasesByStatus(@Param("statuses") List<CaseStatus> statuses, 
                                       @Param("search") String search, 
                                       Pageable pageable);
    
    Page<LegalCase> findByStatusIn(List<CaseStatus> statuses, Pageable pageable);

    // Client portal - find cases by exact client name
    @Query("SELECT c FROM LegalCase c WHERE LOWER(c.clientName) = LOWER(:clientName) ORDER BY c.createdAt DESC")
    Page<LegalCase> findByClientNameIgnoreCase(@Param("clientName") String clientName, Pageable pageable);

    @Query("SELECT c FROM LegalCase c WHERE LOWER(c.clientName) = LOWER(:clientName) ORDER BY c.createdAt DESC")
    List<LegalCase> findAllByClientNameIgnoreCase(@Param("clientName") String clientName);

    // ==================== TENANT-FILTERED METHODS ====================

    Page<LegalCase> findByOrganizationId(Long organizationId, Pageable pageable);

    List<LegalCase> findByOrganizationId(Long organizationId);

    @Query("SELECT c FROM LegalCase c WHERE c.organizationId = :orgId AND " +
           "(LOWER(c.caseNumber) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(c.title) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(c.clientName) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<LegalCase> searchCasesByOrganization(@Param("orgId") Long organizationId,
                                              @Param("search") String search,
                                              Pageable pageable);

    Page<LegalCase> findByOrganizationIdAndStatus(Long organizationId, CaseStatus status, Pageable pageable);

    List<LegalCase> findByOrganizationIdAndStatus(Long organizationId, CaseStatus status);

    Page<LegalCase> findByOrganizationIdAndStatusIn(Long organizationId, List<CaseStatus> statuses, Pageable pageable);

    @Query("SELECT c FROM LegalCase c WHERE c.organizationId = :orgId AND c.status IN :statuses AND " +
           "(LOWER(c.caseNumber) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(c.title) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(c.clientName) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<LegalCase> searchCasesByOrganizationAndStatus(@Param("orgId") Long organizationId,
                                                       @Param("statuses") List<CaseStatus> statuses,
                                                       @Param("search") String search,
                                                       Pageable pageable);

    long countByOrganizationId(Long organizationId);

    long countByOrganizationIdAndStatus(Long organizationId, CaseStatus status);
} 