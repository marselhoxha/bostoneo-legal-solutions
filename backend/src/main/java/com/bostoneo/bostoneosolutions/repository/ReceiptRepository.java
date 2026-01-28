package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.Receipt;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ReceiptRepository extends JpaRepository<Receipt, Long> {

    // ==================== TENANT-FILTERED METHODS ====================

    Page<Receipt> findByOrganizationId(Long organizationId, Pageable pageable);

    List<Receipt> findByOrganizationId(Long organizationId);

    Optional<Receipt> findByIdAndOrganizationId(Long id, Long organizationId);

    boolean existsByIdAndOrganizationId(Long id, Long organizationId);
} 
 
 
 