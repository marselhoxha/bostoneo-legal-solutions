package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.AIPatentApplication;
import com.bostoneo.bostoneosolutions.enumeration.PatentType;
import com.bostoneo.bostoneosolutions.enumeration.PatentStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface AIPatentApplicationRepository extends JpaRepository<AIPatentApplication, Long> {
    
    List<AIPatentApplication> findByClientIdOrderByCreatedAtDesc(Long clientId);
    
    Page<AIPatentApplication> findByPatentType(PatentType patentType, Pageable pageable);
    
    Page<AIPatentApplication> findByStatus(PatentStatus status, Pageable pageable);
    
    List<AIPatentApplication> findByPatentType(PatentType patentType);
    
    List<AIPatentApplication> findByStatus(PatentStatus status);
    
    List<AIPatentApplication> findByTitleContainingIgnoreCase(String title);
    
    List<AIPatentApplication> findByApplicationNumberContaining(String applicationNumber);
}