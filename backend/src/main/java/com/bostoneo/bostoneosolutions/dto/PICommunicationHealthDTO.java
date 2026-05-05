package com.bostoneo.bostoneosolutions.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL;

/**
 * P5 — Communication Health summary surfaced on the Activity tab's 3-card band.
 *
 * <p>Derivation runs against the case's full {@link com.bostoneo.bostoneosolutions.model.PICommunication}
 * timeline and is purely informational — no DB writes, no caching. Cheap
 * enough to compute on every Activity-tab open since cases have at most a
 * few hundred comm rows. Tenant filtering is applied at the repository
 * layer; this DTO never leaves the org boundary.
 *
 * <p>Empty cases populate every numeric to 0 and every list/map to empty,
 * so the frontend can render "All caught up" / zero values safely.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_NULL)
public class PICommunicationHealthDTO {

    /**
     * Mean hours between an inbound communication and our subsequent outbound
     * reply to the same counterparty over the past 30 days. {@code null} if
     * no inbound→outbound pair exists in the window.
     */
    private Double avgResponseHours;

    /** Latest inbound communication regardless of party. */
    private LocalDateTime lastInboundAt;

    // NOTE: a `lastAdjusterContactAt` field was scoped here originally but
    // requires loading the case + decrypting the adjuster name to do a
    // counterparty substring match. Until that wiring lands, the frontend
    // labels the surfaced metric as "Last inbound" (not "Last adjuster
    // contact") to avoid mislabeling non-adjuster comms. Intentional gap.

    /** Count of distinct counterparties whose latest inbound has no later outbound. */
    private int awaitingReplyCount;

    /** Hours since the oldest awaiting-reply inbound was received. */
    private Double oldestAwaitingAgeHours;

    /** Top awaiting parties surfaced in the Activity Health card body. */
    private List<AwaitingItem> awaitingItems;

    /** Total comms in the past 14 days (any direction, any type). */
    private int volume14d;

    /** Comms-count by {@code PICommunication.type} (CALL / EMAIL / LETTER / MEETING). */
    private Map<String, Integer> typeBreakdown;

    /**
     * Comms-count by inferred channel — currently aliases {@link #typeBreakdown}
     * since the entity only carries {@code type}, but we surface a separate
     * field so the frontend can evolve to richer channel taxonomy without
     * a contract change.
     */
    private Map<String, Integer> channelBreakdown;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AwaitingItem {
        /** Counterparty / party name (e.g. "GEICO Adjuster Marcus Reed"). */
        private String name;
        /** Hours since the inbound was received. */
        private Double ageHours;
    }
}
