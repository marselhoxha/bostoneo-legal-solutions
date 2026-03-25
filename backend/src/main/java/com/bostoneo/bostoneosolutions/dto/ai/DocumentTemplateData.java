package com.bostoneo.bostoneosolutions.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Holds all data fields needed for HTML template injection.
 * Layer 1 (structure) and Layer 2 (data) of the three-layer document architecture.
 * All values come from the database — never AI-generated.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DocumentTemplateData {

    // ── Case Identification ──
    private String caseNumber;          // "TX-2025-CR-04871"
    private String docketNumber;        // "MA-2025-04871"

    // ── Parties ──
    private String plaintiffName;       // "THE STATE OF TEXAS" or "COMMONWEALTH OF MASSACHUSETTS"
    private String plaintiffLabel;      // "Plaintiff" / "The People" / "Prosecution"
    private String defendantName;       // "MARCUS ANTHONY REEVES"
    private String defendantLabel;      // "Defendant"

    // ── Court ──
    private String courtName;           // "IN THE CRIMINAL DISTRICT COURT"
    private String countyState;         // "DALLAS COUNTY, TEXAS"
    private String judgeName;           // "Hon. Kristin M. Wade"

    // ── Caption Style (determined by jurisdiction) ──
    private String captionSeparator;    // "§" (Texas), ")" (California), ":" (New York)
    private String causeNumberLabel;    // "CAUSE NO." (Texas), "Case No." (default)
    private String stateLabel;          // "STATE OF TEXAS" or "COMMONWEALTH OF MASSACHUSETTS"

    // ── Document Content (from AI) ──
    private String documentTitle;       // "DEFENDANT'S MOTION TO SUPPRESS EVIDENCE"
    private String documentBody;        // Rendered HTML from AI sections

    // ── Attorney / Firm (from stationery or user profile) ──
    private String attorneyName;
    private String attorneyBarNumber;
    private String firmName;
    private String firmAddress;
    private String firmPhone;
    private String firmEmail;

    // ── Dates ──
    private String filingDate;
    private String currentDate;

    // ── Flags ──
    private boolean respectfullySubmitted;
    private boolean certificateOfService;
    private boolean hasStationery;       // If true, skip attorney/firm block in template
}
