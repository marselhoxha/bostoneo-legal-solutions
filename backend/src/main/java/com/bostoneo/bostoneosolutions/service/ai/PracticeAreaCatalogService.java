package com.bostoneo.bostoneosolutions.service.ai;

import com.bostoneo.bostoneosolutions.dto.ai.DocumentTypeTemplate;
import com.bostoneo.bostoneosolutions.dto.ai.PracticeAreaCatalogResponse;
import com.bostoneo.bostoneosolutions.dto.ai.PracticeAreaCatalogResponse.CatalogEntry;
import com.bostoneo.bostoneosolutions.dto.ai.PracticeAreaCatalogResponse.CatalogTier;
import com.bostoneo.bostoneosolutions.enumeration.PracticeArea;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Returns a per-practice-area, tiered catalog of document types that actually have coverage
 * in {@link DocumentTypeTemplateRegistry}. Drives Step 2 of the draft-wizard.
 *
 * <p>Design:</p>
 * <ul>
 *   <li>A hardcoded {@link #TIER_MAP} encodes attorney-market research — 5 entries per
 *       tier, three tiers per PA. This map IS the research output, codified.</li>
 *   <li>For each candidate doc type, we check whether the registry has a matching key
 *       in any of the 3 PA-aware cascade branches: {@code {type}_{pa}_{state}},
 *       {@code {type}_{state}}, {@code {type}_{pa}}. Only candidates that survive
 *       appear in the response.</li>
 *   <li>Civil Litigation is the one exception: it also counts the bare {@code {type}}
 *       branch as coverage, because the un-suffixed generics (complaint, motion,
 *       discovery, etc.) ARE the Civil baseline — they were never renamed.</li>
 *   <li>Response is {@code @Cacheable}: the registry is immutable at runtime, and the
 *       catalog is deterministic per {@code (practiceArea, jurisdiction)} pair.</li>
 * </ul>
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class PracticeAreaCatalogService {

    private final DocumentTypeTemplateRegistry registry;

    // ─────────────────────────────────────────────────────────────────────────────
    // Candidate DTO — internal, only used to build the response.
    // ─────────────────────────────────────────────────────────────────────────────
    private record Candidate(
            String documentType,       // canonical slug used for cascade (e.g. "lor", "divorce_petition")
            String documentTypeUiId,   // id used by frontend DOC_TYPE_META for icons/descriptions
            String displayName,
            String category,           // "letter" | "pleading" | "motion" | "contract" | "discovery" | "other"
            String description
    ) {}

    private record TierDefinition(
            String tierName,
            int tierRank,
            List<Candidate> candidates
    ) {}

    // ─────────────────────────────────────────────────────────────────────────────
    // TIER_MAP — per-PA, 3-tier doc type catalog based on attorney-market research.
    // Only doc types whose registry cascade resolves are surfaced to the UI.
    // ─────────────────────────────────────────────────────────────────────────────
    private static final Map<String, List<TierDefinition>> TIER_MAP = buildTierMap();

    private static Map<String, List<TierDefinition>> buildTierMap() {
        Map<String, List<TierDefinition>> map = new LinkedHashMap<>();

        // ─── Personal Injury ────────────────────────────────────────────────────
        map.put("pi", List.of(
                tier("Essential", 1, List.of(
                        c("intake_questionnaire", "intake-questionnaire", "Client Intake Questionnaire", "other",
                                "Initial intake \u00b7 incident details \u00b7 injuries \u00b7 treatment providers"),
                        c("engagement_letter", "engagement-letter", "Engagement Letter", "letter",
                                "Terms of representation \u00b7 scope \u00b7 client / firm duties"),
                        c("contingency_fee_agreement", "contingency-fee-agreement", "Contingency Fee Agreement", "contract",
                                "Fee terms \u00b7 costs handling \u00b7 lien \u00b7 settlement authority"),
                        c("hipaa_authorization", "hipaa-authorization", "HIPAA Authorization", "contract",
                                "PHI release for medical records \u00b7 federally compliant"),
                        c("lor", "letter-of-representation", "Letter of Representation", "letter",
                                "Notice of representation \u00b7 policy limits \u00b7 PIP \u00b7 UIM \u00b7 multi-purpose"),
                        c("notice_of_claim", "notice-of-claim", "Notice of Claim", "letter",
                                "First notice of loss \u00b7 carrier acknowledgment \u00b7 prompt-notice trigger"),
                        c("demand_letter", "demand-letter", "Demand Letter", "letter",
                                "Settlement demand with damages breakdown"),
                        c("complaint", "complaint", "Complaint", "pleading",
                                "Civil complaint \u2014 parties, facts, counts, prayer for relief"),
                        c("medical_records_request", "medical-records-request", "Medical Records Request", "letter",
                                "HIPAA-compliant records + authorization request"),
                        c("settlement_release", "settlement-release", "Settlement Release", "contract",
                                "Final settlement + releases \u2014 post-demand resolution"),
                        c("settlement_distribution_statement", "settlement-distribution-statement", "Settlement Distribution Statement", "other",
                                "Closing statement \u00b7 fee \u00b7 costs \u00b7 lien payoffs \u00b7 net to client")
                )),
                tier("Common", 2, List.of(
                        c("preservation_letter", "preservation-letter", "Preservation Letter", "letter",
                                "Spoliation hold \u00b7 evidence categories \u00b7 ESI \u00b7 sanctions warning"),
                        c("employment_records_auth", "employment-records-auth", "Employment Records Authorization", "other",
                                "Client-signed authorization \u00b7 wage loss \u00b7 GINA-compliant"),
                        c("physician_narrative_request", "physician-narrative-request", "Physician Narrative Request", "letter",
                                "Treating provider narrative \u00b7 causation \u00b7 prognosis \u00b7 AMA Guides 6th"),
                        c("letter_of_protection", "letter-of-protection", "Letter of Protection", "letter",
                                "Provider treats on lien against settlement \u00b7 attorney-witnessed"),
                        c("policy_limits_demand", "policy-limits-demand", "Policy Limits Demand", "letter",
                                "Time-limited policy-limits demand \u00b7 bad-faith setup \u00b7 NAIC UCSPA"),
                        c("subpoena", "subpoena", "Subpoena", "discovery",
                                "Compel medical / employment records"),
                        c("interrogatories", "interrogatories", "Interrogatories", "discovery",
                                "Written questions requiring sworn answers"),
                        c("rfp", "rfp", "Request for Production", "discovery",
                                "Request for production of documents and things"),
                        c("mediation_statement", "mediation-statement", "Mediation Statement", "letter",
                                "Pre-mediation brief \u2014 facts, liability, damages")
                )),
                tier("Occasional", 3, List.of(
                        c("vehicle_preservation_letter", "vehicle-preservation-letter", "Vehicle Preservation Letter", "letter",
                                "Vehicle / EDR / ECM / dashcam preservation \u00b7 49 C.F.R. Part 563"),
                        c("surveillance_preservation_letter", "surveillance-preservation-letter", "Surveillance Preservation Letter", "letter",
                                "CCTV / body cam preservation \u00b7 audit trail \u00b7 incident-window scope"),
                        c("motion_to_dismiss", "motion-dismiss", "Motion to Dismiss", "motion",
                                "12(b) grounds \u2014 jurisdiction, venue, failure to state a claim"),
                        c("motion_compel", "motion-compel", "Motion to Compel", "motion",
                                "Force discovery responses that were not provided"),
                        c("deposition_notice", "deposition-notice", "Deposition Notice", "discovery",
                                "Notice of deposition \u2014 deponent, date, scope"),
                        c("appellate_brief", "appellate-brief", "Appellate Brief", "other",
                                "Opening brief on appeal"),
                        c("tribunal_offer_of_proof", "tribunal-offer-of-proof", "Tribunal Offer of Proof (MA)", "other",
                                "M.G.L. c. 231 \u00a7 60B med-mal tribunal \u00b7 SOC \u00b7 breach \u00b7 causation")
                ))
        ));

        // ─── Family Law ─────────────────────────────────────────────────────────
        map.put("family", List.of(
                tier("Essential", 1, List.of(
                        c("divorce_petition", "divorce-petition", "Divorce Petition", "pleading",
                                "Complaint for divorce \u2014 grounds, relief, custody, support"),
                        c("financial_statement", "financial-statement", "Financial Statement", "other",
                                "Probate & Family Court short/long form"),
                        c("parenting_plan", "parenting-plan", "Parenting Plan", "contract",
                                "Custody schedule + decision-making + dispute resolution"),
                        c("child_support_worksheet", "child-support-worksheet", "Child Support Worksheet", "other",
                                "MA Child Support Guidelines calculation"),
                        c("temporary_orders_motion", "temporary-orders-motion", "Motion for Temporary Orders", "motion",
                                "Pendente lite support, custody, use and occupancy")
                )),
                tier("Common", 2, List.of(
                        c("modification_motion", "modification-motion", "Modification Motion", "motion",
                                "Modify support, custody, or alimony"),
                        c("restraining_order", "restraining-order", "Restraining Order (209A)", "motion",
                                "Abuse prevention order \u2014 ex parte and after-hearing"),
                        c("custody_motion", "custody-motion", "Custody Motion", "motion",
                                "Custody request \u2014 legal, physical, parenting time"),
                        c("separation_agreement", "separation-agreement", "Separation Agreement", "contract",
                                "Comprehensive settlement of divorce issues")
                )),
                tier("Occasional", 3, List.of(
                        c("contempt_motion", "contempt-motion", "Contempt Motion", "motion",
                                "Enforce prior order \u2014 support, custody, parenting time"),
                        c("qdro", "qdro", "QDRO", "contract",
                                "Qualified Domestic Relations Order for retirement division")
                ))
        ));

        // ─── Criminal Defense ───────────────────────────────────────────────────
        map.put("criminal", List.of(
                tier("Essential", 1, List.of(
                        c("motion_to_suppress", "motion-suppress", "Motion to Suppress", "motion",
                                "Exclude evidence \u2014 4th / 5th / 6th Amendment or rule-based"),
                        c("motion_to_dismiss", "motion-dismiss", "Motion to Dismiss", "motion",
                                "Insufficient evidence, speedy trial, other procedural grounds"),
                        c("plea_agreement", "plea-agreement", "Plea Agreement", "contract",
                                "Negotiated plea with sentencing recommendation"),
                        c("sentencing_memo", "sentencing-memo", "Sentencing Memorandum", "other",
                                "Mitigation argument + sentencing recommendation"),
                        c("bail_motion", "bail-motion", "Bail / Bond Motion", "motion",
                                "Release on recognizance, conditions, or bail reduction")
                )),
                tier("Common", 2, List.of(
                        c("motion_in_limine", "motion-in-limine", "Motion in Limine", "motion",
                                "Exclude prejudicial evidence pre-trial"),
                        c("appeal_brief", "appellate-brief", "Notice of Appeal / Brief", "other",
                                "Appellate brief on direct review"),
                        c("expungement_petition", "expungement-petition", "Expungement / Sealing Petition", "pleading",
                                "Seal or expunge criminal record")
                )),
                tier("Occasional", 3, List.of(
                        c("new_trial_motion", "new-trial-motion", "Motion for New Trial", "motion",
                                "Post-verdict or post-sentencing new trial request"),
                        c("probation_violation_response", "probation-violation-response", "Probation Violation Response", "letter",
                                "Response to violation notice \u2014 explanation + mitigation")
                ))
        ));

        // ─── Civil Litigation (general) ─────────────────────────────────────────
        // Civil uses the un-suffixed generics as its baseline. The service's Civil-branch
        // check allows bare {type} matches to count as coverage.
        map.put("civil", List.of(
                tier("Essential", 1, List.of(
                        c("complaint", "complaint", "Complaint", "pleading",
                                "Civil complaint \u2014 parties, facts, counts, prayer for relief"),
                        c("motion_to_dismiss", "motion-dismiss", "Motion to Dismiss", "motion",
                                "12(b) grounds \u2014 jurisdiction, venue, failure to state a claim"),
                        c("motion_summary_judgment", "motion-summary-judgment", "Motion for Summary Judgment", "motion",
                                "No genuine dispute of material fact"),
                        c("interrogatories", "interrogatories", "Interrogatories", "discovery",
                                "Written questions requiring sworn answers"),
                        c("discovery", "discovery", "Discovery Package", "discovery",
                                "General discovery requests / responses")
                )),
                tier("Common", 2, List.of(
                        c("rfp", "rfp", "Request for Production", "discovery",
                                "Request for production of documents and things"),
                        c("motion_compel", "motion-compel", "Motion to Compel", "motion",
                                "Force discovery responses that were not provided"),
                        c("settlement_agreement", "settlement-agreement", "Settlement Agreement", "contract",
                                "Final settlement contract with releases"),
                        c("legal_memo", "legal-memo", "Legal Memorandum", "other",
                                "Internal research memorandum")
                )),
                tier("Occasional", 3, List.of(
                        c("motion_in_limine", "motion-in-limine", "Motion in Limine", "motion",
                                "Exclude prejudicial evidence pre-trial"),
                        c("appellate_brief", "appellate-brief", "Appellate Brief", "other",
                                "Opening brief on appeal")
                ))
        ));

        // ─── Estate Planning / Probate ──────────────────────────────────────────
        map.put("estate", List.of(
                tier("Essential", 1, List.of(
                        c("will", "will", "Last Will and Testament", "contract",
                                "Distribution of assets + executor + guardian nominations"),
                        c("rlt", "rlt", "Revocable Living Trust", "contract",
                                "Funded trust \u2014 probate avoidance + incapacity planning"),
                        c("dpoa", "dpoa", "Durable Power of Attorney", "contract",
                                "Financial power \u2014 immediate or springing"),
                        c("healthcare_proxy", "healthcare-proxy", "Healthcare Proxy", "contract",
                                "Medical decisions + end-of-life directives"),
                        c("hipaa_auth", "hipaa-auth", "HIPAA Authorization", "contract",
                                "Release of protected health information to designated agents")
                )),
                tier("Common", 2, List.of(
                        c("probate_petition", "probate-petition", "Petition for Probate", "pleading",
                                "Formal / informal probate commencement"),
                        c("trust_amendment", "trust-amendment", "Trust Amendment", "contract",
                                "Amend revocable trust terms"),
                        c("irrevocable_trust", "irrevocable-trust", "Irrevocable Trust", "contract",
                                "Asset protection + Medicaid planning + tax planning")
                )),
                tier("Occasional", 3, List.of(
                        c("guardianship_petition", "guardianship-petition", "Guardianship Petition", "pleading",
                                "Guardian / conservator appointment"),
                        c("disclaimer", "disclaimer", "Disclaimer of Inheritance", "other",
                                "Qualified disclaimer \u2014 post-death tax planning")
                ))
        ));

        // ─── Real Estate ────────────────────────────────────────────────────────
        map.put("real_estate", List.of(
                tier("Essential", 1, List.of(
                        c("psa", "psa", "Purchase & Sale Agreement", "contract",
                                "Residential / commercial P&S with contingencies"),
                        c("lease", "lease", "Lease Agreement", "contract",
                                "Residential or commercial lease"),
                        c("deed", "deed", "Deed", "contract",
                                "Warranty, quitclaim, or release deed"),
                        c("closing_statement", "closing-statement", "Closing Statement", "other",
                                "Settlement statement / closing disclosure"),
                        c("loi", "loi", "Letter of Intent", "letter",
                                "Non-binding term sheet prior to definitive agreement")
                )),
                tier("Common", 2, List.of(
                        c("easement_agreement", "easement-agreement", "Easement Agreement", "contract",
                                "Grant of access, utility, or conservation easement"),
                        c("lease_amendment", "lease-amendment", "Lease Amendment", "contract",
                                "Modify lease terms \u2014 rent, duration, use"),
                        c("property_management_agreement", "property-management-agreement", "Property Management Agreement", "contract",
                                "Owner / manager scope + fee structure")
                )),
                tier("Occasional", 3, List.of(
                        c("subordination_agreement", "subordination-agreement", "Subordination Agreement", "contract",
                                "Subordinate prior encumbrance to new financing"),
                        c("partition_complaint", "partition-complaint", "Partition Complaint", "pleading",
                                "Court-ordered division / sale of co-owned real estate")
                ))
        ));

        // Practice areas without a TIER_MAP entry are treated as "coming soon" and render
        // the empty state on the frontend. Add to this map as new PAs get template coverage.

        return Collections.unmodifiableMap(map);
    }

    private static TierDefinition tier(String name, int rank, List<Candidate> candidates) {
        return new TierDefinition(name, rank, candidates);
    }

    private static Candidate c(String docType, String uiId, String display, String category, String desc) {
        return new Candidate(docType, uiId, display, category, desc);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────────────────────

    @Cacheable(value = "documentCatalog", key = "T(java.util.Objects).hash(#practiceArea, #jurisdiction)")
    public PracticeAreaCatalogResponse getCatalog(String practiceArea, String jurisdiction) {
        String paSlug = PracticeArea.slugOrNull(practiceArea);
        String paName = PracticeArea.fromString(practiceArea)
                .map(PracticeArea::displayName)
                .orElse(practiceArea);
        String stateCode = registry.normalizeJurisdictionCode(jurisdiction);

        if (paSlug == null) {
            return PracticeAreaCatalogResponse.builder()
                    .practiceAreaSlug(null)
                    .practiceAreaName(Objects.toString(practiceArea, "Unknown"))
                    .jurisdiction(stateCode)
                    .hasCoverage(false)
                    .tiers(Collections.emptyList())
                    .emptyStateMessage("We couldn't match that practice area. Try selecting a different one, or explore the Template Library.")
                    .build();
        }

        List<TierDefinition> tierDefs = TIER_MAP.get(paSlug);
        if (tierDefs == null || tierDefs.isEmpty()) {
            return PracticeAreaCatalogResponse.builder()
                    .practiceAreaSlug(paSlug)
                    .practiceAreaName(paName)
                    .jurisdiction(stateCode)
                    .hasCoverage(false)
                    .tiers(Collections.emptyList())
                    .emptyStateMessage(paName + " templates are coming soon. In the meantime, explore the Template Library or start from a blank document.")
                    .build();
        }

        Set<String> loadedKeys = registry.getLoadedKeys();
        boolean allowBareFallback = "civil".equals(paSlug);

        List<CatalogTier> tiers = new ArrayList<>();
        boolean anyEntry = false;

        for (TierDefinition def : tierDefs) {
            List<CatalogEntry> entries = new ArrayList<>();
            for (Candidate candidate : def.candidates()) {
                CoverageResult coverage = checkCoverage(candidate.documentType(), paSlug, stateCode, loadedKeys, allowBareFallback);
                if (coverage == CoverageResult.NONE) continue;

                DocumentTypeTemplate template = registry.getTemplate(candidate.documentType());
                String displayName = candidate.displayName();
                String category = candidate.category();
                if (template != null) {
                    if (template.getDisplayName() != null && !template.getDisplayName().isBlank()) {
                        displayName = template.getDisplayName();
                    }
                    if (template.getCategory() != null && !template.getCategory().isBlank()) {
                        category = template.getCategory();
                    }
                }

                entries.add(CatalogEntry.builder()
                        .documentType(candidate.documentType())
                        .documentTypeUiId(candidate.documentTypeUiId())
                        .displayName(displayName)
                        .category(category)
                        .description(candidate.description())
                        .hasSpecificTemplate(coverage == CoverageResult.SPECIFIC)
                        .build());
            }
            if (!entries.isEmpty()) {
                tiers.add(CatalogTier.builder()
                        .tierName(def.tierName())
                        .tierRank(def.tierRank())
                        .types(entries)
                        .build());
                anyEntry = true;
            }
        }

        if (!anyEntry) {
            return PracticeAreaCatalogResponse.builder()
                    .practiceAreaSlug(paSlug)
                    .practiceAreaName(paName)
                    .jurisdiction(stateCode)
                    .hasCoverage(false)
                    .tiers(Collections.emptyList())
                    .emptyStateMessage(paName + " templates are coming soon. In the meantime, explore the Template Library or start from a blank document.")
                    .build();
        }

        log.debug("Catalog for pa={}, jur={}: {} tiers, {} total types", paSlug, stateCode, tiers.size(),
                tiers.stream().mapToInt(t -> t.getTypes().size()).sum());

        return PracticeAreaCatalogResponse.builder()
                .practiceAreaSlug(paSlug)
                .practiceAreaName(paName)
                .jurisdiction(stateCode)
                .hasCoverage(true)
                .tiers(tiers)
                .emptyStateMessage(null)
                .build();
    }

    /**
     * Optional alternative constructor that defaults jurisdiction to null when only practice area is known.
     */
    public PracticeAreaCatalogResponse getCatalog(String practiceArea) {
        return getCatalog(practiceArea, null);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Coverage check
    // ─────────────────────────────────────────────────────────────────────────────

    private enum CoverageResult {
        NONE,         // no key in registry matches
        SPECIFIC,     // a PA-aware cascade branch hit, OR (when stateCode is null) any state variant exists for the PA
        GENERIC       // only the bare {type} branch hit — Civil-only
    }

    private CoverageResult checkCoverage(String docType, String paSlug, String stateCode, Set<String> loadedKeys, boolean allowBareFallback) {
        String normalized = docType.toLowerCase().replace("-", "_").replace(" ", "_");

        if (paSlug != null && stateCode != null && loadedKeys.contains(normalized + "_" + paSlug + "_" + stateCode)) {
            return CoverageResult.SPECIFIC;
        }
        if (stateCode != null && loadedKeys.contains(normalized + "_" + stateCode)) {
            return CoverageResult.SPECIFIC;
        }
        if (paSlug != null && loadedKeys.contains(normalized + "_" + paSlug)) {
            return CoverageResult.SPECIFIC;
        }

        // No case linked yet (stateCode == null) but the registry has at least one
        // {type}_{pa}_{state} variant. Surface the doc type anyway — the wizard
        // resolves jurisdiction in a later step, at which point the full cascade
        // will hit the state-specific template. Without this, docs like
        // `demand_letter_pi_ma` stay hidden until the user links a case.
        if (paSlug != null && stateCode == null) {
            String prefix = normalized + "_" + paSlug + "_";
            for (String key : loadedKeys) {
                if (key.startsWith(prefix)) {
                    return CoverageResult.SPECIFIC;
                }
            }
        }

        if (allowBareFallback && loadedKeys.contains(normalized)) {
            return CoverageResult.GENERIC;
        }
        return CoverageResult.NONE;
    }

    /** Expose the PA slugs that have tier coverage — used for admin / debugging. */
    public Set<String> getSupportedPracticeAreas() {
        return Collections.unmodifiableSet(TIER_MAP.keySet());
    }
}
