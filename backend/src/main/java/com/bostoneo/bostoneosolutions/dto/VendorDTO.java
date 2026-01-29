package com.bostoneo.bostoneosolutions.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VendorDTO {
    private Long id;
    // SECURITY: Required for multi-tenant data isolation
    private Long organizationId;
    private String name;
    private String contact;
    private String taxId;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
} 