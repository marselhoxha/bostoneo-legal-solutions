package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.model.StateCourtConfiguration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * Builds jurisdiction-specific prompt sections for AI document generation.
 * Reads from state_court_configurations to provide state-specific legal writing
 * conventions, citation references, and procedural rules — replacing hardcoded
 * Texas-only conventions.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class JurisdictionPromptBuilder {

    private final DocumentTemplateEngine documentTemplateEngine;

    /**
     * Build a jurisdiction-specific prompt section for the given state and document type.
     * Returns formatted text to append to the AI prompt, or a minimal fallback
     * if no state configuration exists.
     */
    public String buildJurisdictionPromptSection(String jurisdiction, String documentType) {
        Optional<StateCourtConfiguration> configOpt = documentTemplateEngine.getStateConfig(jurisdiction);

        StringBuilder section = new StringBuilder();

        if (configOpt.isPresent()) {
            StateCourtConfiguration config = configOpt.get();
            section.append("**LEGAL WRITING CONVENTIONS (").append(config.getStateName()).append(")**:\n");

            // Opening format
            if (config.getComesNowFormat() != null) {
                section.append("- Opening: '").append(config.getComesNowFormat()).append("'\n");
            }

            // Prayer format
            if (config.getPrayerFormat() != null) {
                section.append("- Prayer: '").append(config.getPrayerFormat()).append("'\n");
            }

            // Preamble
            if (config.getPreambleText() != null) {
                section.append("- Preamble: '").append(config.getPreambleText()).append("'\n");
            }

            section.append("- Use formal third-person court filing tone throughout\n");

            // Citation reporters
            if (config.getCitationReporters() != null) {
                section.append("- Cite ").append(config.getStateName())
                       .append(" cases from: ").append(config.getCitationReporters()).append("\n");
            }

            // Procedural rules
            if (config.getProceduralRulesRef() != null) {
                section.append("- Cite statutes/rules: ").append(config.getProceduralRulesRef()).append("\n");
            }

            // Constitutional references
            if (config.getConstitutionalRefs() != null) {
                section.append("- Reference constitutions: ").append(config.getConstitutionalRefs()).append("\n");
            }

            section.append("- Cite 1-2 controlling cases per legal point — quality over quantity\n\n");

            log.debug("Built jurisdiction prompt section for {} ({})", config.getStateName(), config.getStateCode());
        } else {
            // Fallback: basic jurisdiction instruction when no DB config exists
            section.append("**LEGAL WRITING CONVENTIONS (").append(jurisdiction).append(")**:\n");
            section.append("- Use formal third-person court filing tone throughout\n");
            section.append("- Cite ").append(jurisdiction).append(" case law and statutes\n");
            section.append("- Follow ").append(jurisdiction).append(" rules of procedure\n");
            section.append("- Cite 1-2 controlling cases per legal point — quality over quantity\n\n");

            log.debug("No DB config for jurisdiction '{}', using fallback prompt", jurisdiction);
        }

        return section.toString();
    }
}
