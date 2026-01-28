package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.DocumentVersion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DocumentVersionRepository extends JpaRepository<DocumentVersion, Long> {
    
    List<DocumentVersion> findByDocumentIdOrderByVersionNumberDesc(Long documentId);
    
    Optional<DocumentVersion> findByDocumentIdAndVersionNumber(Long documentId, Integer versionNumber);
    
    @Query("SELECT MAX(v.versionNumber) FROM DocumentVersion v WHERE v.documentId = ?1")
    Integer findMaxVersionNumberByDocumentId(Long documentId);

    // ========== TENANT-FILTERED METHODS (SECURE) ==========

    @Query("SELECT v FROM DocumentVersion v WHERE v.id = :id AND v.organizationId = :organizationId")
    Optional<DocumentVersion> findByIdAndOrganizationId(@org.springframework.data.repository.query.Param("id") Long id, @org.springframework.data.repository.query.Param("organizationId") Long organizationId);

    @Query("SELECT v FROM DocumentVersion v WHERE v.documentId = :documentId AND v.organizationId = :organizationId ORDER BY v.versionNumber DESC")
    List<DocumentVersion> findByDocumentIdAndOrganizationIdOrderByVersionNumberDesc(@org.springframework.data.repository.query.Param("documentId") Long documentId, @org.springframework.data.repository.query.Param("organizationId") Long organizationId);

    @Query("SELECT MAX(v.versionNumber) FROM DocumentVersion v WHERE v.documentId = :documentId AND v.organizationId = :organizationId")
    Integer findMaxVersionNumberByDocumentIdAndOrganizationId(@org.springframework.data.repository.query.Param("documentId") Long documentId, @org.springframework.data.repository.query.Param("organizationId") Long organizationId);

    /**
     * SECURITY: Find all document versions for an organization (tenant isolation)
     */
    @Query("SELECT v FROM DocumentVersion v WHERE v.organizationId = :organizationId")
    List<DocumentVersion> findByOrganizationId(@org.springframework.data.repository.query.Param("organizationId") Long organizationId);
} 
 
 
 