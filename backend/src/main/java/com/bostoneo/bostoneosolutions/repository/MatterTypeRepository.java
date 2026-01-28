package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.MatterType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.ListCrudRepository;
import org.springframework.data.repository.PagingAndSortingRepository;

import java.util.List;
import java.util.Optional;

/**
 * WARNING: Entity MatterType may lack organization_id.
 * This may be a shared/system resource. Verify if organization isolation is required.
 */
public interface MatterTypeRepository extends PagingAndSortingRepository<MatterType, Long>, ListCrudRepository<MatterType, Long> {

    // ==================== METHODS REQUIRING REVIEW ====================
    // NOTE: MatterType may be a shared/system resource.
    // Verify if organization isolation is required for your use case.

    /** @deprecated Review: Entity may need organization_id for tenant isolation */
    @Deprecated
    Optional<MatterType> findByName(String name);

    /** @deprecated Review: Entity may need organization_id for tenant isolation */
    @Deprecated
    Optional<MatterType> findByNameIgnoreCase(String name);

    /** @deprecated Review: Entity may need organization_id for tenant isolation */
    @Deprecated
    List<MatterType> findByIsActive(Boolean isActive);

    /** @deprecated Review: Entity may need organization_id for tenant isolation */
    @Deprecated
    Page<MatterType> findByIsActive(Boolean isActive, Pageable pageable);

    /** @deprecated Review: Entity may need organization_id for tenant isolation */
    @Deprecated
    Page<MatterType> findByNameContainingIgnoreCase(String name, Pageable pageable);

    /** @deprecated Review: Entity may need organization_id for tenant isolation */
    @Deprecated
    List<MatterType> findByNameContainingIgnoreCaseAndIsActive(String name, Boolean isActive);

    /** @deprecated Review: Entity may need organization_id for tenant isolation */
    @Deprecated
    boolean existsByName(String name);

    /** @deprecated Review: Entity may need organization_id for tenant isolation */
    @Deprecated
    boolean existsByNameIgnoreCase(String name);

    /** @deprecated Review: Entity may need organization_id for tenant isolation */
    @Deprecated
    List<MatterType> findAllByOrderByNameAsc();

    /** @deprecated Review: Entity may need organization_id for tenant isolation */
    @Deprecated
    List<MatterType> findByIsActiveOrderByNameAsc(Boolean isActive);
} 
 
 
 
 
 
 