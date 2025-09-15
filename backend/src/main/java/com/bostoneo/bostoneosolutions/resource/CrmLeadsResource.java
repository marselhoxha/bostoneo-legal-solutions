package com.bostoneo.bostoneosolutions.resource;

import com.bostoneo.bostoneosolutions.dto.LeadDTO;
import com.bostoneo.bostoneosolutions.dto.LeadConversionResponseDTO;
import com.bostoneo.bostoneosolutions.dtomapper.LeadDTOMapper;
import com.bostoneo.bostoneosolutions.model.Client;
import com.bostoneo.bostoneosolutions.model.Lead;
import com.bostoneo.bostoneosolutions.model.LegalCase;
import com.bostoneo.bostoneosolutions.model.PipelineStage;
import com.bostoneo.bostoneosolutions.service.LeadConversionService;
import com.bostoneo.bostoneosolutions.service.LeadService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/crm/leads")
@RequiredArgsConstructor
@Slf4j
public class CrmLeadsResource {

    private final LeadService leadService;
    private final LeadConversionService leadConversionService;
    private final LeadDTOMapper leadDTOMapper;

    // Lead CRUD and Pipeline Management
    @GetMapping
    public ResponseEntity<Page<LeadDTO>> getAllLeads(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String practiceArea,
            @RequestParam(required = false) Long assignedTo,
            @RequestParam(required = false) String priority) {
        
        log.info("Fetching leads - page: {}, size: {}, status: {}, practiceArea: {}, assignedTo: {}, priority: {}", 
            page, size, status, practiceArea, assignedTo, priority);
        
        Sort.Direction direction = "desc".equalsIgnoreCase(sortDir) ? Sort.Direction.DESC : Sort.Direction.ASC;
        Pageable pageable = PageRequest.of(page, size, Sort.by(direction, sortBy));
        
        Page<Lead> leads;
        
        if (status != null) {
            leads = leadService.findByStatus(status, pageable);
        } else if (assignedTo != null) {
            leads = leadService.findByAssignedTo(assignedTo, pageable);
        } else if (practiceArea != null) {
            leads = leadService.findByPracticeArea(practiceArea, pageable);
        } else {
            leads = leadService.findAll(pageable);
        }
        
        Page<LeadDTO> leadDTOs = leads.map(leadDTOMapper::toDTO);
        
        return ResponseEntity.ok(leadDTOs);
    }

    @GetMapping("/{id}")
    public ResponseEntity<LeadDTO> getLeadById(@PathVariable Long id) {
        log.info("Fetching lead with ID: {}", id);
        
        Lead lead = leadService.findById(id).orElseThrow(() -> 
            new RuntimeException("Lead not found with ID: " + id));
        LeadDTO leadDTO = leadDTOMapper.toDTO(lead);
        
        return ResponseEntity.ok(leadDTO);
    }

    @PutMapping("/{id}")
    public ResponseEntity<LeadDTO> updateLead(
            @PathVariable Long id,
            @RequestBody @Valid LeadDTO leadDTO) {
        
        log.info("Updating lead {}", id);
        
        Long userId = 1L; // Extract from userDetails in real implementation
        Lead lead = leadDTOMapper.toEntity(leadDTO);
        
        Lead updatedLead = leadService.updateLead(id, lead, userId);
        LeadDTO updatedLeadDTO = leadDTOMapper.toDTO(updatedLead);
        
        return ResponseEntity.ok(updatedLeadDTO);
    }

    // Pipeline Management
    @GetMapping("/pipeline/stages")
    public ResponseEntity<List<PipelineStage>> getPipelineStages() {
        log.info("Fetching pipeline stages");
        
        List<PipelineStage> stages = leadService.getAllPipelineStages();
        
        return ResponseEntity.ok(stages);
    }

    @PostMapping("/{id}/pipeline/advance")
    public ResponseEntity<LeadDTO> advanceInPipeline(
            @PathVariable Long id,
            @RequestBody Map<String, Object> pipelineData,
            @AuthenticationPrincipal UserDetails userDetails) {
        
        String newStatus = (String) pipelineData.get("newStatus");
        String notes = (String) pipelineData.get("notes");
        
        log.info("Advancing lead {} to status: {} by user: {}", id, newStatus, userDetails.getUsername());
        
        Long userId = 1L; // Extract from userDetails in real implementation
        Lead lead = leadService.advanceInPipeline(id, newStatus, userId, notes);
        LeadDTO leadDTO = leadDTOMapper.toDTO(lead);
        
        return ResponseEntity.ok(leadDTO);
    }

