package com.bostoneo.bostoneosolutions.dto.superadmin;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateUserForOrgDTO {
    @NotEmpty(message = "First name is required")
    @Size(min = 1, max = 50, message = "First name must be between 1 and 50 characters")
    private String firstName;

    @NotEmpty(message = "Last name is required")
    @Size(min = 1, max = 50, message = "Last name must be between 1 and 50 characters")
    private String lastName;

    @NotEmpty(message = "Email is required")
    @Email(message = "Invalid email format")
    private String email;

    @NotEmpty(message = "Role is required")
    private String roleName;

    // Skip email invitation (superadmin sets up password manually)
    private Boolean skipEmail;
    private String temporaryPassword;
}
