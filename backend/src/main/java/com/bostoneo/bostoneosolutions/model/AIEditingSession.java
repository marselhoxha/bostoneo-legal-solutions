package com.bostoneo.bostoneosolutions.model;

import com.bostoneo.bostoneosolutions.enumeration.SessionStatus;
import com.bostoneo.bostoneosolutions.enumeration.LockStatus;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(NON_DEFAULT)
@Entity
@Table(name = "ai_editing_sessions")
public class AIEditingSession {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "file_id", nullable = false)
    private Long fileId;

    @Column(name = "template_id")
    private Long templateId;

    @Column(name = "session_name", length = 200)
    private String sessionName;

    @Column(columnDefinition = "jsonb")
    private String participants;

    @Column(name = "owner_id", nullable = false)
    private Long ownerId;

    @CreationTimestamp
    @Column(name = "start_time")
    private LocalDateTime startTime;

    @Column(name = "end_time")
    private LocalDateTime endTime;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "active_status")
    private SessionStatus activeStatus = SessionStatus.ACTIVE;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "lock_status")
    private LockStatus lockStatus = LockStatus.UNLOCKED;

    @Column(name = "locked_by")
    private Long lockedBy;

    @Column(name = "current_content", columnDefinition = "LONGTEXT")
    private String currentContent;

    @Column(name = "change_log", columnDefinition = "jsonb")
    private String changeLog;

    @Builder.Default
    @Column(name = "ai_suggestions_enabled")
    private Boolean aiSuggestionsEnabled = true;

    @Builder.Default
    @Column(name = "auto_save_interval")
    private Integer autoSaveInterval = 30;

    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}