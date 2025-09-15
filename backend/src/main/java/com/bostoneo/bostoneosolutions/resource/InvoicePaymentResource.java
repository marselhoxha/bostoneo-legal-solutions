package com.bostoneo.bostoneosolutions.resource;

import com.bostoneo.bostoneosolutions.dto.CustomHttpResponse;
import com.bostoneo.bostoneosolutions.dto.InvoicePaymentDTO;
import com.bostoneo.bostoneosolutions.service.InvoicePaymentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/invoices")
@RequiredArgsConstructor
@Slf4j
public class InvoicePaymentResource {
    
    private final InvoicePaymentService paymentService;
    
    @PostMapping("/{invoiceId}/payments")
    @PreAuthorize("hasAnyAuthority('BILLING:EDIT', 'BILLING:ADMIN')")
    public ResponseEntity<CustomHttpResponse<InvoicePaymentDTO>> createPayment(
            @PathVariable Long invoiceId,
            @Valid @RequestBody InvoicePaymentDTO paymentDTO) {
        
        paymentDTO.setInvoiceId(invoiceId);
        InvoicePaymentDTO savedPayment = paymentService.createPayment(paymentDTO);
        
        return ResponseEntity.status(HttpStatus.CREATED).body(
            new CustomHttpResponse<>(HttpStatus.CREATED.value(), "Payment recorded successfully", savedPayment)
        );
    }
    
    @GetMapping("/{invoiceId}/payments")
    @PreAuthorize("hasAnyAuthority('BILLING:VIEW', 'BILLING:EDIT', 'BILLING:ADMIN')")
    public ResponseEntity<CustomHttpResponse<List<InvoicePaymentDTO>>> getInvoicePayments(
            @PathVariable Long invoiceId) {
        
        List<InvoicePaymentDTO> payments = paymentService.getPaymentsByInvoiceId(invoiceId);
        
        return ResponseEntity.ok(
            new CustomHttpResponse<>(HttpStatus.OK.value(), "Payments retrieved successfully", payments)
        );
    }
    
    @GetMapping("/payments/{paymentId}")
    @PreAuthorize("hasAnyAuthority('BILLING:VIEW', 'BILLING:EDIT', 'BILLING:ADMIN')")
    public ResponseEntity<CustomHttpResponse<InvoicePaymentDTO>> getPayment(
            @PathVariable Long paymentId) {
        
        InvoicePaymentDTO payment = paymentService.getPayment(paymentId);
        
        return ResponseEntity.ok(
            new CustomHttpResponse<>(HttpStatus.OK.value(), "Payment retrieved successfully", payment)
        );
    }
    
    @DeleteMapping("/payments/{paymentId}")
    @PreAuthorize("hasAnyAuthority('BILLING:DELETE', 'BILLING:ADMIN')")
    public ResponseEntity<CustomHttpResponse<Void>> deletePayment(
            @PathVariable Long paymentId) {
        
        paymentService.deletePayment(paymentId);
        
        return ResponseEntity.ok(
            new CustomHttpResponse<>(HttpStatus.OK.value(), "Payment deleted successfully", null)
        );
    }
    
    @GetMapping("/payments/recent")
    @PreAuthorize("hasAnyAuthority('BILLING:VIEW', 'BILLING:EDIT', 'BILLING:ADMIN')")
    public ResponseEntity<CustomHttpResponse<List<InvoicePaymentDTO>>> getRecentPayments(
            @RequestParam(defaultValue = "10") int limit) {
        
        List<InvoicePaymentDTO> payments = paymentService.getRecentPayments(limit);
        
        return ResponseEntity.ok(
            new CustomHttpResponse<>(HttpStatus.OK.value(), "Recent payments retrieved successfully", payments)
        );
    }
    
    @GetMapping("/payments/analytics")
    @PreAuthorize("hasAnyAuthority('BILLING:VIEW', 'BILLING:EDIT', 'BILLING:ADMIN')")
    public ResponseEntity<CustomHttpResponse<Map<String, Object>>> getPaymentAnalytics(
            @RequestParam String startDate,
            @RequestParam String endDate) {
        
        BigDecimal totalPayments = paymentService.getTotalPaymentsByDateRange(startDate, endDate);
        
        Map<String, Object> analytics = Map.of(
            "startDate", startDate,
            "endDate", endDate,
            "totalPayments", totalPayments
        );
        
        return ResponseEntity.ok(
            new CustomHttpResponse<>(HttpStatus.OK.value(), "Payment analytics retrieved successfully", analytics)
        );
    }
}