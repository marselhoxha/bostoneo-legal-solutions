package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.ActionItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ActionItemRepository extends JpaRepository<ActionItem, Long> {
    List<ActionItem> findByAnalysisIdOrderByDeadlineAsc(Long analysisId);
    List<ActionItem> findByAnalysisIdAndStatusOrderByDeadlineAsc(Long analysisId, String status);
    List<ActionItem> findByAnalysisIdInOrderByDeadlineAsc(List<Long> analysisIds);
    void deleteByAnalysisId(Long analysisId);
}
