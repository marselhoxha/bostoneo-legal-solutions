package com.bostoneo.bostoneosolutions.dto.ai;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Structured JSON response from the AI for document generation.
 * Contains ONLY the variable legal content — boilerplate (preamble, prayer,
 * signature, certificate of service) is handled by the HTML template.
 *
 * The AI generates: title, relief sought, facts, legal standard, arguments.
 * The template handles: caption, COMES NOW boilerplate, WHEREFORE prayer,
 * signature block, certificate of service.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class AiDocumentResponse {

    /** Document title, e.g. "MOTION TO SUPPRESS BLOOD ALCOHOL EVIDENCE" */
    private String title;

    /** Brief description of relief sought (fills the COMES NOW template slot)
     *  e.g. "suppress all blood alcohol evidence obtained on December 14, 2025" */
    private String reliefSought;

    /** Statement of facts — the factual narrative */
    private String facts;

    /** Applicable legal standards — governing statutes and constitutional provisions */
    private String legalStandard;

    /** Argument subsections — each is a separate ground for the motion */
    private List<ArgumentSection> arguments;

    /** Specific items of relief for the prayer (fills the WHEREFORE template slot) */
    private List<String> prayerItems;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ArgumentSection {
        /** Subsection label, e.g. "A", "B", "C" */
        private String letter;

        /** Subsection heading, e.g. "The Traffic Stop Lacked Reasonable Suspicion" */
        private String heading;

        /** Argument body — apply law to facts for this specific ground */
        private String body;
    }
}
