package com.bostoneo.bostoneosolutions.controller;

import com.bostoneo.bostoneosolutions.dto.ReceiptDTO;
import com.bostoneo.bostoneosolutions.model.Receipt;
import com.bostoneo.bostoneosolutions.service.ReceiptService;
import com.bostoneo.bostoneosolutions.util.CustomHttpResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.security.access.prepost.PreAuthorize;

@PreAuthorize("hasAnyRole('ROLE_ADMIN', 'ROLE_SYSADMIN', 'ROLE_MANAGING_PARTNER', 'ROLE_ATTORNEY', 'ROLE_PARALEGAL')")
@RestController
@RequestMapping("/api/receipts")
public class ReceiptController {

    private final ReceiptService receiptService;

    public ReceiptController(ReceiptService receiptService) {
        this.receiptService = receiptService;
    }

    @PostMapping("/upload")
    public ResponseEntity<CustomHttpResponse<Receipt>> uploadReceipt(@RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(receiptService.uploadReceipt(file));
    }

    @GetMapping("/{id}")
    public ResponseEntity<CustomHttpResponse<Receipt>> getReceipt(@PathVariable Long id) {
        return ResponseEntity.ok(receiptService.getReceiptById(id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<CustomHttpResponse<Void>> deleteReceipt(@PathVariable Long id) {
        return ResponseEntity.ok(receiptService.deleteReceipt(id));
    }
} 
 
 
 