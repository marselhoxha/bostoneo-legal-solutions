package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.PaymentTransaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PaymentTransactionRepository extends JpaRepository<PaymentTransaction, Long> {
    Page<PaymentTransaction> findByInvoiceId(Long invoiceId, Pageable pageable);
    List<PaymentTransaction> findByTransactionStatus(String status);
    List<PaymentTransaction> findByTransactionType(String type);
    List<PaymentTransaction> findByTransactionStatusIn(List<String> statuses);

    // ==================== TENANT-FILTERED METHODS ====================

    java.util.Optional<PaymentTransaction> findByIdAndOrganizationId(Long id, Long organizationId);

    Page<PaymentTransaction> findByOrganizationIdAndInvoiceId(Long organizationId, Long invoiceId, Pageable pageable);

    List<PaymentTransaction> findByOrganizationIdAndTransactionStatus(Long organizationId, String status);

    List<PaymentTransaction> findByOrganizationIdAndTransactionType(Long organizationId, String type);

    List<PaymentTransaction> findByOrganizationId(Long organizationId);

    long countByOrganizationId(Long organizationId);
}