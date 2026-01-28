package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.InvoiceTemplate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface InvoiceTemplateRepository extends JpaRepository<InvoiceTemplate, Long> {
    
    Optional<InvoiceTemplate> findByName(String name);
    
    Optional<InvoiceTemplate> findByIsDefaultTrue();
    
    Page<InvoiceTemplate> findByIsActiveTrue(Pageable pageable);
    
    List<InvoiceTemplate> findByIsActiveTrueOrderByName();
    
    @Query("SELECT t FROM InvoiceTemplate t WHERE t.isActive = true AND (t.name LIKE %?1% OR t.description LIKE %?1%)")
    Page<InvoiceTemplate> searchActiveTemplates(String searchTerm, Pageable pageable);
    
    boolean existsByNameAndIdNot(String name, Long id);

    // ==================== TENANT-FILTERED METHODS ====================

    Page<InvoiceTemplate> findByOrganizationId(Long organizationId, Pageable pageable);

    List<InvoiceTemplate> findByOrganizationId(Long organizationId);

    Optional<InvoiceTemplate> findByIdAndOrganizationId(Long id, Long organizationId);

    boolean existsByIdAndOrganizationId(Long id, Long organizationId);

    Optional<InvoiceTemplate> findByOrganizationIdAndName(Long organizationId, String name);

    Optional<InvoiceTemplate> findByOrganizationIdAndIsDefaultTrue(Long organizationId);

    Page<InvoiceTemplate> findByOrganizationIdAndIsActiveTrue(Long organizationId, Pageable pageable);

    List<InvoiceTemplate> findByOrganizationIdAndIsActiveTrueOrderByName(Long organizationId);

    boolean existsByOrganizationIdAndNameAndIdNot(Long organizationId, String name, Long id);
}