package com.bostoneo.bostoneosolutions.dto;

import lombok.Data;
import lombok.Builder;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
public class TrustAccountDTO {
    private Long id;
    private String accountName;
    private String accountNumber;
    private String bankName;
    private String routingNumber;
    private String accountType;
    private BigDecimal currentBalance;
    private BigDecimal minimumBalance;
    private Boolean isActive;
    private LocalDateTime lastReconciliationDate;
    private String notes;
    private Long createdBy;
}