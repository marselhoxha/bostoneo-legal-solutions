package com.***REMOVED***.***REMOVED***solutions.service;

import com.***REMOVED***.***REMOVED***solutions.dto.PaymentIntentDTO;
import com.***REMOVED***.***REMOVED***solutions.dto.PaymentMethodDTO;
import com.***REMOVED***.***REMOVED***solutions.model.Invoice;
import com.***REMOVED***.***REMOVED***solutions.model.InvoicePayment;

import java.util.List;

public interface PaymentGatewayService {
    PaymentIntentDTO createPaymentIntent(Invoice invoice);
    PaymentIntentDTO confirmPayment(String paymentIntentId);
    InvoicePayment processWebhookEvent(String payload, String signature);
    List<PaymentMethodDTO> getPaymentMethods(Long clientId);
    PaymentMethodDTO savePaymentMethod(Long clientId, String paymentMethodId);
    void deletePaymentMethod(String paymentMethodId);
}