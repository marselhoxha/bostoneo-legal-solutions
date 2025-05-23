package com.bostoneo.bostoneosolutions.form;

import jakarta.validation.constraints.NotEmpty;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UpdatePasswordForm {
    @NotEmpty(message = "Current Password cannot be empty")
    private String currentPassword;
    @NotEmpty(message = "New Password cannot be empty")
    private String newPassword;
    @NotEmpty(message = "Confirm password cannot be empty")
    private String confirmNewPassword;
}
