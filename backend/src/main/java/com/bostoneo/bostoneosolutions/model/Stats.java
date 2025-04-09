package com.bostoneo.bostoneosolutions.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.Entity;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;

@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
//@JsonInclude(NON_DEFAULT)
public class Stats {
    private int totalCustomers;
    private int totalInvoices;
    private double totalBilled;
}
