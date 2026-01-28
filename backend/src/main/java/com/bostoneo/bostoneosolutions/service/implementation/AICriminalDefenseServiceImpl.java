package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.service.AICriminalDefenseService;
import com.bostoneo.bostoneosolutions.model.AICriminalCase;
import com.bostoneo.bostoneosolutions.model.AICriminalMotion;
import com.bostoneo.bostoneosolutions.enumeration.CriminalCaseType;
import com.bostoneo.bostoneosolutions.enumeration.CriminalCaseStatus;
import com.bostoneo.bostoneosolutions.enumeration.MotionType;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.repository.AICriminalCaseRepository;
import com.bostoneo.bostoneosolutions.repository.AICriminalMotionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.CompletableFuture;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class AICriminalDefenseServiceImpl implements AICriminalDefenseService {

    private final AICriminalCaseRepository caseRepository;
    private final AICriminalMotionRepository motionRepository;
    private final TenantService tenantService;
    
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("MMMM d, yyyy");

    // Case Management
    @Override
    public AICriminalCase createCriminalCase(AICriminalCase criminalCase) {
        log.info("Creating criminal case with docket number: {}", criminalCase.getDocketNumber());
        // SECURITY: Set organization ID from current tenant context
        criminalCase.setOrganizationId(tenantService.requireCurrentOrganizationId());
        criminalCase.setCreatedAt(LocalDateTime.now());
        criminalCase.setUpdatedAt(LocalDateTime.now());
        return caseRepository.save(criminalCase);
    }

    @Override
    public AICriminalCase updateCriminalCase(Long id, AICriminalCase criminalCase) {
        log.info("Updating criminal case ID: {}", id);
        AICriminalCase existing = getCriminalCaseById(id);
        
        // Update fields
        existing.setDocketNumber(criminalCase.getDocketNumber());
        existing.setCourtName(criminalCase.getCourtName());
        existing.setPrimaryOffense(criminalCase.getPrimaryOffense());
        existing.setOffenseLevel(criminalCase.getOffenseLevel());
        existing.setChargeCodes(criminalCase.getChargeCodes());
        existing.setBailConditions(criminalCase.getBailConditions());
        existing.setTrialDate(criminalCase.getTrialDate());
        existing.setUpdatedAt(LocalDateTime.now());
        
        return caseRepository.save(existing);
    }

    @Override
    public AICriminalCase getCriminalCaseById(Long id) {
        // SECURITY: Use tenant-filtered lookup to prevent cross-tenant access
        Long orgId = tenantService.requireCurrentOrganizationId();
        return caseRepository.findByIdAndOrganizationId(id, orgId)
            .orElseThrow(() -> new RuntimeException("Criminal case not found with ID: " + id));
    }

    @Override
    public Page<AICriminalCase> getCriminalCasesByType(CriminalCaseType caseType, Pageable pageable) {
        // For now, return all cases - implement filtering when repository method is available
        return caseRepository.findAll(pageable);
    }

    @Override
    public Page<AICriminalCase> getCriminalCasesByStatus(CriminalCaseStatus status, Pageable pageable) {
        // For now, return all cases - implement filtering when repository method is available
        return caseRepository.findAll(pageable);
    }

    @Override
    public void deleteCriminalCase(Long id) {
        log.info("Deleting criminal case ID: {}", id);
        // SECURITY: Verify case belongs to current tenant before deleting
        Long orgId = tenantService.requireCurrentOrganizationId();
        AICriminalCase existing = caseRepository.findByIdAndOrganizationId(id, orgId)
            .orElseThrow(() -> new RuntimeException("Criminal case not found with ID: " + id));
        caseRepository.delete(existing);
    }

    // Motion Practice
    @Override
    @Async
    public CompletableFuture<String> generateMotion(Long caseId, MotionType motionType, Map<String, Object> facts) {
        AICriminalCase criminalCase = getCriminalCaseById(caseId);
        
        String motion = String.format("""
            COMMONWEALTH OF MASSACHUSETTS
            %s
            
            COMMONWEALTH
            v.                                   Docket No. %s
            DEFENDANT
            
            MOTION TO %s
            
            NOW COMES the Defendant, by and through counsel, and respectfully moves this Honorable Court to %s
            
            FACTUAL BACKGROUND:
            %s
            
            ARGUMENT:
            I. Legal Standard
            %s
            
            II. Application to This Case
            Based on the facts presented, %s
            
            WHEREFORE, the Defendant respectfully requests that this Court grant this Motion.
            
            Respectfully submitted,
            Attorney for Defendant
            Date: %s
            """,
            criminalCase.getCourtName() != null ? criminalCase.getCourtName() : "Superior Court",
            criminalCase.getDocketNumber() != null ? criminalCase.getDocketNumber() : "Unknown",
            motionType.toString().replace("_", " "),
            getMotionRelief(motionType),
            facts.getOrDefault("background", "Facts to be provided"),
            getMotionLegalStandard(motionType),
            facts.getOrDefault("argument", "Detailed argument to be provided"),
            LocalDateTime.now().format(DATE_FORMATTER)
        );
        
        return CompletableFuture.completedFuture(motion);
    }

    @Override
    @Async
    public CompletableFuture<String> generateMotionToSuppress(Long caseId, Map<String, Object> evidenceDetails) {
        return generateMotion(caseId, MotionType.MOTION_TO_SUPPRESS, evidenceDetails);
    }

    @Override
    @Async
    public CompletableFuture<String> generateMotionToDismiss(Long caseId, Map<String, Object> legalArguments) {
        return generateMotion(caseId, MotionType.MOTION_TO_DISMISS, legalArguments);
    }

    @Override
    public AICriminalMotion saveMotion(AICriminalMotion motion) {
        motion.setCreatedAt(LocalDateTime.now());
        motion.setUpdatedAt(LocalDateTime.now());
        return motionRepository.save(motion);
    }

    @Override
    public List<AICriminalMotion> getMotionsByCaseId(Long caseId) {
        return motionRepository.findByCaseIdOrderByCreatedAtDesc(caseId);
    }

    // Sentencing Analysis
    @Override
    @Async
    public CompletableFuture<Map<String, Object>> analyzeSentencingGuidelines(Long caseId) {
        AICriminalCase criminalCase = getCriminalCaseById(caseId);
        
        Map<String, Object> analysis = new HashMap<>();
        analysis.put("caseId", caseId);
        analysis.put("offense", criminalCase.getPrimaryOffense());
        analysis.put("offenseLevel", criminalCase.getOffenseLevel());
        analysis.put("sentencingRange", calculateSentencingRange(criminalCase));
        analysis.put("guidelines", criminalCase.getSentencingGuidelines());
        analysis.put("mitigatingFactors", findMitigatingFactors(criminalCase));
        analysis.put("aggravatingFactors", findAggravatingFactors(criminalCase));
        analysis.put("recommendation", generateSentencingRecommendation(criminalCase));
        analysis.put("analysisDate", LocalDateTime.now());
        
        return CompletableFuture.completedFuture(analysis);
    }

    @Override
    @Async
    public CompletableFuture<String> generateSentencingMemo(Long caseId, Map<String, Object> mitigatingFactors) {
        AICriminalCase criminalCase = getCriminalCaseById(caseId);
        
        String memo = String.format("""
            SENTENCING MEMORANDUM
            
            Re: Commonwealth v. Defendant
            Docket No: %s
            
            INTRODUCTION
            Defense counsel respectfully submits this memorandum to aid the Court in imposing an appropriate sentence.
            
            OFFENSE CONDUCT
            The defendant is before the Court for sentencing on %s.
            
            MITIGATING FACTORS
            %s
            
            PERSONAL HISTORY AND CHARACTERISTICS
            %s
            
            SENTENCING RECOMMENDATION
            Based on the Massachusetts Sentencing Guidelines and the factors presented above, defense counsel
            respectfully requests a sentence of %s.
            
            CONCLUSION
            The defendant accepts responsibility and asks for the Court's consideration of the mitigating factors presented.
            
            Respectfully submitted,
            Attorney for Defendant
            Date: %s
            """,
            criminalCase.getDocketNumber(),
            criminalCase.getPrimaryOffense(),
            formatMitigatingFactors(mitigatingFactors),
            mitigatingFactors.getOrDefault("personalHistory", "To be provided"),
            calculateRecommendedSentence(criminalCase, mitigatingFactors),
            LocalDateTime.now().format(DATE_FORMATTER)
        );
        
        return CompletableFuture.completedFuture(memo);
    }

    @Override
    @Async
    public CompletableFuture<List<String>> suggestMitigatingFactors(Long caseId) {
        List<String> factors = Arrays.asList(
            "First offense - no prior criminal history",
            "Acceptance of responsibility",
            "Cooperation with authorities",
            "Employment history and community ties",
            "Family responsibilities and dependents",
            "Substance abuse treatment participation",
            "Mental health considerations",
            "Age and maturity level at time of offense",
            "Minimal role in offense",
            "Restitution made or offered"
        );
        
        return CompletableFuture.completedFuture(factors);
    }

    // Discovery Management
    @Override
    @Async
    public CompletableFuture<String> generateDiscoveryRequest(Long caseId, List<String> requestedItems) {
        AICriminalCase criminalCase = getCriminalCaseById(caseId);
        
        String discoveryRequest = String.format("""
            DEFENDANT'S DISCOVERY REQUEST
            
            Commonwealth v. Defendant
            Docket No: %s
            
            Pursuant to Mass. R. Crim. P. 14 and applicable constitutional provisions, the Defendant requests:
            
            AUTOMATIC DISCOVERY (Rule 14(a)(1)(A)):
            1. Defendant's statements
            2. Defendant's criminal record
            3. Physical evidence and scientific tests
            4. Exculpatory evidence (Brady material)
            5. Witness statements
            6. Expert witness information
            
            ADDITIONAL REQUESTED ITEMS:
            %s
            
            RECIPROCAL DISCOVERY:
            The Defendant acknowledges the Commonwealth's right to reciprocal discovery under Rule 14(b).
            
            CONTINUING DUTY:
            The Defendant reminds the Commonwealth of its continuing duty to disclose under Rule 14(c).
            
            Respectfully submitted,
            Attorney for Defendant
            Date: %s
            """,
            criminalCase.getDocketNumber(),
            formatRequestedItems(requestedItems),
            LocalDateTime.now().format(DATE_FORMATTER)
        );
        
        return CompletableFuture.completedFuture(discoveryRequest);
    }

    @Override
    @Async
    public CompletableFuture<List<String>> analyzeDiscoveryMaterials(Long caseId, String evidenceType) {
        List<String> analysis = new ArrayList<>();
        
        analysis.add("Review police reports for inconsistencies");
        analysis.add("Analyze witness statements for contradictions");
        analysis.add("Evaluate physical evidence chain of custody");
        analysis.add("Check for Brady material violations");
        analysis.add("Identify potential suppression issues");
        analysis.add("Review video/audio evidence");
        analysis.add("Examine forensic test results");
        analysis.add("Assess witness credibility issues");
        
        return CompletableFuture.completedFuture(analysis);
    }

    @Override
    @Async
    public CompletableFuture<String> generateBradyMotion(Long caseId, Map<String, Object> exculpatoryEvidence) {
        Map<String, Object> facts = new HashMap<>(exculpatoryEvidence);
        facts.put("background", "The Commonwealth has failed to disclose exculpatory evidence");
        facts.put("argument", "The withheld evidence is material to guilt or punishment");
        
        return generateMotion(caseId, MotionType.BRADY_MOTION, facts);
    }

    // Plea Negotiations
    @Override
    @Async
    public CompletableFuture<Map<String, Object>> analyzePleaOffer(Long caseId, Map<String, Object> pleaTerms) {
        AICriminalCase criminalCase = getCriminalCaseById(caseId);
        
        Map<String, Object> analysis = new HashMap<>();
        analysis.put("caseId", caseId);
        analysis.put("currentCharges", criminalCase.getPrimaryOffense());
        analysis.put("pleaOffer", pleaTerms);
        analysis.put("sentenceComparison", compareSentences(criminalCase, pleaTerms));
        analysis.put("collateralConsequences", analyzeCollateralConsequences(pleaTerms));
        analysis.put("trialRisk", assessTrialRisk(criminalCase));
        analysis.put("recommendation", generatePleaRecommendation(criminalCase, pleaTerms));
        analysis.put("analysisDate", LocalDateTime.now());
        
        return CompletableFuture.completedFuture(analysis);
    }

    @Override
    @Async
    public CompletableFuture<String> generatePleaAdvice(Long caseId, Map<String, Object> caseFactors) {
        String advice = """
            PLEA NEGOTIATION ADVICE
            
            Based on the case analysis:
            
            STRENGTHS OF PROSECUTION'S CASE:
            - Physical evidence
            - Witness testimony
            - Prior admissions
            
            DEFENSE ADVANTAGES:
            - Constitutional violations
            - Witness credibility issues
            - Lack of direct evidence
            
            RECOMMENDATION:
            Consider the plea offer carefully, weighing trial risks against certainty of outcome.
            
            FACTORS TO CONSIDER:
            1. Sentencing exposure differential
            2. Collateral consequences
            3. Immigration implications
            4. Professional license impacts
            5. Future employment considerations
            """;
        
        return CompletableFuture.completedFuture(advice);
    }

    @Override
    @Async
    public CompletableFuture<List<String>> calculatePleaBenefits(Map<String, Object> originalCharges, Map<String, Object> pleaOffer) {
        List<String> benefits = Arrays.asList(
            "Reduced sentence exposure",
            "Avoiding mandatory minimum sentences",
            "Preserving appeal rights on certain issues",
            "Certainty of outcome",
            "Reduced legal costs",
            "Faster resolution",
            "Potential for alternative sentencing",
            "Avoiding trial publicity",
            "Opportunity for treatment programs",
            "Reduced collateral consequences"
        );
        
        return CompletableFuture.completedFuture(benefits);
    }

    // Trial Preparation
    @Override
    @Async
    public CompletableFuture<String> generateWitnessExamination(Long caseId, String witnessType, Map<String, Object> witnessInfo) {
        String examination = String.format("""
            WITNESS EXAMINATION OUTLINE
            
            Witness Type: %s
            
            DIRECT EXAMINATION (if defense witness):
            1. Background and credibility establishment
            2. Relationship to case/defendant
            3. Observations relevant to defense theory
            4. Timeline of events
            5. Supporting evidence introduction
            
            CROSS-EXAMINATION (if prosecution witness):
            1. Prior inconsistent statements
            2. Bias and motive to lie
            3. Perception and memory issues
            4. Contradictions with other evidence
            5. Limitation of observations
            
            KEY POINTS TO ESTABLISH:
            %s
            
            EXHIBITS TO INTRODUCE:
            %s
            
            OBJECTIONS TO ANTICIPATE:
            - Hearsay
            - Relevance
            - Leading questions
            - Speculation
            """,
            witnessType,
            witnessInfo.getOrDefault("keyPoints", "To be determined"),
            witnessInfo.getOrDefault("exhibits", "To be determined")
        );
        
        return CompletableFuture.completedFuture(examination);
    }

    @Override
    @Async
    public CompletableFuture<String> generateOpeningStatement(Long caseId, Map<String, Object> defenseTheory) {
        AICriminalCase criminalCase = getCriminalCaseById(caseId);
        
        String opening = String.format("""
            OPENING STATEMENT
            
            Members of the jury,
            
            The evidence will show that %s.
            
            You will hear testimony that %s.
            
            The prosecution's case relies on %s, but the evidence will demonstrate %s.
            
            At the conclusion of this case, after you've heard all the evidence, we will ask you to find 
            the defendant not guilty because the Commonwealth will not have proven its case beyond a reasonable doubt.
            
            Thank you.
            """,
            defenseTheory.getOrDefault("theory", "the defendant is not guilty"),
            defenseTheory.getOrDefault("testimony", "supports the defense theory"),
            defenseTheory.getOrDefault("prosecutionWeakness", "unreliable evidence"),
            defenseTheory.getOrDefault("defenseStrength", "reasonable doubt exists")
        );
        
        return CompletableFuture.completedFuture(opening);
    }

    @Override
    @Async
    public CompletableFuture<String> generateClosingArgument(Long caseId, Map<String, Object> evidenceSummary) {
        String closing = """
            CLOSING ARGUMENT
            
            Members of the jury,
            
            The Commonwealth has failed to prove its case beyond a reasonable doubt.
            
            REASONABLE DOUBT:
            - The highest standard in our legal system
            - Not mere possible doubt
            - Doubt based on reason and common sense
            
            EVIDENCE ANALYSIS:
            - Inconsistent witness testimony
            - Lack of physical evidence
            - Constitutional violations
            - Alternative explanations
            
            DEFENSE THEORY:
            The evidence supports our theory that reasonable doubt exists.
            
            REQUEST:
            We ask that you return the only verdict consistent with the evidence - NOT GUILTY.
            
            Thank you for your service.
            """;
        
        return CompletableFuture.completedFuture(closing);
    }

    // Massachusetts Criminal Law
    @Override
    @Async
    public CompletableFuture<List<String>> getMAStatuteReferences(String chargeType) {
        List<String> statutes = new ArrayList<>();
        
        // Common MA criminal statutes
        statutes.add("M.G.L. c. 265, § 13A - Assault and Battery");
        statutes.add("M.G.L. c. 266, § 30 - Larceny");
        statutes.add("M.G.L. c. 90, § 24 - OUI");
        statutes.add("M.G.L. c. 94C - Controlled Substances");
        statutes.add("M.G.L. c. 269, § 10 - Carrying Dangerous Weapons");
        statutes.add("M.G.L. c. 265, § 1 - Murder");
        statutes.add("M.G.L. c. 272, § 53 - Disorderly Conduct");
        statutes.add("M.G.L. c. 268, § 13B - Intimidation of Witnesses");
        
        return CompletableFuture.completedFuture(statutes);
    }

    @Override
    @Async
    public CompletableFuture<String> generateMAMotionFormat(MotionType motionType, Long caseId) {
        AICriminalCase criminalCase = getCriminalCaseById(caseId);
        
        String motion = String.format("""
            COMMONWEALTH OF MASSACHUSETTS
            
            %s
            %s DEPARTMENT
            
            COMMONWEALTH OF MASSACHUSETTS
            v.                                   No. %s
            Defendant
            
            DEFENDANT'S %s
            
            NOW COMES the Defendant and moves this Honorable Court pursuant to Mass. R. Crim. P. %s
            
            In support thereof, the Defendant states:
            
            1. Procedural History
            2. Statement of Facts
            3. Argument
            4. Request for Relief
            
            WHEREFORE, the Defendant respectfully requests that this Court grant this motion.
            
            Respectfully submitted,
            THE DEFENDANT
            By his/her attorney,
            
            _________________________
            Attorney Name
            BBO# 
            Address
            Phone
            
            Date: %s
            
            CERTIFICATE OF SERVICE
            I hereby certify that a true copy of this motion was served upon the District Attorney's Office.
            """,
            criminalCase.getCourtName() != null ? criminalCase.getCourtName() : "District Court",
            "CRIMINAL",
            criminalCase.getDocketNumber() != null ? criminalCase.getDocketNumber() : "XXXX-XXXX",
            motionType.toString().replace("_", " "),
            getRelevantRule(motionType),
            LocalDateTime.now().format(DATE_FORMATTER)
        );
        
        return CompletableFuture.completedFuture(motion);
    }

    @Override
    @Async
    public CompletableFuture<Map<String, Object>> analyzeMADefenses(String chargeType) {
        Map<String, Object> defenses = new HashMap<>();
        
        defenses.put("chargeType", chargeType);
        defenses.put("statutoryDefenses", Arrays.asList(
            "Self-defense (M.G.L. c. 278, § 8A)",
            "Defense of others",
            "Defense of property",
            "Necessity",
            "Duress",
            "Entrapment"
        ));
        defenses.put("constitutionalDefenses", Arrays.asList(
            "Fourth Amendment violations",
            "Fifth Amendment violations",
            "Sixth Amendment violations",
            "Due Process violations"
        ));
        defenses.put("evidentiaryDefenses", Arrays.asList(
            "Insufficient evidence",
            "Lack of intent",
            "Mistake of fact",
            "Alibi",
            "Identification issues"
        ));
        
        return CompletableFuture.completedFuture(defenses);
    }

    // Helper methods
    private String getMotionRelief(MotionType motionType) {
        switch (motionType) {
            case MOTION_TO_SUPPRESS:
                return "suppress evidence obtained in violation of the defendant's constitutional rights";
            case MOTION_TO_DISMISS:
                return "dismiss the charges for lack of probable cause or legal insufficiency";
            case BRADY_MOTION:
                return "compel disclosure of exculpatory evidence";
            default:
                return "grant the relief requested herein";
        }
    }

    private String getMotionLegalStandard(MotionType motionType) {
        switch (motionType) {
            case MOTION_TO_SUPPRESS:
                return "Evidence obtained in violation of the Fourth Amendment must be suppressed. Mapp v. Ohio, 367 U.S. 643 (1961).";
            case MOTION_TO_DISMISS:
                return "The complaint must establish probable cause. Commonwealth v. McCarthy, 385 Mass. 160 (1982).";
            case BRADY_MOTION:
                return "The prosecution must disclose material exculpatory evidence. Brady v. Maryland, 373 U.S. 83 (1963).";
            default:
                return "The applicable legal standard supports granting this motion.";
        }
    }

    private String calculateSentencingRange(AICriminalCase criminalCase) {
        if (criminalCase.getSentencingGuidelines() != null) {
            return criminalCase.getSentencingGuidelines();
        }
        return "0-5 years (estimated based on offense level)";
    }

    private List<String> findMitigatingFactors(AICriminalCase criminalCase) {
        List<String> factors = new ArrayList<>();
        if (criminalCase.getCriminalHistory() == null || criminalCase.getCriminalHistory().isEmpty()) {
            factors.add("No prior criminal history");
        }
        factors.add("Acceptance of responsibility");
        factors.add("Cooperation with authorities");
        return factors;
    }

    private List<String> findAggravatingFactors(AICriminalCase criminalCase) {
        List<String> factors = new ArrayList<>();
        if (criminalCase.getVictimInformation() != null) {
            factors.add("Impact on victim");
        }
        if (criminalCase.getOffenseLevel() != null) {
            factors.add("Severity of offense");
        }
        return factors;
    }

    private String generateSentencingRecommendation(AICriminalCase criminalCase) {
        return "Probation with conditions appropriate to the offense and defendant's circumstances";
    }

    private String formatMitigatingFactors(Map<String, Object> factors) {
        StringBuilder formatted = new StringBuilder();
        factors.forEach((key, value) -> 
            formatted.append("- ").append(value).append("\n"));
        return formatted.toString();
    }

    private String calculateRecommendedSentence(AICriminalCase criminalCase, Map<String, Object> mitigatingFactors) {
        if (mitigatingFactors.size() > 3) {
            return "Probation or minimum sentence within guidelines";
        }
        return "Sentence at low end of guidelines range";
    }

    private String formatRequestedItems(List<String> items) {
        StringBuilder formatted = new StringBuilder();
        for (int i = 0; i < items.size(); i++) {
            formatted.append(i + 7).append(". ").append(items.get(i)).append("\n");
        }
        return formatted.toString();
    }

    private Map<String, Object> compareSentences(AICriminalCase criminalCase, Map<String, Object> pleaTerms) {
        Map<String, Object> comparison = new HashMap<>();
        comparison.put("trialExposure", criminalCase.getMaxPenalty());
        comparison.put("pleaOffer", pleaTerms.get("proposedSentence"));
        comparison.put("difference", "Significant reduction in exposure");
        return comparison;
    }

    private List<String> analyzeCollateralConsequences(Map<String, Object> pleaTerms) {
        return Arrays.asList(
            "Immigration consequences if applicable",
            "Professional license implications",
            "Public housing eligibility",
            "Student loan eligibility",
            "Voting rights",
            "Firearm ownership restrictions"
        );
    }

    private String assessTrialRisk(AICriminalCase criminalCase) {
        if (criminalCase.getCaseStrengths() != null && criminalCase.getCaseWeaknesses() != null) {
            return "Moderate to high risk based on evidence";
        }
        return "Risk assessment requires further case analysis";
    }

    private String generatePleaRecommendation(AICriminalCase criminalCase, Map<String, Object> pleaTerms) {
        return "Consider accepting plea offer after full consultation with client regarding all consequences";
    }

    private String getRelevantRule(MotionType motionType) {
        switch (motionType) {
            case MOTION_TO_SUPPRESS:
                return "13";
            case MOTION_TO_DISMISS:
                return "13";
            case BRADY_MOTION:
                return "14";
            default:
                return "7";
        }
    }

    // Public methods for controller
    public String generateMotion(Map<String, Object> request) {
        String motionType = (String) request.get("motionType");
        String caseNumber = (String) request.get("caseNumber");
        String defendantName = (String) request.get("defendantName");
        String courtName = (String) request.get("courtName");
        String factualBasis = (String) request.get("factualBasis");
        String legalArguments = (String) request.get("legalArguments");
        String requestedRelief = (String) request.get("requestedRelief");
        
        return String.format("""
            IN THE %s
            
            Case No. %s
            
            STATE/COMMONWEALTH
            v.
            %s
            Defendant
            
            %s
            
            NOW COMES the Defendant, %s, by and through undersigned counsel, and respectfully moves this Honorable Court for the following relief:
            
            FACTUAL BASIS
            
            %s
            
            LEGAL ARGUMENTS
            
            %s
            
            REQUESTED RELIEF
            
            %s
            
            WHEREFORE, Defendant respectfully requests that this Honorable Court grant this motion and provide such other and further relief as the Court deems just and proper.
            
            Respectfully submitted,
            
            _______________________
            Attorney for Defendant
            [Bar Number]
            [Contact Information]
            Date: %s
            """,
            courtName,
            caseNumber,
            defendantName,
            motionType.toUpperCase(),
            defendantName,
            factualBasis,
            legalArguments,
            requestedRelief,
            LocalDateTime.now().format(DATE_FORMATTER)
        );
    }

    public Map<String, Object> calculateSentence(Map<String, Object> request) {
        String offenseCategory = (String) request.get("offenseCategory");
        Integer offenseLevel = (Integer) request.get("offenseLevel");
        Integer criminalHistory = (Integer) request.get("criminalHistory");
        Map<String, Boolean> enhancements = (Map<String, Boolean>) request.get("enhancements");
        Map<String, Boolean> mitigations = (Map<String, Boolean>) request.get("mitigations");
        
        int adjustedLevel = offenseLevel;
        
        // Apply enhancements
        if (enhancements != null) {
            if (Boolean.TRUE.equals(enhancements.get("firearmUsed"))) adjustedLevel += 2;
            if (Boolean.TRUE.equals(enhancements.get("drugQuantity"))) adjustedLevel += 2;
            if (Boolean.TRUE.equals(enhancements.get("victimVulnerable"))) adjustedLevel += 3;
            if (Boolean.TRUE.equals(enhancements.get("leadershipRole"))) adjustedLevel += 4;
            if (Boolean.TRUE.equals(enhancements.get("obstructionJustice"))) adjustedLevel += 2;
        }
        
        // Apply mitigations
        if (mitigations != null) {
            if (Boolean.TRUE.equals(mitigations.get("acceptResponsibility"))) adjustedLevel -= 3;
            if (Boolean.TRUE.equals(mitigations.get("minorRole"))) adjustedLevel -= 2;
            if (Boolean.TRUE.equals(mitigations.get("cooperation"))) adjustedLevel -= 2;
        }
        
        // Ensure level stays within bounds
        adjustedLevel = Math.max(1, Math.min(43, adjustedLevel));
        
        // Calculate sentencing range
        int baseMin = adjustedLevel * 2 + criminalHistory * 3;
        int baseMax = adjustedLevel * 3 + criminalHistory * 4;
        
        Map<String, Object> result = new HashMap<>();
        result.put("originalLevel", offenseLevel);
        result.put("adjustedLevel", adjustedLevel);
        result.put("criminalHistoryCategory", getCriminalHistoryCategory(criminalHistory));
        result.put("minimumMonths", Math.max(0, baseMin));
        result.put("maximumMonths", baseMax);
        result.put("probationPossible", adjustedLevel < 12);
        result.put("mandatoryMinimum", getMandatoryMinimum(offenseCategory));
        
        return result;
    }
    
    private String getCriminalHistoryCategory(int points) {
        if (points == 0) return "I (0 points)";
        if (points <= 2) return "II (1-2 points)";
        if (points <= 4) return "III (3-4 points)";
        if (points <= 6) return "IV (5-6 points)";
        if (points <= 9) return "V (7-9 points)";
        return "VI (10+ points)";
    }
    
    private String getMandatoryMinimum(String category) {
        Map<String, String> minimums = Map.of(
            "drug", "5 years for certain quantities",
            "violent", "10 years for armed offenses",
            "sex", "5-15 years depending on victim age",
            "property", "None",
            "white-collar", "None"
        );
        return minimums.getOrDefault(category, "None");
    }

    public Map<String, Object> analyzeCase(Map<String, Object> request) {
        Map<String, Object> result = new HashMap<>();
        
        result.put("strengths", Arrays.asList(
            "Limited physical evidence",
            "Witness credibility issues",
            "Potential Fourth Amendment violation",
            "Chain of custody questions"
        ));
        
        result.put("weaknesses", Arrays.asList(
            "Defendant's prior record",
            "Video surveillance exists",
            "Multiple witnesses",
            "Admissions made"
        ));
        
        result.put("recommendations", Arrays.asList(
            "File motion to suppress evidence",
            "Interview all witnesses",
            "Consider plea negotiation",
            "Retain expert witnesses"
        ));
        
        result.put("winProbability", 65);
        result.put("bestStrategy", "Challenge evidence admissibility and negotiate favorable plea");
        
        return result;
    }

    public Map<String, Object> analyzePleaAgreement(Map<String, Object> request) {
        Map<String, Object> result = new HashMap<>();
        
        result.put("recommendation", "Consider accepting");
        result.put("pros", Arrays.asList(
            "Significantly reduced sentence",
            "Avoids trial uncertainty",
            "No mandatory minimum",
            "Preserves some appeal rights"
        ));
        
        result.put("cons", Arrays.asList(
            "Criminal record impact",
            "Immigration consequences",
            "Professional license issues",
            "Collateral consequences"
        ));
        
        result.put("alternativeOptions", Arrays.asList(
            "Negotiate for deferred adjudication",
            "Request reduced charge classification",
            "Seek alternative sentencing",
            "Propose treatment programs"
        ));
        
        result.put("riskAssessment", "Medium-Low");
        
        return result;
    }
}