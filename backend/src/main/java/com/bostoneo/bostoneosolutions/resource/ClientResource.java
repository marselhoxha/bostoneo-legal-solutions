package com.***REMOVED***.***REMOVED***solutions.resource;


import com.***REMOVED***.***REMOVED***solutions.annotation.AuditLog;
import com.***REMOVED***.***REMOVED***solutions.dto.UserDTO;
import com.***REMOVED***.***REMOVED***solutions.model.Client;
import com.***REMOVED***.***REMOVED***solutions.model.HttpResponse;
import com.***REMOVED***.***REMOVED***solutions.model.Invoice;
import com.***REMOVED***.***REMOVED***solutions.model.User;
import com.***REMOVED***.***REMOVED***solutions.report.ClientReport;
import com.***REMOVED***.***REMOVED***solutions.report.InvoiceReport;
import com.***REMOVED***.***REMOVED***solutions.service.ClientService;
import com.***REMOVED***.***REMOVED***solutions.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static java.time.LocalDateTime.now;
import static java.util.Map.of;
import static org.springframework.http.HttpHeaders.CONTENT_DISPOSITION;
import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.CREATED;
import static org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR;
import static org.springframework.http.HttpStatus.OK;
import static org.springframework.http.HttpStatus.UNAUTHORIZED;
import static org.springframework.http.MediaType.parseMediaType;

@RestController
@RequestMapping(path = "/client")
@RequiredArgsConstructor
@Slf4j
public class ClientResource {
    private final ClientService clientService;
    private final UserService userService;


    @GetMapping
    public ResponseEntity<HttpResponse> getClients(
            @AuthenticationPrincipal UserDTO user,
            @RequestParam Optional<Integer> page,
            @RequestParam Optional<Integer> size) {
        
        // Add null checking for authentication principal
        if (user == null) {
            return ResponseEntity.status(401).body(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .message("User not authenticated")
                        .status(UNAUTHORIZED)
                        .statusCode(401)
                        .build());
        }
        
        if (user.getEmail() == null || user.getEmail().trim().isEmpty()) {
            return ResponseEntity.status(400).body(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .message("User email is required")
                        .status(BAD_REQUEST)
                        .statusCode(400)
                        .build());
        }
        
        try {
            UserDTO currentUser = userService.getUserByEmail(user.getEmail());
            return ResponseEntity.ok(
                    HttpResponse.builder()
                            .timeStamp(now().toString())
                            .data(of("user", currentUser, 
                                    "page", clientService.getClients(page.orElse(0), size.orElse(10))))
                            .message("Clients retrieved")
                            .status(OK)
                            .statusCode(OK.value())
                            .build());
        } catch (Exception e) {
            log.error("Error retrieving clients for user: {}", user.getEmail(), e);
            return ResponseEntity.status(500).body(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .message("Error retrieving clients: " + e.getMessage())
                        .status(INTERNAL_SERVER_ERROR)
                        .statusCode(500)
                        .build());
        }
    }

