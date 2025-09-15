package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.model.Client;
import com.bostoneo.bostoneosolutions.model.Invoice;
import com.bostoneo.bostoneosolutions.model.Stats;
import org.springframework.data.domain.Page;

import java.util.List;


public interface ClientService {

    //Client functions
    Client createClient(Client client);
    Client updateClient(Client client);
    Page<Client> getClients(int page, int size);
    Iterable<Client> getClients();
    Client getClient(Long id);
    Page<Client> searchClients(String name, int page, int size);
    
    // Get clients with unbilled time entries for invoice generation
    List<Client> getClientsWithUnbilledTimeEntries();
    
    // Role-based access methods
    Page<Client> getClientsForUser(Long userId, int page, int size);
    Page<Client> getEmptyPage(int page, int size);
    Stats getEmptyStats();
    Stats getLimitedStats();

    //Invoice functions
    Invoice createInvoice(Invoice invoice);
    Page<Invoice> getInvoices(int page, int size);
    Page<Invoice> getInvoicesForClient(Long clientId, int page, int size);
    void addInvoiceToClient(Long id, Invoice invoice);

    Invoice getInvoice(Long id);


    void deleteInvoice(Long id);

    void deleteClient(Long id);

    Stats getStats();
}
