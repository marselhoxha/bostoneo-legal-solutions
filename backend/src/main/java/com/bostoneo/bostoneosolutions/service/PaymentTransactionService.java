package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.PaymentTransactionDTO;
import com.bostoneo.bostoneosolutions.model.PaymentTransaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;

public interface PaymentTransactionService {
    PaymentTransaction createTransaction(PaymentTransactionDTO dto);
    Optional<PaymentTransaction> getTransaction(Long id);
    Page<PaymentTransaction> getTransactionsByInvoice(Long invoiceId, Pageable pageable);
    List<PaymentTransaction> getPendingTransactions();
    PaymentTransaction updateTransactionStatus(Long id, String status, String notes);
    PaymentTransaction completeTransaction(Long id);
    void cancelTransaction(Long id);
    List<PaymentTransaction> getTransactionsByType(String type);
}