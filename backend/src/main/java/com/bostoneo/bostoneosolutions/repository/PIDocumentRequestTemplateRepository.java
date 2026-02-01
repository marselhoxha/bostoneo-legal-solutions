package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.PIDocumentRequestTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository for PI Document Request Template entities.
 */
@Repository
public interface PIDocumentRequestTemplateRepository extends JpaRepository<PIDocumentRequestTemplate, Long> {

    /**
     * Find all templates for an organization (including system templates)
     */
    @Query("SELECT t FROM PIDocumentRequestTemplate t WHERE (t.organizationId = :orgId OR t.organizationId IS NULL) " +
           "AND t.isActive = true ORDER BY t.isSystem DESC, t.templateName ASC")
    List<PIDocumentRequestTemplate> findActiveTemplates(@Param("orgId") Long organizationId);

    /**
     * Find templates by document type
     */
    @Query("SELECT t FROM PIDocumentRequestTemplate t WHERE (t.organizationId = :orgId OR t.organizationId IS NULL) " +
           "AND t.documentType = :docType AND t.isActive = true ORDER BY t.isSystem DESC, t.templateName ASC")
    List<PIDocumentRequestTemplate> findByDocumentType(
            @Param("orgId") Long organizationId,
            @Param("docType") String documentType);

    /**
     * Find templates by recipient type
     */
    @Query("SELECT t FROM PIDocumentRequestTemplate t WHERE (t.organizationId = :orgId OR t.organizationId IS NULL) " +
           "AND t.recipientType = :recipientType AND t.isActive = true ORDER BY t.isSystem DESC, t.templateName ASC")
    List<PIDocumentRequestTemplate> findByRecipientType(
            @Param("orgId") Long organizationId,
            @Param("recipientType") String recipientType);

    /**
     * Find a template by code (org-specific first, then system)
     */
    @Query("SELECT t FROM PIDocumentRequestTemplate t WHERE t.templateCode = :code " +
           "AND (t.organizationId = :orgId OR t.organizationId IS NULL) " +
           "AND t.isActive = true ORDER BY t.organizationId DESC NULLS LAST")
    List<PIDocumentRequestTemplate> findByTemplateCode(
            @Param("orgId") Long organizationId,
            @Param("code") String templateCode);

    /**
     * Find system templates only
     */
    List<PIDocumentRequestTemplate> findByIsSystemTrueAndIsActiveTrue();

    /**
     * Find organization-specific templates only
     */
    List<PIDocumentRequestTemplate> findByOrganizationIdAndIsSystemFalseAndIsActiveTrue(Long organizationId);

    /**
     * Check if template code exists for organization
     */
    boolean existsByOrganizationIdAndTemplateCode(Long organizationId, String templateCode);

    /**
     * Find template by ID and organization (for security)
     */
    @Query("SELECT t FROM PIDocumentRequestTemplate t WHERE t.id = :id AND (t.organizationId = :orgId OR t.organizationId IS NULL)")
    Optional<PIDocumentRequestTemplate> findByIdAndOrganization(@Param("id") Long id, @Param("orgId") Long organizationId);
}
