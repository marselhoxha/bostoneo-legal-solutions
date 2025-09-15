package com.bostoneo.bostoneosolutions.service.impl;

import com.bostoneo.bostoneosolutions.dto.PaymentIntentDTO;
import com.bostoneo.bostoneosolutions.dto.PaymentMethodDTO;
import com.bostoneo.bostoneosolutions.model.Client;
import com.bostoneo.bostoneosolutions.model.Invoice;
import com.bostoneo.bostoneosolutions.model.InvoicePayment;
import com.bostoneo.bostoneosolutions.repository.ClientRepository;
import com.bostoneo.bostoneosolutions.repository.InvoicePaymentRepository;
import com.bostoneo.bostoneosolutions.service.PaymentGatewayService;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.exception.StripeException;
import com.stripe.model.Customer;
import com.stripe.model.Event;
import com.stripe.model.PaymentIntent;
import com.stripe.net.Webhook;
import com.stripe.param.CustomerCreateParams;
import com.stripe.param.PaymentIntentCreateParams;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class StripePaymentGatewayService implements PaymentGatewayService {

    private final ClientRepository clientRepository;
    private final InvoicePaymentRepository<InvoicePayment> paymentRepository;
    
    @Value("${stripe.webhook.secret}")
    private String webhookSecret;

    @Override
    @Transactional
    public PaymentIntentDTO createPaymentIntent(Invoice invoice) {
        try {
            Client client = invoice.getClient();
            
            // Ensure client has a Stripe customer ID
            if (client.getStripeCustomerId() == null) {
                Customer customer = createStripeCustomer(client);
                client.setStripeCustomerId(customer.getId());
                clientRepository.save(client);
            }

            // Convert amount to cents
            long amountInCents = invoice.getBalanceDue().multiply(new BigDecimal(100)).longValue();

            PaymentIntentCreateParams params = PaymentIntentCreateParams.builder()
                    .setAmount(amountInCents)
                    .setCurrency("usd")
                    .setCustomer(client.getStripeCustomerId())
                    .putMetadata("invoice_id", invoice.getId().toString())
                    .putMetadata("invoice_number", invoice.getInvoiceNumber())
                    .setDescription("Invoice " + invoice.getInvoiceNumber())
                    .build();

            PaymentIntent intent = PaymentIntent.create(params);

            return PaymentIntentDTO.builder()
                    .id(intent.getId())
                    .clientSecret(intent.getClientSecret())
                    .amount(invoice.getBalanceDue())
                    .currency(intent.getCurrency())
                    .status(intent.getStatus())
                    .invoiceId(invoice.getId())
                    .invoiceNumber(invoice.getInvoiceNumber())
                    .build();

        } catch (StripeException e) {
            log.error("Error creating payment intent: ", e);
            throw new RuntimeException("Failed to create payment intent", e);
        }
    }

    @Override
    public PaymentIntentDTO confirmPayment(String paymentIntentId) {
        try {
            PaymentIntent intent = PaymentIntent.retrieve(paymentIntentId);
            
            return PaymentIntentDTO.builder()
                    .id(intent.getId())
                    .status(intent.getStatus())
                    .amount(new BigDecimal(intent.getAmount()).divide(new BigDecimal(100)))
                    .currency(intent.getCurrency())
                    .build();

        } catch (StripeException e) {
            log.error("Error confirming payment: ", e);
            throw new RuntimeException("Failed to confirm payment", e);
        }
    }

    @Override
    @Transactional
    public InvoicePayment processWebhookEvent(String payload, String signature) {
        try {
            Event event = Webhook.constructEvent(payload, signature, webhookSecret);
            
            if ("payment_intent.succeeded".equals(event.getType())) {
                PaymentIntent intent = (PaymentIntent) event.getDataObjectDeserializer()
                        .getObject()
                        .orElseThrow();
                
                Long invoiceId = Long.parseLong(intent.getMetadata().get("invoice_id"));
                
                InvoicePayment payment = new InvoicePayment();
                payment.setInvoiceId(invoiceId);
                payment.setAmount(new BigDecimal(intent.getAmount()).divide(new BigDecimal(100)));
                payment.setPaymentMethod("CREDIT_CARD");
                payment.setReferenceNumber(intent.getId());
                payment.setPaymentDate(LocalDate.now());
                payment.setNotes("Stripe payment: " + intent.getId());
                
                return paymentRepository.create(payment);
            }
            
            return null;
            
        } catch (SignatureVerificationException e) {
            log.error("Invalid webhook signature", e);
            throw new RuntimeException("Invalid webhook signature", e);
        } catch (Exception e) {
            log.error("Error processing webhook", e);
            throw new RuntimeException("Failed to process webhook", e);
        }
    }

    @Override
    public List<PaymentMethodDTO> getPaymentMethods(Long clientId) {
        try {
            Client client = clientRepository.findById(clientId)
                    .orElseThrow(() -> new RuntimeException("Client not found"));
            
            if (client.getStripeCustomerId() == null) {
                return new ArrayList<>();
            }
            
            Customer customer = Customer.retrieve(client.getStripeCustomerId());
            List<PaymentMethodDTO> methods = new ArrayList<>();
            
            customer.getSources().getData().forEach(source -> {
                if (source instanceof com.stripe.model.Card) {
                    com.stripe.model.Card card = (com.stripe.model.Card) source;
                    methods.add(PaymentMethodDTO.builder()
                            .id(card.getId())
                            .type("card")
                            .brand(card.getBrand())
                            .last4(card.getLast4())
                            .expiryMonth(card.getExpMonth().toString())
                            .expiryYear(card.getExpYear().toString())
                            .clientId(clientId)
                            .isDefault(card.getId().equals(customer.getDefaultSource()))
                            .build());
                }
            });
            
            return methods;
            
        } catch (StripeException e) {
            log.error("Error retrieving payment methods", e);
            throw new RuntimeException("Failed to retrieve payment methods", e);
        }
    }

    @Override
    @Transactional
    public PaymentMethodDTO savePaymentMethod(Long clientId, String paymentMethodId) {
        try {
            Client client = clientRepository.findById(clientId)
                    .orElseThrow(() -> new RuntimeException("Client not found"));
            
            if (client.getStripeCustomerId() == null) {
                Customer customer = createStripeCustomer(client);
                client.setStripeCustomerId(customer.getId());
                clientRepository.save(client);
            }
            
            com.stripe.model.PaymentMethod paymentMethod = com.stripe.model.PaymentMethod.retrieve(paymentMethodId);
            paymentMethod.attach(com.stripe.param.PaymentMethodAttachParams.builder()
                    .setCustomer(client.getStripeCustomerId())
                    .build());
            
            return PaymentMethodDTO.builder()
                    .id(paymentMethod.getId())
                    .type(paymentMethod.getType())
                    .clientId(clientId)
                    .build();
            
        } catch (StripeException e) {
            log.error("Error saving payment method", e);
            throw new RuntimeException("Failed to save payment method", e);
        }
    }

    @Override
    public void deletePaymentMethod(String paymentMethodId) {
        try {
            com.stripe.model.PaymentMethod paymentMethod = com.stripe.model.PaymentMethod.retrieve(paymentMethodId);
            paymentMethod.detach();
        } catch (StripeException e) {
            log.error("Error deleting payment method", e);
            throw new RuntimeException("Failed to delete payment method", e);
        }
    }

    private Customer createStripeCustomer(Client client) throws StripeException {
        CustomerCreateParams params = CustomerCreateParams.builder()
                .setName(client.getClientName())
                .setEmail(client.getEmail())
                .setPhone(client.getPhone())
                .putMetadata("client_id", client.getId().toString())
                .build();
        
        return Customer.create(params);
    }
}