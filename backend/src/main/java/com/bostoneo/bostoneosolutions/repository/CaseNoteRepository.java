package com.***REMOVED***.***REMOVED***solutions.repository;

import com.***REMOVED***.***REMOVED***solutions.model.CaseNote;
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
} 