package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.ai.AiDocumentResponse;
import com.bostoneo.bostoneosolutions.model.LegalCase;
import com.bostoneo.bostoneosolutions.repository.AttorneyRepository;
import com.bostoneo.bostoneosolutions.repository.OrganizationRepository;
import com.bostoneo.bostoneosolutions.repository.StateCourtConfigurationRepository;
import com.bostoneo.bostoneosolutions.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

/**
 * Tests for DocumentTemplateEngine — template routing, section rendering,
 * and criminal case detection.
 */
class DocumentTemplateEngineTest {

    private DocumentTemplateEngine engine;

    @BeforeEach
    void setUp() {
        engine = new DocumentTemplateEngine(
                new JurisdictionResolver(mock(OrganizationRepository.class)),
                mock(UserRepository.class),
                mock(OrganizationRepository.class),
                mock(StateCourtConfigurationRepository.class),
                mock(AttorneyRepository.class)
        );
    }

    // ── resolveDocumentTemplateKey: template routing ──

    @Test
    void resolveDocumentTemplateKey_complaint_returnsComplaint() {
        assertEquals("complaint", engine.resolveDocumentTemplateKey("complaint"));
    }

    @Test
    void resolveDocumentTemplateKey_brief_returnsBrief() {
        assertEquals("brief", engine.resolveDocumentTemplateKey("brief"));
    }

    @Test
    void resolveDocumentTemplateKey_memorandum_returnsBrief() {
        assertEquals("brief", engine.resolveDocumentTemplateKey("memorandum"));
    }

    @Test
    void resolveDocumentTemplateKey_legalMemo_returnsBrief() {
        assertEquals("brief", engine.resolveDocumentTemplateKey("legal_memorandum"));
    }

    @Test
    void resolveDocumentTemplateKey_motion_returnsMotion() {
        assertEquals("motion", engine.resolveDocumentTemplateKey("motion"));
    }

    @Test
    void resolveDocumentTemplateKey_motionDismiss_returnsMotion() {
        assertEquals("motion", engine.resolveDocumentTemplateKey("motion-dismiss"));
    }

    @Test
    void resolveDocumentTemplateKey_petition_returnsMotion() {
        assertEquals("motion", engine.resolveDocumentTemplateKey("petition"));
    }

    @Test
    void resolveDocumentTemplateKey_pleading_returnsMotion() {
        assertEquals("motion", engine.resolveDocumentTemplateKey("pleading"));
    }

    @Test
    void supportsTemplateGeneration_discovery_returnsTrue() {
        assertTrue(engine.supportsTemplateGeneration("discovery"));
    }

    @Test
    void supportsTemplateGeneration_interrogatories_returnsTrue() {
        assertTrue(engine.supportsTemplateGeneration("interrogatories"));
    }

    @Test
    void resolveDocumentTemplateKey_discovery_returnsDiscovery() {
        assertEquals("discovery", engine.resolveDocumentTemplateKey("discovery"));
    }

    @Test
    void resolveDocumentTemplateKey_interrogatories_returnsDiscovery() {
        assertEquals("discovery", engine.resolveDocumentTemplateKey("interrogatories"));
    }

    @Test
    void resolveDocumentTemplateKey_requestForProduction_returnsDiscovery() {
        assertEquals("discovery", engine.resolveDocumentTemplateKey("request-for-production-discovery"));
    }

    @Test
    void resolveDocumentTemplateKey_null_returnsMotion() {
        assertEquals("motion", engine.resolveDocumentTemplateKey(null));
    }

    @Test
    void resolveDocumentTemplateKey_unknown_returnsMotion() {
        assertEquals("motion", engine.resolveDocumentTemplateKey("unknown-type"));
    }

    // ── renderSectionsToHtml: type-specific section headings ──

