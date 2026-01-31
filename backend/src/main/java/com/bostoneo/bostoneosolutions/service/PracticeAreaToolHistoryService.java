package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.CreateToolHistoryRequest;
import com.bostoneo.bostoneosolutions.dto.PracticeAreaToolHistoryDTO;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

/**
 * Service interface for Practice Area Tool History operations
 */
public interface PracticeAreaToolHistoryService {

    /**
     * Get all history items for a practice area
     *
     * @param practiceArea the practice area identifier
     * @return list of history items
     */
    List<PracticeAreaToolHistoryDTO> getHistoryByPracticeArea(String practiceArea);

    /**
     * Get paginated history items for a practice area
     *
     * @param practiceArea the practice area identifier
     * @param pageable pagination info
     * @return page of history items
     */
    Page<PracticeAreaToolHistoryDTO> getHistoryByPracticeArea(String practiceArea, Pageable pageable);

    /**
     * Get history items for a specific tool type within a practice area
     *
     * @param practiceArea the practice area identifier
     * @param toolType the tool type identifier
     * @return list of history items
     */
    List<PracticeAreaToolHistoryDTO> getHistoryByToolType(String practiceArea, String toolType);

    /**
     * Get a specific history item by ID
     *
     * @param practiceArea the practice area identifier
     * @param id the history item ID
     * @return the history item
     */
    PracticeAreaToolHistoryDTO getHistoryById(String practiceArea, Long id);

    /**
     * Create a new history entry
     *
     * @param practiceArea the practice area identifier
     * @param userId the user ID
     * @param request the creation request
     * @return the created history item
     */
    PracticeAreaToolHistoryDTO createHistory(String practiceArea, Long userId, CreateToolHistoryRequest request);

    /**
     * Delete a history item
     *
     * @param practiceArea the practice area identifier
     * @param id the history item ID
     */
    void deleteHistory(String practiceArea, Long id);

    /**
     * Get history items linked to a specific case
     *
     * @param caseId the case ID
     * @return list of history items
     */
    List<PracticeAreaToolHistoryDTO> getHistoryByCase(Long caseId);
}
