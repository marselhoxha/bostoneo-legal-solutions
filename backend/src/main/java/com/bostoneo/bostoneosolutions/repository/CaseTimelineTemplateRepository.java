package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.CaseTimelineTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CaseTimelineTemplateRepository extends JpaRepository<CaseTimelineTemplate, Long> {

    List<CaseTimelineTemplate> findByCaseTypeOrderByPhaseOrderAsc(String caseType);

    @Query("SELECT DISTINCT t.caseType FROM CaseTimelineTemplate t ORDER BY t.caseType")
    List<String> findDistinctCaseTypes();

    boolean existsByCaseType(String caseType);
}
