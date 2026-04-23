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

    // ── Dynamic Sections (resolved from state config + case data) ──
    private String comesNowSection;     // Resolved from state config's comesNowFormat
    private String prayerIntro;         // Resolved from state config's prayerFormat
    private String filingPartyLabel;    // "Defendant" (criminal) or "Plaintiff" (civil) — the client's role

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

    // ── Document-Type-Specific Sections ──
    private String juryDemandSection;    // Complaint only: "DEMAND FOR JURY TRIAL" section HTML
    private String conclusionText;       // Brief/memo only: prose conclusion paragraph

    // ── Letter-Specific Fields ──
    private String letterheadHtml;       // Rendered HTML from stationery letterhead, or generated from attorney/org data
    private String recipientBlock;       // Formatted recipient name/title/address as HTML
    private String reBlock;              // RE: line content as HTML
    private String salutationLine;       // "Dear Ms. Krause," or "Dear Claims Adjuster:"
    private String letterBody;           // AI-generated letter body as rendered HTML paragraphs
    private String closingLine;          // "Very truly yours," or "Sincerely,"
    private String signatureBlockHtml;   // Rendered HTML from stationery signature, or generated from attorney data
    private String footerHtml;           // Rendered HTML from stationery footer (optional)
    private String viaLine;              // "Via Certified Mail, Return Receipt Requested" or "Via Email to [email]"

    // ── Flags ──
    private boolean respectfullySubmitted;
    private boolean certificateOfService;
    private boolean hasStationery;       // If true, skip attorney/firm block in template
}
