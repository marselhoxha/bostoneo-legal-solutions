package com.***REMOVED***.***REMOVED***solutions.service;

import com.***REMOVED***.***REMOVED***solutions.model.Receipt;
import com.***REMOVED***.***REMOVED***solutions.util.CustomHttpResponse;
import org.springframework.web.multipart.MultipartFile;

public interface ReceiptService {
    CustomHttpResponse<Receipt> uploadReceipt(MultipartFile file);
    CustomHttpResponse<Receipt> getReceiptById(Long id);
    CustomHttpResponse<Void> deleteReceipt(Long id);
} 