package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.PaymentIntentDTO;
import com.bostoneo.bostoneosolutions.dto.PaymentMethodDTO;
import com.bostoneo.bostoneosolutions.model.Invoice;
import com.bostoneo.bostoneosolutions.model.InvoicePayment;

import java.util.List;

public interface PaymentGatewayService {
    PaymentIntentDTO createPaymentIntent(Invoice invoice);
    PaymentIntentDTO confirmPayment(String paymentIntentId);
    InvoicePayment processWebhookEvent(String payload, String signature);
    List<PaymentMethodDTO> getPaymentMethods(Long clientId);
    PaymentMethodDTO savePaymentMethod(Long clientId, String paymentMethodId);
    void deletePaymentMethod(String paymentMethodId);
}