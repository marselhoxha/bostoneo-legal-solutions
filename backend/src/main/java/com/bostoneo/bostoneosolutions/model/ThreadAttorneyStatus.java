package com.bostoneo.bostoneosolutions.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;
import static jakarta.persistence.GenerationType.IDENTITY;

/**
 * Tracks per-attorney read status for message threads.
 * This allows each attorney to have their own unread count,
 * so when one attorney reads a message, it doesn't mark it as read for others.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_DEFAULT)
@Entity
@Table(name = "thread_attorney_status",
       uniqueConstraints = @UniqueConstraint(columnNames = {"thread_id", "attorney_user_id"}))
public class ThreadAttorneyStatus {

    @Id
    @GeneratedValue(strategy = IDENTITY)
    @Column(name = "id", columnDefinition = "BIGINT UNSIGNED")
    private Long id;

    @Column(name = "thread_id", nullable = false, columnDefinition = "BIGINT UNSIGNED")
    private Long threadId;

    @Column(name = "attorney_user_id", nullable = false, columnDefinition = "BIGINT UNSIGNED")
    private Long attorneyUserId;

    @Column(name = "unread_count")
    @Builder.Default
    private Integer unreadCount = 0;

    @Column(name = "last_read_at")
    private LocalDateTime lastReadAt;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    /**
     * Increment unread count when a new message arrives
     */
    public void incrementUnread() {
        this.unreadCount = (this.unreadCount == null ? 0 : this.unreadCount) + 1;
    }

    /**
     * Mark all messages as read for this attorney
     */
    public void markAsRead() {
        this.unreadCount = 0;
        this.lastReadAt = LocalDateTime.now();
    }
}