    @Test
    void renderSectionsToHtml_motion_usesMotionHeadings() {
        AiDocumentResponse response = AiDocumentResponse.builder()
                .facts("Test facts here.")
                .legalStandard("Test legal standard.")
                .arguments(List.of(AiDocumentResponse.ArgumentSection.builder()
                        .letter("A").heading("Test Heading").body("Test body.").build()))
                .build();
        String html = engine.renderSectionsToHtml(response, "motion");
        assertTrue(html.contains("I.  STATEMENT OF FACTS"));
        assertTrue(html.contains("II.  APPLICABLE LEGAL STANDARDS"));
        assertTrue(html.contains("III.  ARGUMENT"));
        assertTrue(html.contains("<h3>A.  Test Heading</h3>"));
    }

    @Test
    void renderSectionsToHtml_complaint_usesComplaintHeadings() {
        AiDocumentResponse response = AiDocumentResponse.builder()
                .facts("First allegation.\n\nSecond allegation.")
                .legalStandard("This Court has jurisdiction.")
                .arguments(List.of(
                        AiDocumentResponse.ArgumentSection.builder()
                                .letter("I").heading("Negligence").body("Defendant owed a duty.").build(),
                        AiDocumentResponse.ArgumentSection.builder()
                                .letter("II").heading("Breach of Contract").body("Defendant breached.").build()))
                .build();
        String html = engine.renderSectionsToHtml(response, "complaint");
        assertTrue(html.contains("JURISDICTION AND VENUE"));
        assertTrue(html.contains("FACTUAL ALLEGATIONS"));
        assertTrue(html.contains("COUNT I: Negligence"));
        assertTrue(html.contains("COUNT II: Breach of Contract"));
        // Facts should be numbered paragraphs
        assertTrue(html.contains("1. First allegation."));
        assertTrue(html.contains("2. Second allegation."));
    }

    @Test
    void renderSectionsToHtml_brief_usesBriefHeadings() {
        AiDocumentResponse response = AiDocumentResponse.builder()
                .facts("The facts of the case.")
                .legalStandard("Under Rule 12(b)(6)...")
                .arguments(List.of(AiDocumentResponse.ArgumentSection.builder()
                        .letter("A").heading("Failure to State a Claim").body("The complaint fails.").build()))
                .build();
        String html = engine.renderSectionsToHtml(response, "brief");
        assertTrue(html.contains("STATEMENT OF FACTS"));
        assertTrue(html.contains("LEGAL STANDARD"));
        assertTrue(html.contains("ARGUMENT"));
        assertFalse(html.contains("APPLICABLE LEGAL STANDARDS")); // Not motion-style
    }

    @Test
    void renderSectionsToHtml_discovery_usesDiscoveryHeadings() {
        AiDocumentResponse response = AiDocumentResponse.builder()
                .facts("As used herein, the term 'document' shall mean any writing.")
                .legalStandard("Pursuant to Federal Rule of Civil Procedure 34.")
                .arguments(List.of(
                        AiDocumentResponse.ArgumentSection.builder()
                                .letter("1").heading("Communications Between Parties").body("All documents and communications between Plaintiff and Defendant.").build(),
                        AiDocumentResponse.ArgumentSection.builder()
                                .letter("2").heading("Insurance Policies").body("Complete copies of all liability insurance policies.").build()))
                .build();
        String html = engine.renderSectionsToHtml(response, "discovery");
        assertTrue(html.contains("INSTRUCTIONS AND DEFINITIONS"));
        assertTrue(html.contains("Pursuant to Federal Rule of Civil Procedure 34."));
        assertTrue(html.contains("REQUESTS"));
        assertTrue(html.contains("<strong>1. Communications Between Parties</strong>"));
        assertTrue(html.contains("<strong>2. Insurance Policies</strong>"));
        // Should NOT contain motion-style headings
        assertFalse(html.contains("STATEMENT OF FACTS"));
        assertFalse(html.contains("APPLICABLE LEGAL STANDARDS"));
    }

    @Test
    void renderSectionsToHtml_interrogatories_usesDiscoveryHeadings() {
        AiDocumentResponse response = AiDocumentResponse.builder()
                .facts("Instructions for responding to these interrogatories.")
                .arguments(List.of(
                        AiDocumentResponse.ArgumentSection.builder()
                                .letter("1").heading("Party Identification").body("State your full legal name and address.").build()))
                .build();
        String html = engine.renderSectionsToHtml(response, "interrogatories");
        assertTrue(html.contains("INSTRUCTIONS AND DEFINITIONS"));
        assertTrue(html.contains("<strong>1. Party Identification</strong>"));
    }

