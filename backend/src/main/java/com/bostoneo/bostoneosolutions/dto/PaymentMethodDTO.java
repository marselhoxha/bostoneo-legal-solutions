package com.***REMOVED***.***REMOVED***solutions.dto;

import lombok.Data;
import lombok.Builder;

@Data
@Builder
public class PaymentMethodDTO {
    private String id;
    private String type;
    private String brand;
    private String last4;
    private String expiryMonth;
    private String expiryYear;
    private Long clientId;
    private boolean isDefault;
}