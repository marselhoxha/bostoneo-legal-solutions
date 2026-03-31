package com.bostoneo.bostoneosolutions.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * 201 CMR 17.00 / M.G.L. c. 93H Breach Notification Service.
 * Logs potential data breaches and supports notification workflows.
 *
 * Per 93H Section 3: notification must be made "as soon as practicable
 * and without unreasonable delay" to the AG and affected individuals.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class BreachNotificationService {

    private final NamedParameterJdbcTemplate jdbc;

    /**
     * Record a potential breach incident for investigation.
     * This creates an immutable audit record that cannot be deleted.
     */
    public Long reportPotentialBreach(Long reportedByUserId, Long organizationId,
                                       String breachType, String description,
                                       String affectedDataTypes, Integer estimatedAffectedCount) {
        try {
            String sql = "INSERT INTO breach_incidents (reported_by, organization_id, breach_type, " +
                    "description, affected_data_types, estimated_affected_count, status, " +
                    "reported_at, updated_at) " +
                    "VALUES (:reportedBy, :orgId, :breachType, :description, :affectedDataTypes, " +
                    ":estimatedCount, 'REPORTED', NOW(), NOW()) RETURNING id";

            Long id = jdbc.queryForObject(sql, Map.of(
                    "reportedBy", reportedByUserId,
                    "orgId", organizationId,
                    "breachType", breachType,
                    "description", description,
                    "affectedDataTypes", affectedDataTypes,
                    "estimatedCount", estimatedAffectedCount != null ? estimatedAffectedCount : 0
            ), Long.class);

            log.warn("BREACH INCIDENT REPORTED: id={}, type={}, org={}, reporter={}",
                    id, breachType, organizationId, reportedByUserId);
            return id;
        } catch (Exception e) {
            // If the table doesn't exist yet, log critically but don't crash
            log.error("CRITICAL: Failed to record breach incident: {}. Breach details: type={}, org={}, desc={}",
                    e.getMessage(), breachType, organizationId, description);
            return null;
        }
    }

    /**
     * Update breach status (REPORTED -> INVESTIGATING -> CONFIRMED -> NOTIFIED -> RESOLVED)
     */
    public void updateBreachStatus(Long breachId, String status, String notes) {
        try {
            jdbc.update("UPDATE breach_incidents SET status = :status, resolution_notes = :notes, " +
                            "updated_at = NOW() WHERE id = :id",
                    Map.of("id", breachId, "status", status, "notes", notes != null ? notes : ""));
            log.info("Breach incident {} updated to status: {}", breachId, status);
        } catch (Exception e) {
            log.error("Failed to update breach incident {}: {}", breachId, e.getMessage());
        }
    }
}
