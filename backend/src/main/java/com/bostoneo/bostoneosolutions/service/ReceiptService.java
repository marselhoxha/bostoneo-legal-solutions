package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.model.Receipt;
import com.bostoneo.bostoneosolutions.util.CustomHttpResponse;
import org.springframework.web.multipart.MultipartFile;

public interface ReceiptService {
    CustomHttpResponse<Receipt> uploadReceipt(MultipartFile file);
    CustomHttpResponse<Receipt> getReceiptById(Long id);
    CustomHttpResponse<Void> deleteReceipt(Long id);
} 
 