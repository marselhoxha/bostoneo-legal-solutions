package com.bostoneo.bostoneosolutions.service.tools;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * Service for generating legal motion templates
 */
@Service
@Slf4j
public class MotionTemplateService {

    /**
     * Generate a motion template based on type and case facts
     */
    public String generateMotionTemplate(String motionType, Map<String, Object> caseFacts) {
        log.info("Generating motion template: type={}, facts={}", motionType, caseFacts);

        return switch (motionType.toLowerCase()) {
            case "suppress", "motion_to_suppress", "suppress_evidence" -> generateSuppressionMotion(caseFacts);
            case "dismiss", "motion_to_dismiss" -> generateDismissalMotion(caseFacts);
            case "continue", "motion_to_continue", "continuance" -> generateContinuanceMotion(caseFacts);
            case "discovery", "motion_for_discovery" -> generateDiscoveryMotion(caseFacts);
            case "exclude", "motion_in_limine", "exclude_evidence" -> generateMotionInLimine(caseFacts);
            default -> generateGenericMotion(motionType, caseFacts);
        };
    }

    private String generateSuppressionMotion(Map<String, Object> facts) {
        String defendant = (String) facts.getOrDefault("defendant", "[Defendant Name]");
        String grounds = (String) facts.getOrDefault("grounds", "[constitutional violation, Fourth Amendment, improper search, etc.]");
        String incidentDate = (String) facts.getOrDefault("incident_date", "[Date]");

        return String.format("""
            ## Sample Motion Language: Motion to Suppress Evidence

            **COMMONWEALTH OF MASSACHUSETTS**
            **[Court Name] - [Division]**

            **COMMONWEALTH**
            **v.**
            **%s, Defendant**

            Docket No. [___________]

            ---

            ### DEFENDANT'S MOTION TO SUPPRESS EVIDENCE

            NOW COMES the Defendant, %s, by and through undersigned counsel, and respectfully moves this Honorable Court to suppress all evidence obtained as a result of [describe unlawful conduct: unconstitutional stop, warrantless search, etc.] on %s, and in support thereof states:

            #### I. INTRODUCTION

            This motion seeks suppression of evidence obtained in violation of the Defendant's rights under the Fourth Amendment to the United States Constitution and Article 14 of the Massachusetts Declaration of Rights. The [stop/search/seizure] lacked [probable cause/reasonable suspicion/valid warrant], rendering any evidence obtained thereby inadmissible.

            #### II. FACTUAL BACKGROUND

            [Insert specific facts of the stop/search/seizure. Include:]
            - Date, time, and location
            - Officer(s) involved
            - Basis for initial contact
            - Actions taken by law enforcement
            - Evidence seized

            #### III. LEGAL STANDARD

            **A. Fourth Amendment Protection**

            The Fourth Amendment protects against unreasonable searches and seizures. *Commonwealth v. [Case Name]*, [Citation]. [For checkpoint cases: Sobriety checkpoints must satisfy heightened scrutiny under *Michigan Dep't of State Police v. Sitz*, 496 U.S. 444 (1990).]

            **B. Burden of Proof**

            The Commonwealth bears the burden of proving the lawfulness of the [stop/search/seizure] by a preponderance of the evidence. *Commonwealth v. [Case Name]*, [Citation].

            #### IV. ARGUMENT

            **A. %s**

            [First legal ground for suppression]

            [Explain why the evidence should be suppressed. Include:]
            - Relevant legal standard
            - Application of facts to law
            - Supporting case citations
            - Constitutional provisions violated

            **B. [Second Ground if Applicable]**

            [Additional suppression arguments]

            **C. Exclusionary Rule Applies**

            The exclusionary rule requires suppression of evidence obtained in violation of constitutional rights. *Mapp v. Ohio*, 367 U.S. 643 (1961). The remedy for constitutional violations is exclusion of the tainted evidence and all fruits thereof.

            #### V. CONCLUSION

            For the foregoing reasons, the Defendant respectfully requests that this Honorable Court:

            1. Schedule an evidentiary hearing on this Motion;
            2. ALLOW the Motion and suppress all evidence obtained as a result of the unlawful [stop/search/seizure];
            3. Grant such other and further relief as justice may require.

            Respectfully submitted,

            **%s, Defendant**
            By his/her attorney,

            _____________________
            [Attorney Name]
            [Attorney BBO #]
            [Law Firm]
            [Address]
            [Phone]
            [Email]

            Date: [___________]

            ---

            ### CERTIFICATE OF SERVICE

            I hereby certify that a true copy of the foregoing Motion was served upon [Assistant District Attorney Name] via [method] on [date].

            _____________________
            [Attorney Name]

            ---

            **Note:** This is a template. Customize all bracketed sections with case-specific facts, applicable citations, and legal arguments. Verify all citations before filing.
            """, defendant, defendant, incidentDate, grounds, defendant);
    }

