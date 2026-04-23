package com.bostoneo.bostoneosolutions.dto.ai;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ReviewerEntry {
    private String name;         // attorney name
    private String barNumber;    // BBO # / state bar #
    private String jurisdiction; // ISO-2 state code where admitted (e.g. "ma", "ny")
    private String reviewDate;   // ISO date "YYYY-MM-DD"
    private String status;       // "unreviewed" | "reviewed" | "approved_for_production"
}
