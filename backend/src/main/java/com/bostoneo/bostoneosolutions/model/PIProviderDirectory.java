package com.bostoneo.bostoneosolutions.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;

/**
 * Entity for storing reusable medical provider contact information.
 * Allows organizations to build a directory of providers with
 * records and billing department contacts.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(NON_DEFAULT)
@Entity
@Table(name = "pi_provider_directory")
public class PIProviderDirectory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    // Provider Info
    @Column(name = "provider_name", nullable = false)
    private String providerName;

    @Column(name = "provider_type", length = 100)
    private String providerType; // HOSPITAL, CLINIC, SPECIALIST, IMAGING, PHARMACY

    @Column(name = "npi", length = 20)
    private String npi;

    // Main Contact
    @Column(name = "main_phone", length = 50)
    private String mainPhone;

    @Column(name = "main_email")
    private String mainEmail;

    @Column(name = "main_fax", length = 50)
    private String mainFax;

    @Column(name = "address", columnDefinition = "TEXT")
    private String address;

    @Column(name = "city", length = 100)
    private String city;

    @Column(name = "state", length = 50)
    private String state;

    @Column(name = "zip", length = 20)
    private String zip;

    // Records Department
    @Column(name = "records_contact_name")
    private String recordsContactName;

    @Column(name = "records_phone", length = 50)
    private String recordsPhone;

    @Column(name = "records_email")
    private String recordsEmail;

    @Column(name = "records_fax", length = 50)
    private String recordsFax;

    // Billing Department
    @Column(name = "billing_contact_name")
    private String billingContactName;

    @Column(name = "billing_phone", length = 50)
    private String billingPhone;

    @Column(name = "billing_email")
    private String billingEmail;

    @Column(name = "billing_fax", length = 50)
    private String billingFax;

    // Fee Info
    @Column(name = "base_fee", precision = 10, scale = 2)
    private BigDecimal baseFee;

    @Column(name = "per_page_fee", precision = 10, scale = 2)
    private BigDecimal perPageFee;

    @Column(name = "rush_fee", precision = 10, scale = 2)
    private BigDecimal rushFee;

    // Notes
    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    // Metadata
    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "created_by")
    private Long createdBy;
}