    private String generateDismissalMotion(Map<String, Object> facts) {
        String defendant = (String) facts.getOrDefault("defendant", "[Defendant Name]");
        String grounds = (String) facts.getOrDefault("grounds", "[lack of jurisdiction, defective complaint, etc.]");

        return String.format("""
            ## Sample Motion Language: Motion to Dismiss

            ### DEFENDANT'S MOTION TO DISMISS

            NOW COMES the Defendant, %s, and respectfully moves this Honorable Court to dismiss the complaint against him/her on the grounds that %s.

            #### LEGAL STANDARD

            A motion to dismiss challenges the legal sufficiency of the complaint. The Court must accept all well-pleaded facts as true but need not accept legal conclusions. *[Applicable Standard Case]*

            #### ARGUMENT

            [Explain why dismissal is warranted:]
            - Legal deficiency in the complaint
            - Lack of subject matter jurisdiction
            - Statute of limitations has run
            - Failure to state a claim upon which relief can be granted

            #### CONCLUSION

            For the foregoing reasons, the Defendant respectfully requests that this Court ALLOW this Motion and dismiss the complaint.

            Respectfully submitted,
            [Attorney Signature Block]
            """, defendant, grounds);
    }

    private String generateContinuanceMotion(Map<String, Object> facts) {
        String movingParty = (String) facts.getOrDefault("moving_party", "[Defendant/Commonwealth]");
        String reason = (String) facts.getOrDefault("reason", "[good cause: need for additional discovery, scheduling conflict, witness unavailability, etc.]");
        String currentDate = (String) facts.getOrDefault("current_hearing_date", "[Current Date]");

        return String.format("""
            ## Sample Motion Language: Motion to Continue

            ### MOTION TO CONTINUE

            NOW COMES the %s and respectfully requests that this Honorable Court continue the hearing currently scheduled for %s to a date certain, and in support thereof states:

            1. Good cause exists for this continuance due to %s.

            2. [Opposing party] [does/does not] object to this continuance.

            3. [If applicable:] This is the [first/second] request for continuance in this matter.

            4. [If applicable:] The interests of justice require this continuance because [explain].

            WHEREFORE, the %s respectfully requests that this Court:

            1. ALLOW this Motion to Continue;
            2. Continue the hearing to [proposed date or "a date convenient to the Court"];
            3. Grant such other relief as justice may require.

            Respectfully submitted,
            [Attorney Signature Block]
            """, movingParty, currentDate, reason, movingParty);
    }

