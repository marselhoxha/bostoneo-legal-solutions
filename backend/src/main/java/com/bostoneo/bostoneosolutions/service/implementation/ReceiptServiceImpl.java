package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.model.Receipt;
import com.bostoneo.bostoneosolutions.repository.ReceiptRepository;
import com.bostoneo.bostoneosolutions.service.ReceiptService;
import com.bostoneo.bostoneosolutions.util.CustomHttpResponse;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Date;

@Service
@RequiredArgsConstructor
@Transactional
public class ReceiptServiceImpl implements ReceiptService {

    private final ReceiptRepository receiptRepository;

    @Override
    public CustomHttpResponse<Receipt> uploadReceipt(MultipartFile file) {
        try {
            // Create a new Receipt entity
            Receipt receipt = Receipt.builder()
                    .fileName(file.getOriginalFilename())
                    .contentType(file.getContentType())
                    .fileSize(file.getSize())
                    .content(file.getBytes())
                    .createdAt(new Date())
                    .updatedAt(new Date())
                    .build();

            // Save the receipt
            Receipt savedReceipt = receiptRepository.save(receipt);
            
            // Return the saved receipt without the content to reduce response size
            Receipt responseReceipt = Receipt.builder()
                    .id(savedReceipt.getId())
                    .fileName(savedReceipt.getFileName())
                    .contentType(savedReceipt.getContentType())
                    .fileSize(savedReceipt.getFileSize())
                    .createdAt(savedReceipt.getCreatedAt())
                    .updatedAt(savedReceipt.getUpdatedAt())
                    .build();
            
            return new CustomHttpResponse<>(201, "Receipt uploaded successfully", responseReceipt);
        } catch (IOException e) {
            throw new RuntimeException("Failed to upload receipt: " + e.getMessage());
        }
    }

    @Override
    public CustomHttpResponse<Receipt> getReceiptById(Long id) {
        Receipt receipt = receiptRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Receipt not found with id: " + id));
        
        return new CustomHttpResponse<>(200, "Receipt retrieved successfully", receipt);
    }

    @Override
    public CustomHttpResponse<Void> deleteReceipt(Long id) {
        if (!receiptRepository.existsById(id)) {
            throw new EntityNotFoundException("Receipt not found with id: " + id);
        }
        
        receiptRepository.deleteById(id);
        return new CustomHttpResponse<>(200, "Receipt deleted successfully", null);
    }
} 