package com.bostoneo.bostoneosolutions.model;

import com.fasterxml.jackson.annotation.JsonManagedReference;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "invoice_templates")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class InvoiceTemplate {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id")
    private Long organizationId;

    @NotBlank(message = "Template name is required")
    @Size(max = 100)
    @Column(nullable = false, unique = true)
    private String name;
    
    @Size(max = 500)
    private String description;
    
    @Column(name = "is_active")
    private Boolean isActive = true;
    
    @Column(name = "is_default")
    private Boolean isDefault = false;
    
    // Template settings
    @Column(name = "tax_rate", precision = 5, scale = 2)
    private BigDecimal taxRate = BigDecimal.ZERO;
    
    @Column(name = "payment_terms")
    private Integer paymentTerms = 30;
    
    @Column(name = "currency_code", length = 3)
    private String currencyCode = "USD";
    
    // Template content
    @Column(name = "header_text", columnDefinition = "TEXT")
    private String headerText;
    
    @Column(name = "footer_text", columnDefinition = "TEXT")
    private String footerText;
    
    @Column(name = "notes_template", columnDefinition = "TEXT")
    private String notesTemplate;
    
    @Column(name = "terms_and_conditions", columnDefinition = "TEXT")
    private String termsAndConditions;
    
    // Styling options
    @Column(name = "logo_position", length = 20)
    private String logoPosition = "top-left";
    
    @Column(name = "primary_color", length = 7)
    private String primaryColor = "#405189";
    
    @Column(name = "secondary_color", length = 7)
    private String secondaryColor = "#878a99";
    
    @Column(name = "font_family", length = 50)
    private String fontFamily = "Inter";
    
    // Relationships
    @OneToMany(mappedBy = "template", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @OrderBy("sortOrder ASC")
    @JsonManagedReference
    private List<InvoiceTemplateItem> templateItems = new ArrayList<>();
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    @ToString.Exclude
    private User createdBy;
    
    // Metadata
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
    
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }
    
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
    
    // Helper methods
    public void addTemplateItem(InvoiceTemplateItem item) {
        templateItems.add(item);
        item.setTemplate(this);
    }
    
    public void removeTemplateItem(InvoiceTemplateItem item) {
        templateItems.remove(item);
        item.setTemplate(null);
    }
}