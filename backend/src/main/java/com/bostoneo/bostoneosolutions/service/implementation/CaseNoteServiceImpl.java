package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.dto.CaseNoteDTO;
import com.bostoneo.bostoneosolutions.dto.CreateCaseNoteRequest;
import com.bostoneo.bostoneosolutions.dto.UpdateCaseNoteRequest;
import com.bostoneo.bostoneosolutions.dto.UserDTO;
import com.bostoneo.bostoneosolutions.exception.ResourceNotFoundException;
import com.bostoneo.bostoneosolutions.model.CaseNote;
import com.bostoneo.bostoneosolutions.repository.CaseNoteRepository;
import com.bostoneo.bostoneosolutions.service.CaseNoteService;
import com.bostoneo.bostoneosolutions.service.LegalCaseService;
import com.bostoneo.bostoneosolutions.service.UserService;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@Transactional
@RequiredArgsConstructor
@Slf4j
public class CaseNoteServiceImpl implements CaseNoteService {

    private final LegalCaseService legalCaseService;
    private final UserService userService;
    private final CaseNoteRepository caseNoteRepository;
    private final TenantService tenantService;

    /**
     * Get the current organization ID from tenant context.
     */
    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    @Override
    public List<CaseNoteDTO> getNotesByCaseId(Long caseId) {
        Long orgId = getRequiredOrganizationId();
        log.info("Getting notes for case ID: {}", caseId);
        
        // Verify case exists
        try {
            legalCaseService.getCase(caseId);
        } catch (Exception e) {
            log.error("Error verifying case existence: {}", e.getMessage());
            throw e;
        }
        
        // Get notes from repository with tenant filtering
        try {
            List<CaseNote> notes = caseNoteRepository.findByCaseIdAndOrganizationIdOrderByCreatedAtDesc(caseId, orgId);
            log.info("Retrieved {} notes from database for case ID: {}", notes.size(), caseId);
            
            // Convert to DTOs
            List<CaseNoteDTO> noteDTOs = notes.stream()
                    .map(this::mapToDTO)
                    .collect(Collectors.toList());
            
            log.info("Returning {} note DTOs", noteDTOs.size());
            return noteDTOs;
        } catch (Exception e) {
            log.error("Error retrieving notes from database: {}", e.getMessage(), e);
            throw e;
        }
    }

    @Override
    public CaseNoteDTO getNoteById(Long caseId, Long noteId) {
        log.info("Getting note ID: {} for case ID: {}", noteId, caseId);
        Long orgId = getRequiredOrganizationId();

        // Verify case exists
        legalCaseService.getCase(caseId);

        // SECURITY: Get note from repository with tenant filtering
        CaseNote note = caseNoteRepository.findByCaseIdAndIdAndOrganizationId(caseId, noteId, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Note not found with ID: " + noteId));

        // Convert to DTO
        return mapToDTO(note);
    }

    @Override
    public CaseNoteDTO createNote(CreateCaseNoteRequest request) {
        log.info("Creating note for case ID: {}", request.getCaseId());
        log.info("Request details: {}", request);
        Long orgId = getRequiredOrganizationId();

        // Verify case exists
        legalCaseService.getCase(request.getCaseId());

        // Create new note entity with organization context
        CaseNote note = new CaseNote();
        note.setOrganizationId(orgId);  // SECURITY: Set organization context
        note.setCaseId(request.getCaseId());
        note.setUserId(request.getUserId());
        note.setTitle(request.getTitle());
        note.setContent(request.getContent());
        note.setIsPrivate(request.getPrivateNote() != null ? request.getPrivateNote() : false);
        note.setCreatedAt(LocalDateTime.now());
        note.setUpdatedAt(LocalDateTime.now());
        
        // Save to repository
        try {
            CaseNote savedNote = caseNoteRepository.save(note);
            log.info("Note saved successfully with ID: {}", savedNote.getId());
            
            // Convert to DTO with user info
            CaseNoteDTO noteDTO = mapToDTO(savedNote);

            // Add user information if available
            try {
                if (request.getUserId() != null) {
                    UserDTO user = userService.getUserById(request.getUserId());
                    noteDTO.setUser(user);
                }
            } catch (Exception e) {
                log.warn("Could not fetch user information for note creator: {}", e.getMessage());
            }

            return noteDTO;
        } catch (Exception e) {
            log.error("Error saving note to database: {}", e.getMessage(), e);
            throw e;
        }
    }

    @Override
    public CaseNoteDTO updateNote(Long caseId, Long noteId, UpdateCaseNoteRequest request) {
        log.info("Updating note ID: {} for case ID: {}", noteId, caseId);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Get the existing note with tenant filtering
        CaseNote note = caseNoteRepository.findByCaseIdAndIdAndOrganizationId(caseId, noteId, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Note not found with ID: " + noteId));
        
        // Update fields if provided
        if (request.getTitle() != null) {
            note.setTitle(request.getTitle());
        }
        
        if (request.getContent() != null) {
            note.setContent(request.getContent());
        }
        
        if (request.getPrivateNote() != null) {
            note.setIsPrivate(request.getPrivateNote());
        }
        
        // Set update metadata
        note.setUpdatedAt(LocalDateTime.now());
        note.setUpdatedBy(request.getUserId());
        
        // Save the updated note
        CaseNote updatedNote = caseNoteRepository.save(note);
        
        // Convert to DTO
        CaseNoteDTO noteDTO = mapToDTO(updatedNote);
        
        // Add user information if available
        try {
            if (request.getUserId() != null) {
                UserDTO user = userService.getUserById(request.getUserId());
                noteDTO.setUser(user);
            }
        } catch (Exception e) {
            log.warn("Could not fetch user information for note updater: {}", e.getMessage());
        }
        
        return noteDTO;
    }

    @Override
    public void deleteNote(Long caseId, Long noteId) {
        log.info("Deleting note ID: {} for case ID: {}", noteId, caseId);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Verify note exists with tenant filtering
        CaseNote note = caseNoteRepository.findByCaseIdAndIdAndOrganizationId(caseId, noteId, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Note not found with ID: " + noteId));

        // Delete from repository
        caseNoteRepository.delete(note);
        log.info("Note deleted successfully");
    }
    
    /**
     * Map entity to DTO
     */
    private CaseNoteDTO mapToDTO(CaseNote note) {
        CaseNoteDTO dto = new CaseNoteDTO();
        BeanUtils.copyProperties(note, dto);
        
        // Handle specific mappings
        dto.setPrivate(note.getIsPrivate());
        
        // Try to add user information if available
        try {
            if (note.getUserId() != null) {
                UserDTO user = userService.getUserById(note.getUserId());
                dto.setUser(user);
            }
        } catch (Exception e) {
            log.warn("Could not fetch user information for note: {}", e.getMessage());
        }
        
        return dto;
    }
} 