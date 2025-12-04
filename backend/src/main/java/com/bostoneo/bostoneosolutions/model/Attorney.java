package com.bostoneo.bostoneosolutions.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "attorneys")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Attorney {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, unique = true)
    private Long userId;

    @Column(name = "bar_number")
    private String barNumber;

    @Column(name = "license_state")
    private String licenseState;

    @Column(name = "practice_areas", columnDefinition = "JSON")
    private String practiceAreas;

    @Column(name = "specializations", columnDefinition = "JSON")
    private String specializations;

    @Column(name = "experience_years")
    private Integer experienceYears;

    @Column(name = "is_active")
    private Boolean isActive;

    @Column(name = "current_case_load")
    private Integer currentCaseLoad;

    @Column(name = "max_case_load")
    private Integer maxCaseLoad;

    @Column(name = "preferred_case_types", columnDefinition = "JSON")
    private String preferredCaseTypes;

    @Column(name = "hourly_rate")
    private BigDecimal hourlyRate;

    @Column(name = "office_location")
    private String officeLocation;

    @Column(columnDefinition = "TEXT")
    private String bio;

    @Column(columnDefinition = "JSON")
    private String education;

    @Column(columnDefinition = "JSON")
    private String certifications;

    @Column(columnDefinition = "JSON")
    private String languages;

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
}
