package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.AIRealEstateDocument;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface AIRealEstateDocumentRepository extends JpaRepository<AIRealEstateDocument, Long> {
    
    List<AIRealEstateDocument> findByTransactionIdOrderByCreatedAtDesc(Long transactionId);
    
    Page<AIRealEstateDocument> findByDocumentType(String documentType, Pageable pageable);
    
    List<AIRealEstateDocument> findByDocumentType(String documentType);
    
    List<AIRealEstateDocument> findByDocumentNameContainingIgnoreCase(String documentName);
    
    List<AIRealEstateDocument> findByTransactionId(Long transactionId);
}
