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
        // Mass. R. Crim. P. with rule number and any subsections: Mass. R. Crim. P. 13(a)(2)(B)
        CITATION_URL_MAP.put(
            Pattern.compile("\\bMass\\.?\\s*R\\.?\\s*Crim\\.?\\s*P\\.?\\s*(\\d+)\\s*((?:\\([a-zA-Z0-9]+\\))*)(?!\\]\\()", Pattern.CASE_INSENSITIVE),
            "[Mass. R. Crim. P. $1$2](https://www.mass.gov/law-library/massachusetts-rules-of-criminal-procedure)"
        );

        // Generic catch-all (no rule number) — (?!\s*\d) prevents matching when a rule number follows
        CITATION_URL_MAP.put(
            Pattern.compile("\\bMass\\.?\\s*R\\.?\\s*Crim\\.?\\s*P\\.?(?!\\s*\\d)(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[Mass. R. Crim. P.](https://www.mass.gov/law-library/massachusetts-rules-of-criminal-procedure)"
        );

        // Massachusetts Rules of Civil Procedure — SPECIFIC (with rule number) BEFORE generic
        // Mass. R. Civ. P. with rule number and any subsections: Mass. R. Civ. P. 26(b)(5)(A)
        CITATION_URL_MAP.put(
            Pattern.compile("\\bMass\\.?\\s*R\\.?\\s*Civ\\.?\\s*P\\.?\\s*(\\d+)\\s*((?:\\([a-zA-Z0-9]+\\))*)(?!\\]\\()", Pattern.CASE_INSENSITIVE),
            "[Mass. R. Civ. P. $1$2](https://www.mass.gov/law-library/massachusetts-rules-of-civil-procedure)"
        );

        // Generic catch-all (no rule number) — (?!\s*\d) prevents matching when a rule number follows
        CITATION_URL_MAP.put(
            Pattern.compile("\\bMass\\.?\\s*R\\.?\\s*Civ\\.?\\s*P\\.?(?!\\s*\\d)(?! - Source:)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[Mass. R. Civ. P.](https://www.mass.gov/law-library/massachusetts-rules-of-civil-procedure)"
        );

        // ===== MASSACHUSETTS STATUTES (GENERIC PATTERNS) =====

        // M.G.L. chapter with complex subsections: M.G.L. c. 90, § 24(1)(f)(1), M.G.L. c. 176D, § 3(9)
        // Note: Chapter can have letter suffix (90, 90A, 90B, 93A, 176D, etc.)
        CITATION_URL_MAP.put(
            Pattern.compile("\\bM\\.G\\.L\\.\\s*c\\.\\s*(\\d+[A-Z]?),?\\s*§§?\\s*(\\d+(?:\\([a-zA-Z0-9]+\\))*)(?! - Source:)(?! - View)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[M.G.L. c. $1, § $2](https://malegislature.gov/Laws/GeneralLaws)"
        );

        // M.G.L. chapter only (no section): M.G.L. c. 90, M.G.L. c. 176D
        CITATION_URL_MAP.put(
            Pattern.compile("\\bM\\.G\\.L\\.\\s*c\\.\\s*(\\d+[A-Z]?)(?!\\s*,?\\s*§)(?! - Source:)(?! - View)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[M.G.L. c. $1](https://malegislature.gov/Laws/GeneralLaws)"
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
            "[Tax Court Rule $1](https://www.ustaxcourt.gov/rules.html)"
        );

        // ===== FEDERAL COURT RULES (uscourts.gov — official source) =====

        // FRCP abbreviation: FRCP 8(a), FRCP 12(b)(6)
        CITATION_URL_MAP.put(
            Pattern.compile("\\bFRCP\\s*(\\d+)(?:\\(([a-z0-9()]+)\\))?(?! - Source:)(?! - View)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[FRCP $1](https://www.uscourts.gov/forms-rules/current-rules-practice-procedure/federal-rules-civil-procedure)"
        );

        // FRCrP abbreviation: FRCrP 12(b), FRCrP 16(a)(1)
        CITATION_URL_MAP.put(
            Pattern.compile("\\bFRCrP\\s*(\\d+)(?:\\(([a-z0-9()]+)\\))?(?! - Source:)(?! - View)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[FRCrP $1](https://www.uscourts.gov/forms-rules/current-rules-practice-procedure/federal-rules-criminal-procedure)"
        );

        // Federal Rules of Civil Procedure: Fed. R. Civ. P. 56(c)
        CITATION_URL_MAP.put(
            Pattern.compile("\\bFed\\.?\\s*R\\.?\\s*Civ\\.?\\s*P\\.?\\s*(\\d+)(?:\\(([a-z])\\))?(?! - Source:)(?! - View)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[Fed. R. Civ. P. $1](https://www.uscourts.gov/forms-rules/current-rules-practice-procedure/federal-rules-civil-procedure)"
        );

        // Federal Rules of Criminal Procedure: Fed. R. Crim. P. 12(b)
        CITATION_URL_MAP.put(
            Pattern.compile("\\bFed\\.?\\s*R\\.?\\s*Crim\\.?\\s*P\\.?\\s*(\\d+)(?:\\(([a-z])\\))?(?! - Source:)(?! - View)(?!\\]\\(http)", Pattern.CASE_INSENSITIVE),
            "[Fed. R. Crim. P. $1](https://www.uscourts.gov/forms-rules/current-rules-practice-procedure/federal-rules-criminal-procedure)"
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

        String processed = mainContent;
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

        // Convert all markdown links [text](url) to HTML <a> tags
        // This prevents frontend markdown parsing conflicts with citation parentheses
        // Enrich SOURCES: marker line with URLs from citation map
        processed = enrichSourcesLine(processed);

        processed = convertMarkdownLinksToHtml(processed);

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

            // Skip if already a markdown link
            if (source.startsWith("[") && source.contains("](")) {
                enriched.append(source);
            } else {
                // Try to match against CITATION_URL_MAP
                String matched = matchCitationUrl(source);
                enriched.append(matched != null ? matched : source);
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
     * Convert markdown links [text](url) to HTML anchor tags.
     * Runs AFTER all pattern matching so every injected markdown link becomes an <a> tag.
     * This eliminates frontend markdown parsing failures with citation parentheses.
     */
    private String convertMarkdownLinksToHtml(String text) {
        Pattern mdLinkPattern = Pattern.compile(
            "\\[([^\\]]+)\\]\\((https?://[^)\\s]+)\\)"
        );
        Matcher matcher = mdLinkPattern.matcher(text);
        StringBuffer sb = new StringBuffer();
        while (matcher.find()) {
            String linkText = matcher.group(1);
            String url = matcher.group(2);
            String htmlLink = "<a href=\"" + Matcher.quoteReplacement(url)
                + "\" target=\"_blank\" rel=\"noopener noreferrer\" class=\"legal-link\">"
                + Matcher.quoteReplacement(linkText) + "</a>";
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