    @PostMapping("/{id}/pipeline/move-to-stage")
    public ResponseEntity<LeadDTO> moveToStage(
            @PathVariable Long id,
            @RequestBody Map<String, Object> stageData,
            @AuthenticationPrincipal UserDetails userDetails) {
        
        Long stageId = ((Number) stageData.get("stageId")).longValue();
        String notes = (String) stageData.get("notes");
        
        log.info("Moving lead {} to stage {} by user: {}", id, stageId, userDetails.getUsername());
        
        Long userId = 1L; // Extract from userDetails in real implementation
        Lead lead = leadService.moveToStage(id, stageId, userId, notes);
        LeadDTO leadDTO = leadDTOMapper.toDTO(lead);
        
        return ResponseEntity.ok(leadDTO);
    }

    @GetMapping("/pipeline/summary")
    public ResponseEntity<Map<String, Object>> getPipelineSummary() {
        log.info("Fetching pipeline summary");
        
        Map<String, Long> statusCounts = leadService.getLeadCountsByStatus();
        List<Lead> recentlyMoved = leadService.getRecentlyMovedLeads(10);
        List<Lead> staleLeads = leadService.getStaleLeads();
        
        return ResponseEntity.ok(Map.of(
            "statusCounts", statusCounts,
            "recentlyMoved", recentlyMoved.stream().map(leadDTOMapper::toDTO).toList(),
            "staleLeads", staleLeads.stream().map(leadDTOMapper::toDTO).toList(),
            "totalLeads", statusCounts.values().stream().mapToLong(Long::longValue).sum()
        ));
    }

    // Lead Assignment and Management
    @PostMapping("/{id}/assign")
    public ResponseEntity<LeadDTO> assignLead(
            @PathVariable Long id,
            @RequestBody Map<String, Object> assignmentData,
            @AuthenticationPrincipal UserDetails userDetails) {
        
        // Handle both assignedTo (from frontend) and assignToUserId (alternative)
        Long assignToUserId;
        Object assignToValue = assignmentData.get("assignedTo");
        if (assignToValue == null) {
            assignToValue = assignmentData.get("assignToUserId");
        }
        
        if (assignToValue instanceof String) {
            assignToUserId = Long.parseLong((String) assignToValue);
        } else if (assignToValue instanceof Number) {
            assignToUserId = ((Number) assignToValue).longValue();
        } else {
            throw new IllegalArgumentException("Invalid assignedTo value: " + assignToValue);
        }
        
        String notes = (String) assignmentData.get("notes");
        
        // Handle null userDetails gracefully
        String username = userDetails != null ? userDetails.getUsername() : "system";
        log.info("Assigning lead {} to user {} by: {}", id, assignToUserId, username);
        
        Long assignedBy = 1L; // Extract from userDetails in real implementation
        Lead lead = leadService.assignLeadWithNotes(id, assignToUserId, assignedBy, notes);
        LeadDTO leadDTO = leadDTOMapper.toDTO(lead);
        
        return ResponseEntity.ok(leadDTO);
    }

    @PostMapping("/{id}/schedule-consultation")
    public ResponseEntity<LeadDTO> scheduleConsultation(
            @PathVariable Long id,
            @RequestBody Map<String, Object> consultationData,
            @AuthenticationPrincipal UserDetails userDetails) {
        
        // Handle both consultationDate and consultationDateTime from frontend
        String consultationDateStr = (String) consultationData.get("consultationDateTime");
        if (consultationDateStr == null) {
            consultationDateStr = (String) consultationData.get("consultationDate");
        }
        String notes = (String) consultationData.get("notes");
        
        // Handle null userDetails gracefully
        String username = userDetails != null ? userDetails.getUsername() : "system";
        log.info("Scheduling consultation for lead {} on {} by user: {}", 
            id, consultationDateStr, username);
        
        Long scheduledBy = 1L; // Extract from userDetails in real implementation
        Lead lead = leadService.scheduleConsultation(id, consultationDateStr, scheduledBy, notes);
        LeadDTO leadDTO = leadDTOMapper.toDTO(lead);
        
        return ResponseEntity.ok(leadDTO);
    }

    @PostMapping("/{id}/add-activity")
    public ResponseEntity<Map<String, String>> addActivity(
            @PathVariable Long id,
            @RequestBody Map<String, String> activityData,
            @AuthenticationPrincipal UserDetails userDetails) {
        
        String activityType = activityData.get("activityType");
        String title = activityData.get("title");
        String description = activityData.get("description");
        
        log.info("Adding activity to lead {} by user: {}", id, userDetails.getUsername());
        
        Long userId = 1L; // Extract from userDetails in real implementation
        leadService.addActivity(id, activityType, title, description, userId);
        
        return ResponseEntity.ok(Map.of(
            "success", "true",
            "message", "Activity added successfully"
        ));
    }

