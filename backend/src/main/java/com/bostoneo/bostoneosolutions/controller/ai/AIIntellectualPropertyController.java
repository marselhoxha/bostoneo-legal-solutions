package com.bostoneo.bostoneosolutions.controller.ai;

import com.bostoneo.bostoneosolutions.service.AIPatentService;
import com.bostoneo.bostoneosolutions.service.ai.ClaudeSonnet4Service;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.context.request.async.DeferredResult;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/ai/intellectual-property")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = {"http://localhost:4200", "http://localhost:8085"}, allowCredentials = "true")
public class AIIntellectualPropertyController {

    private final AIPatentService patentService;
    private final ClaudeSonnet4Service claudeService;

    @PostMapping("/generate-patent-application")
    public DeferredResult<ResponseEntity<Map<String, Object>>> generatePatentApplication(@RequestBody Map<String, Object> request) {
        log.info("Generating patent application with Claude AI: {}", request);
        
        DeferredResult<ResponseEntity<Map<String, Object>>> deferredResult = new DeferredResult<>(60000L);
        
        // Extract patent claims if present
        List<Map<String, Object>> claims = (List<Map<String, Object>>) request.getOrDefault("claims", List.of());
        StringBuilder claimsText = new StringBuilder();
        for (Map<String, Object> claim : claims) {
            claimsText.append(claim.get("claimNumber")).append(". ").append(claim.get("claimText")).append("\n\n");
        }
        
        String prompt = String.format("""
            Generate a complete patent application for:
            
            PATENT TYPE: %s
            
            TITLE: %s
            
            INVENTOR(S):
            Primary Inventor: %s
            Address: %s
            
            TECHNICAL FIELD:
            Field: %s
            Technical Area: %s
            
            BACKGROUND OF INVENTION:
            %s
            
            PROBLEM SOLVED:
            %s
            
            SUMMARY OF INVENTION:
            %s
            
            DETAILED DESCRIPTION:
            %s
            
            ADVANTAGES:
            %s
            
            PRIOR ART REFERENCES:
            %s
            
            RELATED APPLICATIONS:
            %s
            
            CLAIMS (if provided):
            %s
            
            ABSTRACT (max 150 words):
            %s
            
            Generate a complete, professional patent application including:
            1. Properly formatted specification
            2. Claims section with independent and dependent claims
            3. Detailed description with reference to potential figures
            4. Abstract within word limit
            5. All required USPTO format sections
            6. Legal language and technical terminology
            
            Follow USPTO patent application format and requirements.
            """,
            request.get("patentType"),
            request.get("title"),
            request.get("primaryInventor"),
            request.get("inventorAddress"),
            request.get("fieldOfInvention"),
            request.get("technicalField"),
            request.get("backgroundOfInvention"),
            request.get("problemSolved"),
            request.get("summaryOfInvention"),
            request.get("detailedDescription"),
            request.get("advantages"),
            request.get("priorArtReferences"),
            request.get("relatedApplications"),
            claimsText.toString(),
            request.get("abstract")
        );
        
        claudeService.generateCompletion(prompt, false)
            .thenApply(claudeResponse -> {
                Map<String, Object> response = new HashMap<>();
                response.put("success", true);
                response.put("application", claudeResponse);
                response.put("generatedAt", System.currentTimeMillis());
                return ResponseEntity.ok(response);
            })
            .exceptionally(ex -> {
                log.error("Error generating patent application with Claude: ", ex);
                Map<String, Object> error = new HashMap<>();
                error.put("success", false);
                error.put("error", "Failed to generate application: " + ex.getMessage());
                return ResponseEntity.status(500).body(error);
            })
            .thenAccept(deferredResult::setResult);
        
        return deferredResult;
    }

