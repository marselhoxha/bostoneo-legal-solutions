package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.model.Customer;
import com.bostoneo.bostoneosolutions.model.Invoice;
import com.bostoneo.bostoneosolutions.model.Stats;
import com.bostoneo.bostoneosolutions.repository.CustomerRepository;
import com.bostoneo.bostoneosolutions.repository.InvoiceRepository;
import com.bostoneo.bostoneosolutions.rowmapper.StatsRowMapper;
import com.bostoneo.bostoneosolutions.service.CustomerService;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.RandomStringUtils;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.Date;
import java.util.Map;
import java.util.Optional;

import static com.bostoneo.bostoneosolutions.query.CustomerQuery.STATS_QUERY;

@Service
@Transactional
@RequiredArgsConstructor
@Slf4j
public class CustomerServiceImpl implements CustomerService {

    private final CustomerRepository customerRepository;
    private final InvoiceRepository invoiceRepository;
    private final NamedParameterJdbcTemplate jdbc;
    private final EntityManager entityManager;

    @Override
    public Customer createCustomer(Customer customer) {
       customer.setCreatedAt(new Date());
       return customerRepository.save(customer);
    }

    @Override
    public Customer updateCustomer(Customer customer) {
        return customerRepository.save(customer);
    }

    @Override
    public Page<Customer> getCustomers(int page, int size) {
        return customerRepository.findAll(PageRequest.of(page, size));
    }

    @Override
    public Iterable<Customer> getCustomers() {
        return customerRepository.findAll();
    }

    @Override
    public Customer getCustomer(Long id) {
        return customerRepository.findById(id).get();
    }

    @Override
    public Page<Customer> searchCustomers(String name, int page, int size) {
        return customerRepository.findByNameContaining(name, PageRequest.of(page, size));
    }

    @Override
    public void deleteCustomer(Long id) {
        log.info("Attempting to delete customer with ID: " + id);

        Optional<Customer> customerOptional = customerRepository.findById(id);

        if (customerOptional.isPresent()) {
            Customer customer = customerOptional.get();

            // Check if the customer has associated invoices
            if (!customer.getInvoices().isEmpty()) {
                log.info("Customer has associated invoices, removing them before deletion.");

                // Remove each invoice associated with the customer
                for (Invoice invoice : customer.getInvoices()) {
                    // Manually remove each invoice
                    entityManager.remove(entityManager.contains(invoice) ? invoice : entityManager.merge(invoice));
                }

                // Clear the invoices from the customer object to prevent any issues during deletion
                customer.getInvoices().clear();
                customerRepository.save(customer); // Save the customer to persist the changes
            }

            // Now that invoices are handled, delete the customer
            entityManager.remove(entityManager.contains(customer) ? customer : entityManager.merge(customer));
            entityManager.flush();  // Flush to ensure immediate execution
            log.info("Customer with ID " + id + " has been deleted.");
        } else {
            throw new RuntimeException("Customer with ID " + id + " not found");
        }
    }


    @Override
    public Invoice createInvoice(Invoice invoice) {
        invoice.setInvoiceNumber(RandomStringUtils.randomAlphanumeric(8).toUpperCase());
        return invoiceRepository.save(invoice);
    }

    @Override
    public Page<Invoice> getInvoices(int page, int size) {
        return invoiceRepository.findAll(PageRequest.of(page, size));
    }

    @Override
    public void addInvoiceToCustomer(Long id, Invoice invoice) {
        invoice.setInvoiceNumber(RandomStringUtils.randomAlphanumeric(8).toUpperCase());
        Customer customer = customerRepository.findById(id).get();
        invoice.setCustomer(customer);
        invoiceRepository.save(invoice);
    }

    @Override
    public Invoice getInvoice(Long id) {
        return invoiceRepository.findById(id).get();
    }


    @Override
    public void deleteInvoice(Long id) {
        System.out.println("Attempting to delete invoice with ID: " + id);

        Optional<Invoice> invoiceOptional = invoiceRepository.findById(id);

        if (invoiceOptional.isPresent()) {
            Invoice invoice = invoiceOptional.get();

            // Remove the invoice from the customer's invoices collection
            Customer customer = invoice.getCustomer();
            if (customer != null) {
                customer.getInvoices().remove(invoice);
                customerRepository.save(customer); // Save the customer to persist the change
            }

            // Ensure that the entity manager is aware of the deletion
            entityManager.remove(entityManager.contains(invoice) ? invoice : entityManager.merge(invoice));
            entityManager.flush();  // Flush to ensure immediate execution

            System.out.println("Invoice with ID " + id + " has been deleted.");
        } else {
            throw new RuntimeException("Invoice with ID " + id + " not found");
        }
    }


    @Override
    public Stats getStats() {
        return jdbc.queryForObject(STATS_QUERY, Map.of(), new StatsRowMapper());
    }
}
