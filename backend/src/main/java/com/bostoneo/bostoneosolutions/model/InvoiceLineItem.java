package com.bostoneo.bostoneosolutions.model;

import com.fasterxml.jackson.annotation.JsonBackReference;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;

import jakarta.persistence.*;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "invoice_line_items")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class InvoiceLineItem {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "invoice_id", nullable = false)
    @JsonBackReference
    @ToString.Exclude
    private Invoice invoice;
    
    @NotBlank(message = "Description is required")
    @Column(nullable = false, length = 500)
    private String description;
    
    @NotNull(message = "Quantity is required")
    @DecimalMin(value = "0.01", message = "Quantity must be greater than 0")
    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal quantity = BigDecimal.ONE;
    
    @NotNull(message = "Unit price is required")
    @DecimalMin(value = "0.00", message = "Unit price cannot be negative")
    @Column(name = "unit_price", nullable = false, precision = 15, scale = 2)
    private BigDecimal unitPrice;
    
    @NotNull(message = "Amount is required")
    @DecimalMin(value = "0.00", message = "Amount cannot be negative")
    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;
    
    @Column(name = "line_order", nullable = false)
    private Integer lineOrder = 0;
    
    @Column(length = 50)
    private String category;
    
    @Column(name = "service_date")
    private LocalDate serviceDate;

    @Column(name = "organization_id")
    private Long organizationId;
    
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
    
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (amount == null && unitPrice != null && quantity != null) {
            amount = unitPrice.multiply(quantity);
        }
    }
    
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
        if (unitPrice != null && quantity != null) {
            amount = unitPrice.multiply(quantity);
        }
    }
}