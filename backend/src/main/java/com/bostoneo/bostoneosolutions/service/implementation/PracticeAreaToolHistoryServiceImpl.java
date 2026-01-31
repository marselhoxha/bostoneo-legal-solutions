package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.dto.CreateToolHistoryRequest;
import com.bostoneo.bostoneosolutions.dto.PracticeAreaToolHistoryDTO;
import com.bostoneo.bostoneosolutions.exception.ResourceNotFoundException;
import com.bostoneo.bostoneosolutions.model.PracticeAreaToolHistory;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.repository.PracticeAreaToolHistoryRepository;
import com.bostoneo.bostoneosolutions.service.PracticeAreaToolHistoryService;
import com.bostoneo.bostoneosolutions.service.UserService;
import com.bostoneo.bostoneosolutions.service.LegalCaseService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Implementation of Practice Area Tool History Service
 */
@Service
@Transactional
@RequiredArgsConstructor
@Slf4j
public class PracticeAreaToolHistoryServiceImpl implements PracticeAreaToolHistoryService {

    private final PracticeAreaToolHistoryRepository repository;
    private final TenantService tenantService;
    private final UserService userService;
    private final LegalCaseService legalCaseService;

    /**
     * Get the current organization ID from tenant context.
     */
    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    @Override
    public List<PracticeAreaToolHistoryDTO> getHistoryByPracticeArea(String practiceArea) {
        Long orgId = getRequiredOrganizationId();
        log.info("Getting history for practice area: {} in org: {}", practiceArea, orgId);

        List<PracticeAreaToolHistory> items = repository
                .findByOrganizationIdAndPracticeAreaOrderByCreatedAtDesc(orgId, practiceArea);

        return items.stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Override
    public Page<PracticeAreaToolHistoryDTO> getHistoryByPracticeArea(String practiceArea, Pageable pageable) {
        Long orgId = getRequiredOrganizationId();
        log.info("Getting paginated history for practice area: {} in org: {}", practiceArea, orgId);

        Page<PracticeAreaToolHistory> page = repository
                .findByOrganizationIdAndPracticeAreaOrderByCreatedAtDesc(orgId, practiceArea, pageable);

        return page.map(this::mapToDTO);
    }

    @Override
    public List<PracticeAreaToolHistoryDTO> getHistoryByToolType(String practiceArea, String toolType) {
        Long orgId = getRequiredOrganizationId();
        log.info("Getting history for tool type: {} in practice area: {}", toolType, practiceArea);

        List<PracticeAreaToolHistory> items = repository
                .findByOrganizationIdAndPracticeAreaAndToolTypeOrderByCreatedAtDesc(orgId, practiceArea, toolType);

        return items.stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Override
    public PracticeAreaToolHistoryDTO getHistoryById(String practiceArea, Long id) {
        Long orgId = getRequiredOrganizationId();
        log.info("Getting history item ID: {} for practice area: {}", id, practiceArea);

        PracticeAreaToolHistory item = repository
                .findByIdAndOrganizationIdAndPracticeArea(id, orgId, practiceArea)
                .orElseThrow(() -> new ResourceNotFoundException("History item not found with ID: " + id));

        return mapToDTO(item);
    }

    @Override
    public PracticeAreaToolHistoryDTO createHistory(String practiceArea, Long userId, CreateToolHistoryRequest request) {
        Long orgId = getRequiredOrganizationId();
        log.info("Creating history entry for practice area: {}, tool: {}", practiceArea, request.getToolType());

        // Build the entity
        PracticeAreaToolHistory item = PracticeAreaToolHistory.builder()
                .organizationId(orgId)
                .userId(userId)
                .practiceArea(practiceArea)
                .toolType(request.getToolType())
                .title(request.getTitle())
                .inputData(request.getInputData())
                .outputData(request.getOutputData())
                .aiAnalysis(request.getAiAnalysis())
                .caseId(request.getCaseId())
                .build();

        // Auto-generate title if not provided
        if (item.getTitle() == null || item.getTitle().isEmpty()) {
            item.setTitle(generateTitle(request));
        }

        // Save to repository
        PracticeAreaToolHistory savedItem = repository.save(item);
        log.info("History entry saved with ID: {}", savedItem.getId());

        return mapToDTO(savedItem);
    }

    @Override
    public void deleteHistory(String practiceArea, Long id) {
        Long orgId = getRequiredOrganizationId();
        log.info("Deleting history item ID: {} for practice area: {}", id, practiceArea);

        PracticeAreaToolHistory item = repository
                .findByIdAndOrganizationIdAndPracticeArea(id, orgId, practiceArea)
                .orElseThrow(() -> new ResourceNotFoundException("History item not found with ID: " + id));

        repository.delete(item);
        log.info("History item deleted successfully");
    }

    @Override
    public List<PracticeAreaToolHistoryDTO> getHistoryByCase(Long caseId) {
        Long orgId = getRequiredOrganizationId();
        log.info("Getting history for case ID: {}", caseId);

        List<PracticeAreaToolHistory> items = repository
                .findByOrganizationIdAndCaseIdOrderByCreatedAtDesc(orgId, caseId);

        return items.stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    /**
     * Generate a title based on the tool type and output data
     */
    private String generateTitle(CreateToolHistoryRequest request) {
        String toolType = request.getToolType();

        // Try to generate a meaningful title based on output data
        if (request.getOutputData() != null) {
            switch (toolType) {
                case "case-value":
                    Object totalValue = request.getOutputData().get("adjustedCaseValue");
                    if (totalValue == null) {
                        totalValue = request.getOutputData().get("totalCaseValue");
                    }
                    if (totalValue != null) {
                        double value = Double.parseDouble(totalValue.toString());
                        return String.format("$%,.0f Case Value", value);
                    }
                    break;
                case "demand-letter":
                    Object clientName = request.getInputData().get("clientName");
                    Object defendantName = request.getInputData().get("defendantName");
                    if (clientName != null && defendantName != null) {
                        return clientName + " v. " + defendantName;
                    }
                    break;
                case "medical-tracker":
                    Object providerCount = request.getOutputData().get("providerCount");
                    if (providerCount != null) {
                        return providerCount + " Medical Providers";
                    }
                    break;
                case "settlement":
                    Object demandAmount = request.getInputData().get("demandAmount");
                    if (demandAmount != null) {
                        double demand = Double.parseDouble(demandAmount.toString());
                        return String.format("$%,.0f Settlement", demand);
                    }
                    break;
            }
        }

        // Default title based on tool type
        return formatToolType(toolType) + " - " + java.time.LocalDate.now();
    }

    /**
     * Format tool type for display (e.g., "case-value" -> "Case Value")
     */
    private String formatToolType(String toolType) {
        if (toolType == null) return "Unknown";
        String[] words = toolType.split("-");
        StringBuilder result = new StringBuilder();
        for (String word : words) {
            if (!word.isEmpty()) {
                if (result.length() > 0) result.append(" ");
                result.append(Character.toUpperCase(word.charAt(0)));
                if (word.length() > 1) {
                    result.append(word.substring(1).toLowerCase());
                }
            }
        }
        return result.toString();
    }

    /**
     * Map entity to DTO with enriched data
     */
    private PracticeAreaToolHistoryDTO mapToDTO(PracticeAreaToolHistory item) {
        PracticeAreaToolHistoryDTO dto = PracticeAreaToolHistoryDTO.builder()
                .id(item.getId())
                .organizationId(item.getOrganizationId())
                .userId(item.getUserId())
                .practiceArea(item.getPracticeArea())
                .toolType(item.getToolType())
                .title(item.getTitle())
                .inputData(item.getInputData())
                .outputData(item.getOutputData())
                .aiAnalysis(item.getAiAnalysis())
                .caseId(item.getCaseId())
                .createdAt(item.getCreatedAt())
                .build();

        // Try to enrich with user name
        try {
            if (item.getUserId() != null) {
                var user = userService.getUserById(item.getUserId());
                if (user != null) {
                    dto.setUserName(user.getFirstName() + " " + user.getLastName());
                }
            }
        } catch (Exception e) {
            log.debug("Could not fetch user name for history item: {}", e.getMessage());
        }

        // Try to enrich with case name
        try {
            if (item.getCaseId() != null) {
                var legalCase = legalCaseService.getCase(item.getCaseId());
                if (legalCase != null) {
                    dto.setCaseName(legalCase.getTitle());
                }
            }
        } catch (Exception e) {
            log.debug("Could not fetch case name for history item: {}", e.getMessage());
        }

        return dto;
    }
}
