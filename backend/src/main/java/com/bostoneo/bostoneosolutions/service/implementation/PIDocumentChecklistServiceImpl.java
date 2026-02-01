package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.dto.PIDocumentChecklistDTO;
import com.bostoneo.bostoneosolutions.exception.ResourceNotFoundException;
import com.bostoneo.bostoneosolutions.model.FileItem;
import com.bostoneo.bostoneosolutions.model.PIDocumentChecklist;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.repository.FileItemRepository;
import com.bostoneo.bostoneosolutions.repository.PIDocumentChecklistRepository;
import com.bostoneo.bostoneosolutions.service.PIDocumentChecklistService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Implementation of PI Document Checklist Service
 */
@Service
@Transactional
@RequiredArgsConstructor
@Slf4j
public class PIDocumentChecklistServiceImpl implements PIDocumentChecklistService {

    private final PIDocumentChecklistRepository repository;
    private final FileItemRepository fileItemRepository;
    private final TenantService tenantService;

    // Default document types for PI cases
    private static final List<Map<String, Object>> DEFAULT_DOCUMENT_TYPES = Arrays.asList(
            Map.of("type", "POLICE_REPORT", "subtype", "Accident Report", "required", true),
            Map.of("type", "MEDICAL_RECORDS", "subtype", "Emergency Room", "required", true),
            Map.of("type", "MEDICAL_RECORDS", "subtype", "Primary Care", "required", false),
            Map.of("type", "MEDICAL_RECORDS", "subtype", "Specialist", "required", false),
            Map.of("type", "MEDICAL_RECORDS", "subtype", "Physical Therapy", "required", false),
            Map.of("type", "MEDICAL_RECORDS", "subtype", "Imaging/Radiology", "required", false),
            Map.of("type", "MEDICAL_BILLS", "subtype", "All Providers", "required", true),
            Map.of("type", "WAGE_DOCUMENTATION", "subtype", "Pay Stubs", "required", false),
            Map.of("type", "WAGE_DOCUMENTATION", "subtype", "Employer Letter", "required", false),
            Map.of("type", "WAGE_DOCUMENTATION", "subtype", "Tax Returns", "required", false),
            Map.of("type", "INSURANCE", "subtype", "Declarations Page", "required", true),
            Map.of("type", "INSURANCE", "subtype", "Policy Limits Letter", "required", false),
            Map.of("type", "PHOTOGRAPHS", "subtype", "Vehicle Damage", "required", false),
            Map.of("type", "PHOTOGRAPHS", "subtype", "Injuries", "required", false),
            Map.of("type", "PHOTOGRAPHS", "subtype", "Accident Scene", "required", false),
            Map.of("type", "WITNESS", "subtype", "Witness Statements", "required", false)
    );

    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    @Override
    public List<PIDocumentChecklistDTO> getChecklistByCaseId(Long caseId) {
        Long orgId = getRequiredOrganizationId();
        log.info("Getting document checklist for case: {} in org: {}", caseId, orgId);

        return repository.findByCaseIdAndOrganizationIdOrderByDocumentType(caseId, orgId)
                .stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Override
    public Page<PIDocumentChecklistDTO> getChecklistByCaseId(Long caseId, Pageable pageable) {
        Long orgId = getRequiredOrganizationId();
        return repository.findByCaseIdAndOrganizationId(caseId, orgId, pageable)
                .map(this::mapToDTO);
    }

    @Override
    public PIDocumentChecklistDTO getChecklistItemById(Long id) {
        Long orgId = getRequiredOrganizationId();
        PIDocumentChecklist item = repository.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Checklist item not found with ID: " + id));
        return mapToDTO(item);
    }

    @Override
    public PIDocumentChecklistDTO createChecklistItem(Long caseId, PIDocumentChecklistDTO itemDTO) {
        Long orgId = getRequiredOrganizationId();
        log.info("Creating checklist item for case: {} in org: {}", caseId, orgId);

        PIDocumentChecklist item = mapToEntity(itemDTO);
        item.setCaseId(caseId);
        item.setOrganizationId(orgId);
        if (item.getStatus() == null) {
            item.setStatus("MISSING");
        }
        if (item.getRequired() == null) {
            item.setRequired(true);
        }
        if (item.getReceived() == null) {
            item.setReceived(false);
        }
        if (item.getFollowUpCount() == null) {
            item.setFollowUpCount(0);
        }

        PIDocumentChecklist saved = repository.save(item);
        log.info("Checklist item created with ID: {}", saved.getId());
        return mapToDTO(saved);
    }

    @Override
    public PIDocumentChecklistDTO updateChecklistItem(Long id, PIDocumentChecklistDTO itemDTO) {
        Long orgId = getRequiredOrganizationId();
        log.info("Updating checklist item: {} in org: {}", id, orgId);

        PIDocumentChecklist existing = repository.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Checklist item not found with ID: " + id));

        updateEntityFromDTO(existing, itemDTO);
        PIDocumentChecklist saved = repository.save(existing);
        return mapToDTO(saved);
    }

    @Override
    public void deleteChecklistItem(Long id) {
        Long orgId = getRequiredOrganizationId();
        log.info("Deleting checklist item: {} in org: {}", id, orgId);

        PIDocumentChecklist item = repository.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Checklist item not found with ID: " + id));

        repository.delete(item);
        log.info("Checklist item deleted successfully");
    }

    @Override
    public List<PIDocumentChecklistDTO> getMissingDocuments(Long caseId) {
        Long orgId = getRequiredOrganizationId();
        return repository.findMissingDocuments(caseId, orgId)
                .stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Override
    public List<PIDocumentChecklistDTO> getOverdueFollowUps(Long caseId) {
        Long orgId = getRequiredOrganizationId();
        return repository.findOverdueFollowUps(caseId, orgId)
                .stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Override
    public List<PIDocumentChecklistDTO> getChecklistByStatus(Long caseId, String status) {
        Long orgId = getRequiredOrganizationId();
        return repository.findByCaseIdAndOrganizationIdAndStatus(caseId, orgId, status)
                .stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Override
    public List<PIDocumentChecklistDTO> initializeDefaultChecklist(Long caseId) {
        Long orgId = getRequiredOrganizationId();
        log.info("Initializing default checklist for case: {} in org: {}", caseId, orgId);

        // Check if checklist already exists
        List<PIDocumentChecklist> existing = repository.findByCaseIdAndOrganizationIdOrderByDocumentType(caseId, orgId);
        if (!existing.isEmpty()) {
            log.info("Checklist already exists for case: {}", caseId);
            return existing.stream().map(this::mapToDTO).collect(Collectors.toList());
        }

        // Create default checklist items
        List<PIDocumentChecklist> items = new ArrayList<>();
        for (Map<String, Object> docType : DEFAULT_DOCUMENT_TYPES) {
            PIDocumentChecklist item = PIDocumentChecklist.builder()
                    .caseId(caseId)
                    .organizationId(orgId)
                    .documentType((String) docType.get("type"))
                    .documentSubtype((String) docType.get("subtype"))
                    .required((Boolean) docType.get("required"))
                    .received(false)
                    .status("MISSING")
                    .followUpCount(0)
                    .build();
            items.add(item);
        }

        List<PIDocumentChecklist> saved = repository.saveAll(items);
        log.info("Created {} default checklist items", saved.size());

        return saved.stream().map(this::mapToDTO).collect(Collectors.toList());
    }

    @Override
    public Map<String, Object> getCompletenessScore(Long caseId) {
        Long orgId = getRequiredOrganizationId();

        // Get all checklist items for this case
        List<PIDocumentChecklist> allItems = repository.findByCaseIdAndOrganizationIdOrderByDocumentType(caseId, orgId);

        // Total counts (all documents)
        long totalCount = allItems.size();
        long totalReceived = allItems.stream().filter(PIDocumentChecklist::getReceived).count();
        long totalMissing = allItems.stream().filter(i -> "MISSING".equals(i.getStatus())).count();
        long totalRequested = allItems.stream().filter(i -> "REQUESTED".equals(i.getStatus())).count();

        // Calculate percentage based on ALL documents (received / total * 100)
        double percentage = totalCount > 0 ? (double) totalReceived / totalCount * 100 : 0;

        Map<String, Object> result = new HashMap<>();
        result.put("totalCount", totalCount);
        result.put("receivedCount", totalReceived);
        result.put("missingCount", totalMissing);
        result.put("requestedCount", totalRequested);
        result.put("completenessPercent", Math.round(percentage));

        // Also include required-only stats for reference
        long requiredCount = allItems.stream().filter(i -> Boolean.TRUE.equals(i.getRequired())).count();
        long requiredReceived = allItems.stream().filter(i -> Boolean.TRUE.equals(i.getRequired()) && i.getReceived()).count();
        result.put("requiredCount", requiredCount);
        result.put("requiredReceivedCount", requiredReceived);

        // Get missing documents (status = MISSING, not just required)
        List<PIDocumentChecklist> missing = allItems.stream()
                .filter(i -> "MISSING".equals(i.getStatus()))
                .collect(Collectors.toList());

        result.put("missingDocuments", missing.stream()
                .map(m -> Map.of(
                        "type", m.getDocumentType(),
                        "subtype", m.getDocumentSubtype() != null ? m.getDocumentSubtype() : "",
                        "daysSinceRequested", calculateDaysSinceRequested(m)
                ))
                .collect(Collectors.toList()));

        return result;
    }

    @Override
    public PIDocumentChecklistDTO markAsReceived(Long id, Long documentId) {
        Long orgId = getRequiredOrganizationId();
        log.info("Marking checklist item {} as received", id);

        PIDocumentChecklist item = repository.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Checklist item not found with ID: " + id));

        item.setReceived(true);
        item.setReceivedDate(LocalDate.now());
        item.setStatus("RECEIVED");
        if (documentId != null) {
            item.setDocumentId(documentId);
        }

        PIDocumentChecklist saved = repository.save(item);
        return mapToDTO(saved);
    }

    @Override
    public PIDocumentChecklistDTO requestDocument(Long id, String requestSentTo) {
        Long orgId = getRequiredOrganizationId();
        log.info("Requesting document for checklist item {}", id);

        PIDocumentChecklist item = repository.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Checklist item not found with ID: " + id));

        item.setStatus("REQUESTED");
        item.setRequestedDate(LocalDate.now());
        item.setRequestSentTo(requestSentTo);
        item.setFollowUpDate(LocalDate.now().plusDays(14)); // Default 2 weeks follow-up

        PIDocumentChecklist saved = repository.save(item);
        return mapToDTO(saved);
    }

    @Override
    public PIDocumentChecklistDTO logFollowUp(Long id) {
        Long orgId = getRequiredOrganizationId();
        log.info("Logging follow-up for checklist item {}", id);

        PIDocumentChecklist item = repository.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Checklist item not found with ID: " + id));

        item.setFollowUpCount(item.getFollowUpCount() + 1);
        item.setFollowUpDate(LocalDate.now().plusDays(7)); // Next follow-up in 1 week

        PIDocumentChecklist saved = repository.save(item);
        return mapToDTO(saved);
    }

    // Helper methods

    private int calculateDaysSinceRequested(PIDocumentChecklist item) {
        if (item.getRequestedDate() == null) return 0;
        return (int) ChronoUnit.DAYS.between(item.getRequestedDate(), LocalDate.now());
    }

    private PIDocumentChecklistDTO mapToDTO(PIDocumentChecklist entity) {
        PIDocumentChecklistDTO dto = PIDocumentChecklistDTO.builder()
                .id(entity.getId())
                .caseId(entity.getCaseId())
                .organizationId(entity.getOrganizationId())
                .documentType(entity.getDocumentType())
                .documentSubtype(entity.getDocumentSubtype())
                .providerName(entity.getProviderName())
                .required(entity.getRequired())
                .received(entity.getReceived())
                .receivedDate(entity.getReceivedDate())
                .status(entity.getStatus())
                .requestedDate(entity.getRequestedDate())
                .requestSentTo(entity.getRequestSentTo())
                .followUpDate(entity.getFollowUpDate())
                .followUpCount(entity.getFollowUpCount())
                .requestCount(entity.getRequestCount())
                .lastRequestAt(entity.getLastRequestAt())
                .totalFee(entity.getTotalFee())
                .documentId(entity.getDocumentId())
                .notes(entity.getNotes())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .createdBy(entity.getCreatedBy())
                .build();

        // Compute days since requested
        if (entity.getRequestedDate() != null) {
            dto.setDaysSinceRequested(calculateDaysSinceRequested(entity));
        }

        // Compute if overdue
        if (entity.getFollowUpDate() != null && !entity.getReceived()) {
            dto.setIsOverdue(entity.getFollowUpDate().isBefore(LocalDate.now()));
        }

        return dto;
    }

    private PIDocumentChecklist mapToEntity(PIDocumentChecklistDTO dto) {
        return PIDocumentChecklist.builder()
                .documentType(dto.getDocumentType())
                .documentSubtype(dto.getDocumentSubtype())
                .providerName(dto.getProviderName())
                .required(dto.getRequired())
                .received(dto.getReceived())
                .receivedDate(dto.getReceivedDate())
                .status(dto.getStatus())
                .requestedDate(dto.getRequestedDate())
                .requestSentTo(dto.getRequestSentTo())
                .followUpDate(dto.getFollowUpDate())
                .followUpCount(dto.getFollowUpCount())
                .documentId(dto.getDocumentId())
                .notes(dto.getNotes())
                .createdBy(dto.getCreatedBy())
                .build();
    }

    private void updateEntityFromDTO(PIDocumentChecklist entity, PIDocumentChecklistDTO dto) {
        if (dto.getDocumentType() != null) entity.setDocumentType(dto.getDocumentType());
        if (dto.getDocumentSubtype() != null) entity.setDocumentSubtype(dto.getDocumentSubtype());
        if (dto.getProviderName() != null) entity.setProviderName(dto.getProviderName());
        if (dto.getRequired() != null) entity.setRequired(dto.getRequired());
        if (dto.getReceived() != null) entity.setReceived(dto.getReceived());
        if (dto.getReceivedDate() != null) entity.setReceivedDate(dto.getReceivedDate());
        if (dto.getStatus() != null) entity.setStatus(dto.getStatus());
        if (dto.getRequestedDate() != null) entity.setRequestedDate(dto.getRequestedDate());
        if (dto.getRequestSentTo() != null) entity.setRequestSentTo(dto.getRequestSentTo());
        if (dto.getFollowUpDate() != null) entity.setFollowUpDate(dto.getFollowUpDate());
        if (dto.getFollowUpCount() != null) entity.setFollowUpCount(dto.getFollowUpCount());
        if (dto.getDocumentId() != null) entity.setDocumentId(dto.getDocumentId());
        if (dto.getNotes() != null) entity.setNotes(dto.getNotes());
    }

    @Override
    public Map<String, Object> syncWithCaseDocuments(Long caseId) {
        Long orgId = getRequiredOrganizationId();
        log.info("Syncing document checklist with case documents for case: {}", caseId);

        Map<String, Object> result = new HashMap<>();
        List<String> matched = new ArrayList<>();
        List<String> unmatched = new ArrayList<>();
        int updated = 0;

        // Get all files for this case
        List<FileItem> files = fileItemRepository.findByCaseIdAndDeletedFalseAndOrganizationId(caseId, orgId);

        // Get checklist items
        List<PIDocumentChecklist> checklistItems = repository.findByCaseIdAndOrganizationIdOrderByDocumentType(caseId, orgId);

        // If no checklist exists, initialize it first
        if (checklistItems.isEmpty()) {
            initializeDefaultChecklist(caseId);
            checklistItems = repository.findByCaseIdAndOrganizationIdOrderByDocumentType(caseId, orgId);
        }

        // Match files to checklist items
        for (FileItem file : files) {
            String fileName = file.getOriginalName().toLowerCase();
            boolean foundMatch = false;

            for (PIDocumentChecklist item : checklistItems) {
                if (item.getReceived()) continue; // Already received

                String docType = item.getDocumentType().toLowerCase();
                String subType = item.getDocumentSubtype() != null ? item.getDocumentSubtype().toLowerCase() : "";

                // Match based on file name patterns
                if (matchesDocumentType(fileName, docType, subType)) {
                    item.setReceived(true);
                    item.setReceivedDate(LocalDate.now());
                    item.setStatus("RECEIVED");
                    item.setDocumentId(file.getId());
                    repository.save(item);

                    matched.add(String.format("%s -> %s/%s", file.getOriginalName(), item.getDocumentType(), item.getDocumentSubtype()));
                    updated++;
                    foundMatch = true;
                    break;
                }
            }

            if (!foundMatch) {
                unmatched.add(file.getOriginalName());
            }
        }

        result.put("success", true);
        result.put("filesProcessed", files.size());
        result.put("checklistItemsUpdated", updated);
        result.put("matched", matched);
        result.put("unmatched", unmatched);

        log.info("Document sync complete: {} files processed, {} items updated", files.size(), updated);
        return result;
    }

    private boolean matchesDocumentType(String fileName, String docType, String subType) {
        // Medical Records matching
        if (docType.contains("medical")) {
            if (fileName.contains("er") || fileName.contains("emergency")) {
                return subType.contains("emergency") || subType.contains("er");
            }
            if (fileName.contains("pt") || fileName.contains("physical therapy")) {
                return subType.contains("physical therapy") || subType.contains("pt");
            }
            if (fileName.contains("mri") || fileName.contains("xray") || fileName.contains("ct") || fileName.contains("imaging")) {
                return subType.contains("imaging") || subType.contains("radiology");
            }
            if (fileName.contains("chiro")) {
                return subType.contains("chiro") || subType.contains("specialist");
            }
            if (fileName.contains("specialist") || fileName.contains("ortho") || fileName.contains("neuro")) {
                return subType.contains("specialist");
            }
            if (fileName.contains("primary") || fileName.contains("pcp")) {
                return subType.contains("primary");
            }
        }

        // Police Report matching
        if (docType.contains("police") || docType.contains("accident")) {
            return fileName.contains("police") || fileName.contains("accident") || fileName.contains("report");
        }

        // Medical Bills matching
        if (docType.contains("bill")) {
            return fileName.contains("bill") || fileName.contains("ledger") || fileName.contains("invoice") || fileName.contains("charges");
        }

        // Insurance matching
        if (docType.contains("insurance")) {
            return fileName.contains("insurance") || fileName.contains("policy") || fileName.contains("declaration");
        }

        // Wage documentation matching
        if (docType.contains("wage")) {
            return fileName.contains("pay") || fileName.contains("stub") || fileName.contains("w2") || fileName.contains("tax") || fileName.contains("employer");
        }

        // Photographs matching
        if (docType.contains("photo")) {
            return fileName.contains("photo") || fileName.contains("image") || fileName.contains("pic");
        }

        return false;
    }
}
