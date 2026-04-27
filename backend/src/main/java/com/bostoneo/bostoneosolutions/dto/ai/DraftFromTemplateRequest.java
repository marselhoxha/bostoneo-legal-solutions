package com.bostoneo.bostoneosolutions.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * Request payload for the deterministic "draft from template" endpoint.
 *
 * The contract: the backend substitutes the supplied {@code variableValues}
 * into the AILegalTemplate's body literally. No AI rewriting, no
 * paraphrasing, no restructuring. Missing values for declared variables
 * surface as {@code [Missing: variableName]} placeholders so the attorney
 * spots gaps during proofread.
 *
 * If {@code additionalInstructions} is non-blank, a single AI tweak pass
 * runs AFTER substitution using those instructions as guidance — strictly
 * opt-in.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DraftFromTemplateRequest {
    /** AILegalTemplate.id — must belong to the caller's organization. */
    private Long templateId;

    /** Optional — the case the draft is being created against. Drafts can be made
     * without a linked case (generic letter, sample doc). */
    private Long caseId;

    /** Variable name → user-supplied value. Keys not declared on the template are ignored. */
    private Map<String, String> variableValues;

    /** Optional — non-blank triggers a single AI tweak pass after substitution. */
    private String additionalInstructions;

    /** Optional — defaults derived from template name + case number. */
    private String sessionName;

    /** Fallback userId used when {@code @AuthenticationPrincipal} resolves to null
     *  (matches the existing {@code /drafts/generate} endpoint pattern). */
    private Long userId;
}
