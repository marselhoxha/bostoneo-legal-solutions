package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.AICriminalMotion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface AICriminalMotionRepository extends JpaRepository<AICriminalMotion, Long> {
    List<AICriminalMotion> findByCaseIdOrderByCreatedAtDesc(Long caseId);
}