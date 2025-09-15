package com.bostoneo.bostoneosolutions.resource;

import com.bostoneo.bostoneosolutions.dto.PaymentTransactionDTO;
import com.bostoneo.bostoneosolutions.model.PaymentTransaction;
import com.bostoneo.bostoneosolutions.service.PaymentTransactionService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/payment-transactions")
@RequiredArgsConstructor
public class PaymentTransactionResource {

    private final PaymentTransactionService transactionService;

    @PostMapping
    @PreAuthorize("hasAuthority('CREATE:PAYMENT_TRANSACTION')")
    public ResponseEntity<PaymentTransaction> createTransaction(@RequestBody PaymentTransactionDTO dto) {
        PaymentTransaction transaction = transactionService.createTransaction(dto);
        return new ResponseEntity<>(transaction, HttpStatus.CREATED);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('READ:PAYMENT_TRANSACTION')")
    public ResponseEntity<PaymentTransaction> getTransaction(@PathVariable Long id) {
        return transactionService.getTransaction(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/invoice/{invoiceId}")
    @PreAuthorize("hasAuthority('READ:PAYMENT_TRANSACTION')")
    public ResponseEntity<Page<PaymentTransaction>> getTransactionsByInvoice(
            @PathVariable Long invoiceId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Page<PaymentTransaction> transactions = transactionService.getTransactionsByInvoice(
                invoiceId, PageRequest.of(page, size));
        return ResponseEntity.ok(transactions);
    }

    @GetMapping("/pending")
    @PreAuthorize("hasAuthority('READ:PAYMENT_TRANSACTION')")
    public ResponseEntity<List<PaymentTransaction>> getPendingTransactions() {
        List<PaymentTransaction> transactions = transactionService.getPendingTransactions();
        return ResponseEntity.ok(transactions);
    }

    @GetMapping("/type/{type}")
    @PreAuthorize("hasAuthority('READ:PAYMENT_TRANSACTION')")
    public ResponseEntity<List<PaymentTransaction>> getTransactionsByType(@PathVariable String type) {
        List<PaymentTransaction> transactions = transactionService.getTransactionsByType(type);
        return ResponseEntity.ok(transactions);
    }

    @PutMapping("/{id}/status")
    @PreAuthorize("hasAuthority('UPDATE:PAYMENT_TRANSACTION')")
    public ResponseEntity<PaymentTransaction> updateTransactionStatus(
            @PathVariable Long id,
            @RequestBody Map<String, String> statusUpdate) {
        String status = statusUpdate.get("status");
        String notes = statusUpdate.get("notes");
        PaymentTransaction transaction = transactionService.updateTransactionStatus(id, status, notes);
        return ResponseEntity.ok(transaction);
    }

    @PostMapping("/{id}/complete")
    @PreAuthorize("hasAuthority('UPDATE:PAYMENT_TRANSACTION')")
    public ResponseEntity<PaymentTransaction> completeTransaction(@PathVariable Long id) {
        PaymentTransaction transaction = transactionService.completeTransaction(id);
        return ResponseEntity.ok(transaction);
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasAuthority('UPDATE:PAYMENT_TRANSACTION')")
    public ResponseEntity<Void> cancelTransaction(@PathVariable Long id) {
        transactionService.cancelTransaction(id);
        return ResponseEntity.ok().build();
    }
}