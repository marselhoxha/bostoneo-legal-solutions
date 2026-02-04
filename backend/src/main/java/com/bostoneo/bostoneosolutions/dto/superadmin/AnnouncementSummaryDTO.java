package com.bostoneo.bostoneosolutions.dto.superadmin;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * DTO for listing announcements in the superadmin panel.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AnnouncementSummaryDTO {

    private Long id;
    private String title;
    private String message;
    private String type; // INFO, WARNING, MAINTENANCE, UPDATE
    private Boolean sendToAll;
    private List<Long> targetOrganizationIds;
    private List<Long> targetUserIds;
    private Integer recipientsCount;
    private LocalDateTime scheduledAt;
    private LocalDateTime sentAt;
    private Long createdBy;
    private String createdByName;
    private LocalDateTime createdAt;
}
