package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.dto.InvoicePaymentDTO;
import com.bostoneo.bostoneosolutions.exception.ApiException;
import com.bostoneo.bostoneosolutions.model.InvoicePayment;
import com.bostoneo.bostoneosolutions.repository.InvoicePaymentRepository;
import com.bostoneo.bostoneosolutions.repository.InvoiceRepository;
import com.bostoneo.bostoneosolutions.service.InvoicePaymentService;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.dto.UserDTO;
import com.bostoneo.bostoneosolutions.model.UserPrincipal;
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
    private final TenantService tenantService;

    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    @Override
    public InvoicePaymentDTO createPayment(InvoicePaymentDTO paymentDTO) {
        log.info("Creating payment for invoice: {}", paymentDTO.getInvoiceId());
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query to validate invoice exists
        invoiceRepository.findByIdAndOrganizationId(paymentDTO.getInvoiceId(), orgId)
            .orElseThrow(() -> new ApiException("Invoice not found or access denied"));

        // Get current user from security context
        Long userId = getCurrentUserId();

        InvoicePayment payment = InvoicePayment.builder()
                .invoiceId(paymentDTO.getInvoiceId())
                .paymentDate(paymentDTO.getPaymentDate())
                .amount(paymentDTO.getAmount())
                .paymentMethod(paymentDTO.getPaymentMethod())
                .referenceNumber(paymentDTO.getReferenceNumber())
                .notes(paymentDTO.getNotes())
                .createdBy(userId)
                .build();

        // SECURITY: Use org-filtered create method
        InvoicePayment savedPayment = paymentRepository.createWithOrganization(payment, orgId);

        // Update invoice payment status
        updateInvoicePaymentStatus(paymentDTO.getInvoiceId());

        // Convert to DTO
        return convertToDTO(savedPayment);
    }

    @Override
    public InvoicePaymentDTO getPayment(Long id) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        InvoicePayment payment = paymentRepository.getByIdAndOrganization(id, orgId)
                .orElseThrow(() -> new ApiException("Payment not found or access denied"));

        return convertToDTO(payment);
    }

    @Override
    public List<InvoicePaymentDTO> getPaymentsByInvoiceId(Long invoiceId) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query (validates invoice belongs to org)
        return paymentRepository.findByInvoiceIdAndOrganization(invoiceId, orgId);
    }

    @Override
    public BigDecimal getTotalPaymentsByInvoiceId(Long invoiceId) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        return paymentRepository.getTotalPaymentsByInvoiceIdAndOrganization(invoiceId, orgId);
    }

    @Override
    public void deletePayment(Long id) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Get payment with org filter first to get invoiceId for status update
        InvoicePayment payment = paymentRepository.getByIdAndOrganization(id, orgId)
                .orElseThrow(() -> new ApiException("Payment not found or access denied"));

        // SECURITY: Delete with org filter
        paymentRepository.deleteByIdAndOrganization(id, orgId);

        // Update invoice payment status after deletion
        updateInvoicePaymentStatus(payment.getInvoiceId());
    }

    @Override
    public List<InvoicePaymentDTO> getRecentPayments(int limit) {
        Long orgId = getRequiredOrganizationId();
        try {
            // SECURITY: Use tenant-filtered query
            return paymentRepository.findRecentPaymentsByOrganization(orgId, limit);
        } catch (Exception e) {
            log.warn("Error fetching recent payments: {}", e.getMessage());
            // Return empty list instead of failing
            return List.of();
        }
    }

    @Override
    public BigDecimal getTotalPaymentsByDateRange(String startDate, String endDate) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        return paymentRepository.getTotalPaymentsByDateRangeAndOrganization(orgId, startDate, endDate);
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
    
    private Long getCurrentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.isAuthenticated()) {
            Object principal = authentication.getPrincipal();
            if (principal instanceof UserDTO) {
                return ((UserDTO) principal).getId();
            } else if (principal instanceof UserPrincipal) {
                return ((UserPrincipal) principal).getUser().getId();
            }
        }
        // SECURITY: Throw exception instead of returning hardcoded ID
        throw new RuntimeException("Authentication required - could not determine current user");
    }
}