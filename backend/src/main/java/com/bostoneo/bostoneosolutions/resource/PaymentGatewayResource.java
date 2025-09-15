package com.bostoneo.bostoneosolutions.resource;

import com.bostoneo.bostoneosolutions.dto.PaymentIntentDTO;
import com.bostoneo.bostoneosolutions.dto.PaymentMethodDTO;
import com.bostoneo.bostoneosolutions.model.Invoice;
import com.bostoneo.bostoneosolutions.model.InvoicePayment;
import com.bostoneo.bostoneosolutions.repository.InvoiceRepository;
import com.bostoneo.bostoneosolutions.service.PaymentGatewayService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/payments")
@RequiredArgsConstructor
public class PaymentGatewayResource {

    private final PaymentGatewayService paymentGatewayService;
    private final InvoiceRepository invoiceRepository;

    @PostMapping("/intent/{invoiceId}")
    @PreAuthorize("hasAuthority('UPDATE:INVOICE')")
    public ResponseEntity<PaymentIntentDTO> createPaymentIntent(@PathVariable Long invoiceId) {
        Invoice invoice = invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new RuntimeException("Invoice not found"));
        
        PaymentIntentDTO intent = paymentGatewayService.createPaymentIntent(invoice);
        return ResponseEntity.ok(intent);
    }

    @GetMapping("/intent/{paymentIntentId}")
    @PreAuthorize("hasAuthority('READ:INVOICE')")
    public ResponseEntity<PaymentIntentDTO> getPaymentIntent(@PathVariable String paymentIntentId) {
        PaymentIntentDTO intent = paymentGatewayService.confirmPayment(paymentIntentId);
        return ResponseEntity.ok(intent);
    }

    @PostMapping("/webhook")
    public ResponseEntity<String> handleWebhook(
            @RequestBody String payload,
            @RequestHeader("Stripe-Signature") String signature) {
        try {
            InvoicePayment payment = paymentGatewayService.processWebhookEvent(payload, signature);
            return ResponseEntity.ok("Webhook processed successfully");
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Webhook processing failed: " + e.getMessage());
        }
    }

    @GetMapping("/methods/client/{clientId}")
    @PreAuthorize("hasAuthority('READ:CLIENT')")
    public ResponseEntity<List<PaymentMethodDTO>> getPaymentMethods(@PathVariable Long clientId) {
        List<PaymentMethodDTO> methods = paymentGatewayService.getPaymentMethods(clientId);
        return ResponseEntity.ok(methods);
    }

    @PostMapping("/methods/client/{clientId}")
    @PreAuthorize("hasAuthority('UPDATE:CLIENT')")
    public ResponseEntity<PaymentMethodDTO> savePaymentMethod(
            @PathVariable Long clientId,
            @RequestBody Map<String, String> request) {
        String paymentMethodId = request.get("paymentMethodId");
        PaymentMethodDTO method = paymentGatewayService.savePaymentMethod(clientId, paymentMethodId);
        return ResponseEntity.ok(method);
    }

    @DeleteMapping("/methods/{paymentMethodId}")
    @PreAuthorize("hasAuthority('UPDATE:CLIENT')")
    public ResponseEntity<Void> deletePaymentMethod(@PathVariable String paymentMethodId) {
        paymentGatewayService.deletePaymentMethod(paymentMethodId);
        return ResponseEntity.ok().build();
    }
}