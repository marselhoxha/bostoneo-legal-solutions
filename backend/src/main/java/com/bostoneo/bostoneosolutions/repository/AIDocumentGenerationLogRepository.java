package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.AIDocumentGenerationLog;
import com.bostoneo.bostoneosolutions.enumeration.GenerationType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface AIDocumentGenerationLogRepository extends JpaRepository<AIDocumentGenerationLog, Long> {
    
    Page<AIDocumentGenerationLog> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);
    
    Page<AIDocumentGenerationLog> findByTemplateIdOrderByCreatedAtDesc(Long templateId, Pageable pageable);
    
    List<AIDocumentGenerationLog> findByUserId(Long userId);
    
    List<AIDocumentGenerationLog> findByTemplateId(Long templateId);
    
    List<AIDocumentGenerationLog> findByUserIdOrderByCreatedAtDesc(Long userId);
    
    List<AIDocumentGenerationLog> findByTemplateIdOrderByCreatedAtDesc(Long templateId);
    
    List<AIDocumentGenerationLog> findByGenerationType(GenerationType generationType);
    
    List<AIDocumentGenerationLog> findBySuccess(Boolean success);
}
