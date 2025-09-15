package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.dto.InvoicePaymentDTO;
import com.bostoneo.bostoneosolutions.model.InvoicePayment;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

public interface InvoicePaymentRepository<T extends InvoicePayment> {
    T create(T payment);
    Optional<T> get(Long id);
    List<InvoicePaymentDTO> findByInvoiceId(Long invoiceId);
    BigDecimal getTotalPaymentsByInvoiceId(Long invoiceId);
    void delete(Long id);
    List<InvoicePaymentDTO> findRecentPayments(int limit);
    BigDecimal getTotalPaymentsByDateRange(String startDate, String endDate);
}