    // Lead Conversion Endpoints
    @PostMapping("/{id}/convert/client-only")
    public ResponseEntity<LeadConversionResponseDTO> convertToClientOnly(
            @PathVariable Long id,
            @RequestBody Map<String, Object> clientData,
            @AuthenticationPrincipal UserDetails userDetails) {
        
        // Handle null userDetails gracefully
        String username = userDetails != null ? userDetails.getUsername() : "system";
        log.info("Converting lead {} to Client Only by user: {}", id, username);
        
        Long convertedBy = 1L; // Extract from userDetails in real implementation
        
        try {
            Client client = leadConversionService.convertToClientOnly(id, clientData, convertedBy);
            
            return ResponseEntity.ok(LeadConversionResponseDTO.builder()
                .success(true)
                .message("Lead successfully converted to Client Only")
                .leadId(id)
                .clientId(client.getId())
                .conversionType("CLIENT_ONLY")
                .build());
                
        } catch (Exception e) {
            log.error("Failed to convert lead {} to client only", id, e);
            return ResponseEntity.badRequest().body(LeadConversionResponseDTO.builder()
                .success(false)
                .message("Failed to convert lead: " + e.getMessage())
                .leadId(id)
                .conversionType("CLIENT_ONLY")
                .build());
        }
    }

    @PostMapping("/{id}/convert/matter-only")
    public ResponseEntity<LeadConversionResponseDTO> convertToMatterOnly(
            @PathVariable Long id,
            @RequestBody Map<String, Object> caseData,
            @AuthenticationPrincipal UserDetails userDetails) {
        
        // Handle null userDetails gracefully
        String username = userDetails != null ? userDetails.getUsername() : "system";
        log.info("Converting lead {} to Matter Only by user: {}", id, username);
        
        Long convertedBy = 1L; // Extract from userDetails in real implementation
        
        try {
            LegalCase legalCase = leadConversionService.convertToMatterOnly(id, caseData, convertedBy);
            
            return ResponseEntity.ok(LeadConversionResponseDTO.builder()
                .success(true)
                .message("Lead successfully converted to Matter Only")
                .leadId(id)
                .caseId(legalCase.getId())
                .conversionType("MATTER_ONLY")
                .build());
                
        } catch (Exception e) {
            log.error("Failed to convert lead {} to matter only", id, e);
            return ResponseEntity.badRequest().body(LeadConversionResponseDTO.builder()
                .success(false)
                .message("Failed to convert lead: " + e.getMessage())
                .leadId(id)
                .conversionType("MATTER_ONLY")
                .build());
        }
    }

    @PostMapping("/{id}/convert/client-and-matter")
    public ResponseEntity<LeadConversionResponseDTO> convertToClientAndMatter(
            @PathVariable Long id,
            @RequestBody Map<String, Object> conversionData,
            @AuthenticationPrincipal UserDetails userDetails) {
        
        // Handle null userDetails gracefully
        String username = userDetails != null ? userDetails.getUsername() : "system";
        log.info("Converting lead {} to Client AND Matter by user: {}", id, username);
        
        Long convertedBy = 1L; // Extract from userDetails in real implementation
        
        @SuppressWarnings("unchecked")
        Map<String, Object> clientData = (Map<String, Object>) conversionData.get("clientData");
        @SuppressWarnings("unchecked")
        Map<String, Object> caseData = (Map<String, Object>) conversionData.get("caseData");
        
        try {
            LeadConversionService.ConversionResult result = leadConversionService
                .convertToClientAndMatter(id, clientData, caseData, convertedBy);
            
            return ResponseEntity.ok(LeadConversionResponseDTO.builder()
                .success(true)
                .message("Lead successfully converted to Client AND Matter")
                .leadId(id)
                .clientId(result.getClientId())
                .caseId(result.getCaseId())
                .conversionType("CLIENT_AND_MATTER")
                .conversionId(result.getId())
                .build());
                
        } catch (Exception e) {
            log.error("Failed to convert lead {} to client and matter", id, e);
            return ResponseEntity.badRequest().body(LeadConversionResponseDTO.builder()
                .success(false)
                .message("Failed to convert lead: " + e.getMessage())
                .leadId(id)
                .conversionType("CLIENT_AND_MATTER")
                .build());
        }
    }

