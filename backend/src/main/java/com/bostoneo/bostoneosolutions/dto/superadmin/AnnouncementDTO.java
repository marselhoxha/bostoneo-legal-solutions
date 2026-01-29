package com.bostoneo.bostoneosolutions.dto.superadmin;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AnnouncementDTO {

    @NotBlank(message = "Title is required")
    private String title;

    @NotBlank(message = "Message is required")
    private String message;

    private String type; // INFO, WARNING, MAINTENANCE, UPDATE

    // Target audience
    private boolean sendToAll; // If true, send to all organizations
    private List<Long> targetOrganizationIds; // Specific orgs to send to
    private List<Long> targetUserIds; // Specific users to send to

    // Optional scheduling
    private boolean sendImmediately;
    private String scheduledAt; // ISO datetime string
}
