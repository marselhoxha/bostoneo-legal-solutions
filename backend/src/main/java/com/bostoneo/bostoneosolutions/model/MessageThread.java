package com.bostoneo.bostoneosolutions.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;
import static jakarta.persistence.GenerationType.IDENTITY;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_DEFAULT)
@Entity
@Table(name = "message_threads")
public class MessageThread {

    @Id
    @GeneratedValue(strategy = IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "case_id", nullable = false)
    private Long caseId;

    @Column(name = "client_id", nullable = false)
    private Long clientId;

    @Column(name = "attorney_id")
    private Long attorneyId;

    @Column(name = "subject", nullable = false)
    private String subject;

    @Column(name = "channel", length = 20)
    @Builder.Default
    private String channel = "PORTAL";

    @Enumerated(EnumType.STRING)
    @Column(name = "status")
    private ThreadStatus status = ThreadStatus.OPEN;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "last_message_at")
    private LocalDateTime lastMessageAt;

    @Column(name = "last_message_by")
    private String lastMessageBy;

    @Column(name = "unread_by_client")
    private Integer unreadByClient = 0;

    @Column(name = "unread_by_attorney")
    private Integer unreadByAttorney = 0;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public enum ThreadStatus {
        OPEN, CLOSED, ARCHIVED
    }
}
