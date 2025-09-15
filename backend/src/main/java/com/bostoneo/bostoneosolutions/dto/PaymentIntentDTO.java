package com.bostoneo.bostoneosolutions.dto;

import lombok.Data;
import lombok.Builder;
import java.math.BigDecimal;

@Data
@Builder
public class PaymentIntentDTO {
    private String id;
    private String clientSecret;
    private BigDecimal amount;
    private String currency;
    private String status;
    private Long invoiceId;
    private String invoiceNumber;
}