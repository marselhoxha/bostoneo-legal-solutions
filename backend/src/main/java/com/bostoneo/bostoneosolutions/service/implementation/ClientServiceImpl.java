package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.annotation.AuditLog;
import com.bostoneo.bostoneosolutions.model.Client;
import com.bostoneo.bostoneosolutions.model.Invoice;
import com.bostoneo.bostoneosolutions.model.Stats;
import com.bostoneo.bostoneosolutions.repository.ClientRepository;
import com.bostoneo.bostoneosolutions.repository.InvoiceRepository;
import com.bostoneo.bostoneosolutions.rowmapper.StatsRowMapper;
import com.bostoneo.bostoneosolutions.service.ClientService;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.RandomStringUtils;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static com.bostoneo.bostoneosolutions.query.ClientQuery.STATS_QUERY;

@Service
@Transactional
@RequiredArgsConstructor
@Slf4j
public class ClientServiceImpl implements ClientService {

    private final ClientRepository clientRepository;
    private final InvoiceRepository invoiceRepository;
    private final NamedParameterJdbcTemplate jdbc;
    private final EntityManager entityManager;
    private final TenantService tenantService;

    @Override
    public Client createClient(Client client) {
       client.setCreatedAt(new Date());
       return clientRepository.save(client);
    }

    @Override
    public Client updateClient(Client client) {
        return clientRepository.save(client);
    }

    @Override
    public Page<Client> getClients(int page, int size) {
        Pageable pageable = PageRequest.of(page, size);

        // Use tenant-filtered query if organization context is available
        return tenantService.getCurrentOrganizationId()
            .map(orgId -> clientRepository.findByOrganizationId(orgId, pageable))
            .orElseGet(() -> clientRepository.findAll(pageable));
    }

    @Override
    public Iterable<Client> getClients() {
        return clientRepository.findAll();
    }

    @Override
    public Client getClient(Long id) {
        return clientRepository.findById(id).get();
    }

    @Override
    public Page<Client> searchClients(String name, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);

