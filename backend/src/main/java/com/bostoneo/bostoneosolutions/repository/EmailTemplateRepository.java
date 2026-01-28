package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.EmailTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EmailTemplateRepository extends JpaRepository<EmailTemplate, Long> {

    List<EmailTemplate> findByEventType(String eventType);

    Optional<EmailTemplate> findByName(String name);

    @Query("SELECT e FROM EmailTemplate e WHERE e.eventType = ?1 AND e.isDefault = true AND e.isActive = true")
    Optional<EmailTemplate> findDefaultTemplateForEventType(String eventType);

    List<EmailTemplate> findByIsActiveTrue();

    // ==================== TENANT-FILTERED METHODS ====================

    List<EmailTemplate> findByOrganizationId(Long organizationId);

    List<EmailTemplate> findByOrganizationIdAndIsActiveTrue(Long organizationId);

    Optional<EmailTemplate> findByIdAndOrganizationId(Long id, Long organizationId);

    Optional<EmailTemplate> findByNameAndOrganizationId(String name, Long organizationId);

    List<EmailTemplate> findByEventTypeAndOrganizationId(String eventType, Long organizationId);

    @Query("SELECT e FROM EmailTemplate e WHERE e.eventType = ?1 AND e.organizationId = ?2 AND e.isDefault = true AND e.isActive = true")
    Optional<EmailTemplate> findDefaultTemplateForEventTypeAndOrganizationId(String eventType, Long organizationId);

    boolean existsByIdAndOrganizationId(Long id, Long organizationId);
} 