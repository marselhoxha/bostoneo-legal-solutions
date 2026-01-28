package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.dto.InvoicePaymentDTO;
import com.bostoneo.bostoneosolutions.model.InvoicePayment;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

public interface InvoicePaymentRepository<T extends InvoicePayment> {

    // ==================== TENANT-FILTERED METHODS (SECURE) ====================

    T createWithOrganization(T payment, Long organizationId);
    Optional<T> getByIdAndOrganization(Long id, Long organizationId);
    List<InvoicePaymentDTO> findByInvoiceIdAndOrganization(Long invoiceId, Long organizationId);
    BigDecimal getTotalPaymentsByInvoiceIdAndOrganization(Long invoiceId, Long organizationId);
    void deleteByIdAndOrganization(Long id, Long organizationId);
    List<InvoicePaymentDTO> findRecentPaymentsByOrganization(Long organizationId, int limit);
    BigDecimal getTotalPaymentsByDateRangeAndOrganization(Long organizationId, String startDate, String endDate);

    // ==================== LEGACY METHODS (DEPRECATED) ====================

    /** @deprecated Use createWithOrganization for tenant isolation */
    @Deprecated
    T create(T payment);

    /** @deprecated Use getByIdAndOrganization for tenant isolation */
    @Deprecated
    Optional<T> get(Long id);

    /** @deprecated Use findByInvoiceIdAndOrganization for tenant isolation */
    @Deprecated
    List<InvoicePaymentDTO> findByInvoiceId(Long invoiceId);

    /** @deprecated Use getTotalPaymentsByInvoiceIdAndOrganization for tenant isolation */
    @Deprecated
    BigDecimal getTotalPaymentsByInvoiceId(Long invoiceId);

    /** @deprecated Use deleteByIdAndOrganization for tenant isolation */
    @Deprecated
    void delete(Long id);

    /** @deprecated Use findRecentPaymentsByOrganization for tenant isolation */
    @Deprecated
    List<InvoicePaymentDTO> findRecentPayments(int limit);

    /** @deprecated Use getTotalPaymentsByDateRangeAndOrganization for tenant isolation */
    @Deprecated
    BigDecimal getTotalPaymentsByDateRange(String startDate, String endDate);
}