    @PostMapping("/save")
    @AuditLog(action = "CREATE", entityType = "CLIENT", description = "Created new client")
    public ResponseEntity<HttpResponse> saveClient(@AuthenticationPrincipal UserDTO user, @RequestBody @Valid Client client) {
        return ResponseEntity.created(URI.create("")).body(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("user", userService.getUserByEmail(user.getEmail()), "client", clientService.createClient(client)))
                        .message("Client created successfully")
                        .status(CREATED)
                        .statusCode(CREATED.value())
                        .build());
    }

    @GetMapping("/get/{id}")
    public ResponseEntity<HttpResponse> getClient(@AuthenticationPrincipal UserDTO user, @PathVariable("id") Long id) {
        Client client = clientService.getClient(id);
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("user", userService.getUserByEmail(user.getEmail()), "client", client))
                        .message("Client retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @GetMapping("/search")
    public ResponseEntity<HttpResponse> searchClients(@AuthenticationPrincipal UserDTO user,
                                                       @RequestParam Optional<String> name, 
                                                       @RequestParam Optional<Integer> page, 
                                                       @RequestParam Optional<Integer> size) {
        Page<Client> searchResults = clientService.searchClients(name.orElse(""), page.orElse(0), size.orElse(10));
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("user", userService.getUserByEmail(user.getEmail()), "page", searchResults))
                        .message(String.format("Found %d clients matching search criteria", searchResults.getTotalElements()))
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @DeleteMapping("/delete/{id}")
    @AuditLog(action = "DELETE", entityType = "CUSTOMER", description = "Deleted client and associated data")
    public ResponseEntity<HttpResponse> deleteClient(@PathVariable("id") Long id) {
        clientService.deleteClient(id);
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .message("Client deleted successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @PutMapping("/update")
    @AuditLog(action = "UPDATE", entityType = "CUSTOMER", description = "Updated client information")
    public ResponseEntity<HttpResponse> updateClient(@AuthenticationPrincipal UserDTO user, @RequestBody @Valid Client client) {
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("user", userService.getUserByEmail(user.getEmail()), "client", clientService.updateClient(client)))
                        .message("Client updated successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @PostMapping("/invoice/create")
    @AuditLog(action = "CREATE", entityType = "INVOICE", description = "Created new invoice")
    public ResponseEntity<HttpResponse> createInvoice(@AuthenticationPrincipal UserDTO user, @RequestBody Invoice invoice) {

        return ResponseEntity.created(URI.create("")).body(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("user", userService.getUserByEmail(user.getEmail()), "clients", clientService.createInvoice(invoice)))
                        .message("Invoice created successfully")
                        .status(CREATED)
                        .statusCode(CREATED.value())
                        .build());


    }

    @GetMapping("/invoice/new")
    public ResponseEntity<HttpResponse> newInvoice(@AuthenticationPrincipal UserDTO user) {

        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("user", userService.getUserByEmail(user.getEmail()), "clients", clientService.getClients()))
                        .message("Clients retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());


    }

    @GetMapping("/invoice/list")
    public ResponseEntity<HttpResponse> getInvoices(@AuthenticationPrincipal UserDTO user, @RequestParam Optional<Integer> page, @RequestParam Optional<Integer> size) {
        // Role-based invoice filtering
        boolean isAdmin = user.getRoles() != null && 
            (user.getRoles().contains("ROLE_ADMIN") ||
             user.getRoles().contains("ROLE_ATTORNEY") ||
             user.getRoles().contains("MANAGING_PARTNER") ||
             user.getRoles().contains("ROLE_MANAGING_PARTNER") ||
             user.getRoles().contains("SENIOR_PARTNER") ||
             user.getRoles().contains("ROLE_SENIOR_PARTNER") ||
             user.getRoles().contains("EQUITY_PARTNER") ||
             user.getRoles().contains("ROLE_EQUITY_PARTNER") ||
             user.getRoles().contains("OF_COUNSEL") ||
             user.getRoles().contains("ROLE_OF_COUNSEL") ||
             user.getRoles().contains("ROLE_SYSADMIN") ||
             user.getRoles().contains("ADMINISTRATOR"));
        
        // Clients only see their own invoices
        if (isAdmin) {
            return ResponseEntity.ok(
                    HttpResponse.builder()
                            .timeStamp(now().toString())
                            .data(of("user", userService.getUserByEmail(user.getEmail()), 
                                    "page", clientService.getInvoicesForClient(user.getId(), page.orElse(0), size.orElse(10))))
                            .message("Your invoices retrieved successfully")
                            .status(OK)
                            .statusCode(OK.value())
                            .build());
        }
        
        // Admin and Manager see all invoices
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("user", userService.getUserByEmail(user.getEmail()), 
                                "page", clientService.getInvoices(page.orElse(0), size.orElse(10))))
                        .message("Invoices retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @GetMapping("/invoice/get/{id}")
    public ResponseEntity<HttpResponse> getInvoice(@AuthenticationPrincipal UserDTO user, @PathVariable("id") Long id) {
        Invoice invoice = clientService.getInvoice(id);
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("user", userService.getUserByEmail(user.getEmail()), "invoice", invoice, "client", clientService.getInvoice(id).getClient()))
                        .message("Invoice retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @PostMapping("/invoice/addtoclient/{id}")
    @AuditLog(action = "CREATE", entityType = "INVOICE", description = "Added invoice to client account")
    public ResponseEntity<HttpResponse> addInvoiceToClient(@AuthenticationPrincipal UserDTO user, @PathVariable("id") Long id, @RequestBody Invoice invoice) {
        clientService.addInvoiceToClient(id, invoice);
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("user", userService.getUserByEmail(user.getEmail()), "clients", clientService.getClients()))
                        .message(String.format("Invoice added to client with id: %d", id))
                        .status(OK)
                        .statusCode(OK.value())
                        .build());


    }

    @DeleteMapping("/invoice/get/{id}")
    @AuditLog(action = "DELETE", entityType = "INVOICE", description = "Deleted invoice")
    public ResponseEntity<Void> deleteInvoice(@PathVariable Long id) {
        clientService.deleteInvoice(id);
        return ResponseEntity.noContent().build();  // Returns a 204 No Content status
    }

    @GetMapping("/download/report")
    @AuditLog(action = "EXPORT", entityType = "CLIENT", description = "Exported client report")
    public ResponseEntity<Resource> downloadReport() {
        List<Client> clients = new ArrayList<>();
        clientService.getClients().iterator().forEachRemaining(clients::add);
        ClientReport report = new ClientReport(clients);
        HttpHeaders headers = new HttpHeaders();
        headers.add("File-Name", "client-report.xlsx");
        headers.add(CONTENT_DISPOSITION, "attachment;File-Name=client-report.xlsx");
        return ResponseEntity.ok().contentType(parseMediaType("application/vnd.ms-excel"))
                .headers(headers).body(report.exportClientReport());
    }

    @GetMapping("/invoice/download/invoice-report")
    @AuditLog(action = "EXPORT", entityType = "INVOICE", description = "Exported invoice report")
    public ResponseEntity<Resource> downloadInvoiceReport(@RequestParam Optional<Integer> page, @RequestParam Optional<Integer> size) {
        List<Invoice> invoices = new ArrayList<>();
        clientService.getInvoices(page.orElse(0), size.orElse(10)).iterator().forEachRemaining(invoices::add);
        InvoiceReport report = new InvoiceReport(invoices);
        HttpHeaders headers = new HttpHeaders();
        headers.add("File-Name", "invoice-report.xlsx");
        headers.add(CONTENT_DISPOSITION, "attachment;File-Name=client-report.xlsx");
        return ResponseEntity.ok().contentType(parseMediaType("application/vnd.ms-excel"))
                .headers(headers).body(report.exportInvoiceReport());
    }

    @PutMapping("/invoice/update/{id}")
    @AuditLog(action = "UPDATE", entityType = "INVOICE", description = "Updated invoice details")
    public ResponseEntity<HttpResponse> updateInvoice(@AuthenticationPrincipal UserDTO user, @PathVariable("id") Long id, @RequestBody Invoice invoice) {
        invoice.setId(id);
        Invoice updatedInvoice = clientService.createInvoice(invoice);
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("user", userService.getUserByEmail(user.getEmail()), "invoice", updatedInvoice))
                        .message("Invoice updated successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }
}
