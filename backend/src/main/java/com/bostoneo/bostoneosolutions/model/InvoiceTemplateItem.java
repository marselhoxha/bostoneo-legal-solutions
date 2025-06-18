package com.***REMOVED***.***REMOVED***solutions.model;

import com.fasterxml.jackson.annotation.JsonBackReference;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "invoice_template_items")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class InvoiceTemplateItem {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "template_id", nullable = false)
    @JsonBackReference
    @ToString.Exclude
    private InvoiceTemplate template;
    
    @NotBlank(message = "Description is required")
    @Size(max = 500)
    @Column(nullable = false)
    private String description;
    
    @Column(name = "default_quantity", precision = 10, scale = 2)
    private BigDecimal defaultQuantity = BigDecimal.ONE;
    
    @Column(name = "default_unit_price", precision = 15, scale = 2)
    private BigDecimal defaultUnitPrice;
    
    @Size(max = 50)
    private String category;
    
    @Column(name = "is_optional")
    private Boolean isOptional = false;
    
    @Column(name = "sort_order")
    private Integer sortOrder = 0;
    
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
}