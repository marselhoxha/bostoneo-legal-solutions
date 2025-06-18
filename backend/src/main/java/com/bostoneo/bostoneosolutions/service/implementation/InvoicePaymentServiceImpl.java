package com.***REMOVED***.***REMOVED***solutions.service.implementation;

import com.***REMOVED***.***REMOVED***solutions.dto.InvoicePaymentDTO;
import com.***REMOVED***.***REMOVED***solutions.exception.ApiException;
import com.***REMOVED***.***REMOVED***solutions.model.InvoicePayment;
import com.***REMOVED***.***REMOVED***solutions.repository.InvoicePaymentRepository;
import com.***REMOVED***.***REMOVED***solutions.repository.InvoiceRepository;
import com.***REMOVED***.***REMOVED***solutions.service.InvoicePaymentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class InvoicePaymentServiceImpl implements InvoicePaymentService {
    
    private final InvoicePaymentRepository<InvoicePayment> paymentRepository;
    private final InvoiceRepository invoiceRepository;

    @Override
    public InvoicePaymentDTO createPayment(InvoicePaymentDTO paymentDTO) {
        log.info("Creating payment for invoice: {}", paymentDTO.getInvoiceId());
        
        // Validate invoice exists
        invoiceRepository.findById(paymentDTO.getInvoiceId())
            .orElseThrow(() -> new ApiException("Invoice not found"));
        
        // Get current user
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        Long userId = getUserId(auth.getName());
        
        InvoicePayment payment = InvoicePayment.builder()
                .invoiceId(paymentDTO.getInvoiceId())
                .paymentDate(paymentDTO.getPaymentDate())
                .amount(paymentDTO.getAmount())
                .paymentMethod(paymentDTO.getPaymentMethod())
                .referenceNumber(paymentDTO.getReferenceNumber())
                .notes(paymentDTO.getNotes())
                .createdBy(userId)
                .build();
        
        InvoicePayment savedPayment = paymentRepository.create(payment);
        
        // Update invoice payment status
        updateInvoicePaymentStatus(paymentDTO.getInvoiceId());
        
        // Convert to DTO
        return convertToDTO(savedPayment);
    }

    @Override
    public InvoicePaymentDTO getPayment(Long id) {
        return paymentRepository.get(id)
                .map(this::convertToDTO)
                .orElseThrow(() -> new ApiException("Payment not found"));
    }

    @Override
    public List<InvoicePaymentDTO> getPaymentsByInvoiceId(Long invoiceId) {
        return paymentRepository.findByInvoiceId(invoiceId);
    }

    @Override
    public BigDecimal getTotalPaymentsByInvoiceId(Long invoiceId) {
        return paymentRepository.getTotalPaymentsByInvoiceId(invoiceId);
    }

    @Override
    public void deletePayment(Long id) {
        InvoicePayment payment = paymentRepository.get(id)
                .orElseThrow(() -> new ApiException("Payment not found"));
        
        paymentRepository.delete(id);
        
        // Update invoice payment status after deletion
        updateInvoicePaymentStatus(payment.getInvoiceId());
    }

    @Override
    public List<InvoicePaymentDTO> getRecentPayments(int limit) {
        return paymentRepository.findRecentPayments(limit);
    }

    @Override
    public BigDecimal getTotalPaymentsByDateRange(String startDate, String endDate) {
        return paymentRepository.getTotalPaymentsByDateRange(startDate, endDate);
    }

    @Override
    public void updateInvoicePaymentStatus(Long invoiceId) {
        try {
            // This will be handled by the database trigger we created
            // But we can add additional logic here if needed
            log.info("Invoice payment status updated for invoice: {}", invoiceId);
        } catch (Exception e) {
            log.error("Error updating invoice payment status: {}", e.getMessage());
        }
    }
    
    private InvoicePaymentDTO convertToDTO(InvoicePayment payment) {
        return InvoicePaymentDTO.builder()
                .id(payment.getId())
                .invoiceId(payment.getInvoiceId())
                .paymentDate(payment.getPaymentDate())
                .amount(payment.getAmount())
                .paymentMethod(payment.getPaymentMethod())
                .referenceNumber(payment.getReferenceNumber())
                .notes(payment.getNotes())
                .createdBy(payment.getCreatedBy())
                .createdAt(payment.getCreatedAt())
                .updatedAt(payment.getUpdatedAt())
                .build();
    }
    
    private Long getUserId(String username) {
        // This would typically fetch from user repository
        // For now, returning a placeholder
        return 1L;
    }
}