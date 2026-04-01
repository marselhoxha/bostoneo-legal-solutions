package com.bostoneo.bostoneosolutions.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.bostoneo.bostoneosolutions.converter.EncryptedStringConverter;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.util.Collection;
import java.util.Date;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;
import static jakarta.persistence.CascadeType.ALL;
import static jakarta.persistence.FetchType.EAGER;
import static jakarta.persistence.GenerationType.IDENTITY;

@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_DEFAULT)
@Entity
@Table(name = "clients")
public class Client {

    @Id
    @GeneratedValue(strategy = IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "organization_id")
    private Long organizationId;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    // NOTE: email is NOT encrypted because it's used as a lookup key in SQL WHERE clauses.
    // Encrypting it would break ClientRepository.findByEmail() and conflict check queries.
    @Column(name = "email", length = 100)
    private String email;

    @Column(name = "type", length = 50)
    private String type;

    @Column(name = "status", length = 50)
    private String status;

    @Column(name = "address", columnDefinition = "TEXT")
    @Convert(converter = EncryptedStringConverter.class)
    private String address;

    @Column(name = "phone", columnDefinition = "TEXT")
    @Convert(converter = EncryptedStringConverter.class)
    private String phone;
    
    @Column(name = "image_url", length = 255)
    private String imageUrl;
    
    @Column(name = "stripe_customer_id", length = 255)
    private String stripeCustomerId;
    
    @Column(name = "created_at")
    @Temporal(TemporalType.TIMESTAMP)
    private Date createdAt;
    
    @PrePersist
    protected void onCreate() {
        createdAt = new Date();
    }

    // ABA Rule 1.4: AI Disclosure Consent tracking
    @Column(name = "ai_consent_given")
    private Boolean aiConsentGiven;

    @Column(name = "ai_consent_date")
    @Temporal(TemporalType.TIMESTAMP)
    private Date aiConsentDate;

    @Column(name = "ai_consent_notes", columnDefinition = "TEXT")
    private String aiConsentNotes;

    @Column(name = "ai_consent_token", length = 255)
    @JsonIgnore
    private String aiConsentToken;

    @OneToMany(mappedBy = "client", fetch = FetchType.EAGER, cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    @JsonIgnoreProperties("client")
    private Collection<Invoice> invoices;

    @OneToMany(mappedBy = "client", fetch = FetchType.LAZY)
    @JsonIgnoreProperties("client")
    private Collection<Expense> expenses;
    
    public String getClientName() {
        return this.name;
    }
}
