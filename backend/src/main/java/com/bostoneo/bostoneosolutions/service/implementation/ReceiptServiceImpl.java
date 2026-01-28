package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.model.Receipt;
import com.bostoneo.bostoneosolutions.repository.ReceiptRepository;
import com.bostoneo.bostoneosolutions.service.ReceiptService;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
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
    private final TenantService tenantService;

    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    @Override
    public CustomHttpResponse<Receipt> uploadReceipt(MultipartFile file) {
        Long orgId = getRequiredOrganizationId();
        try {
            // Create a new Receipt entity
            Receipt receipt = Receipt.builder()
                    .organizationId(orgId) // SECURITY: Set organization ID
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
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Use tenant-filtered query
        Receipt receipt = receiptRepository.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new EntityNotFoundException("Receipt not found or access denied: " + id));

        return new CustomHttpResponse<>(200, "Receipt retrieved successfully", receipt);
    }

    @Override
    public CustomHttpResponse<Void> deleteReceipt(Long id) {
        Long orgId = getRequiredOrganizationId();
        // SECURITY: Verify ownership before deletion
        if (!receiptRepository.existsByIdAndOrganizationId(id, orgId)) {
            throw new EntityNotFoundException("Receipt not found or access denied: " + id);
        }

        receiptRepository.deleteById(id);
        return new CustomHttpResponse<>(200, "Receipt deleted successfully", null);
    }
} 
 
 
 