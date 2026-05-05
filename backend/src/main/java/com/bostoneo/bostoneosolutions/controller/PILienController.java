package com.bostoneo.bostoneosolutions.controller;

import com.bostoneo.bostoneosolutions.dto.PILienDTO;
import com.bostoneo.bostoneosolutions.model.HttpResponse;
import com.bostoneo.bostoneosolutions.service.PILienService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

import static java.time.LocalDateTime.now;
import static java.util.Map.of;
import static org.springframework.http.HttpStatus.*;

/**
 * P10.c — REST controller for PI liens & subrogation claims.
 */
@RestController
@RequestMapping("/api/pi/liens")
@RequiredArgsConstructor
@Slf4j
public class PILienController {

    private final PILienService lienService;

    @GetMapping("/{caseId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> getByCaseId(@PathVariable("caseId") Long caseId) {
        log.info("Getting liens for case: {}", caseId);
        List<PILienDTO> liens = lienService.getByCaseId(caseId);
        BigDecimal effectiveTotal = lienService.getEffectiveTotal(caseId);
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("liens", liens, "effectiveTotal", effectiveTotal))
                        .message("Liens retrieved successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @PostMapping("/{caseId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> create(
            @PathVariable("caseId") Long caseId,
            @Valid @RequestBody PILienDTO dto) {
        log.info("Creating lien for case: {}", caseId);
        PILienDTO created = lienService.create(caseId, dto);
        return ResponseEntity.status(CREATED)
                .body(HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("lien", created))
                        .message("Lien created successfully")
                        .status(CREATED)
                        .statusCode(CREATED.value())
                        .build());
    }

    @PutMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> update(
            @PathVariable("id") Long id,
            @Valid @RequestBody PILienDTO dto) {
        log.info("Updating lien: {}", id);
        PILienDTO updated = lienService.update(id, dto);
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .data(of("lien", updated))
                        .message("Lien updated successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HttpResponse> delete(@PathVariable("id") Long id) {
        log.info("Deleting lien: {}", id);
        lienService.delete(id);
        return ResponseEntity.ok(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .message("Lien deleted successfully")
                        .status(OK)
                        .statusCode(OK.value())
                        .build());
    }
}
