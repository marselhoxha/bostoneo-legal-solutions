package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.ResearchActionItem;
import com.bostoneo.bostoneosolutions.model.ResearchActionItem.ActionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ResearchActionItemRepository extends JpaRepository<ResearchActionItem, Long> {

    List<ResearchActionItem> findByUserIdAndActionStatusOrderByCreatedAtDesc(Long userId, ActionStatus actionStatus);

    List<ResearchActionItem> findByUserIdOrderByCreatedAtDesc(Long userId);

    List<ResearchActionItem> findByResearchSessionIdOrderByCreatedAtDesc(Long researchSessionId);

    List<ResearchActionItem> findByCaseIdAndActionStatusOrderByCreatedAtDesc(Long caseId, ActionStatus actionStatus);

    Long countByUserIdAndActionStatus(Long userId, ActionStatus actionStatus);
}
