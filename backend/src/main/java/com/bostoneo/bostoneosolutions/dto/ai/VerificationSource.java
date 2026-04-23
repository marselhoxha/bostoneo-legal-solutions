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
public class VerificationSource {
    private String citation;   // e.g. "M.G.L. c. 231, § 60B"
    private String url;        // authoritative source URL (malegislature.gov, masscourts.org, etc.)
    private String verifiedOn; // ISO date string "YYYY-MM-DD"
}
