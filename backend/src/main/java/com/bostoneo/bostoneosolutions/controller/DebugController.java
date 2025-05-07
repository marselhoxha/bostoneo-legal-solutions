package com.***REMOVED***.***REMOVED***solutions.controller;

import com.***REMOVED***.***REMOVED***solutions.dto.CaseNoteDTO;
import com.***REMOVED***.***REMOVED***solutions.dto.CreateCaseNoteRequest;
import com.***REMOVED***.***REMOVED***solutions.model.CaseNote;
import com.***REMOVED***.***REMOVED***solutions.repository.CaseNoteRepository;
import com.***REMOVED***.***REMOVED***solutions.service.CaseNoteService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/debug")
@RequiredArgsConstructor
@Slf4j
public class DebugController {

    private final CaseNoteRepository caseNoteRepository;
    private final CaseNoteService caseNoteService;

    @GetMapping("/ping")
    public ResponseEntity<Map<String, Object>> ping() {
        Map<String, Object> response = new HashMap<>();
        response.put("timestamp", LocalDateTime.now().toString());
        response.put("status", "UP");
        response.put("message", "Debug controller is working");
        return ResponseEntity.ok(response);
    }

    @GetMapping("/notes")
    public ResponseEntity<List<CaseNote>> getAllNotes() {
        log.info("Debug: Getting all notes");
        List<CaseNote> notes = caseNoteRepository.findAll();
        log.info("Debug: Found {} notes total", notes.size());
        return ResponseEntity.ok(notes);
    }

    @GetMapping("/notes/case/{caseId}")
    public ResponseEntity<List<CaseNote>> getNotesByCaseId(@PathVariable Long caseId) {
        log.info("Debug: Getting notes for case ID: {}", caseId);
        List<CaseNote> notes = caseNoteRepository.findByCaseIdOrderByCreatedAtDesc(caseId);
        log.info("Debug: Found {} notes for case ID: {}", notes.size(), caseId);
        return ResponseEntity.ok(notes);
    }

    @PostMapping("/notes/create")
    public ResponseEntity<CaseNote> createTestNote() {
        log.info("Debug: Creating test note");
        
        CaseNote note = new CaseNote();
        note.setCaseId(1L); // Assuming case ID 1 exists
        note.setTitle("Test Note");
        note.setContent("This is a test note created by the debug controller");
        note.setIsPrivate(false);
        note.setCreatedAt(LocalDateTime.now());
        note.setUpdatedAt(LocalDateTime.now());
        
        CaseNote savedNote = caseNoteRepository.save(note);
        log.info("Debug: Created test note with ID: {}", savedNote.getId());
        
        return ResponseEntity.ok(savedNote);
    }
    
    @PostMapping("/notes/create-with-service")
    public ResponseEntity<CaseNoteDTO> createTestNoteWithService() {
        log.info("Debug: Creating test note using service");
        
        CreateCaseNoteRequest request = new CreateCaseNoteRequest();
        request.setCaseId(1L); // Assuming case ID 1 exists
        request.setUserId(1L); // Assuming user ID 1 exists
        request.setTitle("Test Note via Service");
        request.setContent("This is a test note created by the debug controller using the service");
        request.setPrivateNote(false);
        
        CaseNoteDTO savedNote = caseNoteService.createNote(request);
        log.info("Debug: Created test note with ID: {} using service", savedNote.getId());
        
        return ResponseEntity.ok(savedNote);
    }
    
    @PostMapping("/notes/create-with-service-private")
    public ResponseEntity<CaseNoteDTO> createTestPrivateNoteWithService() {
        log.info("Debug: Creating private test note using service");
        
        CreateCaseNoteRequest request = new CreateCaseNoteRequest();
        request.setCaseId(1L); // Assuming case ID 1 exists
        request.setUserId(1L); // Assuming user ID 1 exists
        request.setTitle("Private Test Note via Service");
        request.setContent("This is a private test note created by the debug controller using the service");
        request.setPrivateNote(true);
        
        CaseNoteDTO savedNote = caseNoteService.createNote(request);
        log.info("Debug: Created private test note with ID: {} using service, isPrivate: {}", 
                savedNote.getId(), savedNote.isPrivate());
        
        return ResponseEntity.ok(savedNote);
    }
    
    @GetMapping("/notes/test-deserialization")
    public ResponseEntity<Map<String, Object>> testDeserialization() {
        log.info("Debug: Testing JSON field handling");
        
        Map<String, Object> response = new HashMap<>();
        
        // Create a DTO with specific field values
        CaseNoteDTO dto = new CaseNoteDTO();
        dto.setId(999L);
        dto.setTitle("Test Serialization");
        dto.setContent("Testing JSON field handling");
        dto.setPrivate(true);
        
        // Add the DTO to the response to see how it's serialized
        response.put("noteDto", dto);
        response.put("dtoIsPrivateValue", dto.isPrivate());
        
        // Create a Note entity with similar field values
        CaseNote entity = new CaseNote();
        entity.setId(888L);
        entity.setTitle("Test Entity Serialization");
        entity.setContent("Testing entity JSON field handling");
        entity.setIsPrivate(true);
        
        // Add the entity to the response to see how it's serialized
        response.put("noteEntity", entity);
        response.put("entityIsPrivateValue", entity.getIsPrivate());
        
        log.info("Debug: Completed JSON field test");
        return ResponseEntity.ok(response);
    }
} 