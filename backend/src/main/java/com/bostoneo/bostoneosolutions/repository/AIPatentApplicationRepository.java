package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.AIPatentApplication;
import com.bostoneo.bostoneosolutions.enumeration.PatentType;
import com.bostoneo.bostoneosolutions.enumeration.PatentStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface AIPatentApplicationRepository extends JpaRepository<AIPatentApplication, Long> {
    
    List<AIPatentApplication> findByClientIdOrderByCreatedAtDesc(Long clientId);
    
    Page<AIPatentApplication> findByPatentType(PatentType patentType, Pageable pageable);
    
    Page<AIPatentApplication> findByStatus(PatentStatus status, Pageable pageable);
    
    List<AIPatentApplication> findByPatentType(PatentType patentType);
    
    List<AIPatentApplication> findByStatus(PatentStatus status);
    
    List<AIPatentApplication> findByTitleContainingIgnoreCase(String title);
    
    List<AIPatentApplication> findByApplicationNumberContaining(String applicationNumber);

    // ==================== TENANT-FILTERED METHODS (SECURITY CRITICAL) ====================

    /**
     * SECURITY: Find all patent applications for an organization (tenant isolation)
     */
    List<AIPatentApplication> findByOrganizationId(Long organizationId);

    /**
     * SECURITY: Find patent application by ID within organization (tenant isolation)
     */
    java.util.Optional<AIPatentApplication> findByIdAndOrganizationId(Long id, Long organizationId);

    /**
     * SECURITY: Find by patent type within organization
     */
    Page<AIPatentApplication> findByPatentTypeAndOrganizationId(PatentType patentType, Long organizationId, Pageable pageable);

    /**
     * SECURITY: Find by status within organization
     */
    Page<AIPatentApplication> findByStatusAndOrganizationId(PatentStatus status, Long organizationId, Pageable pageable);

    /**
     * SECURITY: Find by client ID within organization
     */
    List<AIPatentApplication> findByClientIdAndOrganizationIdOrderByCreatedAtDesc(Long clientId, Long organizationId);
}