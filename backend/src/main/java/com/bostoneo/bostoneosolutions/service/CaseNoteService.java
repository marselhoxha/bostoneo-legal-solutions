package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.CaseNoteDTO;
import com.bostoneo.bostoneosolutions.dto.CreateCaseNoteRequest;
import com.bostoneo.bostoneosolutions.dto.UpdateCaseNoteRequest;

import java.util.List;

public interface CaseNoteService {
    
    /**
     * Get all notes for a specific case
     * 
     * @param caseId the ID of the case
     * @return list of case notes
     */
    List<CaseNoteDTO> getNotesByCaseId(Long caseId);
    
    /**
     * Get a specific note by ID
     * 
     * @param caseId the ID of the case
     * @param noteId the ID of the note
     * @return the case note
     */
    CaseNoteDTO getNoteById(Long caseId, Long noteId);
    
    /**
     * Create a new note for a case
     * 
     * @param request the note creation request
     * @return the created case note
     */
    CaseNoteDTO createNote(CreateCaseNoteRequest request);
    
    /**
     * Update an existing note
     * 
     * @param caseId the ID of the case
     * @param noteId the ID of the note
     * @param request the note update request
     * @return the updated case note
     */
    CaseNoteDTO updateNote(Long caseId, Long noteId, UpdateCaseNoteRequest request);
    
    /**
     * Delete a note
     * 
     * @param caseId the ID of the case
     * @param noteId the ID of the note
     */
    void deleteNote(Long caseId, Long noteId);
} 