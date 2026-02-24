package com.bostoneo.bostoneosolutions.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

@Data
public class DemoRequestDTO {
    @NotBlank(message = "Name is required")
    private String name;

    @NotBlank(message = "Email is required")
    @Email(message = "Please provide a valid email address")
    private String email;

    @NotBlank(message = "Firm name is required")
    private String firmName;

    @NotBlank(message = "Firm size is required")
    private String firmSize;

    @NotEmpty(message = "At least one practice area is required")
    private List<String> practiceAreas;

    private String phone;
    private String message;
}
