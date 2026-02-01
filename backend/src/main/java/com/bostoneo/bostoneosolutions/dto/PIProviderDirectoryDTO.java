package com.bostoneo.bostoneosolutions.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * DTO for PI Provider Directory
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PIProviderDirectoryDTO {

    private Long id;
    private Long organizationId;

    // Provider Info
    private String providerName;
    private String providerType;
    private String npi;

    // Main Contact
    private String mainPhone;
    private String mainEmail;
    private String mainFax;
    private String address;
    private String city;
    private String state;
    private String zip;

    // Records Department
    private String recordsContactName;
    private String recordsPhone;
    private String recordsEmail;
    private String recordsFax;

    // Billing Department
    private String billingContactName;
    private String billingPhone;
    private String billingEmail;
    private String billingFax;

    // Fee Info
    private BigDecimal baseFee;
    private BigDecimal perPageFee;
    private BigDecimal rushFee;

    // Notes
    private String notes;

    // Metadata
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime createdAt;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime updatedAt;

    private Long createdBy;
    private String createdByName;

    // Computed fields
    private String fullAddress;
    private Boolean hasRecordsContact;
    private Boolean hasBillingContact;

    public String getFullAddress() {
        if (address == null) return null;
        StringBuilder sb = new StringBuilder(address);
        if (city != null) sb.append(", ").append(city);
        if (state != null) sb.append(", ").append(state);
        if (zip != null) sb.append(" ").append(zip);
        return sb.toString();
    }

    public Boolean getHasRecordsContact() {
        return recordsEmail != null || recordsPhone != null || recordsFax != null;
    }

    public Boolean getHasBillingContact() {
        return billingEmail != null || billingPhone != null || billingFax != null;
    }
}
