package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.AIImmigrationDocument;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface AIImmigrationDocumentRepository extends JpaRepository<AIImmigrationDocument, Long> {
    
    List<AIImmigrationDocument> findByCaseIdOrderByCreatedAtDesc(Long caseId);
    
    Page<AIImmigrationDocument> findByDocumentType(String documentType, Pageable pageable);
    
    List<AIImmigrationDocument> findByDocumentType(String documentType);
    
    List<AIImmigrationDocument> findByDocumentNameContainingIgnoreCase(String documentName);
    
    List<AIImmigrationDocument> findByCaseId(Long caseId);
}