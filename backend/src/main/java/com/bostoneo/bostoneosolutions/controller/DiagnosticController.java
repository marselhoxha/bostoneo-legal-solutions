package com.bostoneo.bostoneosolutions.controller;

import com.bostoneo.bostoneosolutions.dto.UserDTO;
import com.bostoneo.bostoneosolutions.model.UserPrincipal;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/diagnostic")
@RequiredArgsConstructor
@Slf4j
public class DiagnosticController {

    @GetMapping("/authorities")
    public ResponseEntity<Map<String, Object>> getCurrentUserAuthorities() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        Map<String, Object> result = new HashMap<>();
        
        if (authentication != null && authentication.isAuthenticated()) {
            String username = "unknown";
            Object principal = authentication.getPrincipal();
            if (principal instanceof UserDTO) {
                username = ((UserDTO) principal).getEmail();
            } else if (principal instanceof UserPrincipal) {
                username = ((UserPrincipal) principal).getUser().getEmail();
            }
            result.put("username", username);
            result.put("isAuthenticated", authentication.isAuthenticated());
            
            // Get all authorities
            List<String> authorities = authentication.getAuthorities().stream()
                    .map(GrantedAuthority::getAuthority)
                    .sorted()
                    .collect(Collectors.toList());
            
            result.put("authorities", authorities);
            result.put("authorityCount", authorities.size());
            
            // Check specific invoice authorities
            List<String> invoiceAuthorities = authorities.stream()
                    .filter(auth -> auth.contains("INVOICE"))
                    .collect(Collectors.toList());
            
            result.put("invoiceAuthorities", invoiceAuthorities);
            result.put("hasReadInvoice", authorities.contains("READ:INVOICE"));
            result.put("hasInvoiceView", authorities.contains("INVOICE:VIEW"));
            result.put("hasInvoiceRead", authorities.contains("INVOICE:READ"));
            
            // Check if it's a UserPrincipal for roles/permissions
            if (principal instanceof UserPrincipal) {
                UserPrincipal userPrincipal = (UserPrincipal) principal;
                result.put("roles", userPrincipal.getRoles().stream()
                        .map(role -> role.getName())
                        .collect(Collectors.toList()));
                result.put("permissions", userPrincipal.getPermissions().stream()
                        .map(perm -> perm.getName())
                        .collect(Collectors.toList()));
            }
        } else {
            result.put("error", "Not authenticated");
        }
        
        return ResponseEntity.ok(result);
    }
}