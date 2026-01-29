package com.bostoneo.bostoneosolutions.dto.superadmin;

import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateOrganizationDTO {

    @Size(min = 2, max = 100, message = "Name must be between 2 and 100 characters")
    private String name;

    @Size(min = 2, max = 50, message = "Slug must be between 2 and 50 characters")
    private String slug;

    private String planType; // STARTER, PROFESSIONAL, ENTERPRISE
    private String status; // ACTIVE, SUSPENDED, PENDING

    // Contact info
    private String phone;
    private String address;
    private String website;
    private String timezone;

    // Quotas
    private Integer maxUsers;
    private Integer maxCases;
    private Long maxStorageBytes;
}
