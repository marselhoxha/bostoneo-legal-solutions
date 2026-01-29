package com.bostoneo.bostoneosolutions.dto.superadmin;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateOrganizationDTO {

    @NotBlank(message = "Organization name is required")
    @Size(min = 2, max = 100, message = "Name must be between 2 and 100 characters")
    private String name;

    @NotBlank(message = "Organization slug is required")
    @Size(min = 2, max = 50, message = "Slug must be between 2 and 50 characters")
    private String slug;

    private String planType; // STARTER, PROFESSIONAL, ENTERPRISE

    // Initial admin user
    @NotBlank(message = "Admin first name is required")
    private String adminFirstName;

    @NotBlank(message = "Admin last name is required")
    private String adminLastName;

    @NotBlank(message = "Admin email is required")
    @Email(message = "Invalid email format")
    private String adminEmail;

    // Optional settings
    private String phone;
    private String address;
    private String website;
    private String timezone;

    // Quotas (optional, defaults will be used if not provided)
    private Integer maxUsers;
    private Integer maxCases;
    private Long maxStorageBytes;
}