    @GetMapping("/{id}/conversion/can-convert")
    public ResponseEntity<Map<String, Object>> canConvert(
            @PathVariable Long id,
            @RequestParam String conversionType) {
        
        log.info("Checking if lead {} can be converted to {}", id, conversionType);
        
        boolean canConvert = leadConversionService.canConvertLead(id, conversionType);
        boolean hasConflicts = leadConversionService.hasUnresolvedConflicts(id);
        
        log.info("Conflict check results for lead {}: canConvert={}, hasConflicts={}", id, canConvert, hasConflicts);
        
        Map<String, Object> result = new HashMap<>();
        result.put("canConvert", canConvert);
        result.put("hasConflicts", hasConflicts);
        result.put("conversionType", conversionType);
        result.put("leadId", id);
        
        if (hasConflicts) {
            // Get conflict details
            List<Map<String, Object>> conflicts = leadConversionService.getConflictDetails(id);
            result.put("conflicts", conflicts);
            result.put("reason", "Lead has unresolved conflicts that must be addressed before conversion");
        } else if (!canConvert) {
            // Get reason why conversion is not allowed
            Lead lead = leadService.findById(id).orElse(null);
            String reason = lead == null ? "Lead not found" : 
                "Lead status '" + lead.getStatus() + "' is not eligible for conversion. Must be QUALIFIED, CONSULTATION_SCHEDULED, PROPOSAL_SENT, or NEGOTIATION.";
            result.put("reason", reason);
        }
        
        return ResponseEntity.ok(result);
    }

    @GetMapping("/{id}/conversion/required-fields")
    public ResponseEntity<Map<String, Object>> getRequiredConversionFields(
            @PathVariable Long id,
            @RequestParam String conversionType) {
        
        log.info("Getting required fields for lead {} conversion to {}", id, conversionType);
        
        Map<String, Object> result = new java.util.HashMap<>();
        result.put("conversionType", conversionType);
        result.put("leadId", id);
        
        switch (conversionType.toUpperCase()) {
            case "CLIENT_ONLY":
                result.put("requiredFields", leadConversionService.getRequiredClientFields());
                result.put("optionalFields", leadConversionService.getOptionalClientFields());
                break;
            case "MATTER_ONLY":
                result.put("requiredFields", leadConversionService.getRequiredCaseFields());
                result.put("optionalFields", leadConversionService.getOptionalCaseFields());
                break;
            case "CLIENT_AND_MATTER":
                result.put("requiredClientFields", leadConversionService.getRequiredClientFields());
                result.put("optionalClientFields", leadConversionService.getOptionalClientFields());
                result.put("requiredCaseFields", leadConversionService.getRequiredCaseFields());
                result.put("optionalCaseFields", leadConversionService.getOptionalCaseFields());
                break;
            default:
                return ResponseEntity.badRequest().body(Map.of(
                    "error", "Invalid conversion type: " + conversionType
                ));
        }
        
        return ResponseEntity.ok(result);
    }

    // Analytics and Reporting
    @GetMapping("/analytics/summary")
    public ResponseEntity<Map<String, Object>> getLeadsSummary() {
        log.info("Fetching leads analytics summary");
        
        Map<String, Long> statusCounts = leadService.getLeadCountsByStatus();
        Map<String, Long> practiceAreaCounts = leadService.getLeadCountsByPracticeArea();
        List<Lead> recentLeads = leadService.getRecentLeads(5);
        
        return ResponseEntity.ok(Map.of(
            "statusCounts", statusCounts,
            "practiceAreaCounts", practiceAreaCounts,
            "recentLeads", recentLeads.stream().map(leadDTOMapper::toDTO).toList(),
            "totalActive", statusCounts.getOrDefault("NEW", 0L) + 
                          statusCounts.getOrDefault("CONTACTED", 0L) + 
                          statusCounts.getOrDefault("QUALIFIED", 0L)
        ));
    }

    @GetMapping("/analytics/conversion-rates")
    public ResponseEntity<Map<String, Object>> getConversionRates() {
        log.info("Fetching lead conversion rate analytics");
        
        Map<String, Long> statusCounts = leadService.getLeadCountsByStatus();
        long totalLeads = statusCounts.values().stream().mapToLong(Long::longValue).sum();
        long convertedLeads = statusCounts.getOrDefault("CONVERTED", 0L);
        
        double conversionRate = totalLeads > 0 ? (convertedLeads * 100.0) / totalLeads : 0.0;
        
        return ResponseEntity.ok(Map.of(
            "totalLeads", totalLeads,
            "convertedLeads", convertedLeads,
            "conversionRate", String.format("%.2f", conversionRate) + "%",
            "statusBreakdown", statusCounts
        ));
    }
}