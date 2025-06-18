package com.***REMOVED***.***REMOVED***solutions.service;

import com.***REMOVED***.***REMOVED***solutions.dto.InvoicePaymentDTO;

import java.math.BigDecimal;
import java.util.List;

public interface InvoicePaymentService {
    InvoicePaymentDTO createPayment(InvoicePaymentDTO paymentDTO);
    InvoicePaymentDTO getPayment(Long id);
    List<InvoicePaymentDTO> getPaymentsByInvoiceId(Long invoiceId);
    BigDecimal getTotalPaymentsByInvoiceId(Long invoiceId);
    void deletePayment(Long id);
    List<InvoicePaymentDTO> getRecentPayments(int limit);
    BigDecimal getTotalPaymentsByDateRange(String startDate, String endDate);
    void updateInvoicePaymentStatus(Long invoiceId);
}