    @Test
    void renderSectionsToHtml_complaint_stripsAiNumbering() {
        AiDocumentResponse response = AiDocumentResponse.builder()
                .facts("1. Already numbered.\n\n2. Also numbered.")
                .build();
        String html = engine.renderSectionsToHtml(response, "complaint");
        // Should re-number, not produce "1. 1. Already numbered."
        assertTrue(html.contains("1. Already numbered."));
        assertTrue(html.contains("2. Also numbered."));
        assertFalse(html.contains("1. 1."));
    }

    // ── renderConclusionText: prose conclusion for briefs ──

    @Test
    void renderConclusionText_singleItem() {
        AiDocumentResponse response = AiDocumentResponse.builder()
                .prayerItems(List.of("Dismiss the Complaint with prejudice"))
                .build();
        String conclusion = engine.renderConclusionText(response);
        assertTrue(conclusion.startsWith("For the foregoing reasons,"));
        assertTrue(conclusion.contains("dismiss the Complaint with prejudice"));
    }

    @Test
    void renderConclusionText_multipleItems() {
        AiDocumentResponse response = AiDocumentResponse.builder()
                .prayerItems(List.of("Dismiss the Complaint", "Award attorney's fees"))
                .build();
        String conclusion = engine.renderConclusionText(response);
        assertTrue(conclusion.contains("(1)"));
        assertTrue(conclusion.contains("(2)"));
    }

    @Test
    void renderConclusionText_emptyItems_defaultMessage() {
        AiDocumentResponse response = AiDocumentResponse.builder().build();
        String conclusion = engine.renderConclusionText(response);
        assertEquals("For the foregoing reasons, the Court should grant the relief requested herein.", conclusion);
    }

    @Test
    void renderConclusionText_filtersOtherRelief() {
        AiDocumentResponse response = AiDocumentResponse.builder()
                .prayerItems(List.of("Dismiss the case", "Grant such other and further relief as deemed just"))
                .build();
        String conclusion = engine.renderConclusionText(response);
        assertTrue(conclusion.contains("dismiss the case"));
        assertFalse(conclusion.contains("other and further relief"));
    }

    // ── isCriminalCase: practice area detection ──

    @Test
    void isCriminalCase_null_returnsFalse() {
        assertFalse(engine.isCriminalCase(null));
    }

    @Test
    void isCriminalCase_emptyCase_returnsFalse() {
        LegalCase legalCase = new LegalCase();
        assertFalse(engine.isCriminalCase(legalCase));
    }

    @Test
    void isCriminalCase_criminalPracticeArea_returnsTrue() {
        LegalCase legalCase = new LegalCase();
        legalCase.setPracticeArea("Criminal Defense");
        assertTrue(engine.isCriminalCase(legalCase));
    }

    @Test
    void isCriminalCase_dwiPracticeArea_returnsTrue() {
        LegalCase legalCase = new LegalCase();
        legalCase.setPracticeArea("DWI Defense");
        assertTrue(engine.isCriminalCase(legalCase));
    }

    @Test
    void isCriminalCase_duiPracticeArea_returnsTrue() {
        LegalCase legalCase = new LegalCase();
        legalCase.setPracticeArea("DUI");
        assertTrue(engine.isCriminalCase(legalCase));
    }

    @Test
    void isCriminalCase_felonyPracticeArea_returnsTrue() {
        LegalCase legalCase = new LegalCase();
        legalCase.setPracticeArea("Felony Defense");
        assertTrue(engine.isCriminalCase(legalCase));
    }

    @Test
    void isCriminalCase_misdemeanorPracticeArea_returnsTrue() {
        LegalCase legalCase = new LegalCase();
        legalCase.setPracticeArea("Misdemeanor");
        assertTrue(engine.isCriminalCase(legalCase));
    }

