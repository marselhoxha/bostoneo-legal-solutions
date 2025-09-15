package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.*;
import com.bostoneo.bostoneosolutions.model.Client;
import com.bostoneo.bostoneosolutions.model.Invoice;
import com.bostoneo.bostoneosolutions.model.LegalCase;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.Collection;

@Service
public class RoleBasedDTOMapper {
    
    public Object mapClientByRole(Client client) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) {
            return mapToPublicDTO(client);
        }
        
        Collection<String> roles = auth.getAuthorities().stream()
                .map(a -> a.getAuthority())
                .toList();
        
        if (roles.contains("ROLE_ADMIN") || roles.contains("ROLE_MANAGER")) {
            return client; // Full access
        } else if (roles.contains("ROLE_CLIENT")) {
            return mapToPublicDTO(client);
        } else {
            // Attorney, Secretary, Paralegal - intermediate access
            return mapToStaffDTO(client);
        }
    }
    
    public Object mapInvoiceByRole(Invoice invoice) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) {
            return mapToPublicInvoiceDTO(invoice);
        }
        
        Collection<String> roles = auth.getAuthorities().stream()
                .map(a -> a.getAuthority())
                .toList();
        
        if (roles.contains("ROLE_ADMIN") || roles.contains("ROLE_MANAGER")) {
            return invoice; // Full access
        } else if (roles.contains("ROLE_CLIENT")) {
            return mapToPublicInvoiceDTO(invoice);
        } else {
            return invoice; // Other staff see full invoice
        }
    }
    
    private ClientPublicDTO mapToPublicDTO(Client client) {
        return ClientPublicDTO.builder()
                .id(client.getId())
                .name(client.getName())
                .email(client.getEmail())
                .phone(client.getPhone())
                .build();
    }
    
    private ClientStaffDTO mapToStaffDTO(Client client) {
        return ClientStaffDTO.builder()
                .id(client.getId())
                .name(client.getName())
                .email(client.getEmail())
                .phone(client.getPhone())
                .type(client.getType())
                .status(client.getStatus())
                .build();
    }
    
    private InvoicePublicDTO mapToPublicInvoiceDTO(Invoice invoice) {
        return InvoicePublicDTO.builder()
                .id(invoice.getId())
                .invoiceNumber(invoice.getInvoiceNumber())
                .date(java.util.Date.from(invoice.getDate().atStartOfDay(java.time.ZoneId.systemDefault()).toInstant()))
                .total(invoice.getTotal().doubleValue())
                .status(invoice.getStatus().toString())
                .build();
    }
    
    // Add more mappers for other entities as needed
} 