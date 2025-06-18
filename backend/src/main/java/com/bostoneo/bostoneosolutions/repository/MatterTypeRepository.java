package com.***REMOVED***.***REMOVED***solutions.repository;

import com.***REMOVED***.***REMOVED***solutions.model.MatterType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.ListCrudRepository;
import org.springframework.data.repository.PagingAndSortingRepository;

import java.util.List;
import java.util.Optional;

public interface MatterTypeRepository extends PagingAndSortingRepository<MatterType, Long>, ListCrudRepository<MatterType, Long> {
    
    // Find by name
    Optional<MatterType> findByName(String name);
    
    Optional<MatterType> findByNameIgnoreCase(String name);
    
    // Find active matter types
    List<MatterType> findByIsActive(Boolean isActive);
    
    Page<MatterType> findByIsActive(Boolean isActive, Pageable pageable);
    
    // Search by name
    Page<MatterType> findByNameContainingIgnoreCase(String name, Pageable pageable);
    
    List<MatterType> findByNameContainingIgnoreCaseAndIsActive(String name, Boolean isActive);
    
    // Check if name exists (for validation)
    boolean existsByName(String name);
    
    boolean existsByNameIgnoreCase(String name);
    
    // Find all ordered by name
    List<MatterType> findAllByOrderByNameAsc();
    
    List<MatterType> findByIsActiveOrderByNameAsc(Boolean isActive);
} 
 
 
 
 
 
 