    @Test
    void isCriminalCase_civilPracticeArea_returnsFalse() {
        LegalCase legalCase = new LegalCase();
        legalCase.setPracticeArea("Personal Injury");
        assertFalse(engine.isCriminalCase(legalCase));
    }

    @Test
    void isCriminalCase_primaryChargeSet_returnsTrue() {
        LegalCase legalCase = new LegalCase();
        legalCase.setPrimaryCharge("First Degree Murder");
        assertTrue(engine.isCriminalCase(legalCase));
    }

    @Test
    void isCriminalCase_chargeLevelSet_returnsTrue() {
        LegalCase legalCase = new LegalCase();
        legalCase.setChargeLevel("Felony");
        assertTrue(engine.isCriminalCase(legalCase));
    }

    @Test
    void isCriminalCase_titleWithMurder_returnsTrue() {
        LegalCase legalCase = new LegalCase();
        legalCase.setTitle("State v. Morrison - First Degree Murder");
        assertTrue(engine.isCriminalCase(legalCase));
    }

    @Test
    void isCriminalCase_titleStartsWithStateV_returnsTrue() {
        LegalCase legalCase = new LegalCase();
        legalCase.setTitle("State v. Johnson");
        assertTrue(engine.isCriminalCase(legalCase));
    }

    @Test
    void isCriminalCase_titleStartsWithPeopleV_returnsTrue() {
        LegalCase legalCase = new LegalCase();
        legalCase.setTitle("People v. Smith");
        assertTrue(engine.isCriminalCase(legalCase));
    }

    @Test
    void isCriminalCase_titleStartsWithCommonwealthV_returnsTrue() {
        LegalCase legalCase = new LegalCase();
        legalCase.setTitle("Commonwealth v. Jones");
        assertTrue(engine.isCriminalCase(legalCase));
    }

    @Test
    void isCriminalCase_titleStartsWithUnitedStatesV_returnsTrue() {
        LegalCase legalCase = new LegalCase();
        legalCase.setTitle("United States v. Davis");
        assertTrue(engine.isCriminalCase(legalCase));
    }

    @Test
    void isCriminalCase_titleWithAssaultOnly_returnsFalse() {
        // "Assault" alone is ambiguous — could be civil tort. Requires prosecution pattern.
        LegalCase legalCase = new LegalCase();
        legalCase.setTitle("Aggravated Assault Case");
        assertFalse(engine.isCriminalCase(legalCase));
    }

    @Test
    void isCriminalCase_titleWithAssaultAndProsecution_returnsTrue() {
        // "Assault" with prosecution pattern IS criminal
        LegalCase legalCase = new LegalCase();
        legalCase.setTitle("State v. Brown - Aggravated Assault");
        assertTrue(engine.isCriminalCase(legalCase));
    }

    @Test
    void isCriminalCase_civilTitle_returnsFalse() {
        LegalCase legalCase = new LegalCase();
        legalCase.setTitle("Smith v. ABC Corp - Contract Dispute");
        assertFalse(engine.isCriminalCase(legalCase));
    }

    @Test
    void isCriminalCase_personalInjuryTitle_returnsFalse() {
        LegalCase legalCase = new LegalCase();
        legalCase.setTitle("Doe v. Hospital - Medical Malpractice");
        assertFalse(engine.isCriminalCase(legalCase));
    }

    @Test
    void isCriminalCase_practiceAreaTakesPrecedence() {
        // Even if title looks civil, criminal practice area wins
        LegalCase legalCase = new LegalCase();
        legalCase.setPracticeArea("Criminal Defense");
        legalCase.setTitle("Smith v. Jones");
        assertTrue(engine.isCriminalCase(legalCase));
    }

    @Test
    void isCriminalCase_blankPrimaryCharge_notCriminal() {
        LegalCase legalCase = new LegalCase();
        legalCase.setPrimaryCharge("   ");
        assertFalse(engine.isCriminalCase(legalCase));
    }

    // ── Letter type routing and detection ──

