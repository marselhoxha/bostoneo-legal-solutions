package com.bostoneo.bostoneosolutions.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import com.bostoneo.bostoneosolutions.dto.CaseDocumentSummary;

import java.util.*;
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
            "[501 CMR 2.56](https://www.mass.gov/regulations/501-CMR-200-safe-roads)"
        );

        // Specific 501 CMR 2.00 (breath test operation)
        CITATION_URL_MAP.put(
            Pattern.compile("\\b501\\s*CMR\\s*2\\.00\\b(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[501 CMR 2.00](https://www.mass.gov/regulations/501-CMR-200-safe-roads)"
        );

        // Specific 540 CMR 2.00 (RMV hearing regulations)
        CITATION_URL_MAP.put(
            Pattern.compile("\\b540\\s*CMR\\s*2\\.00\\b(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[540 CMR 2.00](https://www.mass.gov/regulations/540-CMR-200-rmv-hearings)"
        );

        // Generic CMR pattern: ### CMR #.##
        CITATION_URL_MAP.put(
            Pattern.compile("\\b(\\d+)\\s*CMR\\s*([\\d.]+)\\b(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[$1 CMR $2](https://www.mass.gov/regulations/$1-CMR-$2)"
        );

        // Massachusetts Rules of Criminal Procedure — SPECIFIC (with rule number) BEFORE generic
        // (?<!\[) prevents re-matching inside markdown links created by earlier replacements
        CITATION_URL_MAP.put(
            Pattern.compile("(?<!\\[)\\bMass\\.?\\s*R\\.?\\s*Crim\\.?\\s*P\\.?\\s*(\\d+)\\s*((?:\\([a-zA-Z0-9]+\\))*)(?!\\]\\()", Pattern.CASE_INSENSITIVE),
            "[Mass. R. Crim. P. $1$2](https://www.mass.gov/law-library/massachusetts-rules-of-criminal-procedure)"
        );

        // Generic catch-all (no rule number)
        // (?<!\[) prevents re-matching inside markdown links
        CITATION_URL_MAP.put(
            Pattern.compile("(?<!\\[)\\bMass\\.?\\s*R\\.?\\s*Crim\\.?\\s*P\\.?(?![.\\s]*\\d)(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[Mass. R. Crim. P.](https://www.mass.gov/law-library/massachusetts-rules-of-criminal-procedure)"
        );

        // Massachusetts Rules of Civil Procedure — specific rules handled by injectMassCivPUrls()
        // (?<!\[) prevents re-matching inside markdown links created by injectMassCivPUrls
        CITATION_URL_MAP.put(
            Pattern.compile("(?<!\\[)\\bMass\\.?\\s*R\\.?\\s*Civ\\.?\\s*P\\.?(?![.\\s]*\\d)(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[Mass. R. Civ. P.](https://www.mass.gov/law-library/massachusetts-rules-of-civil-procedure)"
        );

        // ===== MASSACHUSETTS STATUTES (GENERIC PATTERNS) =====

        // M.G.L. chapter with section: M.G.L. c. 90, § 24D, M.G.L. c. 176D, § 3(9), M.G.L. c. 231, § 60B
        // Note: Chapter can have letter suffix (90A, 93A, 176D). Section can have letter suffix (60B, 60C).
        // URL pattern: https://malegislature.gov/Laws/GeneralLaws/Chapter{ch}/Section{sec}
        // (?<!\[) prevents re-matching citations already inside markdown links from earlier patterns.
        // Section split: $2 = base section number (for URL), $3 = subsection parens (display only, not in URL).
        CITATION_URL_MAP.put(
            Pattern.compile("(?<!\\[)\\bM\\.G\\.L\\.\\s*c\\.\\s*(\\d+[A-Z]?),?\\s*§§?\\s*(\\d+[A-Z]?)((?:\\([a-zA-Z0-9]+\\))*)(?! - Source:)(?! - View)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[M.G.L. c. $1, § $2$3](https://malegislature.gov/Laws/GeneralLaws/Chapter$1/Section$2)"
        );

        // M.G.L. chapter only (no section): M.G.L. c. 90, M.G.L. c. 176D
        // URL pattern: https://malegislature.gov/Laws/GeneralLaws/Chapter{ch}
        // (?<!\[) prevents re-matching inside markdown links. (?!\d) prevents partial number backtracking
        // (e.g., matching "23" from "233" when the negative lookahead for § causes backtracking).
        CITATION_URL_MAP.put(
            Pattern.compile("(?<!\\[)\\bM\\.G\\.L\\.\\s*c\\.\\s*(\\d+[A-Z]?)(?!\\d)(?!\\s*,?\\s*§)(?! - Source:)(?! - View)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[M.G.L. c. $1](https://malegislature.gov/Laws/GeneralLaws/Chapter$1)"
        );

        // G.L. alias (AI sometimes drops the M. prefix): G.L. c. 260, § 2A
        CITATION_URL_MAP.put(
            Pattern.compile("(?<!\\[)\\bG\\.L\\.\\s*c\\.\\s*(\\d+[A-Z]?),?\\s*§§?\\s*(\\d+[A-Z]?)((?:\\([a-zA-Z0-9]+\\))*)(?! - Source:)(?! - View)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[G.L. c. $1, § $2$3](https://malegislature.gov/Laws/GeneralLaws/Chapter$1/Section$2)"
        );

        // G.L. chapter only (no section): G.L. c. 260
        CITATION_URL_MAP.put(
            Pattern.compile("(?<!\\[)\\bG\\.L\\.\\s*c\\.\\s*(\\d+[A-Z]?)(?!\\d)(?!\\s*,?\\s*§)(?! - Source:)(?! - View)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[G.L. c. $1](https://malegislature.gov/Laws/GeneralLaws/Chapter$1)"
        );

        // ===== MASSACHUSETTS COURT STANDING ORDERS & LOCAL RULES =====

        // BMC Standing Orders: BMC Standing Order 1-04
        CITATION_URL_MAP.put(
            Pattern.compile("\\bBMC\\s+Standing\\s+Order\\s+(\\d+-\\d+)(?! - Source:)(?! - View)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[BMC Standing Order $1](https://www.mass.gov/guides/massachusetts-rules-of-court-and-standing-orders)"
        );

        // BMC Local Rules: BMC Local Rule 3
        CITATION_URL_MAP.put(
            Pattern.compile("\\bBMC\\s+Local\\s+Rule\\s+(\\d+)(?! - Source:)(?! - View)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[BMC Local Rule $1](https://www.mass.gov/guides/massachusetts-rules-of-court-and-standing-orders)"
        );

        // BLS Standing Orders: BLS Standing Order 1-12
        CITATION_URL_MAP.put(
            Pattern.compile("\\bBLS\\s+Standing\\s+Order\\s+(\\d+-\\d+)(?! - Source:)(?! - View)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[BLS Standing Order $1](https://www.mass.gov/guides/massachusetts-rules-of-court-and-standing-orders)"
        );

        // Superior Court Standing Orders: Superior Court Standing Order 2-86
        CITATION_URL_MAP.put(
            Pattern.compile("\\bSuperior\\s+Court\\s+Standing\\s+Order\\s+(\\d+-\\d+)(?! - Source:)(?! - View)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[Superior Court Standing Order $1](https://www.mass.gov/guides/massachusetts-rules-of-court-and-standing-orders)"
        );

        // ===== FEDERAL CIRCUIT COURT CASES =====

        // First Circuit with pin cites: United States v. Name, 963 F.3d 1, 12-15 (1st Cir. 2020)
        CITATION_URL_MAP.put(
            Pattern.compile("(?<!\\[)\\b((?:United States|U\\.S\\.)\\s+v\\.\\s+[A-Z*][a-zA-Z*-]+),?\\s*(\\d+)\\s+F\\.3d\\s+(\\d+),?\\s+([\\d-]+)\\s*\\(1st Cir\\.\\s*\\d{4}\\)(?!\\]\\()", Pattern.CASE_INSENSITIVE),
            "[$1, $2 F.3d $3, $4 (1st Cir.)](https://www.courtlistener.com/?q=$2+F.3d+$3)"
        );

        // First Circuit without pin cites: United States v. Name, 963 F.3d 1 (1st Cir. 2020)
        CITATION_URL_MAP.put(
            Pattern.compile("(?<!\\[)\\b((?:United States|U\\.S\\.)\\s+v\\.\\s+[A-Z*][a-zA-Z*-]+),?\\s*(\\d+)\\s+F\\.3d\\s+(\\d+)\\s*\\(1st Cir\\.\\s*\\d{4}\\)(?!\\]\\()", Pattern.CASE_INSENSITIVE),
            "[$1, $2 F.3d $3 (1st Cir.)](https://www.courtlistener.com/?q=$2+F.3d+$3)"
        );

        // Other First Circuit cases with pin cites: Name v. Name, 728 F.3d 1, 5-8 (1st Cir. 2013)
        CITATION_URL_MAP.put(
            Pattern.compile("(?<!\\[)\\b([A-Z*][a-zA-Z*\\s&.]+?)\\s+v\\.\\s+([A-Z*][a-zA-Z*\\s&.]+?),?\\s*(\\d+)\\s+F\\.3d\\s+(\\d+),?\\s+([\\d-]+)\\s*\\(1st Cir\\.\\s*\\d{4}\\)(?!\\]\\()"),
            "[$1 v. $2, $3 F.3d $4, $5 (1st Cir.)](https://www.courtlistener.com/?q=$3+F.3d+$4)"
        );

        // Other First Circuit cases without pin cites: Name v. Name, 728 F.3d 1 (1st Cir. 2013)
        CITATION_URL_MAP.put(
            Pattern.compile("(?<!\\[)\\b([A-Z*][a-zA-Z*\\s&.]+?)\\s+v\\.\\s+([A-Z*][a-zA-Z*\\s&.]+?),?\\s*(\\d+)\\s+F\\.3d\\s+(\\d+)\\s*\\(1st Cir\\.\\s*\\d{4}\\)(?!\\]\\()"),
            "[$1 v. $2, $3 F.3d $4 (1st Cir.)](https://www.courtlistener.com/?q=$3+F.3d+$4)"
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
        // $1 = base reg number (e.g. 1.170A-14), $2 = all subsection groups (e.g. (g)(5)(i))
        CITATION_URL_MAP.put(
            Pattern.compile("\\b(?:Treas\\.\\s*Reg\\.|26\\s*CFR)\\s*§\\s*([\\d.A-Za-z\\-]+)((?:\\s*\\([^)]+\\))*)(?! - Source:)(?! - View)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[Treas. Reg. § $1$2](https://www.ecfr.gov/current/title-26)"
        );

        // IRC sections with complex subsections (uscode.house.gov): IRC §170(h)(4)(A), IRC §6707A
        // $1 = section number with optional letter suffix (e.g. 170, 6707A), $2 = all subsection groups (e.g. (f)(11)(C))
        CITATION_URL_MAP.put(
            Pattern.compile("\\b(?:IRC|26\\s*U\\.S\\.C\\.)\\s*§\\s*(\\d+[A-Z]?)((?:\\s*\\([^)]+\\))*)(?! - Source:)(?! - View)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[IRC § $1$2](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section$1&num=0&edition=prelim)"
        );

        // Tax Court Memo citations: Name v. Comm'r, T.C. Memo 2018-159
        CITATION_URL_MAP.put(
            Pattern.compile("(?<!\\[)\\b([A-Z*][a-zA-Z*\\s&.]+?)\\s+v\\.\\s+Comm'r,\\s*T\\.C\\.\\s*Memo\\.?\\s*(\\d{4})-(\\d+)(?! - Source:)(?!\\]\\(http)"),
            "[$1 v. Comm'r, T.C. Memo $2-$3](https://www.courtlistener.com/?q=T.C.+Memo+$2-$3)"
        );

        // Tax Court regular citations: Name v. Comm'r, 151 T.C. 247
        CITATION_URL_MAP.put(
            Pattern.compile("(?<!\\[)\\b([A-Z*][a-zA-Z*\\s&.]+?)\\s+v\\.\\s+Comm'r,\\s*(\\d+)\\s*T\\.C\\.\\s*(\\d+)(?! - Source:)(?!\\]\\(http)"),
            "[$1 v. Comm'r, $2 T.C. $3](https://www.courtlistener.com/?q=$2+T.C.+$3)"
        );

        // ===== FEDERAL COURT RULES =====

        // Tax Court Rules: Tax Court Rule 91(b)
        CITATION_URL_MAP.put(
            Pattern.compile("\\bTax Court Rule\\s*(\\d+)(?:\\(([a-z]\\d?)\\))?(?! - Source:)(?! - View)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[Tax Court Rule $1](https://www.ustaxcourt.gov/rules.html)"
        );

        // ===== FEDERAL COURT RULES (uscourts.gov — official source) =====

        // FRCP abbreviation: FRCP 8(a), FRCP 12(b)(6)
        CITATION_URL_MAP.put(
            Pattern.compile("(?<!\\[)\\bFRCP\\s*(\\d+)((?:\\([a-zA-Z0-9]+\\))*)(?! - Source:)(?! - View)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[FRCP $1$2](https://www.law.cornell.edu/rules/frcp/rule_$1)"
        );

        // FRCrP abbreviation: FRCrP 12(b), FRCrP 16(a)(1)
        CITATION_URL_MAP.put(
            Pattern.compile("(?<!\\[)\\bFRCrP\\s*(\\d+)((?:\\([a-zA-Z0-9]+\\))*)(?! - Source:)(?! - View)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[FRCrP $1$2](https://www.law.cornell.edu/rules/frcrmp/rule_$1)"
        );

        // Federal Rules of Civil Procedure: Fed. R. Civ. P. 56(c)(2)(E)
        // Full subsection capture: $1=rule number, $2=all subsection parens (display only, not in URL)
        CITATION_URL_MAP.put(
            Pattern.compile("(?<!\\[)\\bFed\\.?\\s*R\\.?\\s*Civ\\.?\\s*P\\.?\\s*(\\d+)((?:\\([a-zA-Z0-9]+\\))*)(?! - Source:)(?! - View)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[Fed. R. Civ. P. $1$2](https://www.law.cornell.edu/rules/frcp/rule_$1)"
        );

        // Federal Rules of Criminal Procedure: Fed. R. Crim. P. 12(b)(3)
        CITATION_URL_MAP.put(
            Pattern.compile("(?<!\\[)\\bFed\\.?\\s*R\\.?\\s*Crim\\.?\\s*P\\.?\\s*(\\d+)((?:\\([a-zA-Z0-9]+\\))*)(?! - Source:)(?! - View)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[Fed. R. Crim. P. $1$2](https://www.law.cornell.edu/rules/frcrmp/rule_$1)"
        );

        // U.S. Sentencing Guidelines: U.S.S.G. §2B1.1
        CITATION_URL_MAP.put(
            Pattern.compile("\\bU\\.S\\.S\\.G\\.\\s*§\\s*([\\d.A-Za-z]+)(?! - Source:)(?! - View)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[U.S.S.G. § $1](https://www.ussc.gov/guidelines)"
        );

        // D. Mass. Local Rules: D. Mass. Local Rule 7.1(b)(1)
        CITATION_URL_MAP.put(
            Pattern.compile("\\bD\\.?\\s*Mass\\.?\\s*Local Rule\\s*([\\d.()a-z]+)(?!\\]\\()", Pattern.CASE_INSENSITIVE),
            "[D. Mass. Local Rule $1](https://www.mad.uscourts.gov/attorneys/local-rules)"
        );

        // ===== FEDERAL EMPLOYMENT LAW (uscode.house.gov — official U.S. Code source) =====

        // Title VII
        CITATION_URL_MAP.put(
            Pattern.compile("\\bTitle VII\\b(?! - Source:)(?!\\]\\(http)"),
            "[Title VII](https://uscode.house.gov/view.xhtml?path=/prelim@title42/chapter21/subchapter6&edition=prelim)"
        );

        // 42 U.S.C. § 2000e (Title VII codification)
        CITATION_URL_MAP.put(
            Pattern.compile("\\b42\\s*U\\.S\\.C\\.\\s*§\\s*2000e(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[42 U.S.C. § 2000e](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section2000e&num=0&edition=prelim)"
        );

        // ADA
        CITATION_URL_MAP.put(
            Pattern.compile("\\bAmericans with Disabilities Act\\b(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[Americans with Disabilities Act](https://uscode.house.gov/view.xhtml?path=/prelim@title42/chapter126&edition=prelim)"
        );

        // 29 U.S.C. (ADEA, FMLA, etc.)
        CITATION_URL_MAP.put(
            Pattern.compile("\\b29\\s*U\\.S\\.C\\.\\s*§\\s*(\\d+)(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[29 U.S.C. § $1](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title29-section$1&num=0&edition=prelim)"
        );

        // ADEA specifically
        CITATION_URL_MAP.put(
            Pattern.compile("\\bADEA\\b(?! - Source:)(?!\\]\\(http)"),
            "[ADEA](https://uscode.house.gov/view.xhtml?path=/prelim@title29/chapter14&edition=prelim)"
        );

        // FMLA specifically
        CITATION_URL_MAP.put(
            Pattern.compile("\\bFMLA\\b(?! - Source:)(?!\\]\\(http)"),
            "[FMLA](https://uscode.house.gov/view.xhtml?path=/prelim@title29/chapter28&edition=prelim)"
        );

        // ===== FEDERAL INTELLECTUAL PROPERTY LAW (uscode.house.gov) =====

        // Patent statute: 35 U.S.C. § 271
        CITATION_URL_MAP.put(
            Pattern.compile("\\b35\\s*U\\.S\\.C\\.\\s*§\\s*(\\d+)(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[35 U.S.C. § $1](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title35-section$1&num=0&edition=prelim)"
        );

        // Lanham Act: 15 U.S.C. § 1125(a)
        CITATION_URL_MAP.put(
            Pattern.compile("\\bLanham Act\\s*§\\s*43\\(a\\)(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[Lanham Act § 43(a)](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title15-section1125&num=0&edition=prelim)"
        );

        CITATION_URL_MAP.put(
            Pattern.compile("\\b15\\s*U\\.S\\.C\\.\\s*§\\s*1125(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[15 U.S.C. § 1125](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title15-section1125&num=0&edition=prelim)"
        );

        // Copyright: 17 U.S.C.
        CITATION_URL_MAP.put(
            Pattern.compile("\\b17\\s*U\\.S\\.C\\.\\s*§\\s*(\\d+)(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[17 U.S.C. § $1](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title17-section$1&num=0&edition=prelim)"
        );

        // ===== GENERIC U.S. CODE (catch-all for titles not listed above) =====
        // XX U.S.C. § YYY — routes to Cornell LII
        CITATION_URL_MAP.put(
            Pattern.compile("(?<!\\[)\\b(\\d+)\\s*U\\.S\\.C\\.\\s*§\\s*(\\d+[a-z]?)((?:\\([a-zA-Z0-9]+\\))*)(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[$1 U.S.C. § $2$3](https://www.law.cornell.edu/uscode/text/$1/$2)"
        );

        // ===== CALIFORNIA STATUTES =====
        // leginfo.legislature.ca.gov — official California code search

        // Cal. Civ. Proc. Code § XXX (Code of Civil Procedure)
        CITATION_URL_MAP.put(
            Pattern.compile("(?<!\\[)\\bCal\\.?\\s*Civ\\.?\\s*Proc\\.?\\s*Code\\s*§\\s*(\\d+[a-z]?\\.?\\d*)((?:\\([a-zA-Z0-9]+\\))*)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[Cal. Civ. Proc. Code § $1$2](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=$1.&lawCode=CCP)"
        );

        // Cal. Civ. Code § XXX (Civil Code)
        CITATION_URL_MAP.put(
            Pattern.compile("(?<!\\[)\\bCal\\.?\\s*Civ\\.?\\s*Code\\s*§\\s*(\\d+[a-z]?\\.?\\d*)((?:\\([a-zA-Z0-9]+\\))*)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[Cal. Civ. Code § $1$2](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=$1.&lawCode=CIV)"
        );

        // Cal. Penal Code § XXX
        CITATION_URL_MAP.put(
            Pattern.compile("(?<!\\[)\\bCal\\.?\\s*Penal\\s*Code\\s*§\\s*(\\d+[a-z]?\\.?\\d*)((?:\\([a-zA-Z0-9]+\\))*)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[Cal. Penal Code § $1$2](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=$1.&lawCode=PEN)"
        );

        // Cal. Evid. Code § XXX
        CITATION_URL_MAP.put(
            Pattern.compile("(?<!\\[)\\bCal\\.?\\s*Evid\\.?\\s*Code\\s*§\\s*(\\d+[a-z]?\\.?\\d*)((?:\\([a-zA-Z0-9]+\\))*)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[Cal. Evid. Code § $1$2](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=$1.&lawCode=EVID)"
        );

        // Cal. Bus. & Prof. Code § XXX
        CITATION_URL_MAP.put(
            Pattern.compile("(?<!\\[)\\bCal\\.?\\s*Bus\\.?\\s*(?:&|and)\\s*Prof\\.?\\s*Code\\s*§\\s*(\\d+[a-z]?\\.?\\d*)((?:\\([a-zA-Z0-9]+\\))*)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[Cal. Bus. & Prof. Code § $1$2](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=$1.&lawCode=BPC)"
        );

        // ===== NEW YORK STATUTES =====

        // N.Y. C.P.L.R. § XXX (Civil Practice Law & Rules)
        CITATION_URL_MAP.put(
            Pattern.compile("(?<!\\[)\\bN\\.?Y\\.?\\s*C\\.?P\\.?L\\.?R\\.?\\s*§\\s*(\\d+[a-z]?)((?:\\([a-zA-Z0-9]+\\))*)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[N.Y. C.P.L.R. § $1$2](https://www.nysenate.gov/legislation/laws/CVP/$1)"
        );

        // N.Y. Penal Law § XXX
        CITATION_URL_MAP.put(
            Pattern.compile("(?<!\\[)\\bN\\.?Y\\.?\\s*Penal\\s*Law\\s*§\\s*(\\d+[a-z]?\\.?\\d*)((?:\\([a-zA-Z0-9]+\\))*)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[N.Y. Penal Law § $1$2](https://www.nysenate.gov/legislation/laws/PEN/$1)"
        );

        // N.Y. Gen. Bus. Law § XXX
        CITATION_URL_MAP.put(
            Pattern.compile("(?<!\\[)\\bN\\.?Y\\.?\\s*Gen\\.?\\s*Bus\\.?\\s*Law\\s*§\\s*(\\d+[a-z]?)((?:\\([a-zA-Z0-9]+\\))*)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[N.Y. Gen. Bus. Law § $1$2](https://www.nysenate.gov/legislation/laws/GBS/$1)"
        );

        // ===== UNIFORM COMMERCIAL CODE =====

        // U.C.C. § X-YYY — routes to Cornell LII
        CITATION_URL_MAP.put(
            Pattern.compile("(?<!\\[)\\bU\\.?C\\.?C\\.?\\s*§\\s*(\\d+)-(\\d+[a-zA-Z]?)((?:\\([a-zA-Z0-9]+\\))*)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[U.C.C. § $1-$2$3](https://www.law.cornell.edu/ucc/$1/$1-$2)"
        );

        // ===== MASSACHUSETTS STATE CASE LAW =====

        // Mass. Appeals Court: Name v. Name, ### Mass. App. Ct. ### (year) — MUST be before Mass. SJC
        // Mass. App. Ct.: Name v. Name, ### Mass. App. Ct. ### (year)
        // Character class includes * for markdown emphasis (*Name*)
        CITATION_URL_MAP.put(
            Pattern.compile("(?<!\\[)\\b([A-Z*][a-zA-Z'*\\s&.]+?)\\s+v\\.\\s+([A-Z*][a-zA-Z'*\\s&.]+?),\\s*(\\d+)\\s+Mass\\.\\s*App\\.\\s*Ct\\.\\s*(\\d+)(?:,?\\s*\\d+(?:-\\d+)?)?(?:\\s*\\(\\d{4}\\))?(?!\\]\\()", Pattern.CASE_INSENSITIVE),
            "[$1 v. $2, $3 Mass. App. Ct. $4](https://www.courtlistener.com/?q=$3+Mass.+App.+Ct.+$4)"
        );

        // Mass. SJC: Name v. Name, ### Mass. ### (year)
        CITATION_URL_MAP.put(
            Pattern.compile("(?<!\\[)\\b([A-Z*][a-zA-Z'*\\s&.]+?)\\s+v\\.\\s+([A-Z*][a-zA-Z'*\\s&.]+?),\\s*(\\d+)\\s+Mass\\.\\s+(\\d+)(?:,?\\s*\\d+(?:-\\d+)?)?(?:\\s*\\(\\d{4}\\))?(?!\\]\\()", Pattern.CASE_INSENSITIVE),
            "[$1 v. $2, $3 Mass. $4](https://www.courtlistener.com/?q=$3+Mass.+$4)"
        );

        // Mass. N.E.2d/N.E.3d citations: Name v. Name, ### N.E.2d/3d ### (Mass. year)
        CITATION_URL_MAP.put(
            Pattern.compile("(?<!\\[)\\b([A-Z*][a-zA-Z'*\\s&.]+?)\\s+v\\.\\s+([A-Z*][a-zA-Z'*\\s&.]+?),\\s*(\\d+)\\s+N\\.E\\.(2d|3d)\\s+(\\d+)(?:,?\\s*\\d+(?:-\\d+)?)?(?:\\s*\\(Mass\\.\\s*\\d{4}\\))?(?!\\]\\()", Pattern.CASE_INSENSITIVE),
            "[$1 v. $2, $3 N.E.$4 $5](https://www.courtlistener.com/?q=$3+N.E.$4+$5)"
        );

        // ===== FEDERAL CASE LAW =====

        // Federal Circuit F.3d: Name v. Name, 123 F.3d 456
        CITATION_URL_MAP.put(
            Pattern.compile("(?<!\\[)\\b([A-Z*][a-zA-Z*\\s&.]+?)\\s+v\\.\\s+([A-Z*][a-zA-Z*\\s&.]+?),\\s*(\\d+)\\s*F\\.3d\\s*(\\d+)(?! - Source:)(?!\\]\\(http)"),
            "[$1 v. $2, $3 F.3d $4](https://www.courtlistener.com/?q=$3+F.3d+$4)"
        );

        // Federal Circuit F.2d: Name v. Name, 123 F.2d 456
        CITATION_URL_MAP.put(
            Pattern.compile("(?<!\\[)\\b([A-Z*][a-zA-Z*\\s&.]+?)\\s+v\\.\\s+([A-Z*][a-zA-Z*\\s&.]+?),\\s*(\\d+)\\s*F\\.2d\\s*(\\d+)(?! - Source:)(?!\\]\\(http)"),
            "[$1 v. $2, $3 F.2d $4](https://www.courtlistener.com/?q=$3+F.2d+$4)"
        );

        // SCOTUS: Name v. Name, ### U.S. ###
        CITATION_URL_MAP.put(
            Pattern.compile("(?<!\\[)\\b([A-Z*][a-zA-Z'*\\s&.]+?)\\s+v\\.\\s+([A-Z*][a-zA-Z'*\\s&.]+?),\\s*(\\d+)\\s+U\\.S\\.\\s+(\\d+)(?:,?\\s*\\d+(?:-\\d+)?)?(?:\\s*\\(\\d{4}\\))?(?!\\]\\()"),
            "[$1 v. $2, $3 U.S. $4](https://www.courtlistener.com/?q=$3+U.S.+$4)"
        );

        // ===== IMMIGRATION LAW (uscode.house.gov) =====

        // INA sections (Immigration and Nationality Act = 8 U.S.C.)
        CITATION_URL_MAP.put(
            Pattern.compile("\\bINA\\s*§\\s*(\\d+[A-Z]?)(?:\\(([a-z])\\))?(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[INA § $1](https://uscode.house.gov/view.xhtml?path=/prelim@title8/chapter12&edition=prelim)"
        );

        // Specific 8 U.S.C. immigration sections
        CITATION_URL_MAP.put(
            Pattern.compile("\\b8\\s*U\\.S\\.C\\.\\s*§\\s*(\\d+)(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[8 U.S.C. § $1](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title8-section$1&num=0&edition=prelim)"
        );

        // ===== GENERIC U.S.C. SECTIONS (uscode.house.gov — official source) =====

        // Generic U.S.C. with subsection: 11 U.S.C. § 1191(b)
        CITATION_URL_MAP.put(
            Pattern.compile("(?<!\\[)\\b(\\d+)\\s*U\\.S\\.C\\.\\s*§\\s*(\\d+)\\(([a-z])\\)(?!\\]\\()", Pattern.CASE_INSENSITIVE),
            "[$1 U.S.C. § $2($3)](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title$1-section$2&num=0&edition=prelim)"
        );

        // Generic U.S.C. without subsection: 11 U.S.C. § 1191
        CITATION_URL_MAP.put(
            Pattern.compile("(?<!\\[)\\b(\\d+)\\s*U\\.S\\.C\\.\\s*§\\s*(\\d+)(?!\\]\\()", Pattern.CASE_INSENSITIVE),
            "[$1 U.S.C. § $2](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title$1-section$2&num=0&edition=prelim)"
        );

        // Treas. Reg. (Treasury Regulations) — covered by ecfr.gov pattern above (line ~217)

        // 8 CFR immigration regulations (more specific than general CFR catchall)
        // 8 CFR § 1003.1 (BIA), § 1003.2 (Remand), § 1003.3 (Appeal), § 208 (Asylum procedures)
        CITATION_URL_MAP.put(
            Pattern.compile("\\b8\\s*CFR\\s*§\\s*([\\d.]+)(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[8 CFR § $1](https://www.ecfr.gov/current/title-8/section-$1)"
        );

        // BIA precedent decisions: Matter of X-Y-Z-, 24 I&N Dec. 493 (BIA 2008)
        CITATION_URL_MAP.put(
            Pattern.compile("\\bMatter of\\s+([A-Z](?:-[A-Z])*-),\\s*(\\d+)\\s*I&N\\s*Dec\\.\\s*(\\d+)(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[Matter of $1, $2 I&N Dec. $3](https://www.justice.gov/eoir/ag-bia-decisions)"
        );

        // BIA precedent decisions without citation: Matter of X-Y-Z-
        CITATION_URL_MAP.put(
            Pattern.compile("\\bMatter of\\s+([A-Z](?:-[A-Z])*-)(?! - Source:)(?!\\]\\(http)(?!,\\s*\\d+)", Pattern.CASE_INSENSITIVE),
            "[Matter of $1](https://www.justice.gov/eoir/ag-bia-decisions)"
        );

        // ===== FEDERAL ENVIRONMENTAL LAW (CERCLA) =====

        // CERCLA (Comprehensive Environmental Response, Compensation, and Liability Act)
        // 42 U.S.C. §§ 9601-9675

        // CERCLA statutes (uscode.house.gov)

        // CERCLA § 107 (liability) = 42 U.S.C. § 9607
        CITATION_URL_MAP.put(
            Pattern.compile("\\b(?:CERCLA\\s*§\\s*107|42\\s*U\\.S\\.C\\.\\s*§\\s*9607)(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[42 U.S.C. § 9607 (CERCLA § 107)](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section9607&num=0&edition=prelim)"
        );

        // CERCLA § 101 (definitions) = 42 U.S.C. § 9601
        CITATION_URL_MAP.put(
            Pattern.compile("\\b(?:CERCLA\\s*§\\s*101|42\\s*U\\.S\\.C\\.\\s*§\\s*9601)(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[42 U.S.C. § 9601 (CERCLA § 101)](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section9601&num=0&edition=prelim)"
        );

        // CERCLA § 113 (contribution) = 42 U.S.C. § 9613
        CITATION_URL_MAP.put(
            Pattern.compile("\\b(?:CERCLA\\s*§\\s*113|42\\s*U\\.S\\.C\\.\\s*§\\s*9613)(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[42 U.S.C. § 9613 (CERCLA § 113)](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section9613&num=0&edition=prelim)"
        );

        // CERCLA § 122 (settlements) = 42 U.S.C. § 9622
        CITATION_URL_MAP.put(
            Pattern.compile("\\b(?:CERCLA\\s*§\\s*122|42\\s*U\\.S\\.C\\.\\s*§\\s*9622)(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[42 U.S.C. § 9622 (CERCLA § 122)](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section9622&num=0&edition=prelim)"
        );

        // Specific 42 U.S.C. §§ 9600-9675 (CERCLA range)
        CITATION_URL_MAP.put(
            Pattern.compile("\\b42\\s*U\\.S\\.C\\.\\s*§\\s*(96\\d{2})(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[42 U.S.C. § $1](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section$1&num=0&edition=prelim)"
        );

        // National Contingency Plan (NCP): 40 CFR Part 300 — kept (ecfr.gov is official government source)
        CITATION_URL_MAP.put(
            Pattern.compile("\\b(?:NCP|National Contingency Plan|40\\s*C\\.F\\.R\\.\\s*(?:Part\\s*)?300)(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[40 CFR Part 300 (NCP)](https://www.ecfr.gov/current/title-40/chapter-I/subchapter-J/part-300)"
        );

        // ===== OTHER FEDERAL STATUTES =====

        // General U.S.C. catchall (uscode.house.gov — official source)
        CITATION_URL_MAP.put(
            Pattern.compile("\\b(\\d+)\\s*U\\.S\\.C\\.\\s*§\\s*([\\d]+)(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[$1 U.S.C. § $2](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title$1-section$2&num=0&edition=prelim)"
        );

        // General CFR catchall (ecfr.gov — official government source)
        CITATION_URL_MAP.put(
            Pattern.compile("\\b(\\d+)\\s*CFR\\s*§\\s*([\\d.]+)(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[$1 CFR § $2](https://www.ecfr.gov/current/title-$1/section-$2)"
        );
    }

    // Massachusetts Rules of Civil Procedure — per-rule URL lookup
    // Each rule has a unique slug on mass.gov, so we map rule numbers to full URLs.
    private static final Map<String, String> MASS_CIV_P_URLS = new HashMap<>();
    static {
        String base = "https://www.mass.gov/rules-of-civil-procedure/civil-procedure-rule-";
        MASS_CIV_P_URLS.put("1", base + "1-scope-of-rules");
        MASS_CIV_P_URLS.put("2", base + "2-one-form-of-action");
        MASS_CIV_P_URLS.put("3", base + "3-commencement-of-action");
        MASS_CIV_P_URLS.put("4", base + "4-process");
        MASS_CIV_P_URLS.put("5", base + "5-service-and-filing-of-pleadings-and-other-papers");
        MASS_CIV_P_URLS.put("6", base + "6-time");
        MASS_CIV_P_URLS.put("7", base + "7-pleadings-allowed-form-of-motions");
        MASS_CIV_P_URLS.put("8", base + "8-general-rules-of-pleading");
        MASS_CIV_P_URLS.put("9", base + "9-pleading-special-matters");
        MASS_CIV_P_URLS.put("10", base + "10-form-of-pleadings");
        MASS_CIV_P_URLS.put("11", base + "11-appearances-and-pleadings");
        MASS_CIV_P_URLS.put("12", base + "12-defenses-and-objections-when-and-how-presented-by-pleading-or-motion-motion-for-judgment-on-pleadings");
        MASS_CIV_P_URLS.put("13", base + "13-counterclaim-and-cross-claim");
        MASS_CIV_P_URLS.put("14", base + "14-third-party-practice");
        MASS_CIV_P_URLS.put("15", base + "15-amended-and-supplemental-pleadings");
        MASS_CIV_P_URLS.put("16", base + "16-pre-trial-procedure-formulating-issues");
        MASS_CIV_P_URLS.put("17", base + "17-parties-plaintiff-and-defendant-capacity");
        MASS_CIV_P_URLS.put("18", base + "18-joinder-of-claims-and-remedies");
        MASS_CIV_P_URLS.put("19", base + "19-joinder-of-persons-needed-for-just-adjudication");
        MASS_CIV_P_URLS.put("20", base + "20-permissive-joinder-of-parties");
        MASS_CIV_P_URLS.put("21", base + "21-misjoinder-and-non-joinder-of-parties");
        MASS_CIV_P_URLS.put("22", base + "22-interpleader");
        MASS_CIV_P_URLS.put("23", base + "23-class-actions");
        MASS_CIV_P_URLS.put("24", base + "24-intervention");
        MASS_CIV_P_URLS.put("25", base + "25-substitution-of-parties");
        MASS_CIV_P_URLS.put("26", base + "26-general-provisions-governing-discovery");
        MASS_CIV_P_URLS.put("27", base + "27-depositions-before-action-or-pending-appeal");
        MASS_CIV_P_URLS.put("28", base + "28-persons-before-whom-depositions-may-be-taken");
        MASS_CIV_P_URLS.put("29", base + "29-stipulations-regarding-discovery-procedure");
        MASS_CIV_P_URLS.put("30", base + "30-depositions-upon-oral-examination");
        MASS_CIV_P_URLS.put("31", base + "31-depositions-of-witnesses-upon-written-questions");
        MASS_CIV_P_URLS.put("32", base + "32-use-of-depositions-in-court-proceedings");
        MASS_CIV_P_URLS.put("33", base + "33-interrogatories-to-parties");
        MASS_CIV_P_URLS.put("34", base + "34-producing-documents-electronically-stored-information-and-tangible-things-or-entering-onto-land-for-inspection-and-other-purposes");
        MASS_CIV_P_URLS.put("35", base + "35-physical-and-mental-examination-of-persons");
        MASS_CIV_P_URLS.put("36", base + "36-requests-for-admission");
        MASS_CIV_P_URLS.put("37", base + "37-failure-to-make-discovery-sanctions");
        MASS_CIV_P_URLS.put("38", base + "38-jury-trial-of-right");
        MASS_CIV_P_URLS.put("39", base + "39-trial-by-jury-or-by-the-court");
        MASS_CIV_P_URLS.put("40", base + "40-assignment-of-cases-for-trial-continuances");
        MASS_CIV_P_URLS.put("41", base + "41-dismissal-of-actions");
        MASS_CIV_P_URLS.put("42", base + "42-consolidation-separate-trials");
        MASS_CIV_P_URLS.put("43", base + "43-evidence");
        MASS_CIV_P_URLS.put("44", base + "44-proof-of-official-records");
        MASS_CIV_P_URLS.put("45", base + "45-subpoena");
        MASS_CIV_P_URLS.put("46", base + "46-exceptions-unnecessary");
        MASS_CIV_P_URLS.put("47", base + "47-jurors");
        MASS_CIV_P_URLS.put("48", base + "48-number-of-jurors-majority-verdict");
        MASS_CIV_P_URLS.put("49", base + "49-special-verdicts-and-interrogatories");
        MASS_CIV_P_URLS.put("50", base + "50-motion-for-a-directed-verdict-and-for-judgment-notwithstanding-the-verdict");
        MASS_CIV_P_URLS.put("51", base + "51-argument-instructions-to-jury");
        MASS_CIV_P_URLS.put("52", base + "52-findings-by-the-court");
        MASS_CIV_P_URLS.put("53", base + "53-masters");
        MASS_CIV_P_URLS.put("54", base + "54-judgments-costs");
        MASS_CIV_P_URLS.put("55", base + "55-default");
        MASS_CIV_P_URLS.put("56", base + "56-summary-judgment");
        MASS_CIV_P_URLS.put("57", base + "57-declaratory-judgment");
        MASS_CIV_P_URLS.put("58", base + "58-entry-of-judgment");
        MASS_CIV_P_URLS.put("59", base + "59-new-trials-amendment-of-judgments");
        MASS_CIV_P_URLS.put("60", base + "60-relief-from-judgment-or-order");
        MASS_CIV_P_URLS.put("61", base + "61-harmless-error");
        MASS_CIV_P_URLS.put("62", base + "62-stay-of-proceedings-to-enforce-a-judgment");
        MASS_CIV_P_URLS.put("63", base + "63-unavailability-of-a-judge-receipt-of-verdict");
        MASS_CIV_P_URLS.put("64", base + "64-report-of-case");
        MASS_CIV_P_URLS.put("65", base + "65-injunctions");
        MASS_CIV_P_URLS.put("66", base + "66-receivers");
        MASS_CIV_P_URLS.put("67", base + "67-deposit-in-court");
        MASS_CIV_P_URLS.put("68", base + "68-offer-of-judgment");
        MASS_CIV_P_URLS.put("69", base + "69-execution");
        MASS_CIV_P_URLS.put("70", base + "70-judgment-for-specific-acts-vesting-title");
        MASS_CIV_P_URLS.put("71", base + "71-process-in-behalf-of-and-against-persons-not-parties");
        MASS_CIV_P_URLS.put("77", base + "77-courts-and-clerks");
        MASS_CIV_P_URLS.put("78", base + "78-motion-day");
        MASS_CIV_P_URLS.put("79", base + "79-books-and-records-kept-by-the-clerk-and-entries-therein");
        MASS_CIV_P_URLS.put("80", base + "80-stenographic-report-or-transcript");
        MASS_CIV_P_URLS.put("81", base + "81-applicability-of-rules");
        MASS_CIV_P_URLS.put("82", base + "82-jurisdiction-and-venue-unaffected");
        MASS_CIV_P_URLS.put("83", base + "83-supplemental-rules");
        MASS_CIV_P_URLS.put("85", base + "85-title");
    }

    private static final String MASS_CIV_P_FALLBACK = "https://www.mass.gov/law-library/massachusetts-rules-of-civil-procedure";

    /**
     * Replace Mass. R. Civ. P. citations with per-rule URLs from the lookup map.
     * Must run BEFORE the main CITATION_URL_MAP loop (which only has the generic catch-all).
     */
    private String injectMassCivPUrls(String text) {
        Pattern pattern = Pattern.compile(
            "\\bMass\\.?\\s*R\\.?\\s*Civ\\.?\\s*P\\.?\\s*(\\d+)(\\s*(?:\\([a-zA-Z0-9]+\\))*)(?!\\]\\()",
            Pattern.CASE_INSENSITIVE
        );
        Matcher matcher = pattern.matcher(text);
        StringBuffer sb = new StringBuffer();
        while (matcher.find()) {
            String ruleNum = matcher.group(1);
            String subsection = matcher.group(2) != null ? matcher.group(2).trim() : "";
            String url = MASS_CIV_P_URLS.getOrDefault(ruleNum, MASS_CIV_P_FALLBACK);
            String display = "Mass. R. Civ. P. " + ruleNum + (subsection.isEmpty() ? "" : subsection);
            String replacement = "[" + display + "](" + url + ")";
            matcher.appendReplacement(sb, Matcher.quoteReplacement(replacement));
        }
        matcher.appendTail(sb);
        return sb.toString();
    }

    // Thread-local document context for matching sources against case documents
    private final ThreadLocal<List<CaseDocumentSummary>> documentContext = new ThreadLocal<>();
    private final ThreadLocal<String> caseIdContext = new ThreadLocal<>();

    /**
     * Inject with document context — matches sources against uploaded case documents.
     */
    public String inject(String response, String caseId, List<CaseDocumentSummary> documents) {
        try {
            if (documents != null && !documents.isEmpty()) {
                documentContext.set(documents);
                caseIdContext.set(caseId);
                log.info("🔗 CitationUrlInjector: {} case documents available for source matching", documents.size());
            }
            return inject(response);
        } finally {
            documentContext.remove();
            caseIdContext.remove();
        }
    }

    /**
     * Main injection method - scans response and adds URLs for known citations
     */
    public String inject(String response) {
        if (response == null || response.isBlank()) {
            return response;
        }

        log.info("🔗 CitationUrlInjector: Processing response ({} chars)", response.length());

        // Extract follow-up questions section BEFORE processing to avoid injecting HTML into it.
        // The frontend extracts these as plain text, so HTML tags would display as raw text.
        String mainContent = response;
        String followUpSection = "";
        Pattern followUpPattern = Pattern.compile("(##\\s*Follow-up Questions\\s*\\n[\\s\\S]*?)(?=\\n##|$)", Pattern.CASE_INSENSITIVE);
        Matcher followUpMatcher = followUpPattern.matcher(response);
        if (followUpMatcher.find()) {
            followUpSection = followUpMatcher.group(1);
            mainContent = response.substring(0, followUpMatcher.start()) + response.substring(followUpMatcher.end());
        }

        // Replace Justia URLs with CourtListener — AI sometimes generates justia links from training data
        mainContent = mainContent.replaceAll("https?://law\\.justia\\.com/[^)\\s\"]+", "https://www.courtlistener.com/");

        // Extract SOURCES line BEFORE pattern matching to prevent
        // the main regex loop from mangling the structured marker with partial replacements.
        String sourcesLine = "";
        String processed = mainContent;

        // Strip any leftover KEY_ELEMENTS marker (no longer used)
        processed = processed.replaceAll("(?m)^KEY_ELEMENTS:\\s*.+$\\n?", "");

        Pattern srcPat = Pattern.compile("^(SOURCES:\\s*.+)$", Pattern.MULTILINE);
        Matcher srcMat = srcPat.matcher(processed);
        if (srcMat.find()) {
            sourcesLine = srcMat.group(1);
            processed = processed.substring(0, srcMat.start()) + processed.substring(srcMat.end());
        }

        // Inject per-rule URLs for Mass. R. Civ. P. (lookup-based, runs before generic patterns)
        processed = injectMassCivPUrls(processed);

        // Run pattern matching only on prose content (markers are safely extracted)
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

        // Convert prose markdown links to HTML <a> tags
        processed = convertMarkdownLinksToHtml(processed);

        // Now enrich the SOURCES line separately (clean, unmangled by the main loop)
        if (!sourcesLine.isEmpty()) {
            sourcesLine = injectMassCivPUrls(sourcesLine);
            sourcesLine = enrichSourcesLine(sourcesLine);
            sourcesLine = convertMarkdownLinksToHtml(sourcesLine);
        }

        // Re-insert SOURCES marker at the end of prose (before follow-up questions)
        String markers = "";
        if (!sourcesLine.isEmpty()) {
            markers += "\n" + sourcesLine;
        }
        processed = processed.trim() + markers;

        // Re-append the unmodified follow-up section (no HTML tags, just plain text)
        if (!followUpSection.isEmpty()) {
            processed = processed.trim() + "\n\n" + followUpSection;
        }

        return processed;
    }

    /**
     * Enrich the SOURCES: marker line with URLs from CITATION_URL_MAP.
     * Input:  "SOURCES: Brune v. Belinkoff, 354 Mass. 102 | M.G.L. c. 231 § 60B"
     * Output: "SOURCES: [Brune v. Belinkoff, 354 Mass. 102](url) | [M.G.L. c. 231 § 60B](url)"
     */
    private String enrichSourcesLine(String text) {
        Pattern sourcesPattern = Pattern.compile("^(SOURCES:\\s*)(.+)$", Pattern.MULTILINE);
        Matcher sourcesMatcher = sourcesPattern.matcher(text);
        if (!sourcesMatcher.find()) {
            return text;
        }

        String prefix = sourcesMatcher.group(1);
        String sourcesContent = sourcesMatcher.group(2);
        String[] sources = sourcesContent.split("\\s*\\|\\s*");
        StringBuilder enriched = new StringBuilder(prefix);

        for (int i = 0; i < sources.length; i++) {
            String source = sources[i].trim();
            if (source.isEmpty()) continue;

            // Skip if already a complete markdown link [text](url)
            if (source.startsWith("[") && source.contains("](")) {
                enriched.append(source);
            } else {
                // Strip bare brackets — AI sometimes outputs [Citation] without URL
                if (source.startsWith("[") && source.endsWith("]")) {
                    source = source.substring(1, source.length() - 1);
                } else if (source.startsWith("[")) {
                    source = source.substring(1);
                }
                // Try to match against CITATION_URL_MAP
                String matched = matchCitationUrl(source);
                if (matched != null) {
                    enriched.append(matched);
                } else {
                    // Try to match against uploaded case documents
                    String docMatch = matchCaseDocument(source);
                    if (docMatch != null) {
                        enriched.append(docMatch);
                    } else {
                        // Fallback: CourtListener search (better than Google Scholar for legal documents)
                        String encoded = source.trim().replaceAll("\\s+", "+");
                        enriched.append("[" + source + "](https://www.courtlistener.com/?q=" + encoded + "&type=o)");
                    }
                }
            }

            if (i < sources.length - 1) {
                enriched.append(" | ");
            }
        }

        return text.substring(0, sourcesMatcher.start()) + enriched.toString() + text.substring(sourcesMatcher.end());
    }

    /**
     * Try to match a single citation string against CITATION_URL_MAP.
     * Returns the markdown link replacement if found, null otherwise.
     */
    private String matchCitationUrl(String citation) {
        for (Map.Entry<Pattern, String> entry : CITATION_URL_MAP.entrySet()) {
            Matcher matcher = entry.getKey().matcher(citation);
            if (matcher.find()) {
                return matcher.replaceAll(entry.getValue());
            }
        }
        return null;
    }

    /**
     * Try to match a source string against uploaded case documents.
     * Uses fuzzy matching: checks if the document name is contained in the source or vice versa.
     * Returns a casedoc: protocol link for frontend to handle, or null.
     */
    private String matchCaseDocument(String source) {
        List<CaseDocumentSummary> docs = documentContext.get();
        String caseId = caseIdContext.get();
        if (docs == null || docs.isEmpty() || caseId == null) return null;

        String sourceLower = source.toLowerCase().trim();

        // Try exact name match first, then fuzzy containment
        for (CaseDocumentSummary doc : docs) {
            String docName = doc.getName();
            if (docName == null) continue;
            String docNameLower = docName.toLowerCase().trim();

            // Strip file extension for matching (e.g., "Medical Records.pdf" → "Medical Records")
            String docNameNoExt = docNameLower.replaceAll("\\.[a-z]{2,5}$", "").trim();

            if (sourceLower.equals(docNameLower) || sourceLower.equals(docNameNoExt)
                || sourceLower.contains(docNameNoExt) || docNameNoExt.contains(sourceLower)) {
                log.info("📄 Matched source '{}' → case document ID {} ({})", source, doc.getId(), docName);
                return "[" + source + "](casedoc:" + caseId + ":" + doc.getId() + ")";
            }
        }
        return null;
    }

    /**
     * Convert markdown links [text](url) to HTML anchor tags.
     * Runs AFTER all pattern matching so every injected markdown link becomes an <a> tag.
     * This eliminates frontend markdown parsing failures with citation parentheses.
     */
    private String convertMarkdownLinksToHtml(String text) {
        // Match both http/https URLs and casedoc: protocol links
        Pattern mdLinkPattern = Pattern.compile(
            "\\[([^\\]]+)\\]\\(((?:https?://|casedoc:)[^)\\s]+)\\)"
        );
        Matcher matcher = mdLinkPattern.matcher(text);
        StringBuffer sb = new StringBuffer();
        while (matcher.find()) {
            String linkText = matcher.group(1);
            String url = matcher.group(2);
            String htmlLink;
            if (url.startsWith("casedoc:")) {
                // Case document link — render with data attribute for frontend click handling
                htmlLink = "<a href=\"#\" data-casedoc=\"" + Matcher.quoteReplacement(url.substring(8))
                    + "\" class=\"legal-link doc-link\" onclick=\"return false;\">"
                    + Matcher.quoteReplacement(linkText) + "</a>";
            } else {
                htmlLink = "<a href=\"" + Matcher.quoteReplacement(url)
                    + "\" target=\"_blank\" rel=\"noopener noreferrer\" class=\"legal-link\">"
                    + Matcher.quoteReplacement(linkText) + "</a>";
            }
            matcher.appendReplacement(sb, Matcher.quoteReplacement(htmlLink));
        }
        matcher.appendTail(sb);
        return sb.toString();
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
