package com.***REMOVED***.***REMOVED***solutions.repository;

import com.***REMOVED***.***REMOVED***solutions.model.EmailTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EmailTemplateRepository extends JpaRepository<EmailTemplate, Long> {
    
    List<EmailTemplate> findByEventType(String eventType);
    
    Optional<EmailTemplate> findByName(String name);
    
    @Query("SELECT e FROM EmailTemplate e WHERE e.eventType = ?1 AND e.isDefault = true AND e.isActive = true")
    Optional<EmailTemplate> findDefaultTemplateForEventType(String eventType);
    
    List<EmailTemplate> findByIsActiveTrue();
} 