    @Test
    void resolveDocumentTemplateKey_correspondence_returnsLetter() {
        assertEquals("letter", engine.resolveDocumentTemplateKey("correspondence"));
    }

    @Test
    void resolveDocumentTemplateKey_coverLetter_returnsLetter() {
        assertEquals("letter", engine.resolveDocumentTemplateKey("cover-letter"));
    }

    @Test
    void resolveDocumentTemplateKey_letterOfRepresentation_returnsLetter() {
        assertEquals("letter", engine.resolveDocumentTemplateKey("letter-of-representation"));
    }

    @Test
    void resolveDocumentTemplateKey_opposingCounselLetter_returnsLetter() {
        assertEquals("letter", engine.resolveDocumentTemplateKey("opposing-counsel-letter"));
    }

    @Test
    void resolveDocumentTemplateKey_opinionLetter_returnsLetter() {
        assertEquals("letter", engine.resolveDocumentTemplateKey("opinion-letter"));
    }

    @Test
    void resolveDocumentTemplateKey_settlementLetter_returnsLetter() {
        assertEquals("letter", engine.resolveDocumentTemplateKey("settlement-letter"));
    }

    @Test
    void resolveDocumentTemplateKey_clientEmail_returnsLetter() {
        assertEquals("letter", engine.resolveDocumentTemplateKey("client-email"));
    }

    @Test
    void isLetterDocumentType_correspondence_returnsTrue() {
        assertTrue(engine.isLetterDocumentType("correspondence"));
    }

    @Test
    void isLetterDocumentType_coverLetter_returnsTrue() {
        assertTrue(engine.isLetterDocumentType("cover-letter"));
    }

    @Test
    void isLetterDocumentType_demandLetter_returnsFalse() {
        assertFalse(engine.isLetterDocumentType("demand-letter"));
    }

    @Test
    void isLetterDocumentType_null_returnsFalse() {
        assertFalse(engine.isLetterDocumentType(null));
    }

    @Test
    void supportsTemplateGeneration_correspondence_returnsTrue() {
        assertTrue(engine.supportsTemplateGeneration("correspondence"));
    }

    @Test
    void supportsTemplateGeneration_letterOfRepresentation_returnsTrue() {
        assertTrue(engine.supportsTemplateGeneration("letter-of-representation"));
    }

    @Test
    void supportsTemplateGeneration_demandLetter_returnsFalse() {
        assertFalse(engine.supportsTemplateGeneration("demand-letter"));
    }

    @Test
    void renderLetterDocument_basicLetter_containsTemplateMarker() {
        AiDocumentResponse response = AiDocumentResponse.builder()
                .salutation("Dear Ms. Krause:")
                .letterBody("Please be advised that this firm has been retained.\n\nWe look forward to hearing from you.")
                .closing("Very truly yours,")
                .recipientBlock("Liberty Mutual Insurance\nAttn: Jane Krause\n175 Berkeley Street\nBoston, MA 02116")
                .reBlock("Our Client: John Doe\nClaim Number: LM-2025-12345")
                .build();
        String html = engine.renderLetterDocument(response, null, null, null);
        assertTrue(html.startsWith("<!-- HTML_TEMPLATE -->"));
    }

    @Test
    void renderLetterDocument_basicLetter_containsSalutationAndClosing() {
        AiDocumentResponse response = AiDocumentResponse.builder()
                .salutation("Dear Ms. Krause:")
                .letterBody("This firm represents John Doe.")
                .closing("Sincerely,")
                .build();
        String html = engine.renderLetterDocument(response, null, null, null);
        assertTrue(html.contains("Dear Ms. Krause:"));
        assertTrue(html.contains("Sincerely,"));
    }

    @Test
    void renderLetterDocument_recipientBlock_rendersAsHtml() {
        AiDocumentResponse response = AiDocumentResponse.builder()
                .letterBody("Test body.")
                .recipientBlock("Liberty Mutual Insurance\nAttn: Jane Krause")
                .build();
        String html = engine.renderLetterDocument(response, null, null, null);
        assertTrue(html.contains("Liberty Mutual Insurance"));
        assertTrue(html.contains("Jane Krause"));
    }