        // Use tenant-filtered search if organization context is available
        return tenantService.getCurrentOrganizationId()
            .map(orgId -> clientRepository.findByOrganizationIdAndNameContaining(orgId, name, pageable))
            .orElseGet(() -> clientRepository.findByNameContaining(name, pageable));
    }

    @Override
    public List<Client> getClientsWithUnbilledTimeEntries() {
        log.info("Retrieving clients with unbilled time entries");

        // Use tenant-filtered query if organization context is available
        List<Client> clients = tenantService.getCurrentOrganizationId()
            .map(orgId -> clientRepository.findClientsWithUnbilledTimeEntriesByOrganization(orgId))
            .orElseGet(() -> clientRepository.findClientsWithUnbilledTimeEntries());

        log.info("Found {} clients with unbilled time entries", clients.size());
        return clients;
    }

    @Override
    public void deleteClient(Long id) {
        log.info("Attempting to delete client with ID: " + id);

        Optional<Client> clientOptional = clientRepository.findById(id);

        if (clientOptional.isPresent()) {
            Client client = clientOptional.get();

            // Check if the client has associated invoices
            if (!client.getInvoices().isEmpty()) {
                log.info("Client has associated invoices, removing them before deletion.");

                // Remove each invoice associated with the client
                for (Invoice invoice : client.getInvoices()) {
                    // Manually remove each invoice
                    entityManager.remove(entityManager.contains(invoice) ? invoice : entityManager.merge(invoice));
                }

                // Clear the invoices from the client object to prevent any issues during deletion
                client.getInvoices().clear();
                clientRepository.save(client); // Save the client to persist the changes
            }

            // Now that invoices are handled, delete the client
            entityManager.remove(entityManager.contains(client) ? client : entityManager.merge(client));
            entityManager.flush();  // Flush to ensure immediate execution
            log.info("Client with ID " + id + " has been deleted.");
        } else {
            throw new RuntimeException("Client with ID " + id + " not found");
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
    public Page<Invoice> getInvoicesForClient(Long clientId, int page, int size) {
        // For clients, return only their invoices
        // This would typically filter invoices by client ID
        // For now returning empty page as clients are not directly linked to invoices
        return Page.empty(PageRequest.of(page, size));
    }

    @Override
    public void addInvoiceToClient(Long id, Invoice invoice) {
        invoice.setInvoiceNumber(RandomStringUtils.randomAlphanumeric(8).toUpperCase());
        Client client = clientRepository.findById(id).get();
        invoice.setClient(client);
        invoiceRepository.save(invoice);
    }

    @Override
    public Invoice getInvoice(Long id) {
        return invoiceRepository.findById(id).get();
    }


    @Override
    @Transactional
    @AuditLog(action = "DELETE", entityType = "INVOICE", description = "Deleted invoice and updated dependent expenses")
    public void deleteInvoice(Long id) {
        log.info("Attempting to delete invoice with ID: {}", id);

        Optional<Invoice> invoiceOptional = invoiceRepository.findById(id);

        if (invoiceOptional.isPresent()) {
            Invoice invoice = invoiceOptional.get();

            try {
                // Step 1: Handle dependent expenses - set their invoice_id to null
                if (invoice.getExpenses() != null && !invoice.getExpenses().isEmpty()) {
                    log.info("Invoice has {} associated expenses, updating them before deletion", 
                            invoice.getExpenses().size());
                    
                    // Set invoice_id to null for all expenses referencing this invoice
                    entityManager.createQuery(
                        "UPDATE Expense e SET e.invoice = null WHERE e.invoice.id = :invoiceId")
                        .setParameter("invoiceId", id)
                        .executeUpdate();
                    
                    // Clear the expenses collection
                    invoice.getExpenses().clear();
                    log.info("Successfully updated {} expenses to remove invoice reference", 
                            invoice.getExpenses().size());
                }

                // Step 2: Remove the invoice from the client's invoices collection
                Client client = invoice.getClient();
                if (client != null && client.getInvoices() != null) {
                    client.getInvoices().remove(invoice);
                    log.info("Removed invoice from client's collection");
                }

                // Step 3: Delete the invoice
                entityManager.flush(); // Ensure updates are applied first
                invoiceRepository.deleteById(id);
                entityManager.flush(); // Ensure deletion is completed

                log.info("Successfully deleted invoice with ID: {}", id);

            } catch (Exception e) {
                log.error("Error deleting invoice with ID: {}", id, e);
                throw new RuntimeException("Failed to delete invoice: " + e.getMessage(), e);
            }
        } else {
            log.warn("Invoice with ID {} not found", id);
            throw new RuntimeException("Invoice with ID " + id + " not found");
        }
    }


    @Override
    public Stats getStats() {
        return jdbc.queryForObject(STATS_QUERY, Map.of(), new StatsRowMapper());
    }

    @Override
    public Page<Client> getClientsForUser(Long userId, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);

        // Use tenant-filtered query if organization context is available
        return tenantService.getCurrentOrganizationId()
            .map(orgId -> clientRepository.findByOrganizationId(orgId, pageable))
            .orElseGet(() -> clientRepository.findAll(pageable));
    }
    
    @Override
    public Page<Client> getEmptyPage(int page, int size) {
        // Return an empty page for users with no access
        return Page.empty(PageRequest.of(page, size));
    }
    
    @Override
    public Stats getEmptyStats() {
        // Return empty stats for users with no access
        Stats stats = new Stats();
        stats.setTotalClients(0);
        stats.setTotalInvoices(0);
        stats.setTotalBilled(0.0);
        return stats;
    }
    
    @Override
    public Stats getLimitedStats() {
        // Return limited stats for non-admin users
        // Could be filtered based on user's accessible data
        Stats stats = new Stats();
        stats.setTotalClients((int) clientRepository.count());
        stats.setTotalInvoices(0);
        stats.setTotalBilled(0.0);
        return stats;
    }
}
