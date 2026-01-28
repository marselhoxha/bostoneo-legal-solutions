package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.CaseNote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CaseNoteRepository extends JpaRepository<CaseNote, Long> {
    /**
     * Find all notes for a specific case
     * @param caseId The case ID
     * @return List of notes
     */
    List<CaseNote> findByCaseIdOrderByCreatedAtDesc(Long caseId);
    
    /**
     * Find a specific note by case ID and note ID
     * @param caseId The case ID
     * @param id The note ID
     * @return Note if found
     */
    Optional<CaseNote> findByCaseIdAndId(Long caseId, Long id);
    
    /**
     * Delete all notes for a specific case
     * @param caseId The case ID
     */
    void deleteByCaseId(Long caseId);

    // ========== TENANT-FILTERED METHODS (SECURE) ==========

    /**
     * Find all notes for a specific case with organization filtering
     */
    List<CaseNote> findByCaseIdAndOrganizationIdOrderByCreatedAtDesc(Long caseId, Long organizationId);

    /**
     * Find a specific note by case ID, note ID and organization ID
     */
    Optional<CaseNote> findByCaseIdAndIdAndOrganizationId(Long caseId, Long id, Long organizationId);

    /**
     * Find a specific note by ID and organization ID
     */
    Optional<CaseNote> findByIdAndOrganizationId(Long id, Long organizationId);

    /**
     * Delete all notes for a specific case within organization
     */
    void deleteByCaseIdAndOrganizationId(Long caseId, Long organizationId);
} 