    @Test
    void renderLetterDocument_reBlock_stripsAiRePrefix() {
        AiDocumentResponse response = AiDocumentResponse.builder()
                .letterBody("Test body.")
                .reBlock("Re: Our Client: John Doe\nClaim Number: 12345")
                .build();
        String html = engine.renderLetterDocument(response, null, null, null);
        // Should have Re: label added by template rendering, AI prefix stripped
        assertTrue(html.contains("<strong>Re:</strong>"));
        // Tabular format: label in one cell, value in another
        assertTrue(html.contains("Our Client:"));
        assertTrue(html.contains("John Doe"));
        assertTrue(html.contains("Claim Number:"));
        assertTrue(html.contains("12345"));
    }

    @Test
    void renderLetterDocument_viaLine_renderedFromTitle() {
        AiDocumentResponse response = AiDocumentResponse.builder()
                .title("Via Certified Mail, Return Receipt Requested")
                .letterBody("Test body.")
                .build();
        String html = engine.renderLetterDocument(response, null, null, null);
        assertTrue(html.contains("Via Certified Mail, Return Receipt Requested"));
    }

    @Test
    void renderLetterDocument_withStationery_usesStationeryHtml() {
        DocumentTemplateEngine.StationeryHtmlParts stationery = new DocumentTemplateEngine.StationeryHtmlParts(
                "<div>FIRM LETTERHEAD</div>",
                "<div>SIGNATURE BLOCK</div>",
                "<div>FOOTER</div>"
        );
        AiDocumentResponse response = AiDocumentResponse.builder()
                .letterBody("Test body.")
                .build();
        String html = engine.renderLetterDocument(response, null, null, stationery);
        assertTrue(html.contains("FIRM LETTERHEAD"));
        assertTrue(html.contains("SIGNATURE BLOCK"));
        assertTrue(html.contains("FOOTER"));
    }

    @Test
    void renderLetterDocument_defaultSalutationAndClosing() {
        AiDocumentResponse response = AiDocumentResponse.builder()
                .letterBody("Test body.")
                .build();
        String html = engine.renderLetterDocument(response, null, null, null);
        // Defaults when AI doesn't provide them
        assertTrue(html.contains("Dear Sir or Madam:"));
        assertTrue(html.contains("Very truly yours,"));
    }

    // ── Contract type routing and detection ──

    @Test
    void resolveDocumentTemplateKey_contract_returnsContract() {
        assertEquals("contract", engine.resolveDocumentTemplateKey("contract"));
    }

    @Test
    void resolveDocumentTemplateKey_nda_returnsContract() {
        assertEquals("contract", engine.resolveDocumentTemplateKey("nda"));
    }

    @Test
    void resolveDocumentTemplateKey_settlementAgreement_returnsContract() {
        assertEquals("contract", engine.resolveDocumentTemplateKey("settlement-agreement"));
    }

    @Test
    void isContractDocumentType_contract_returnsTrue() {
        assertTrue(engine.isContractDocumentType("contract"));
    }

    @Test
    void isContractDocumentType_nda_returnsTrue() {
        assertTrue(engine.isContractDocumentType("nda"));
    }

    @Test
    void isContractDocumentType_settlementAgreement_returnsTrue() {
        assertTrue(engine.isContractDocumentType("settlement-agreement"));
    }

    @Test
    void isContractDocumentType_nonDisclosureAgreement_returnsTrue() {
        assertTrue(engine.isContractDocumentType("non-disclosure-agreement"));
    }

    @Test
    void isContractDocumentType_motion_returnsFalse() {
        assertFalse(engine.isContractDocumentType("motion"));
    }

    @Test
    void isContractDocumentType_null_returnsFalse() {
        assertFalse(engine.isContractDocumentType(null));
    }

    @Test
    void supportsTemplateGeneration_contract_returnsTrue() {
        assertTrue(engine.supportsTemplateGeneration("contract"));
    }

    @Test
    void supportsTemplateGeneration_nda_returnsTrue() {
        assertTrue(engine.supportsTemplateGeneration("nda"));
    }

