package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.TimelineEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TimelineEventRepository extends JpaRepository<TimelineEvent, Long> {
    List<TimelineEvent> findByAnalysisIdOrderByEventDateAsc(Long analysisId);
    List<TimelineEvent> findByAnalysisIdAndEventTypeOrderByEventDateAsc(Long analysisId, String eventType);
    List<TimelineEvent> findByAnalysisIdInOrderByEventDateAsc(List<Long> analysisIds);
    void deleteByAnalysisId(Long analysisId);
}