    private String generateDiscoveryMotion(Map<String, Object> facts) {
        String itemsRequested = (String) facts.getOrDefault("items_requested", "[police reports, witness statements, expert reports, etc.]");

        return String.format("""
            ## Sample Motion Language: Motion for Discovery

            ### DEFENDANT'S MOTION FOR DISCOVERY

            NOW COMES the Defendant and respectfully requests that this Court order the Commonwealth to provide the following discovery materials:

            1. **Police Reports:** All incident reports, investigation reports, and supplemental reports related to this case.

            2. **Witness Information:** Names, addresses, and statements of all witnesses the Commonwealth intends to call.

            3. **Expert Reports:** All expert reports, qualifications, and opinions the Commonwealth intends to introduce.

            4. **Physical Evidence:** Access to inspect and test all physical evidence, including [%s].

            5. **Brady Material:** All exculpatory evidence and evidence favorable to the Defendant under *Brady v. Maryland*, 373 U.S. 83 (1963).

            6. **Impeachment Evidence:** All evidence relating to the credibility of Commonwealth witnesses (*Giglio v. United States*, 405 U.S. 150 (1972)).

            #### LEGAL BASIS

            The Defendant is entitled to discovery under [Mass. R. Crim. P. 14 / applicable discovery rule]. Due process requires disclosure of all material exculpatory evidence.

            #### CONCLUSION

            WHEREFORE, the Defendant respectfully requests that this Court order the Commonwealth to provide the requested discovery within [___] days.

            Respectfully submitted,
            [Attorney Signature Block]
            """, itemsRequested);
    }

    private String generateMotionInLimine(Map<String, Object> facts) {
        String evidenceToExclude = (String) facts.getOrDefault("evidence", "[hearsay, prior bad acts, prejudicial evidence, etc.]");
        String grounds = (String) facts.getOrDefault("grounds", "[relevance, prejudice, hearsay, etc.]");

        return String.format("""
            ## Sample Motion Language: Motion in Limine

            ### DEFENDANT'S MOTION IN LIMINE TO EXCLUDE EVIDENCE

            NOW COMES the Defendant and respectfully moves this Court to exclude %s from evidence at trial on the grounds that %s.

            #### LEGAL STANDARD

            Evidence is admissible only if relevant (*Mass. G. Evid. § 401*) and not unfairly prejudicial (*Mass. G. Evid. § 403*). The Court must exclude evidence whose probative value is substantially outweighed by the danger of unfair prejudice.

            #### ARGUMENT

            **A. The Evidence is Inadmissible**

            [Explain why the evidence should be excluded:]
            - Not relevant to any issue in the case
            - Hearsay without applicable exception
            - Character evidence offered for improper purpose
            - Prejudicial effect substantially outweighs probative value
            - Violates evidentiary rules

            **B. Prejudice to Defendant**

            Admission of this evidence would unfairly prejudice the Defendant because [explain specific prejudice].

            #### CONCLUSION

            WHEREFORE, the Defendant respectfully requests that this Court:

            1. ALLOW this Motion in Limine;
            2. Exclude %s from evidence at trial;
            3. Order the Commonwealth not to reference the excluded evidence in opening, closing, or examination of witnesses.

            Respectfully submitted,
            [Attorney Signature Block]
            """, evidenceToExclude, grounds, evidenceToExclude);
    }

    private String generateGenericMotion(String motionType, Map<String, Object> facts) {
        return String.format("""
            ## Sample Motion Language: %s

            ### [TITLE OF MOTION]

            NOW COMES the [Defendant/Plaintiff/Moving Party] and respectfully moves this Honorable Court to [describe relief sought], and in support thereof states:

            #### FACTUAL BACKGROUND

            [Insert relevant facts supporting the motion]

            #### LEGAL STANDARD

            [State the applicable legal standard and burden of proof]

            #### ARGUMENT

            [Present legal arguments with supporting citations]

            #### CONCLUSION

            WHEREFORE, the [Moving Party] respectfully requests that this Court:

            1. ALLOW this Motion;
            2. [Describe specific relief requested];
            3. Grant such other and further relief as justice may require.

            Respectfully submitted,
            [Attorney Signature Block]

            ---

            **Note:** This is a generic template. Customize with case-specific facts, applicable law, and supporting citations.
            """, motionType);
    }
}
