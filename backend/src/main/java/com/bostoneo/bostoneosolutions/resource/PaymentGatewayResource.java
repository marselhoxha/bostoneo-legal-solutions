package com.bostoneo.bostoneosolutions.resource;

import com.bostoneo.bostoneosolutions.dto.PaymentIntentDTO;
import com.bostoneo.bostoneosolutions.dto.PaymentMethodDTO;
import com.bostoneo.bostoneosolutions.exception.ApiException;
import com.bostoneo.bostoneosolutions.model.Invoice;
import com.bostoneo.bostoneosolutions.model.InvoicePayment;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.repository.ClientRepository;
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
    private final ClientRepository clientRepository;
    private final TenantService tenantService;

    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new ApiException("Organization context required"));
    }

    @PostMapping("/intent/{invoiceId}")
    @PreAuthorize("hasAuthority('UPDATE:INVOICE')")
    public ResponseEntity<PaymentIntentDTO> createPaymentIntent(@PathVariable Long invoiceId) {
        Long orgId = getRequiredOrganizationId();
        Invoice invoice = invoiceRepository.findByIdAndOrganizationId(invoiceId, orgId)
                .orElseThrow(() -> new ApiException("Invoice not found"));

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
        // SECURITY: Verify client belongs to current organization
        Long orgId = getRequiredOrganizationId();
        if (!clientRepository.existsByIdAndOrganizationId(clientId, orgId)) {
            throw new ApiException("Client not found or access denied");
        }
        List<PaymentMethodDTO> methods = paymentGatewayService.getPaymentMethods(clientId);
        return ResponseEntity.ok(methods);
    }

    @PostMapping("/methods/client/{clientId}")
    @PreAuthorize("hasAuthority('UPDATE:CLIENT')")
    public ResponseEntity<PaymentMethodDTO> savePaymentMethod(
            @PathVariable Long clientId,
            @RequestBody Map<String, String> request) {
        // SECURITY: Verify client belongs to current organization
        Long orgId = getRequiredOrganizationId();
        if (!clientRepository.existsByIdAndOrganizationId(clientId, orgId)) {
            throw new ApiException("Client not found or access denied");
        }
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