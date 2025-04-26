package com.***REMOVED***.***REMOVED***solutions.controller;

import com.***REMOVED***.***REMOVED***solutions.dto.ReceiptDTO;
import com.***REMOVED***.***REMOVED***solutions.model.Receipt;
import com.***REMOVED***.***REMOVED***solutions.service.ReceiptService;
import com.***REMOVED***.***REMOVED***solutions.util.CustomHttpResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

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