package com.bostoneo.bostoneosolutions.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "timeline_events")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TimelineEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "analysis_id", nullable = false)
    private Long analysisId;

    @Column(name = "event_date", nullable = false)
    private LocalDate eventDate;

    @Column(nullable = false)
    private String title;

    @Column(name = "event_type", length = 50)
    private String eventType; // DEADLINE, FILING, HEARING, MILESTONE

    @Column(length = 20)
    private String priority; // CRITICAL, HIGH, MEDIUM, LOW

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "related_section")
    private String relatedSection;

    @Column(name = "created_date")
    private LocalDateTime createdDate;

    @Column(name = "updated_date")
    private LocalDateTime updatedDate;

    @PrePersist
    protected void onCreate() {
        createdDate = LocalDateTime.now();
        updatedDate = LocalDateTime.now();
        if (eventType == null) {
            eventType = "DEADLINE";
        }
        if (priority == null) {
            priority = "MEDIUM";
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedDate = LocalDateTime.now();
    }
}
