package com.bostoneo.bostoneosolutions.form;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RegisterForm {
    @NotEmpty(message = "First name cannot be empty")
    @Size(max = 100, message = "First name must be under 100 characters")
    private String firstName;

    @NotEmpty(message = "Last name cannot be empty")
    @Size(max = 100, message = "Last name must be under 100 characters")
    private String lastName;

    @NotEmpty(message = "Email cannot be empty")
    @Email(message = "Invalid email. Please enter a valid email address")
    private String email;

    @NotEmpty(message = "Password cannot be empty")
    @Size(min = 8, max = 128, message = "Password must be between 8 and 128 characters")
    private String password;
}
