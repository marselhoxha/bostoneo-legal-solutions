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
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

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

    @Value("${UI_APP_URL:http://localhost:4200}")
    private String frontendBaseUrl;
    private final TenantService tenantService;
    private final com.bostoneo.bostoneosolutions.service.EmailService emailService;

    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    @Override
    public Client createClient(Client client) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Set organization ID for tenant isolation
        client.setOrganizationId(orgId);
        client.setCreatedAt(new Date());
        return clientRepository.save(client);
    }

    @Override
    public Client updateClient(Client client) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Verify client belongs to current organization before update
        if (client.getId() != null) {
            clientRepository.findByIdAndOrganizationId(client.getId(), orgId)
                    .orElseThrow(() -> new RuntimeException("Client not found or access denied"));
        }
        // Ensure organization ID is preserved
        client.setOrganizationId(orgId);
        return clientRepository.save(client);
    }

    @Override
    public Page<Client> getClients(int page, int size) {
        Pageable pageable = PageRequest.of(page, size);

        // Use tenant-filtered query - throw exception if no organization context
        return tenantService.getCurrentOrganizationId()
            .map(orgId -> clientRepository.findByOrganizationId(orgId, pageable))
            .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    @Override
    public Iterable<Client> getClients() {
        // Use tenant-filtered query if organization context is available
        return tenantService.getCurrentOrganizationId()
            .map(orgId -> (Iterable<Client>) clientRepository.findByOrganizationId(orgId))
            .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    @Override
    public Client getClient(Long id) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        return clientRepository.findByIdAndOrganizationId(id, orgId)
            .orElseThrow(() -> new RuntimeException("Client not found or access denied: " + id));
    }

    @Override
    public Page<Client> searchClients(String name, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);

        // Use tenant-filtered search - throw exception if no organization context
        return tenantService.getCurrentOrganizationId()
            .map(orgId -> clientRepository.findByOrganizationIdAndNameContaining(orgId, name, pageable))
            .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    @Override
    public List<Client> getClientsWithUnbilledTimeEntries() {
        log.info("Retrieving clients with unbilled time entries");

        // Use tenant-filtered query - throw exception if no organization context
        List<Client> clients = tenantService.getCurrentOrganizationId()
            .map(orgId -> clientRepository.findClientsWithUnbilledTimeEntriesByOrganization(orgId))
            .orElseThrow(() -> new RuntimeException("Organization context required"));

        log.info("Found {} clients with unbilled time entries", clients.size());
        return clients;
    }

    @Override
    public void deleteClient(Long id) {
        log.info("Attempting to delete client with ID: " + id);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query
        Optional<Client> clientOptional = clientRepository.findByIdAndOrganizationId(id, orgId);

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
        Pageable pageable = PageRequest.of(page, size);
        // Use tenant-filtered query if organization context is available
        return tenantService.getCurrentOrganizationId()
            .map(orgId -> invoiceRepository.findByOrganizationId(orgId, pageable))
            .orElseThrow(() -> new RuntimeException("Organization context required"));
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
        Long orgId = getRequiredOrganizationId();
        invoice.setInvoiceNumber(RandomStringUtils.randomAlphanumeric(8).toUpperCase());
        // SECURITY: Use tenant-filtered query
        Client client = clientRepository.findByIdAndOrganizationId(id, orgId)
            .orElseThrow(() -> new RuntimeException("Client not found or access denied: " + id));
        invoice.setClient(client);
        invoiceRepository.save(invoice);
    }

    @Override
    public Invoice getInvoice(Long id) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        return invoiceRepository.findByIdAndOrganizationId(id, orgId)
            .orElseThrow(() -> new RuntimeException("Invoice not found or access denied: " + id));
    }


    @Override
    @Transactional
    @AuditLog(action = "DELETE", entityType = "INVOICE", description = "Deleted invoice and updated dependent expenses")
    public void deleteInvoice(Long id) {
        log.info("Attempting to delete invoice with ID: {}", id);
        Long orgId = getRequiredOrganizationId();

        // SECURITY: Use tenant-filtered query
        Optional<Invoice> invoiceOptional = invoiceRepository.findByIdAndOrganizationId(id, orgId);

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
    public void sendAiConsentEmail(Long clientId, String emailOverride) {
        Long orgId = getRequiredOrganizationId();
        Client client = clientRepository.findByIdAndOrganizationId(clientId, orgId)
                .orElseThrow(() -> new RuntimeException("Client not found or access denied"));

        // Use override email if provided, otherwise fall back to client's email
        String targetEmail = (emailOverride != null && !emailOverride.isBlank()) ? emailOverride.trim() : client.getEmail();

        if (targetEmail == null || targetEmail.isBlank()) {
            throw new RuntimeException("No email address provided");
        }

        // Generate token and save
        String token = UUID.randomUUID().toString();
        client.setAiConsentToken(token);
        clientRepository.save(client);

        // Build consent URL (frontend public route)
        String consentUrl = frontendBaseUrl + "/public/ai-consent/" + token;

        // Build branded email body
        String htmlBody = buildAiConsentEmailHtml(client.getName(), consentUrl);
        emailService.sendEmail(targetEmail, "AI Technology Disclosure - Your Acknowledgment Requested", htmlBody);
        log.info("AI consent email sent to client {} ({})", client.getName(), targetEmail);
    }

    @Override
    public void acknowledgeAiConsent(String token) {
        Client client = clientRepository.findByAiConsentToken(token)
                .orElseThrow(() -> new RuntimeException("Invalid or expired consent token"));

        client.setAiConsentGiven(true);
        client.setAiConsentDate(new Date());
        client.setAiConsentNotes("Acknowledged via email consent link");
        client.setAiConsentToken(null); // Invalidate token after use
        clientRepository.save(client);
        log.info("AI consent acknowledged for client: {}", client.getName());
    }

    @Override
    public Client getClientByConsentToken(String token) {
        return clientRepository.findByAiConsentToken(token)
                .orElseThrow(() -> new RuntimeException("Invalid or expired consent token"));
    }

    private String buildAiConsentEmailHtml(String clientName, String consentUrl) {
        StringBuilder html = new StringBuilder();
        html.append("<!DOCTYPE html><html lang=\"en\"><head>");
        html.append("<meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">");
        html.append("<title>AI Technology Disclosure</title>");
        html.append("<style>");
        html.append("body{margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#f5f7fa;color:#333;line-height:1.6}");
        html.append(".container{max-width:600px;margin:0 auto;background:#fff;box-shadow:0 4px 12px rgba(0,0,0,0.1);border-radius:8px;overflow:hidden}");
        html.append(".header{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;padding:20px;text-align:center}");
        html.append(".header h2{margin:0;font-size:24px;font-weight:300;letter-spacing:1px}");
        html.append(".content{padding:30px}");
        html.append(".content h3{margin:0 0 20px;color:#333;font-size:20px}");
        html.append(".info-box{background:#e3f2fd;border-left:4px solid #1976d2;padding:20px;border-radius:8px;margin:20px 0}");
        html.append(".info-box h4{margin:0 0 5px;font-size:18px;color:#333}");
        html.append(".uses-list{margin:15px 0;padding-left:20px;color:#555}");
        html.append(".uses-list li{margin-bottom:8px}");
        html.append(".note{background:#f8f9fa;padding:15px;border-radius:6px;margin:20px 0;border-left:3px solid #28a745;font-size:14px;color:#555}");
        html.append(".cta{text-align:center;margin:30px 0;padding:20px;background:#f8f9fa;border-radius:8px}");
        html.append(".cta-btn{display:inline-block;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;padding:14px 40px;text-decoration:none;border-radius:25px;font-weight:600;font-size:16px}");
        html.append(".cta p{margin:15px 0 0;font-size:14px;color:#666}");
        html.append(".badge{display:inline-block;background:#e8f5e9;color:#2e7d32;padding:6px 12px;border-radius:12px;font-size:13px;font-weight:500;margin-top:10px}");
        html.append(".footer{background:#f8f9fa;padding:20px;text-align:center;border-top:1px solid #e9ecef;font-size:14px;color:#555}");
        html.append(".footer small{color:#999;font-size:12px}");
        html.append("</style></head><body>");

        html.append("<div class=\"container\">");
        html.append("<div class=\"header\"><h2>Legience</h2></div>");
        html.append("<div class=\"content\">");
        html.append("<h3>Hello ").append(clientName != null ? clientName : "").append(",</h3>");

        html.append("<div class=\"info-box\">");
        html.append("<h4>AI Technology Disclosure</h4>");
        html.append("<p style=\"margin:5px 0 0;font-size:12px;color:#666;text-transform:uppercase;letter-spacing:.5px\">ABA Rule 1.4 Compliance</p>");
        html.append("</div>");

        html.append("<p style=\"font-size:16px;color:#555\">Our firm may use AI-assisted technology in connection with your legal matter. We want to be transparent about how these tools are used.</p>");

        html.append("<p style=\"font-size:15px;color:#555;font-weight:600\">AI tools may be used for:</p>");
        html.append("<ul class=\"uses-list\">");
        html.append("<li>Legal research and case law analysis</li>");
        html.append("<li>Document review and analysis</li>");
        html.append("<li>Drafting assistance for legal documents</li>");
        html.append("<li>Case strategy research</li>");
        html.append("</ul>");

        html.append("<div class=\"note\">");
        html.append("<strong>Important:</strong> All AI-generated output is reviewed and verified by a licensed attorney before being used in your case. AI tools do not replace professional legal judgment.");
        html.append("</div>");

        html.append("<div class=\"cta\">");
        html.append("<a href=\"").append(consentUrl).append("\" class=\"cta-btn\">I Acknowledge This Disclosure</a>");
        html.append("<p>Or copy and paste this link in your browser:</p>");
        html.append("<p style=\"font-size:12px;color:#666;word-break:break-all\">").append(consentUrl).append("</p>");
        html.append("<div class=\"badge\">Consent is NOT required to receive legal services</div>");
        html.append("</div>");

        html.append("</div>"); // end content
        html.append("<div class=\"footer\">");
        html.append("<p>Best regards,<br><strong>Legience Team</strong></p>");
        html.append("<small>This is an automated disclosure email. If you did not expect this email, you can safely ignore it.</small>");
        html.append("</div>");
        html.append("</div>"); // end container
        html.append("</body></html>");

        return html.toString();
    }

    @Override
    public Stats getStats() {
        // SECURITY: Use tenant-filtered stats query
        Long orgId = getRequiredOrganizationId();
        return jdbc.queryForObject(STATS_QUERY, Map.of("organizationId", orgId), new StatsRowMapper());
    }

    @Override
    public Page<Client> getClientsForUser(Long userId, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);

        // Use tenant-filtered query - throw exception if no organization context
        return tenantService.getCurrentOrganizationId()
            .map(orgId -> clientRepository.findByOrganizationId(orgId, pageable))
            .orElseThrow(() -> new RuntimeException("Organization context required"));
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
        // SECURITY: Use tenant-filtered count
        Long orgId = tenantService.getCurrentOrganizationId()
            .orElseThrow(() -> new RuntimeException("Organization context required"));
        Stats stats = new Stats();
        stats.setTotalClients((int) clientRepository.countByOrganizationId(orgId));
        stats.setTotalInvoices(0);
        stats.setTotalBilled(0.0);
        return stats;
    }

    @Override
    public List<Client> findByOrganizationIdAndEmail(Long orgId, String email) {
        return clientRepository.findByOrganizationIdAndEmail(orgId, email);
    }

    @Override
    public Long getCurrentOrganizationId() {
        return tenantService.getCurrentOrganizationId()
            .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    @Override
    public List<Client> quickSearch(Long orgId, String query) {
        if (query == null || query.length() < 2) return List.of();
        return clientRepository.quickSearch(orgId, query, org.springframework.data.domain.PageRequest.of(0, 5)).getContent();
    }
}