    @Test
    void renderContractDocument_basicContract_containsTemplateMarker() {
        AiDocumentResponse response = AiDocumentResponse.builder()
                .title("SERVICE AGREEMENT")
                .facts("This Service Agreement is entered into as of April 15, 2026.")
                .arguments(List.of(
                        AiDocumentResponse.ArgumentSection.builder()
                                .letter("1").heading("Definitions").body("The following terms shall have the meanings set forth below.").build(),
                        AiDocumentResponse.ArgumentSection.builder()
                                .letter("2").heading("Scope of Services").body("Provider shall deliver consulting services.").build()))
                .build();
        String html = engine.renderContractDocument(response, null);
        assertTrue(html.startsWith("<!-- HTML_TEMPLATE -->"));
    }

    @Test
    void renderContractDocument_rendersTitle() {
        AiDocumentResponse response = AiDocumentResponse.builder()
                .title("NON-DISCLOSURE AGREEMENT")
                .arguments(List.of())
                .build();
        String html = engine.renderContractDocument(response, null);
        assertTrue(html.contains("NON-DISCLOSURE AGREEMENT"));
    }

    @Test
    void renderContractDocument_rendersNumberedSections() {
        AiDocumentResponse response = AiDocumentResponse.builder()
                .title("AGREEMENT")
                .arguments(List.of(
                        AiDocumentResponse.ArgumentSection.builder()
                                .letter("1").heading("Definitions").body("Key terms are defined here.").build(),
                        AiDocumentResponse.ArgumentSection.builder()
                                .letter("2").heading("Term and Termination").body("This agreement runs for two years.").build()))
                .build();
        String html = engine.renderContractDocument(response, null);
        assertTrue(html.contains("1. DEFINITIONS"));
        assertTrue(html.contains("2. TERM AND TERMINATION"));
        assertTrue(html.contains("Key terms are defined here."));
    }

    @Test
    void renderContractDocument_rendersPreamble() {
        AiDocumentResponse response = AiDocumentResponse.builder()
                .title("AGREEMENT")
                .facts("This Agreement is entered into by ABC Corp and XYZ Inc.")
                .build();
        String html = engine.renderContractDocument(response, null);
        assertTrue(html.contains("ABC Corp"));
        assertTrue(html.contains("XYZ Inc"));
    }

    @Test
    void renderContractDocument_dualSignatureBlocks_withCase() {
        LegalCase legalCase = new LegalCase();
        legalCase.setClientName("Acme Corporation");
        legalCase.setDefendantName("Beta Industries");
        AiDocumentResponse response = AiDocumentResponse.builder()
                .title("SERVICE AGREEMENT")
                .build();
        String html = engine.renderContractDocument(response, legalCase);
        assertTrue(html.contains("Acme Corporation"));
        assertTrue(html.contains("Beta Industries"));
        assertTrue(html.contains("SIGNATURE PAGE"));
        assertTrue(html.contains("IN WITNESS WHEREOF"));
    }

    @Test
    void renderContractDocument_dualSignatureBlocks_withoutCase() {
        AiDocumentResponse response = AiDocumentResponse.builder()
                .title("NDA")
                .build();
        String html = engine.renderContractDocument(response, null);
        assertTrue(html.contains("[PARTY 1]"));
        assertTrue(html.contains("[PARTY 2]"));
    }

    @Test
    void renderContractDocument_defaultTitle() {
        AiDocumentResponse response = AiDocumentResponse.builder().build();
        String html = engine.renderContractDocument(response, null);
        assertTrue(html.contains("AGREEMENT"));
    }

    @Test
    void renderContractDocument_noCaptionOrLetterhead() {
        AiDocumentResponse response = AiDocumentResponse.builder()
                .title("CONTRACT")
                .build();
        String html = engine.renderContractDocument(response, null);
        assertFalse(html.contains("captionHtml"));
        assertFalse(html.contains("letterheadHtml"));
        assertFalse(html.contains("CERTIFICATE OF SERVICE"));
    }
}
