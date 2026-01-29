package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.PaymentTransaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PaymentTransactionRepository extends JpaRepository<PaymentTransaction, Long> {

    // ==================== LEGACY METHODS (DEPRECATED) ====================
    // Use tenant-filtered versions below for proper multi-tenant isolation

    /** @deprecated Use findByOrganizationIdAndInvoiceId for tenant isolation */
    @Deprecated
    Page<PaymentTransaction> findByInvoiceId(Long invoiceId, Pageable pageable);

    /** @deprecated Use findByOrganizationIdAndTransactionStatus for tenant isolation */
    @Deprecated
    List<PaymentTransaction> findByTransactionStatus(String status);

    /** @deprecated Use findByOrganizationIdAndTransactionType for tenant isolation */
    @Deprecated
    List<PaymentTransaction> findByTransactionType(String type);

    /** @deprecated Use findByOrganizationIdAndTransactionStatusIn for tenant isolation */
    @Deprecated
    List<PaymentTransaction> findByTransactionStatusIn(List<String> statuses);

    // ==================== TENANT-FILTERED METHODS ====================

    java.util.Optional<PaymentTransaction> findByIdAndOrganizationId(Long id, Long organizationId);

    Page<PaymentTransaction> findByOrganizationIdAndInvoiceId(Long organizationId, Long invoiceId, Pageable pageable);

    List<PaymentTransaction> findByOrganizationIdAndTransactionStatus(Long organizationId, String status);

    List<PaymentTransaction> findByOrganizationIdAndTransactionType(Long organizationId, String type);

    List<PaymentTransaction> findByOrganizationId(Long organizationId);

    List<PaymentTransaction> findByOrganizationIdAndTransactionStatusIn(Long organizationId, List<String> statuses);

    long countByOrganizationId(Long organizationId);

    boolean existsByIdAndOrganizationId(Long id, Long organizationId);
}