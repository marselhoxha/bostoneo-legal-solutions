package com.bostoneo.bostoneosolutions.service.impl;

import com.bostoneo.bostoneosolutions.dto.PaymentTransactionDTO;
import com.bostoneo.bostoneosolutions.model.InvoicePayment;
import com.bostoneo.bostoneosolutions.model.PaymentTransaction;
import com.bostoneo.bostoneosolutions.repository.InvoicePaymentRepository;
import com.bostoneo.bostoneosolutions.repository.PaymentTransactionRepository;
import com.bostoneo.bostoneosolutions.service.PaymentTransactionService;
import com.bostoneo.bostoneosolutions.service.NotificationService;
import com.bostoneo.bostoneosolutions.repository.CaseAssignmentRepository;
import com.bostoneo.bostoneosolutions.repository.InvoiceRepository;
import com.bostoneo.bostoneosolutions.model.CaseAssignment;
import com.bostoneo.bostoneosolutions.model.Invoice;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.HashSet;
import java.util.Set;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class PaymentTransactionServiceImpl implements PaymentTransactionService {

    private final PaymentTransactionRepository transactionRepository;
    private final InvoicePaymentRepository<InvoicePayment> paymentRepository;
    private final NotificationService notificationService;
    private final CaseAssignmentRepository caseAssignmentRepository;
    private final InvoiceRepository invoiceRepository;
    private final com.bostoneo.bostoneosolutions.multitenancy.TenantService tenantService;

    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    @Override
    @Transactional
    public PaymentTransaction createTransaction(PaymentTransactionDTO dto) {
        Long orgId = getRequiredOrganizationId();
        PaymentTransaction transaction = PaymentTransaction.builder()
                .organizationId(orgId) // SECURITY: Set organization ID
                .invoiceId(dto.getInvoiceId())
                .transactionType(dto.getTransactionType())
                .transactionStatus("PENDING")
                .amount(dto.getAmount())
                .routingNumber(dto.getRoutingNumber())
                .accountNumberLast4(dto.getAccountNumberLast4())
                .wireReference(dto.getWireReference())
                .bankName(dto.getBankName())
                .processingDate(dto.getProcessingDate() != null ? dto.getProcessingDate() : LocalDate.now())
                .referenceNumber(dto.getReferenceNumber())
                .notes(dto.getNotes())
                .createdBy(dto.getCreatedBy())
                .build();

        return transactionRepository.save(transaction);
    }

    @Override
    public Optional<PaymentTransaction> getTransaction(Long id) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        return transactionRepository.findByIdAndOrganizationId(id, orgId);
    }

    @Override
    public Page<PaymentTransaction> getTransactionsByInvoice(Long invoiceId, Pageable pageable) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        return transactionRepository.findByOrganizationIdAndInvoiceId(orgId, invoiceId, pageable);
    }

    @Override
    public List<PaymentTransaction> getPendingTransactions() {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        return transactionRepository.findByOrganizationIdAndTransactionStatus(orgId, "PENDING");
    }

    @Override
    @Transactional
    public PaymentTransaction updateTransactionStatus(Long id, String status, String notes) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Verify ownership before update
        PaymentTransaction transaction = transactionRepository.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new RuntimeException("Transaction not found or access denied"));

        transaction.setTransactionStatus(status);
        if (notes != null) {
            transaction.setNotes(transaction.getNotes() != null ?
                transaction.getNotes() + "\n" + notes : notes);
        }

        return transactionRepository.save(transaction);
    }

    @Override
    @Transactional
    public PaymentTransaction completeTransaction(Long id) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Verify ownership before completion
        PaymentTransaction transaction = transactionRepository.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new RuntimeException("Transaction not found or access denied"));
        
        transaction.setTransactionStatus("COMPLETED");
        transaction.setCompletionDate(LocalDate.now());
        
        // Create corresponding invoice payment
        InvoicePayment payment = InvoicePayment.builder()
                .invoiceId(transaction.getInvoiceId())
                .amount(transaction.getAmount())
                .paymentMethod(transaction.getTransactionType())
                .referenceNumber(transaction.getReferenceNumber())
                .paymentDate(LocalDate.now())
                .notes("Payment via " + transaction.getTransactionType() + 
                       (transaction.getWireReference() != null ? " - Wire Ref: " + transaction.getWireReference() : "") +
                       (transaction.getAccountNumberLast4() != null ? " - Account ending: " + transaction.getAccountNumberLast4() : ""))
                .createdBy(transaction.getCreatedBy())
                .build();
        
        paymentRepository.create(payment);
        
        PaymentTransaction savedTransaction = transactionRepository.save(transaction);
        
        // Send payment received notifications
        try {
            // Get invoice details for notification - SECURITY: Use tenant-filtered query
            Optional<Invoice> invoiceOpt = invoiceRepository.findByIdAndOrganizationId(transaction.getInvoiceId(), orgId);
            if (invoiceOpt.isPresent()) {
                Invoice invoice = invoiceOpt.get();
                String title = "Payment Received";
                String message = String.format("Payment of $%.2f received for invoice %s", 
                    transaction.getAmount(), invoice.getInvoiceNumber());
                
                Set<Long> notificationUserIds = new HashSet<>();
                
                // Get users assigned to the case if this invoice is related to a case
                if (invoice.getLegalCaseId() != null) {
                    List<CaseAssignment> caseAssignments = caseAssignmentRepository.findActiveByCaseIdAndOrganizationId(invoice.getLegalCaseId(), orgId);
                    for (CaseAssignment assignment : caseAssignments) {
                        if (assignment.getAssignedTo() != null) {
                            notificationUserIds.add(assignment.getAssignedTo().getId());
                        }
                    }
                }
                
                for (Long userId : notificationUserIds) {
                    notificationService.sendCrmNotification(title, message, userId, 
                        "PAYMENT_RECEIVED", Map.of("paymentId", savedTransaction.getId(),
                                                  "invoiceId", invoice.getId(),
                                                  "invoiceNumber", invoice.getInvoiceNumber(),
                                                  "amount", transaction.getAmount(),
                                                  "caseId", invoice.getLegalCaseId() != null ? invoice.getLegalCaseId() : 0));
                }
                
                log.info("Payment received notifications sent to {} users", notificationUserIds.size());
            }
        } catch (Exception e) {
            log.error("Failed to send payment received notifications: {}", e.getMessage());
        }
        
        return savedTransaction;
    }

    @Override
    @Transactional
    public void cancelTransaction(Long id) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Verify ownership before cancellation
        PaymentTransaction transaction = transactionRepository.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new RuntimeException("Transaction not found or access denied"));

        transaction.setTransactionStatus("CANCELLED");
        transactionRepository.save(transaction);
    }

    @Override
    public List<PaymentTransaction> getTransactionsByType(String type) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        return transactionRepository.findByOrganizationIdAndTransactionType(orgId, type);
    }
}