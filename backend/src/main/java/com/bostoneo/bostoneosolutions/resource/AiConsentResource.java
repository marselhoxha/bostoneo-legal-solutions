package com.bostoneo.bostoneosolutions.resource;

import com.bostoneo.bostoneosolutions.model.Client;
import com.bostoneo.bostoneosolutions.service.ClientService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/public/ai-consent")
@RequiredArgsConstructor
@Slf4j
public class AiConsentResource {

    private final ClientService clientService;

    @GetMapping("/{token}")
    public ResponseEntity<Map<String, Object>> validateToken(@PathVariable String token) {
        log.info("Validating AI consent token");
        try {
            Client client = clientService.getClientByConsentToken(token);
            return ResponseEntity.ok(Map.of(
                    "valid", true,
                    "clientName", client.getName() != null ? client.getName() : "",
                    "organizationName", "Bostoneo Legal Solutions"
            ));
        } catch (Exception e) {
            log.warn("Invalid AI consent token attempted");
            return ResponseEntity.badRequest().body(Map.of(
                    "valid", false,
                    "message", "This link is invalid or has already been used."
            ));
        }
    }

    @PostMapping("/{token}/acknowledge")
    public ResponseEntity<Map<String, Object>> acknowledgeConsent(@PathVariable String token) {
        log.info("Processing AI consent acknowledgment");
        try {
            clientService.acknowledgeAiConsent(token);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Thank you for acknowledging the AI technology disclosure."
            ));
        } catch (Exception e) {
            log.error("Error processing AI consent acknowledgment", e);
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "This link is invalid or has already been used."
            ));
        }
    }
}
