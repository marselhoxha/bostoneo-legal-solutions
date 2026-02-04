package com.bostoneo.bostoneosolutions.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Entity for storing platform announcements sent by superadmins.
 */
@Entity
@Table(name = "platform_announcements")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PlatformAnnouncement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String message;

    @Column(length = 50)
    private String type; // INFO, WARNING, MAINTENANCE, UPDATE

    @Column(name = "send_to_all")
    private Boolean sendToAll;

    @Column(name = "target_organization_ids", columnDefinition = "TEXT")
    private String targetOrganizationIds; // Comma-separated list

    @Column(name = "target_user_ids", columnDefinition = "TEXT")
    private String targetUserIds; // Comma-separated list

    @Column(name = "recipients_count")
    private Integer recipientsCount;

    @Column(name = "scheduled_at")
    private LocalDateTime scheduledAt;

    @Column(name = "sent_at")
    private LocalDateTime sentAt;

    @Column(name = "created_by")
    private Long createdBy;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
