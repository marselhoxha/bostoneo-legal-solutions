package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.Customer;

import com.bostoneo.bostoneosolutions.model.Invoice;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.ListCrudRepository;
import org.springframework.data.repository.PagingAndSortingRepository;
import java.util.Date;
import java.util.List;

public interface InvoiceRepository extends PagingAndSortingRepository<Invoice, Long>, ListCrudRepository<Invoice, Long>, JpaRepository<Invoice, Long> {
    // Find all invoices by status
    List<Invoice> findByStatus(String status);

    // Count invoices by status
    long countByStatus(String status);

    // Count overdue unpaid invoices
    long countByStatusAndDateBefore(String status, Date date);
}
