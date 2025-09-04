package com.***REMOVED***.***REMOVED***solutions.resource;

import com.***REMOVED***.***REMOVED***solutions.dto.ConflictCheckDTO;
import com.***REMOVED***.***REMOVED***solutions.dtomapper.ConflictCheckDTOMapper;
import com.***REMOVED***.***REMOVED***solutions.model.ConflictCheck;
import com.***REMOVED***.***REMOVED***solutions.service.ConflictCheckService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/conflict-checks")
@RequiredArgsConstructor
@Slf4j
public class ConflictCheckResource {

    private final ConflictCheckService conflictCheckService;
    private final ConflictCheckDTOMapper conflictCheckMapper;

    // Basic CRUD operations
    @GetMapping
    public ResponseEntity<Page<ConflictCheckDTO>> getAllConflictChecks(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String entityType,
            @RequestParam(required = false) Long entityId,
            @RequestParam(required = false) String checkType) {
        
        log.info("Fetching conflict checks - page: {}, size: {}, status: {}", page, size, status);
        
        Sort.Direction direction = "desc".equalsIgnoreCase(sortDir) ? Sort.Direction.DESC : Sort.Direction.ASC;
        Pageable pageable = PageRequest.of(page, size, Sort.by(direction, sortBy));
        
        Page<ConflictCheck> conflictChecks;
        
        if (status != null) {
            List<ConflictCheck> checks = conflictCheckService.findByStatus(status);
            conflictChecks = new PageImpl<>(checks, pageable, checks.size());
        } else if (entityType != null && entityId != null) {
            List<ConflictCheck> checks = conflictCheckService.findByEntityTypeAndEntityId(entityType, entityId);
            conflictChecks = new PageImpl<>(checks, pageable, checks.size());
        } else if (checkType != null) {
            List<ConflictCheck> checks = conflictCheckService.findByCheckType(checkType);
            conflictChecks = new PageImpl<>(checks, pageable, checks.size());
        } else {
            conflictChecks = conflictCheckService.findAll(pageable);
        }
        
        Page<ConflictCheckDTO> conflictCheckDTOs = conflictChecks.map(conflictCheckMapper::toDTO);
        
        return ResponseEntity.ok(conflictCheckDTOs);
    }

    @GetMapping("/{id}")
    public ResponseEntity<ConflictCheckDTO> getConflictCheckById(@PathVariable Long id) {
        log.info("Fetching conflict check with ID: {}", id);
        
        ConflictCheck conflictCheck = conflictCheckService.findById(id)
                .orElseThrow(() -> new RuntimeException("ConflictCheck not found with ID: " + id));
        
        ConflictCheckDTO conflictCheckDTO = conflictCheckMapper.toDTO(conflictCheck);
        
        return ResponseEntity.ok(conflictCheckDTO);
    }