    @PostMapping("/search-trademark")
    public DeferredResult<ResponseEntity<Map<String, Object>>> searchTrademark(@RequestBody Map<String, Object> request) {
        log.info("Searching trademarks with Claude AI: {}", request);
        
        DeferredResult<ResponseEntity<Map<String, Object>>> deferredResult = new DeferredResult<>(60000L);
        
        String prompt = String.format("""
            Perform comprehensive trademark search and analysis:
            
            PROPOSED MARK: %s
            MARK TYPE: %s
            
            GOODS/SERVICES: %s
            
            OWNER INFORMATION:
            Name: %s
            Type: %s
            Address: %s
            
            USE DATES:
            First Use: %s
            First Use in Commerce: %s
            
            SEARCH SCOPE: %s
            
            DISCLAIMERS: %s
            TRANSLATION: %s
            
            Provide:
            1. Similar existing marks (list at least 5-10)
            2. Likelihood of confusion analysis
            3. Classification recommendations (Nice Classification)
            4. Strength of mark assessment
            5. Potential conflicts and risk levels
            6. Recommended modifications if conflicts exist
            7. Filing strategy recommendations
            8. International considerations
            
            For each potentially conflicting mark, include:
            - Registration number
            - Owner
            - Goods/Services
            - Status
            - Similarity percentage
            - Risk level (high/medium/low)
            """,
            request.get("markText"),
            request.get("markType"),
            request.get("goodsServices"),
            request.get("ownerName"),
            request.get("ownerType"),
            request.get("ownerAddress"),
            request.get("firstUseDate"),
            request.get("firstUseInCommerceDate"),
            request.get("searchScope"),
            request.get("disclaimer"),
            request.get("translation")
        );
        
        claudeService.generateCompletion(prompt, false)
            .thenApply(claudeResponse -> {
                Map<String, Object> response = new HashMap<>();
                response.put("success", true);
                response.put("searchResults", claudeResponse);
                response.put("generatedAt", System.currentTimeMillis());
                return ResponseEntity.ok(response);
            })
            .exceptionally(ex -> {
                log.error("Error searching trademarks with Claude: ", ex);
                Map<String, Object> error = new HashMap<>();
                error.put("success", false);
                error.put("error", "Failed to search: " + ex.getMessage());
                return ResponseEntity.status(500).body(error);
            })
            .thenAccept(deferredResult::setResult);
        
        return deferredResult;
    }

    @PostMapping("/generate-copyright-registration")
    public DeferredResult<ResponseEntity<Map<String, Object>>> generateCopyrightRegistration(@RequestBody Map<String, Object> request) {
        log.info("Generating copyright registration with Claude AI: {}", request);
        
        DeferredResult<ResponseEntity<Map<String, Object>>> deferredResult = new DeferredResult<>(60000L);
        
        String prompt = String.format("""
            Generate a complete copyright registration application:
            
            WORK INFORMATION:
            Title: %s
            Type: %s
            Year of Creation: %s
            
            PUBLICATION:
            Status: %s
            Date: %s
            Country: %s
            
            AUTHOR:
            Name: %s
            Type: %s
            Citizenship: %s
            Domicile: %s
            Work for Hire: %s
            
            CLAIMANT:
            Name: %s
            Address: %s
            Transfer Statement: %s
            
            LIMITATION OF CLAIM:
            %s
            Preexisting Material: %s
            Material Excluded: %s
            New Material: %s
            
            Generate:
            1. Complete Form CO or eCO application
            2. Deposit requirements
            3. Filing fee information
            4. Instructions for submission
            5. Rights granted upon registration
            6. Duration of copyright
            7. Special considerations for the work type
            
            Follow U.S. Copyright Office requirements.
            """,
            request.get("workTitle"),
            request.get("workType"),
            request.get("yearOfCreation"),
            request.get("publicationStatus"),
            request.get("publicationDate"),
            request.get("publicationCountry"),
            request.get("authorName"),
            request.get("authorType"),
            request.get("authorCitizenship"),
            request.get("authorDomicile"),
            request.get("workForHire"),
            request.get("claimantName"),
            request.get("claimantAddress"),
            request.get("transferStatement"),
            request.get("limitationOfClaim"),
            request.get("preexistingMaterial"),
            request.get("materialExcluded"),
            request.get("newMaterialIncluded")
        );
        
        claudeService.generateCompletion(prompt, false)
            .thenApply(claudeResponse -> {
                Map<String, Object> response = new HashMap<>();
                response.put("success", true);
                response.put("registration", claudeResponse);
                response.put("generatedAt", System.currentTimeMillis());
                return ResponseEntity.ok(response);
            })
            .exceptionally(ex -> {
                log.error("Error generating copyright registration with Claude: ", ex);
                Map<String, Object> error = new HashMap<>();
                error.put("success", false);
                error.put("error", "Failed to generate registration: " + ex.getMessage());
                return ResponseEntity.status(500).body(error);
            })
            .thenAccept(deferredResult::setResult);
        
        return deferredResult;
    }

