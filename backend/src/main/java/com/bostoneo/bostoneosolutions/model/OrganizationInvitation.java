package com.bostoneo.bostoneosolutions.model;

import com.bostoneo.bostoneosolutions.enumeration.PracticeArea;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;
import static jakarta.persistence.GenerationType.IDENTITY;

/**
 * Organization invitation for team member invites.
 * Allows admins to invite users to join their organization.
 */
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_DEFAULT)
@Entity
@Table(name = "organization_invitations")
public class OrganizationInvitation {

    @Id
    @GeneratedValue(strategy = IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id", insertable = false, updatable = false)
    private Organization organization;

    @Column(name = "email", nullable = false)
    private String email;

    @Column(name = "role", nullable = false)
    @Builder.Default
    private String role = "USER";

    @Column(name = "token", nullable = false, unique = true)
    private String token;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "accepted_at")
    private LocalDateTime acceptedAt;

    @Column(name = "created_by", nullable = false)
    private Long createdBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by", insertable = false, updatable = false)
    private User createdByUser;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    // Practice areas the invited user will be assigned to (comma-delimited
    // PracticeArea enum names). Copied onto the resulting Attorney row when
    // the invitation is accepted.
    @Column(name = "practice_areas", columnDefinition = "TEXT")
    private String practiceAreas;

    // Transient fields for display
    @Transient
    private String organizationName;

    @Transient
    private String createdByName;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        if (this.token == null) {
            this.token = UUID.randomUUID().toString();
        }
        if (this.expiresAt == null) {
            // Default expiration: 7 days
            this.expiresAt = LocalDateTime.now().plusDays(7);
        }
    }

    /**
     * Check if the invitation has expired
     */
    public boolean isExpired() {
        return expiresAt != null && LocalDateTime.now().isAfter(expiresAt);
    }

    /**
     * Check if the invitation has been accepted
     */
    public boolean isAccepted() {
        return acceptedAt != null;
    }

    /**
     * Check if the invitation is still valid (not expired and not accepted)
     */
    public boolean isValid() {
        return !isExpired() && !isAccepted();
    }

    /**
     * Mark the invitation as accepted
     */
    public void accept() {
        this.acceptedAt = LocalDateTime.now();
    }

    /**
     * Parse {@link #practiceAreas} (comma-delimited PracticeArea enum names)
     * into a typed list. Tokens that do not map to a known enum value are
     * skipped silently. Returns an empty list when the field is null or blank.
     */
    @JsonIgnore
    public List<PracticeArea> getPracticeAreasList() {
        if (practiceAreas == null || practiceAreas.isBlank()) {
            return Collections.emptyList();
        }
        List<PracticeArea> result = new ArrayList<>();
        for (String token : practiceAreas.split(",")) {
            String trimmed = token.trim();
            if (trimmed.isEmpty()) continue;
            try {
                result.add(PracticeArea.valueOf(trimmed));
            } catch (IllegalArgumentException ignored) {
                // Skip unknown enum tokens (graceful handling).
            }
        }
        return result;
    }
}
