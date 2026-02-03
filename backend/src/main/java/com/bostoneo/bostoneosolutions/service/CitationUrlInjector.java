package com.bostoneo.bostoneosolutions.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Post-processor that injects URLs for known legal citations.
 * Guarantees 100% URL coverage regardless of AI laziness.
 *
 * Purpose: Even if Claude ignores our URL requirements, we forcibly inject them.
 * Result: Court-ready responses with clickable source links.
 */
@Service
@Slf4j
public class CitationUrlInjector {

    // LinkedHashMap to preserve insertion order (match longer patterns first)
    private static final Map<Pattern, String> CITATION_URL_MAP = new LinkedHashMap<>();

    static {
        // Massachusetts Constitution
        CITATION_URL_MAP.put(
            Pattern.compile("\\bArticle 14\\b(?! - Source:)(?!\\]\\(http)"),
            "[Article 14](https://malegislature.gov/Laws/Constitution#partTheFirst)"
        );

        // Massachusetts General Laws - Chapter 90 (most common in OUI cases)
        CITATION_URL_MAP.put(
            Pattern.compile("\\bM\\.G\\.L\\.\\s*c\\.\\s*90,?\\s*§\\s*24D\\b(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[M.G.L. c. 90 § 24D](https://malegislature.gov/Laws/GeneralLaws/PartI/TitleXIV/Chapter90/Section24D)"
        );

        CITATION_URL_MAP.put(
            Pattern.compile("\\bM\\.G\\.L\\.\\s*c\\.\\s*90,?\\s*§\\s*24K\\b(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[M.G.L. c. 90 § 24K](https://malegislature.gov/Laws/GeneralLaws/PartI/TitleXIV/Chapter90/Section24K)"
        );

        CITATION_URL_MAP.put(
            Pattern.compile("\\bM\\.G\\.L\\.\\s*c\\.\\s*90,?\\s*§\\s*24\\(1\\)\\([ef]\\)\\b(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[M.G.L. c. 90 § 24(1)(e)-(f)](https://malegislature.gov/Laws/GeneralLaws/PartI/TitleXIV/Chapter90/Section24)"
        );

        CITATION_URL_MAP.put(
            Pattern.compile("\\bM\\.G\\.L\\.\\s*c\\.\\s*90,?\\s*§\\s*24\\b(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[M.G.L. c. 90 § 24](https://malegislature.gov/Laws/GeneralLaws/PartI/TitleXIV/Chapter90/Section24)"
        );

        // CMR Regulations - Massachusetts Regulations
        // Specific 501 CMR 2.56 (breathalyzer regulations)
        CITATION_URL_MAP.put(
            Pattern.compile("\\b501\\s*CMR\\s*2\\.56\\b(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[501 CMR 2.56 [View →]](https://www.mass.gov/regulations/501-CMR-256-breathalyzer-certification)"
        );

        // Specific 501 CMR 2.00 (breath test operation)
        CITATION_URL_MAP.put(
            Pattern.compile("\\b501\\s*CMR\\s*2\\.00\\b(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[501 CMR 2.00 [View →]](https://www.mass.gov/regulations/501-CMR-200-operation-of-breath-test-devices)"
        );

        // Specific 540 CMR 2.00 (RMV hearing regulations)
        CITATION_URL_MAP.put(
            Pattern.compile("\\b540\\s*CMR\\s*2\\.00\\b(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[540 CMR 2.00 [View →]](https://www.mass.gov/regulations/540-CMR-200-rmv-hearings)"
        );

        // Generic CMR pattern: ### CMR #.##
        CITATION_URL_MAP.put(
            Pattern.compile("\\b(\\d+)\\s*CMR\\s*([\\d.]+)\\b(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[$1 CMR $2 [View →]](https://www.mass.gov/regulations/$1-CMR-$2)"
        );

        // Massachusetts Rules of Criminal Procedure
        CITATION_URL_MAP.put(
            Pattern.compile("\\bMass\\.?\\s*R\\.?\\s*Crim\\.?\\s*P\\.?\\s*14\\b(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[Mass. R. Crim. P. 14](https://www.mass.gov/supreme-judicial-court-rules/rules-of-criminal-procedure)"
        );

        CITATION_URL_MAP.put(
            Pattern.compile("\\bMass\\.?\\s*R\\.?\\s*Crim\\.?\\s*P\\.?(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[Mass. R. Crim. P.](https://www.mass.gov/supreme-judicial-court-rules/rules-of-criminal-procedure)"
        );

        // Massachusetts Rules of Civil Procedure
        CITATION_URL_MAP.put(
            Pattern.compile("\\bMass\\.?\\s*R\\.?\\s*Civ\\.?\\s*P\\.?(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[Mass. R. Civ. P.](https://www.mass.gov/supreme-judicial-court-rules/rules-of-civil-procedure)"
        );

        // ===== MASSACHUSETTS STATUTES (GENERIC PATTERNS) =====

        // M.G.L. chapter with complex subsections: M.G.L. c. 90, § 24(1)(f)(1), M.G.L. c. 176D, § 3(9)
        // Note: Chapter can have letter suffix (90, 90A, 90B, 93A, 176D, etc.)
        CITATION_URL_MAP.put(
            Pattern.compile("\\bM\\.G\\.L\\.\\s*c\\.\\s*(\\d+[A-Z]?),?\\s*§§?\\s*([\\d()a-zA-Z\\-,\\s]+)(?! - Source:)(?! - View)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[M.G.L. c. $1, § $2](https://malegislature.gov/Laws/GeneralLaws)"
        );

        // M.G.L. chapter only (no section): M.G.L. c. 90, M.G.L. c. 176D
        CITATION_URL_MAP.put(
            Pattern.compile("\\bM\\.G\\.L\\.\\s*c\\.\\s*(\\d+[A-Z]?)(?!\\s*,?\\s*§)(?! - Source:)(?! - View)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[M.G.L. c. $1](https://malegislature.gov/Laws/GeneralLaws)"
        );

        // Mass. R. Crim. P. with complex subsections: Mass. R. Crim. P. 13(a)(2)
        CITATION_URL_MAP.put(
            Pattern.compile("\\bMass\\.?\\s*R\\.?\\s*Crim\\.?\\s*P\\.?\\s*(\\d+)\\(([a-z])\\)\\(([\\d])\\)(?!\\]\\()", Pattern.CASE_INSENSITIVE),
            "[Mass. R. Crim. P. $1($2)($3)](https://www.mass.gov/supreme-judicial-court-rules/rules-of-criminal-procedure)"
        );

        // Mass. R. Crim. P. with simple subsection: Mass. R. Crim. P. 13(a)
        CITATION_URL_MAP.put(
            Pattern.compile("\\bMass\\.?\\s*R\\.?\\s*Crim\\.?\\s*P\\.?\\s*(\\d+)\\(([a-z])\\)(?!\\]\\()", Pattern.CASE_INSENSITIVE),
            "[Mass. R. Crim. P. $1($2)](https://www.mass.gov/supreme-judicial-court-rules/rules-of-criminal-procedure)"
        );

        // Mass. R. Crim. P. rule only: Mass. R. Crim. P. 13
        CITATION_URL_MAP.put(
            Pattern.compile("\\bMass\\.?\\s*R\\.?\\s*Crim\\.?\\s*P\\.?\\s*(\\d+)(?!\\()(?!\\]\\()", Pattern.CASE_INSENSITIVE),
            "[Mass. R. Crim. P. $1](https://www.mass.gov/supreme-judicial-court-rules/rules-of-criminal-procedure)"
        );

        // Mass. R. Civ. P. with complex subsections
        CITATION_URL_MAP.put(
            Pattern.compile("\\bMass\\.?\\s*R\\.?\\s*Civ\\.?\\s*P\\.?\\s*(\\d+)\\(([a-z])\\)\\(([\\d])\\)(?!\\]\\()", Pattern.CASE_INSENSITIVE),
            "[Mass. R. Civ. P. $1($2)($3)](https://www.mass.gov/supreme-judicial-court-rules/rules-of-civil-procedure)"
        );

        // Mass. R. Civ. P. with simple subsection
        CITATION_URL_MAP.put(
            Pattern.compile("\\bMass\\.?\\s*R\\.?\\s*Civ\\.?\\s*P\\.?\\s*(\\d+)\\(([a-z])\\)(?!\\]\\()", Pattern.CASE_INSENSITIVE),
            "[Mass. R. Civ. P. $1($2)](https://www.mass.gov/supreme-judicial-court-rules/rules-of-civil-procedure)"
        );

        // Mass. R. Civ. P. rule only
        CITATION_URL_MAP.put(
            Pattern.compile("\\bMass\\.?\\s*R\\.?\\s*Civ\\.?\\s*P\\.?\\s*(\\d+)(?!\\()(?!\\]\\()", Pattern.CASE_INSENSITIVE),
            "[Mass. R. Civ. P. $1](https://www.mass.gov/supreme-judicial-court-rules/rules-of-civil-procedure)"
        );

        // ===== MASSACHUSETTS COURT STANDING ORDERS & LOCAL RULES =====

        // BMC Standing Orders: BMC Standing Order 1-04
        CITATION_URL_MAP.put(
            Pattern.compile("\\bBMC\\s+Standing\\s+Order\\s+(\\d+-\\d+)(?! - Source:)(?! - View)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[BMC Standing Order $1 - View →](https://www.mass.gov/guides/massachusetts-rules-of-court-and-standing-orders)"
        );

        // BMC Local Rules: BMC Local Rule 3
        CITATION_URL_MAP.put(
            Pattern.compile("\\bBMC\\s+Local\\s+Rule\\s+(\\d+)(?! - Source:)(?! - View)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[BMC Local Rule $1 - View →](https://www.mass.gov/guides/massachusetts-rules-of-court-and-standing-orders)"
        );

        // BLS Standing Orders: BLS Standing Order 1-12
        CITATION_URL_MAP.put(
            Pattern.compile("\\bBLS\\s+Standing\\s+Order\\s+(\\d+-\\d+)(?! - Source:)(?! - View)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[BLS Standing Order $1 - View →](https://www.mass.gov/guides/massachusetts-rules-of-court-and-standing-orders)"
        );

        // Superior Court Standing Orders: Superior Court Standing Order 2-86
        CITATION_URL_MAP.put(
            Pattern.compile("\\bSuperior\\s+Court\\s+Standing\\s+Order\\s+(\\d+-\\d+)(?! - Source:)(?! - View)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[Superior Court Standing Order $1 - View →](https://www.mass.gov/guides/massachusetts-rules-of-court-and-standing-orders)"
        );

        // ===== FEDERAL CIRCUIT COURT CASES =====

        // First Circuit with pin cites: United States v. Name, 963 F.3d 1, 12-15 (1st Cir. 2020)
        // (?<!\\[) prevents matching case names already in markdown links
        CITATION_URL_MAP.put(
            Pattern.compile("(?<!\\[)\\b((?:United States|U\\.S\\.)\\s+v\\.\\s+[A-Z][a-zA-Z-]+),?\\s*(\\d+)\\s+F\\.3d\\s+(\\d+),?\\s+([\\d-]+)\\s*\\(1st Cir\\.\\s*\\d{4}\\)(?!\\]\\()", Pattern.CASE_INSENSITIVE),
            "[$1, $2 F.3d $3, $4 (1st Cir.)](https://www.courtlistener.com/)"
        );

        // First Circuit without pin cites: United States v. Name, 963 F.3d 1 (1st Cir. 2020)
        // (?<!\\[) prevents matching case names already in markdown links
        CITATION_URL_MAP.put(
            Pattern.compile("(?<!\\[)\\b((?:United States|U\\.S\\.)\\s+v\\.\\s+[A-Z][a-zA-Z-]+),?\\s*(\\d+)\\s+F\\.3d\\s+(\\d+)\\s*\\(1st Cir\\.\\s*\\d{4}\\)(?!\\]\\()", Pattern.CASE_INSENSITIVE),
            "[$1, $2 F.3d $3 (1st Cir.)](https://www.courtlistener.com/)"
        );

        // Other First Circuit cases with pin cites: Name v. Name, 728 F.3d 1, 5-8 (1st Cir. 2013)
        // (?<!\\[) prevents matching case names already in markdown links
        CITATION_URL_MAP.put(
            Pattern.compile("(?<!\\[)\\b([A-Z][a-zA-Z\\s&.]+)\\s+v\\.\\s+([A-Z][a-zA-Z\\s&.]+),?\\s*(\\d+)\\s+F\\.3d\\s+(\\d+),?\\s+([\\d-]+)\\s*\\(1st Cir\\.\\s*\\d{4}\\)(?!\\]\\()"),
            "[$1 v. $2, $3 F.3d $4, $5 (1st Cir.)](https://www.courtlistener.com/)"
        );

        // Other First Circuit cases without pin cites: Name v. Name, 728 F.3d 1 (1st Cir. 2013)
        // (?<!\\[) prevents matching case names already in markdown links
        CITATION_URL_MAP.put(
            Pattern.compile("(?<!\\[)\\b([A-Z][a-zA-Z\\s&.]+)\\s+v\\.\\s+([A-Z][a-zA-Z\\s&.]+),?\\s*(\\d+)\\s+F\\.3d\\s+(\\d+)\\s*\\(1st Cir\\.\\s*\\d{4}\\)(?!\\]\\()"),
            "[$1 v. $2, $3 F.3d $4 (1st Cir.)](https://www.courtlistener.com/)"
        );

        // General URLs
        CITATION_URL_MAP.put(
            Pattern.compile("\\bMassachusetts\\s+Declaration\\s+of\\s+Rights\\b(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[Massachusetts Declaration of Rights](https://malegislature.gov/Laws/Constitution#partTheFirst)"
        );

        CITATION_URL_MAP.put(
            Pattern.compile("\\bMassachusetts\\s+General\\s+Laws\\b(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[Massachusetts General Laws](https://malegislature.gov/Laws/GeneralLaws)"
        );

        // ===== FEDERAL TAX LAW =====

        // Treasury Regulations with subsections: Treas. Reg. §1.170A-14(g)(5)(i) - MUST BE FIRST (longest pattern)
        CITATION_URL_MAP.put(
            Pattern.compile("\\b(?:Treas\\.\\s*Reg\\.|26\\s*CFR)\\s*§\\s*([\\d.A-Za-z()\\-]+)(?! - Source:)(?! - View)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[Treas. Reg. § $1 - View →](https://www.ecfr.gov/current/title-26)"
        );

        // IRC sections with complex subsections: IRC §170(h)(4)(A) - MUST BE BEFORE simple pattern
        CITATION_URL_MAP.put(
            Pattern.compile("\\b(?:IRC|26\\s*U\\.S\\.C\\.)\\s*§\\s*([\\d()A-Za-z\\-]+)(?! - Source:)(?! - View)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[IRC § $1 - View →](https://www.law.cornell.edu/uscode/text/26)"
        );

        // Tax Court Memo citations: Name v. Comm'r, T.C. Memo 2018-159
        CITATION_URL_MAP.put(
            Pattern.compile("\\b([A-Z][a-zA-Z\\s&.]+)\\s+v\\.\\s+Comm'r,\\s*T\\.C\\.\\s*Memo\\.?\\s*(\\d{4})-(\\d+)(?! - Source:)(?!\\]\\(http)"),
            "[$1 v. Comm'r, T.C. Memo $2-$3](https://scholar.google.com/scholar?q=$1+v+Commissioner+T.C.+Memo+$2-$3)"
        );

        // Tax Court regular citations: Name v. Comm'r, 151 T.C. 247
        CITATION_URL_MAP.put(
            Pattern.compile("\\b([A-Z][a-zA-Z\\s&.]+)\\s+v\\.\\s+Comm'r,\\s*(\\d+)\\s*T\\.C\\.\\s*(\\d+)(?! - Source:)(?!\\]\\(http)"),
            "[$1 v. Comm'r, $2 T.C. $3](https://scholar.google.com/scholar?q=$1+v+Commissioner+$2+T.C.+$3)"
        );

        // ===== FEDERAL COURT RULES =====

        // Tax Court Rules: Tax Court Rule 91(b)
        CITATION_URL_MAP.put(
            Pattern.compile("\\bTax Court Rule\\s*(\\d+)(?:\\(([a-z]\\d?)\\))?(?! - Source:)(?! - View)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[Tax Court Rule $1 - View →](https://www.ustaxcourt.gov/rules.html)"
        );

        // FRCP abbreviation: FRCP 8(a), FRCP 12(b)(6)
        // Must come BEFORE "Fed. R. Civ. P." pattern to match abbreviations first
        CITATION_URL_MAP.put(
            Pattern.compile("\\bFRCP\\s*(\\d+)(?:\\(([a-z0-9()]+)\\))?(?! - Source:)(?! - View)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[FRCP $1](https://www.law.cornell.edu/rules/frcp/rule_$1)"
        );

        // FRCrP abbreviation: FRCrP 12(b), FRCrP 16(a)(1)
        CITATION_URL_MAP.put(
            Pattern.compile("\\bFRCrP\\s*(\\d+)(?:\\(([a-z0-9()]+)\\))?(?! - Source:)(?! - View)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[FRCrP $1](https://www.law.cornell.edu/rules/frcrmp/rule_$1)"
        );

        // Federal Rules of Civil Procedure: Fed. R. Civ. P. 56(c)
        CITATION_URL_MAP.put(
            Pattern.compile("\\bFed\\.?\\s*R\\.?\\s*Civ\\.?\\s*P\\.?\\s*(\\d+)(?:\\(([a-z])\\))?(?! - Source:)(?! - View)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[Fed. R. Civ. P. $1](https://www.law.cornell.edu/rules/frcp/rule_$1)"
        );

        // Federal Rules of Criminal Procedure: Fed. R. Crim. P. 12(b)
        CITATION_URL_MAP.put(
            Pattern.compile("\\bFed\\.?\\s*R\\.?\\s*Crim\\.?\\s*P\\.?\\s*(\\d+)(?:\\(([a-z])\\))?(?! - Source:)(?! - View)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[Fed. R. Crim. P. $1](https://www.law.cornell.edu/rules/frcrmp/rule_$1)"
        );

        // U.S. Sentencing Guidelines: U.S.S.G. §2B1.1
        CITATION_URL_MAP.put(
            Pattern.compile("\\bU\\.S\\.S\\.G\\.\\s*§\\s*([\\d.A-Za-z]+)(?! - Source:)(?! - View)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[U.S.S.G. § $1](https://www.ussc.gov/guidelines)"
        );

        // D. Mass. Local Rules: D. Mass. Local Rule 7.1(b)(1)
        CITATION_URL_MAP.put(
            Pattern.compile("\\bD\\.?\\s*Mass\\.?\\s*Local Rule\\s*([\\d.()a-z]+)(?!\\]\\()", Pattern.CASE_INSENSITIVE),
            "[D. Mass. Local Rule $1](https://www.mad.uscourts.gov/general/pdf/LocalRules.pdf)"
        );

        // ===== FEDERAL EMPLOYMENT LAW =====

        // Title VII
        CITATION_URL_MAP.put(
            Pattern.compile("\\bTitle VII\\b(?! - Source:)(?!\\]\\(http)"),
            "[Title VII](https://www.law.cornell.edu/uscode/text/42/chapter-21/subchapter-VI)"
        );

        // 42 U.S.C. § 2000e (Title VII codification)
        CITATION_URL_MAP.put(
            Pattern.compile("\\b42\\s*U\\.S\\.C\\.\\s*§\\s*2000e(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[42 U.S.C. § 2000e](https://www.law.cornell.edu/uscode/text/42/2000e)"
        );

        // ADA
        CITATION_URL_MAP.put(
            Pattern.compile("\\bAmericans with Disabilities Act\\b(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[Americans with Disabilities Act](https://www.law.cornell.edu/uscode/text/42/chapter-126)"
        );

        // 29 U.S.C. (ADEA, FMLA, etc.)
        CITATION_URL_MAP.put(
            Pattern.compile("\\b29\\s*U\\.S\\.C\\.\\s*§\\s*(\\d+)(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[29 U.S.C. § $1](https://www.law.cornell.edu/uscode/text/29/$1)"
        );

        // ADEA specifically
        CITATION_URL_MAP.put(
            Pattern.compile("\\bADEA\\b(?! - Source:)(?!\\]\\(http)"),
            "[ADEA](https://www.law.cornell.edu/uscode/text/29/chapter-14)"
        );

        // FMLA specifically
        CITATION_URL_MAP.put(
            Pattern.compile("\\bFMLA\\b(?! - Source:)(?!\\]\\(http)"),
            "[FMLA](https://www.law.cornell.edu/uscode/text/29/chapter-28)"
        );

        // ===== FEDERAL INTELLECTUAL PROPERTY LAW =====

        // Patent statute: 35 U.S.C. § 271
        CITATION_URL_MAP.put(
            Pattern.compile("\\b35\\s*U\\.S\\.C\\.\\s*§\\s*(\\d+)(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[35 U.S.C. § $1](https://www.law.cornell.edu/uscode/text/35/$1)"
        );

        // Lanham Act: 15 U.S.C. § 1125(a)
        CITATION_URL_MAP.put(
            Pattern.compile("\\bLanham Act\\s*§\\s*43\\(a\\)(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[Lanham Act § 43(a)](https://www.law.cornell.edu/uscode/text/15/1125)"
        );

        CITATION_URL_MAP.put(
            Pattern.compile("\\b15\\s*U\\.S\\.C\\.\\s*§\\s*1125(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[15 U.S.C. § 1125](https://www.law.cornell.edu/uscode/text/15/1125)"
        );

        // Copyright: 17 U.S.C.
        CITATION_URL_MAP.put(
            Pattern.compile("\\b17\\s*U\\.S\\.C\\.\\s*§\\s*(\\d+)(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[17 U.S.C. § $1](https://www.law.cornell.edu/uscode/text/17/$1)"
        );

        // ===== FEDERAL CASE LAW =====

        // Federal Circuit F.3d: Name v. Name, 123 F.3d 456
        CITATION_URL_MAP.put(
            Pattern.compile("\\b([A-Z][a-zA-Z\\s&.]+)\\s+v\\.\\s+([A-Z][a-zA-Z\\s&.]+),\\s*(\\d+)\\s*F\\.3d\\s*(\\d+)(?! - Source:)(?!\\]\\(http)"),
            "[$1 v. $2, $3 F.3d $4](https://scholar.google.com/scholar?q=$1+v+$2+$3+F.3d+$4)"
        );

        // Federal Circuit F.2d: Name v. Name, 123 F.2d 456
        CITATION_URL_MAP.put(
            Pattern.compile("\\b([A-Z][a-zA-Z\\s&.]+)\\s+v\\.\\s+([A-Z][a-zA-Z\\s&.]+),\\s*(\\d+)\\s*F\\.2d\\s*(\\d+)(?! - Source:)(?!\\]\\(http)"),
            "[$1 v. $2, $3 F.2d $4](https://scholar.google.com/scholar?q=$1+v+$2+$3+F.2d+$4)"
        );

        // ===== IMMIGRATION LAW =====

        // INA sections (Immigration and Nationality Act = 8 U.S.C.)
        // INA § 208 = 8 U.S.C. § 1158, INA § 240A = 8 U.S.C. § 1229b, etc.
        // Pattern: INA § 208(a)(1)
        CITATION_URL_MAP.put(
            Pattern.compile("\\bINA\\s*§\\s*(\\d+[A-Z]?)(?:\\(([a-z])\\))?(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[INA § $1](https://www.law.cornell.edu/uscode/text/8/chapter-12)"
        );

        // Specific 8 U.S.C. immigration sections (Title 8 = Immigration)
        // 8 U.S.C. § 1158 (asylum), § 1229b (cancellation), § 1101 (definitions)
        CITATION_URL_MAP.put(
            Pattern.compile("\\b8\\s*U\\.S\\.C\\.\\s*§\\s*(\\d+)(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[8 U.S.C. § $1](https://www.law.cornell.edu/uscode/text/8/$1)"
        );

        // ===== GENERIC U.S.C. SECTIONS (Catchall for any title with subsections) =====

        // Generic U.S.C. with subsection: 11 U.S.C. § 1191(b) or any title § section(subsection)
        // (?<!\\[) prevents matching inside existing markdown links like [11 U.S.C. § 1191(b)](url)
        // (?!\\]\\() prevents matching if followed by markdown link syntax
        CITATION_URL_MAP.put(
            Pattern.compile("(?<!\\[)\\b(\\d+)\\s*U\\.S\\.C\\.\\s*§\\s*(\\d+)\\(([a-z])\\)(?!\\]\\()", Pattern.CASE_INSENSITIVE),
            "[$1 U.S.C. § $2($3)](https://www.law.cornell.edu/uscode/text/$1/$2#$3)"
        );

        // Generic U.S.C. without subsection: 11 U.S.C. § 1191 or any title § section
        // (?<!\\[) prevents matching inside existing markdown links
        // (?!\\]\\() prevents matching if followed by markdown link syntax
        CITATION_URL_MAP.put(
            Pattern.compile("(?<!\\[)\\b(\\d+)\\s*U\\.S\\.C\\.\\s*§\\s*(\\d+)(?!\\]\\()", Pattern.CASE_INSENSITIVE),
            "[$1 U.S.C. § $2](https://www.law.cornell.edu/uscode/text/$1/$2)"
        );

        // ===== IRC (INTERNAL REVENUE CODE) SECTIONS (Title 26 U.S.C.) =====

        // IRC with subsection: IRC § 170(f) or IRC § 170(f)(1)(E) or IRC § 6664(c)
        // (?<!\\[) prevents matching inside existing markdown links
        CITATION_URL_MAP.put(
            Pattern.compile("(?<!\\[)\\bIRC\\s*§\\s*(\\d+)\\(([a-z0-9]+)\\)(?:\\(([a-z0-9]+)\\))?(?:\\(([A-Z]+)\\))?(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[IRC § $1($2)$3$4](https://www.law.cornell.edu/uscode/text/26/$1#$2)"
        );

        // IRC without subsection: IRC § 170
        CITATION_URL_MAP.put(
            Pattern.compile("(?<!\\[)\\bIRC\\s*§\\s*(\\d+)(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[IRC § $1](https://www.law.cornell.edu/uscode/text/26/$1)"
        );

        // Treas. Reg. (Treasury Regulations): Treas. Reg. § 1.170A-13(c)(3)
        CITATION_URL_MAP.put(
            Pattern.compile("(?<!\\[)\\bTreas\\.\\s*Reg\\.\\s*§\\s*([\\d.A-Za-z-]+)(?:\\(([a-z0-9]+)\\))?(?:\\(([0-9]+)\\))?(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[Treas. Reg. § $1$2$3](https://www.law.cornell.edu/cfr/text/26/$1)"
        );

        // 8 CFR immigration regulations (more specific than general CFR catchall)
        // 8 CFR § 1003.1 (BIA), § 1003.2 (Remand), § 1003.3 (Appeal), § 208 (Asylum procedures)
        CITATION_URL_MAP.put(
            Pattern.compile("\\b8\\s*CFR\\s*§\\s*([\\d.]+)(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[8 CFR § $1](https://www.ecfr.gov/current/title-8/section-$1)"
        );

        // BIA precedent decisions: Matter of X-Y-Z-, 24 I&N Dec. 493 (BIA 2008)
        CITATION_URL_MAP.put(
            Pattern.compile("\\bMatter of\\s+([A-Z](?:-[A-Z])*-),\\s*(\\d+)\\s*I&N\\s*Dec\\.\\s*(\\d+)(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[Matter of $1, $2 I&N Dec. $3](https://www.justice.gov/eoir/board-immigration-appeals-precedent-decisions)"
        );

        // BIA precedent decisions without citation: Matter of X-Y-Z-
        CITATION_URL_MAP.put(
            Pattern.compile("\\bMatter of\\s+([A-Z](?:-[A-Z])*-)(?! - Source:)(?!\\]\\(http)(?!,\\s*\\d+)", Pattern.CASE_INSENSITIVE),
            "[Matter of $1](https://www.justice.gov/eoir/board-immigration-appeals-precedent-decisions)"
        );

        // ===== FEDERAL ENVIRONMENTAL LAW (CERCLA) =====

        // CERCLA (Comprehensive Environmental Response, Compensation, and Liability Act)
        // 42 U.S.C. §§ 9601-9675

        // CERCLA § 107 (liability) = 42 U.S.C. § 9607
        CITATION_URL_MAP.put(
            Pattern.compile("\\b(?:CERCLA\\s*§\\s*107|42\\s*U\\.S\\.C\\.\\s*§\\s*9607)(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[42 U.S.C. § 9607 (CERCLA § 107)](https://www.law.cornell.edu/uscode/text/42/9607)"
        );

        // CERCLA § 101 (definitions) = 42 U.S.C. § 9601
        CITATION_URL_MAP.put(
            Pattern.compile("\\b(?:CERCLA\\s*§\\s*101|42\\s*U\\.S\\.C\\.\\s*§\\s*9601)(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[42 U.S.C. § 9601 (CERCLA § 101)](https://www.law.cornell.edu/uscode/text/42/9601)"
        );

        // CERCLA § 113 (contribution) = 42 U.S.C. § 9613
        CITATION_URL_MAP.put(
            Pattern.compile("\\b(?:CERCLA\\s*§\\s*113|42\\s*U\\.S\\.C\\.\\s*§\\s*9613)(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[42 U.S.C. § 9613 (CERCLA § 113)](https://www.law.cornell.edu/uscode/text/42/9613)"
        );

        // CERCLA § 122 (settlements) = 42 U.S.C. § 9622
        CITATION_URL_MAP.put(
            Pattern.compile("\\b(?:CERCLA\\s*§\\s*122|42\\s*U\\.S\\.C\\.\\s*§\\s*9622)(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[42 U.S.C. § 9622 (CERCLA § 122)](https://www.law.cornell.edu/uscode/text/42/9622)"
        );

        // National Contingency Plan (NCP): 40 CFR Part 300
        CITATION_URL_MAP.put(
            Pattern.compile("\\b(?:NCP|National Contingency Plan|40\\s*C\\.F\\.R\\.\\s*(?:Part\\s*)?300)(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[40 CFR Part 300 (NCP)](https://www.ecfr.gov/current/title-40/chapter-I/subchapter-J/part-300)"
        );

        // Specific 42 U.S.C. §§ 9600-9675 (CERCLA range)
        CITATION_URL_MAP.put(
            Pattern.compile("\\b42\\s*U\\.S\\.C\\.\\s*§\\s*(96\\d{2})(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[42 U.S.C. § $1](https://www.law.cornell.edu/uscode/text/42/$1)"
        );

        // ===== OTHER FEDERAL STATUTES =====

        // General U.S.C. catchall (for statutes not covered above)
        CITATION_URL_MAP.put(
            Pattern.compile("\\b(\\d+)\\s*U\\.S\\.C\\.\\s*§\\s*([\\d]+)(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[$1 U.S.C. § $2](https://www.law.cornell.edu/uscode/text/$1/$2)"
        );

        // General CFR catchall (for regulations not covered above)
        CITATION_URL_MAP.put(
            Pattern.compile("\\b(\\d+)\\s*CFR\\s*§\\s*([\\d.]+)(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[$1 CFR § $2](https://www.ecfr.gov/current/title-$1/section-$2)"
        );
    }

    /**
     * Main injection method - scans response and adds URLs for known citations
     */
    public String inject(String response) {
        if (response == null || response.isBlank()) {
            return response;
        }

        log.info("🔗 CitationUrlInjector: Processing response ({} chars)", response.length());

        String processed = response;
        int injectCount = 0;

        for (Map.Entry<Pattern, String> entry : CITATION_URL_MAP.entrySet()) {
            Pattern pattern = entry.getKey();
            String replacement = entry.getValue();

            Matcher matcher = pattern.matcher(processed);
            if (matcher.find()) {
                processed = matcher.replaceAll(replacement);
                injectCount++;
            }
        }

        if (injectCount > 0) {
            log.info("✅ Injected {} URLs into response", injectCount);
        } else {
            log.info("ℹ️ No URL injections needed (all citations already had URLs or none found)");
        }

        return processed;
    }

    /**
     * Validates response has sufficient URL coverage
     * Returns percentage of known citations that have URLs
     */
    public ValidationResult validate(String response) {
        if (response == null || response.isBlank()) {
            return new ValidationResult(0, 0, 0.0);
        }

        int citationsFound = 0;
        int citationsWithUrls = 0;

        for (Pattern pattern : CITATION_URL_MAP.keySet()) {
            // Remove the negative lookbehind to find ALL occurrences
            String patternStr = pattern.pattern()
                .replace("(?! - Source:)", "")
                .replace("(?!\\]\\(http)", "");

            Pattern findPattern = Pattern.compile(patternStr, pattern.flags());
            Matcher matcher = findPattern.matcher(response);

            while (matcher.find()) {
                citationsFound++;

                // Check if this specific occurrence has a URL
                String citationText = matcher.group();
                int citationEnd = matcher.end();

                // Check next 200 chars for URL pattern
                String following = response.substring(
                    citationEnd,
                    Math.min(citationEnd + 200, response.length())
                );

                if (following.matches("^\\s*-\\s*Source:\\s*http.*") ||
                    following.matches("^\\]\\(http.*")) {
                    citationsWithUrls++;
                }
            }
        }

        double coverage = citationsFound > 0 ? (double) citationsWithUrls / citationsFound * 100 : 100.0;

        return new ValidationResult(citationsFound, citationsWithUrls, coverage);
    }

    /**
     * Result of validation check
     */
    public static class ValidationResult {
        public final int totalCitations;
        public final int citationsWithUrls;
        public final double coveragePercentage;

        public ValidationResult(int total, int withUrls, double coverage) {
            this.totalCitations = total;
            this.citationsWithUrls = withUrls;
            this.coveragePercentage = coverage;
        }

        public boolean isAcceptable() {
            return coveragePercentage >= 90.0; // 90%+ coverage is acceptable
        }

        @Override
        public String toString() {
            return String.format("Citations: %d, With URLs: %d, Coverage: %.1f%%",
                totalCitations, citationsWithUrls, coveragePercentage);
        }
    }
}