    @PutMapping("/{id}")
    public ResponseEntity<ConflictCheckDTO> updateConflictCheck(
            @PathVariable Long id,
            @RequestBody @Valid ConflictCheckDTO conflictCheckDTO,
            @AuthenticationPrincipal UserDetails userDetails) {
        
        log.info("Updating conflict check {} by user: {}", id, userDetails.getUsername());
        
        ConflictCheck conflictCheck = conflictCheckMapper.toEntity(conflictCheckDTO);
        conflictCheck.setId(id);
        
        ConflictCheck updatedConflictCheck = conflictCheckService.save(conflictCheck);
        ConflictCheckDTO updatedDTO = conflictCheckMapper.toDTO(updatedConflictCheck);
        
        return ResponseEntity.ok(updatedDTO);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> deleteConflictCheck(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {
        
        log.info("Deleting conflict check {} by user: {}", id, userDetails.getUsername());
        
        conflictCheckService.deleteById(id);
        
        return ResponseEntity.ok(Map.of(
            "success", "true",
            "message", "ConflictCheck deleted successfully"
        ));
    }

    // Conflict checking operations
    @PostMapping("/check-client")
    public ResponseEntity<ConflictCheckDTO> performClientConflictCheck(
            @RequestParam Long leadId,
            @RequestBody Map<String, Object> clientData,
            @AuthenticationPrincipal UserDetails userDetails) {
        
        log.info("Performing client conflict check for lead {} by user: {}", leadId, userDetails.getUsername());
        
        ConflictCheck conflictCheck = conflictCheckService.performClientConflictCheck(leadId, clientData);
        ConflictCheckDTO conflictCheckDTO = conflictCheckMapper.toDTO(conflictCheck);
        
        return ResponseEntity.ok(conflictCheckDTO);
    }

    @PostMapping("/check-matter")
    public ResponseEntity<ConflictCheckDTO> performMatterConflictCheck(
            @RequestParam Long leadId,
            @RequestBody Map<String, Object> matterData,
            @AuthenticationPrincipal UserDetails userDetails) {
        
        log.info("Performing matter conflict check for lead {} by user: {}", leadId, userDetails.getUsername());
        
        ConflictCheck conflictCheck = conflictCheckService.performMatterConflictCheck(leadId, matterData);
        ConflictCheckDTO conflictCheckDTO = conflictCheckMapper.toDTO(conflictCheck);
        
        return ResponseEntity.ok(conflictCheckDTO);
    }

    @PostMapping("/check-full")
    public ResponseEntity<ConflictCheckDTO> performFullConflictCheck(
            @RequestParam Long leadId,
            @RequestBody Map<String, Object> conversionData,
            @AuthenticationPrincipal UserDetails userDetails) {
        
        log.info("Performing full conflict check for lead {} by user: {}", leadId, userDetails.getUsername());
        
        @SuppressWarnings("unchecked")
        Map<String, Object> clientData = (Map<String, Object>) conversionData.get("clientData");
        @SuppressWarnings("unchecked")
        Map<String, Object> matterData = (Map<String, Object>) conversionData.get("matterData");
        
        ConflictCheck conflictCheck = conflictCheckService.performFullConflictCheck(leadId, clientData, matterData);
        ConflictCheckDTO conflictCheckDTO = conflictCheckMapper.toDTO(conflictCheck);
        
        return ResponseEntity.ok(conflictCheckDTO);
    }

    // Conflict resolution operations
    @PostMapping("/{id}/review")
    public ResponseEntity<ConflictCheckDTO> reviewConflictCheck(
            @PathVariable Long id,
            @RequestBody Map<String, String> reviewData,
            @AuthenticationPrincipal UserDetails userDetails) {
        
        String resolution = reviewData.get("resolution");
        String notes = reviewData.get("notes");
        
        log.info("Reviewing conflict check {} with resolution: {} by user: {}", 
                id, resolution, userDetails.getUsername());
        
        Long userId = 1L; // Extract from userDetails in real implementation
        ConflictCheck conflictCheck = conflictCheckService.reviewConflictCheck(id, userId, resolution, notes);
        ConflictCheckDTO conflictCheckDTO = conflictCheckMapper.toDTO(conflictCheck);
        
        return ResponseEntity.ok(conflictCheckDTO);
    }

    @PostMapping("/{id}/resolve")
    public ResponseEntity<ConflictCheckDTO> resolveConflict(
            @PathVariable Long id,
            @RequestBody Map<String, String> resolutionData,
            @AuthenticationPrincipal UserDetails userDetails) {
        
        String resolution = resolutionData.get("resolution");
        String notes = resolutionData.get("resolutionNotes");
        String waiverDocumentPath = resolutionData.get("waiverDocumentPath");
        
        log.info("Resolving conflict check {} by user: {}", id, userDetails.getUsername());
        
        Long userId = 1L; // Extract from userDetails in real implementation
        ConflictCheck conflictCheck = conflictCheckService.resolveConflict(id, userId, resolution, notes, waiverDocumentPath);
        ConflictCheckDTO conflictCheckDTO = conflictCheckMapper.toDTO(conflictCheck);
        
        return ResponseEntity.ok(conflictCheckDTO);
    }

    // Query operations
    @GetMapping("/pending")
    public ResponseEntity<List<ConflictCheckDTO>> getPendingConflictChecks() {
        log.info("Fetching pending conflict checks");
        
        List<ConflictCheck> pendingChecks = conflictCheckService.findPendingConflictChecks();
        List<ConflictCheckDTO> pendingCheckDTOs = pendingChecks.stream()
                .map(conflictCheckMapper::toDTO)
                .collect(Collectors.toList());
        
        return ResponseEntity.ok(pendingCheckDTOs);
    }

    @GetMapping("/unresolved")
    public ResponseEntity<List<ConflictCheckDTO>> getUnresolvedConflicts() {
        log.info("Fetching unresolved conflicts");
        
        List<ConflictCheck> unresolvedConflicts = conflictCheckService.findUnresolvedConflicts();
        List<ConflictCheckDTO> unresolvedConflictDTOs = unresolvedConflicts.stream()
                .map(conflictCheckMapper::toDTO)
                .collect(Collectors.toList());
        
        return ResponseEntity.ok(unresolvedConflictDTOs);
    }

    @GetMapping("/expired")
    public ResponseEntity<List<ConflictCheckDTO>> getExpiredConflictChecks() {
        log.info("Fetching expired conflict checks");
        
        List<ConflictCheck> expiredChecks = conflictCheckService.findExpiredConflictChecks();
        List<ConflictCheckDTO> expiredCheckDTOs = expiredChecks.stream()
                .map(conflictCheckMapper::toDTO)
                .collect(Collectors.toList());
        
        return ResponseEntity.ok(expiredCheckDTOs);
    }

    @GetMapping("/entity/{entityType}/{entityId}/can-proceed")
    public ResponseEntity<Map<String, Object>> canProceedWithConversion(
            @PathVariable String entityType,
            @PathVariable Long entityId) {
        
        log.info("Checking if conversion can proceed for entity: {} with ID: {}", entityType, entityId);
        
        boolean hasUnresolved = conflictCheckService.hasUnresolvedConflicts(entityType, entityId);
        boolean canProceed = conflictCheckService.canProceedWithConversion(entityType, entityId);
        
        List<ConflictCheck> allChecks = conflictCheckService.findByEntityTypeAndEntityId(entityType, entityId);
        List<ConflictCheckDTO> allCheckDTOs = allChecks.stream()
                .map(conflictCheckMapper::toDTO)
                .collect(Collectors.toList());
        
        return ResponseEntity.ok(Map.of(
            "canProceed", canProceed,
            "hasUnresolvedConflicts", hasUnresolved,
            "conflictChecks", allCheckDTOs,
            "totalChecks", allChecks.size()
        ));
    }

    // Analytics operations
    @GetMapping("/analytics/status-stats")
    public ResponseEntity<Map<String, Long>> getConflictCheckStatsByStatus() {
        log.info("Fetching conflict check statistics by status");
        
        Map<String, Long> stats = conflictCheckService.getConflictCheckStatsByStatus();
        
        return ResponseEntity.ok(stats);
    }

    @GetMapping("/analytics/type-stats")
    public ResponseEntity<Map<String, Long>> getConflictCheckStatsByType() {
        log.info("Fetching conflict check statistics by type");
        
        Map<String, Long> stats = conflictCheckService.getConflictCheckStatsByType();
        
        return ResponseEntity.ok(stats);
    }

    @GetMapping("/analytics/recent")
    public ResponseEntity<List<ConflictCheckDTO>> getRecentConflictChecks(
            @RequestParam(defaultValue = "10") int limit) {
        
        log.info("Fetching {} recent conflict checks", limit);
        
        List<ConflictCheck> recentChecks = conflictCheckService.getRecentConflictChecks(limit);
        List<ConflictCheckDTO> recentCheckDTOs = recentChecks.stream()
                .map(conflictCheckMapper::toDTO)
                .collect(Collectors.toList());
        
        return ResponseEntity.ok(recentCheckDTOs);
    }
}