    @PostMapping("/search-prior-art")
    public DeferredResult<ResponseEntity<Map<String, Object>>> searchPriorArt(@RequestBody Map<String, Object> request) {
        log.info("Searching prior art with Claude AI: {}", request);
        
        DeferredResult<ResponseEntity<Map<String, Object>>> deferredResult = new DeferredResult<>(60000L);
        
        // Extract search databases
        Map<String, Object> databases = (Map<String, Object>) request.getOrDefault("searchDatabases", new HashMap<>());
        Map<String, Object> dateRange = (Map<String, Object>) request.getOrDefault("dateRange", new HashMap<>());
        
        String prompt = String.format("""
            Conduct comprehensive prior art search:
            
            INVENTION: %s
            
            KEYWORDS: %s
            
            TECHNICAL FIELD: %s
            
            INVENTION DESCRIPTION:
            %s
            
            SEARCH PARAMETERS:
            Jurisdictions: %s
            Date Range: %s to %s
            Databases: USPTO=%s, Google Patents=%s, Espacenet=%s, WIPO=%s, Non-Patent Literature=%s
            
            Provide:
            1. Most relevant prior art references (10-15 results)
            2. For each reference:
               - Title
               - Publication/Patent Number
               - Publication Date
               - Inventor(s)/Author(s)
               - Abstract
               - Relevance score (0-100)
               - Key similarities
               - Key differences
               - Potential impact on patentability
            3. Overall patentability assessment
            4. Claim drafting recommendations to avoid prior art
            5. Freedom to operate analysis
            6. Suggested search strategy refinements
            
            Organize results by relevance and provide detailed analysis.
            """,
            request.get("inventionTitle"),
            request.get("keywords"),
            request.get("technicalField"),
            request.get("inventionDescription"),
            request.get("jurisdictions"),
            dateRange.get("startDate"),
            dateRange.get("endDate"),
            databases.get("uspto"),
            databases.get("googlePatents"),
            databases.get("espacenet"),
            databases.get("wipo"),
            databases.get("nonPatentLiterature")
        );
        
        claudeService.generateCompletion(prompt, false)
            .thenApply(claudeResponse -> {
                Map<String, Object> response = new HashMap<>();
                response.put("success", true);
                response.put("priorArtResults", claudeResponse);
                response.put("generatedAt", System.currentTimeMillis());
                return ResponseEntity.ok(response);
            })
            .exceptionally(ex -> {
                log.error("Error searching prior art with Claude: ", ex);
                Map<String, Object> error = new HashMap<>();
                error.put("success", false);
                error.put("error", "Failed to search: " + ex.getMessage());
                return ResponseEntity.status(500).body(error);
            })
            .thenAccept(deferredResult::setResult);
        
        return deferredResult;
    }

    @PostMapping("/generate-license-agreement")
    public DeferredResult<ResponseEntity<Map<String, Object>>> generateLicenseAgreement(@RequestBody Map<String, Object> request) {
        log.info("Generating license agreement with Claude AI: {}", request);
        
        DeferredResult<ResponseEntity<Map<String, Object>>> deferredResult = new DeferredResult<>(60000L);
        
        // Extract duration info
        Map<String, Object> duration = (Map<String, Object>) request.getOrDefault("duration", new HashMap<>());
        
        String prompt = String.format("""
            Generate a comprehensive IP license agreement:
            
            LICENSE TYPE: %s
            
            PARTIES:
            Licensor: %s (%s)
            Licensee: %s (%s)
            
            INTELLECTUAL PROPERTY:
            Type: %s
            Description: %s
            Registration/Patent Numbers: %s
            
            GRANT TERMS:
            Territory: %s
            Field of Use: %s
            
            DURATION:
            Start Date: %s
            End Date: %s
            Perpetual: %s
            
            FINANCIAL TERMS:
            Upfront Payment: $%s
            Royalty Rate: %s%% of %s
            Minimum Royalties: $%s
            Milestone Payments: %s
            
            RIGHTS AND RESTRICTIONS:
            Sublicense Rights: %s
            Improvement Rights: %s
            Quality Control: %s
            Confidentiality: %s
            Non-Compete: %s
            
            Generate a complete license agreement including:
            1. Detailed grant clause
            2. Payment terms and audit rights
            3. IP warranties and indemnification
            4. Termination provisions
            5. Dispute resolution
            6. Governing law
            7. All standard commercial terms
            8. Schedules and exhibits as needed
            
            Make it legally comprehensive and commercially reasonable.
            """,
            request.get("licenseType"),
            request.get("licensorName"),
            request.get("licensorAddress"),
            request.get("licenseeName"),
            request.get("licenseeAddress"),
            request.get("ipType"),
            request.get("ipDescription"),
            request.get("registrationNumbers"),
            request.get("territory"),
            request.get("fieldOfUse"),
            duration.get("startDate"),
            duration.get("endDate"),
            duration.get("perpetual"),
            request.get("upfrontPayment"),
            request.get("royaltyRate"),
            request.get("royaltyBase"),
            request.get("minimumRoyalties"),
            request.get("milestonePayments"),
            request.get("sublicenseRights"),
            request.get("improvementRights"),
            request.get("qualityControl"),
            request.get("confidentiality"),
            request.get("nonCompete")
        );
        
        claudeService.generateCompletion(prompt, false)
            .thenApply(claudeResponse -> {
                Map<String, Object> response = new HashMap<>();
                response.put("success", true);
                response.put("agreement", claudeResponse);
                response.put("generatedAt", System.currentTimeMillis());
                return ResponseEntity.ok(response);
            })
            .exceptionally(ex -> {
                log.error("Error generating license agreement with Claude: ", ex);
                Map<String, Object> error = new HashMap<>();
                error.put("success", false);
                error.put("error", "Failed to generate agreement: " + ex.getMessage());
                return ResponseEntity.status(500).body(error);
            })
            .thenAccept(deferredResult::setResult);
        
        return deferredResult;
    }
}