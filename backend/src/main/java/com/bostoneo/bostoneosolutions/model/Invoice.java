package com.bostoneo.bostoneosolutions.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.util.Date;
import java.util.Collection;

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
@Table(name = "Invoice")
public class Invoice {

    @Id
    @GeneratedValue(strategy = IDENTITY)
    @Column(name = "id", columnDefinition = "BIGINT UNSIGNED")
    private Long id;

    @Column(name = "invoice_number", nullable = false, unique = true, length = 50)
    private String invoiceNumber;

    @Column(name = "date", nullable = false)
    @Temporal(TemporalType.TIMESTAMP)
    private Date date;

    @Column(name = "total", nullable = false)
    private Double total;

    @Column(name = "status", nullable = false, length = 50)
    private String status;

    @Column(name = "services", columnDefinition = "TEXT")
    private String services;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "customer_id", nullable = false, columnDefinition = "BIGINT UNSIGNED")
    @JsonIgnoreProperties("invoices")
    private Customer customer;

    @OneToMany(mappedBy = "invoice", fetch = FetchType.LAZY)
    @JsonIgnoreProperties("invoice")
    private Collection<Expense> expenses;
}
