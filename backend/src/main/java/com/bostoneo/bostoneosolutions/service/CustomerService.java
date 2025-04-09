package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.model.Customer;
import com.bostoneo.bostoneosolutions.model.Invoice;
import com.bostoneo.bostoneosolutions.model.Stats;
import org.springframework.data.domain.Page;


public interface CustomerService {

    //Customer functions
    Customer createCustomer(Customer customer);
    Customer updateCustomer(Customer customer);
    Page<Customer> getCustomers(int page, int size);
    Iterable<Customer> getCustomers();
    Customer getCustomer(Long id);
    Page<Customer> searchCustomers(String name, int page, int size);

    //Invoice functions
    Invoice createInvoice(Invoice invoice);
    Page<Invoice> getInvoices(int page, int size);
    void addInvoiceToCustomer(Long id, Invoice invoice);

    Invoice getInvoice(Long id);


    void deleteInvoice(Long id);

    void deleteCustomer(Long id);

    Stats getStats();
}
