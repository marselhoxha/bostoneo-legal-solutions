package com.***REMOVED***.***REMOVED***solutions.model;

import com.***REMOVED***.***REMOVED***solutions.enumeration.InvoiceStatus;
import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "invoices")
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class Invoice {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "invoice_number", unique = true)
    private String invoiceNumber;

    @Column(name = "client_id", nullable = false)
    private Long clientId;

    @Column(name = "client_name")
    private String clientName;

    @Column(name = "legal_case_id")
    private Long legalCaseId;

    @Column(name = "case_name")
    private String caseName;

    @Column(name = "issue_date", nullable = false)
    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate issueDate;

    @Column(name = "due_date", nullable = false)
    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate dueDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private InvoiceStatus status;

    @Column(name = "subtotal", nullable = false, precision = 10, scale = 2)
    private BigDecimal subtotal;

    @Column(name = "tax_rate", precision = 5, scale = 2)
    private BigDecimal taxRate;

    @Column(name = "tax_amount", precision = 10, scale = 2)
    private BigDecimal taxAmount;

    @Column(name = "total_amount", nullable = false, precision = 10, scale = 2)
    private BigDecimal totalAmount;
    
    @Column(name = "total_paid", precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal totalPaid = BigDecimal.ZERO;
    
    @Column(name = "balance_due", precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal balanceDue = BigDecimal.ZERO;
    
    @Column(name = "last_payment_date")
    private LocalDate lastPaymentDate;
    
    @Column(name = "payment_status", length = 20)
    @Builder.Default
    private String paymentStatus = "UNPAID";

    @Column(name = "notes", length = 1000)
    private String notes;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "invoice_time_entries",
        joinColumns = @JoinColumn(name = "invoice_id"),
        inverseJoinColumns = @JoinColumn(name = "time_entry_id")
    )
    @JsonIgnoreProperties({"invoice"})
    private List<TimeEntry> timeEntries = new ArrayList<>();

    @Column(name = "created_by")
    private Long createdBy;

    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        if (this.invoiceNumber == null || this.invoiceNumber.isEmpty()) {
            this.invoiceNumber = generateInvoiceNumber();
        }
    }

    private String generateInvoiceNumber() {
        // Format: INV-YYYY-XXXX where XXXX is a random number between 1000-9999
        int randomNum = 1000 + (int)(Math.random() * 9000);
        return "INV-" + LocalDate.now().getYear() + "-" + randomNum;
    }
    
    // Helper methods for compatibility
    public BigDecimal getTotal() {
        return totalAmount;
    }
    
    public LocalDate getDate() {
        return issueDate;
    }
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "client_id", insertable = false, updatable = false)
    private Client client;
    
    @OneToMany(mappedBy = "invoice", fetch = FetchType.LAZY)
    private List<Expense> expenses = new ArrayList<>();
    
    @OneToMany(mappedBy = "invoice", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @OrderBy("lineOrder ASC")
    private List<InvoiceLineItem> lineItems = new ArrayList<>();
}
