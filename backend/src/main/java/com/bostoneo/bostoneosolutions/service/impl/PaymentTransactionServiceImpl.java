package com.***REMOVED***.***REMOVED***solutions.service.impl;

import com.***REMOVED***.***REMOVED***solutions.dto.PaymentTransactionDTO;
import com.***REMOVED***.***REMOVED***solutions.model.InvoicePayment;
import com.***REMOVED***.***REMOVED***solutions.model.PaymentTransaction;
import com.***REMOVED***.***REMOVED***solutions.repository.InvoicePaymentRepository;
import com.***REMOVED***.***REMOVED***solutions.repository.PaymentTransactionRepository;
import com.***REMOVED***.***REMOVED***solutions.service.PaymentTransactionService;
import com.***REMOVED***.***REMOVED***solutions.service.NotificationService;
import com.***REMOVED***.***REMOVED***solutions.repository.CaseAssignmentRepository;
import com.***REMOVED***.***REMOVED***solutions.repository.InvoiceRepository;
import com.***REMOVED***.***REMOVED***solutions.model.CaseAssignment;
import com.***REMOVED***.***REMOVED***solutions.model.Invoice;
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

    @Override
    @Transactional
    public PaymentTransaction createTransaction(PaymentTransactionDTO dto) {
        PaymentTransaction transaction = PaymentTransaction.builder()
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
        return transactionRepository.findById(id);
    }

    @Override
    public Page<PaymentTransaction> getTransactionsByInvoice(Long invoiceId, Pageable pageable) {
        return transactionRepository.findByInvoiceId(invoiceId, pageable);
    }

    @Override
    public List<PaymentTransaction> getPendingTransactions() {
        return transactionRepository.findByTransactionStatus("PENDING");
    }

    @Override
    @Transactional
    public PaymentTransaction updateTransactionStatus(Long id, String status, String notes) {
        PaymentTransaction transaction = transactionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Transaction not found"));
        
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
        PaymentTransaction transaction = transactionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Transaction not found"));
        
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
            // Get invoice details for notification
            Optional<Invoice> invoiceOpt = invoiceRepository.findById(transaction.getInvoiceId());
            if (invoiceOpt.isPresent()) {
                Invoice invoice = invoiceOpt.get();
                String title = "Payment Received";
                String message = String.format("Payment of $%.2f received for invoice %s", 
                    transaction.getAmount(), invoice.getInvoiceNumber());
                
                Set<Long> notificationUserIds = new HashSet<>();
                
                // Get users assigned to the case if this invoice is related to a case
                if (invoice.getLegalCaseId() != null) {
                    List<CaseAssignment> caseAssignments = caseAssignmentRepository.findActiveByCaseId(invoice.getLegalCaseId());
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
        PaymentTransaction transaction = transactionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Transaction not found"));
        
        transaction.setTransactionStatus("CANCELLED");
        transactionRepository.save(transaction);
    }

    @Override
    public List<PaymentTransaction> getTransactionsByType(String type) {
        return transactionRepository.findByTransactionType(type);
    }
}