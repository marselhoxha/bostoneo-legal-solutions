package com.***REMOVED***.***REMOVED***solutions.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.util.Date;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;
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
    private Long id;
    private String invoiceNumber;
    private String services;
    private Date date;
    private String status;
    private double total;

    @ManyToOne
    @JoinColumn(name = "customer_id", nullable = false) // Create a foreign key column
    @JsonIgnore // Prevent infinite recursion
    private Customer customer;
}
