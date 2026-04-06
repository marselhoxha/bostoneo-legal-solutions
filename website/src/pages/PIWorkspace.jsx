import Icon from "../components/ui/Icon"
import { useState } from "react"
import { Link } from "react-router-dom"
import { Helmet } from "react-helmet-async"
import { motion } from "framer-motion"
import PageHero from "../components/ui/PageHero"
import SectionHead from "../components/ui/SectionHead"
import { mockup_settlement, mockup_doc_checklist, mockup_case_detail } from "../assets/mockups"

const piWorkspaceSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Legience PI Workspace",
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "Personal Injury Case Management Software",
  operatingSystem: "Web",
  url: "https://legience.com/pi-workspace",
  description: "All-in-one PI workspace: AI demand letters at $0/case, medical records analysis, settlement tracking, document checklist & damage calculator. Purpose-built for personal injury firms.",
  offers: {
    "@type": "AggregateOffer",
    lowPrice: "99",
    highPrice: "249",
    priceCurrency: "USD",
    offerCount: 3,
  },
  featureList: "AI Damage Calculator, Document Checklist & Tracking, Settlement Negotiation Tracker, PI Case Overview Dashboard, AI Demand Letters, Medical Records Analysis, Comparable Case Analysis",
  publisher: { "@type": "Organization", name: "Legience", url: "https://legience.com" },
}

const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } } }
const stagger = { visible: { transition: { staggerChildren: 0.08 } } }

const piTools = [
  {
    id: "damage-calc",
    icon: "ri-calculator-line",
    label: "Damage Calculator",
    title: "AI-Powered Damage Calculator",
    desc: "Track economic damages (medical expenses, lost wages, mileage, household services) and non-economic damages (pain & suffering). Billing data auto-syncs from extracted medical records. AI provides comparable case analysis and settlement range recommendations (low/mid/high).",
    bullets: ["Economic damages auto-populated from extracted billing data", "Non-economic pain & suffering with configurable multipliers and per diem", "AI-driven comparable case analysis from relevant precedents", "Settlement range recommendations: low / mid / high with confidence levels", "One-click export to LegiDraft™ for demand letter generation"],
    mockup: `<div style="background:#0f1629;border-radius:12px;overflow:hidden;font-family:system-ui,sans-serif;color:#fff;border:1px solid rgba(255,255,255,0.04)">
<div style="padding:16px">
<div style="font-size:13px;font-weight:700;margin-bottom:2px">Damage Calculator</div>
<div style="font-size:8px;color:rgba(255,255,255,0.5);margin-bottom:14px">Economic + non-economic with AI settlement analysis</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
<div>
<div style="font-size:8px;font-weight:600;color:#38b6ff;margin-bottom:6px">Economic Damages</div>
<div style="display:flex;flex-direction:column;gap:4px;margin-bottom:10px">
<div style="display:flex;justify-content:space-between;padding:6px 8px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);border-radius:5px"><span style="font-size:8px;color:rgba(255,255,255,0.7)">Medical Expenses</span><span style="font-size:8px;font-weight:700;color:#0ab39c">$18,450</span></div>
<div style="display:flex;justify-content:space-between;padding:6px 8px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);border-radius:5px"><span style="font-size:8px;color:rgba(255,255,255,0.7)">Future Medical (est.)</span><span style="font-size:8px;font-weight:700;color:#f59e0b">$8,200</span></div>
<div style="display:flex;justify-content:space-between;padding:6px 8px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);border-radius:5px"><span style="font-size:8px;color:rgba(255,255,255,0.7)">Lost Wages</span><span style="font-size:8px;font-weight:700">$6,400</span></div>
<div style="display:flex;justify-content:space-between;padding:6px 8px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);border-radius:5px"><span style="font-size:8px;color:rgba(255,255,255,0.7)">Mileage (142 trips)</span><span style="font-size:8px;font-weight:700">$940</span></div>
</div>
<div style="font-size:8px;font-weight:600;color:#a78bfa;margin-bottom:6px">Non-Economic Damages</div>
<div style="display:flex;flex-direction:column;gap:4px">
<div style="display:flex;justify-content:space-between;padding:6px 8px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);border-radius:5px"><span style="font-size:8px;color:rgba(255,255,255,0.7)">Pain & Suffering (2.5x)</span><span style="font-size:8px;font-weight:700;color:#a78bfa">$46,125</span></div>
<div style="display:flex;justify-content:space-between;padding:6px 8px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);border-radius:5px"><span style="font-size:8px;color:rgba(255,255,255,0.7)">Per Diem ($150 × 180d)</span><span style="font-size:8px;font-weight:700;color:#a78bfa">$27,000</span></div>
</div>
<div style="margin-top:10px;padding:10px;background:rgba(56,182,255,0.04);border:1px solid rgba(56,182,255,0.1);border-radius:8px;text-align:center">
<div style="font-size:7px;color:rgba(255,255,255,0.5);text-transform:uppercase">Total Demand Value</div>
<div style="font-size:20px;font-weight:800;color:#38b6ff;margin-top:2px">$107,115</div>
</div>
</div>
<div>
<div style="font-size:8px;font-weight:600;color:#f59e0b;margin-bottom:6px">AI Settlement Analysis</div>
<div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);border-radius:8px;padding:10px;margin-bottom:8px">
<div style="font-size:7px;color:rgba(255,255,255,0.5);margin-bottom:6px">Recommended Settlement Range</div>
<div style="display:flex;gap:6px;margin-bottom:8px">
<div style="flex:1;text-align:center;padding:8px;background:rgba(240,101,72,0.04);border-radius:5px"><div style="font-size:6px;color:#f06548;text-transform:uppercase">Low</div><div style="font-size:12px;font-weight:800;margin-top:2px">$35K</div></div>
<div style="flex:1;text-align:center;padding:8px;background:rgba(56,182,255,0.04);border:1px solid rgba(56,182,255,0.1);border-radius:5px"><div style="font-size:6px;color:#38b6ff;text-transform:uppercase">Mid (Recommended)</div><div style="font-size:12px;font-weight:800;color:#38b6ff;margin-top:2px">$52K</div></div>
<div style="flex:1;text-align:center;padding:8px;background:rgba(10,179,156,0.04);border-radius:5px"><div style="font-size:6px;color:#0ab39c;text-transform:uppercase">High</div><div style="font-size:12px;font-weight:800;margin-top:2px">$72K</div></div>
</div>
<div style="height:6px;background:rgba(255,255,255,0.04);border-radius:3px;position:relative;margin-bottom:4px"><div style="position:absolute;left:25%;right:25%;height:100%;background:linear-gradient(90deg,#f06548,#38b6ff,#0ab39c);border-radius:3px;opacity:0.3"></div><div style="position:absolute;left:45%;width:8px;height:8px;background:#38b6ff;border-radius:50%;top:-1px;box-shadow:0 0 6px rgba(56,182,255,0.4)"></div></div>
<div style="font-size:6px;color:rgba(255,255,255,0.55);display:flex;justify-content:space-between"><span>$0</span><span>$100K+</span></div>
</div>
<div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);border-radius:8px;padding:10px">
<div style="font-size:7px;color:rgba(255,255,255,0.6);margin-bottom:6px">Comparable Cases</div>
<div style="display:flex;flex-direction:column;gap:4px">
<div style="padding:5px 6px;background:rgba(255,255,255,0.02);border-radius:4px"><div style="font-size:7px;font-weight:600;color:rgba(255,255,255,0.6)">Sullivan v. State Farm (2024)</div><div style="font-size:6px;color:rgba(255,255,255,0.5)">Cervical sprain, rear-end — Settled $48,000</div></div>
<div style="padding:5px 6px;background:rgba(255,255,255,0.02);border-radius:4px"><div style="font-size:7px;font-weight:600;color:rgba(255,255,255,0.6)">Martinez v. Liberty Mutual (2023)</div><div style="font-size:6px;color:rgba(255,255,255,0.5)">Soft tissue, I-93 — Settled $55,000</div></div>
<div style="padding:5px 6px;background:rgba(255,255,255,0.02);border-radius:4px"><div style="font-size:7px;font-weight:600;color:rgba(255,255,255,0.6)">Chen v. MAPFRE (2024)</div><div style="font-size:6px;color:rgba(255,255,255,0.5)">Whiplash + disc — Settled $62,000</div></div>
</div>
</div>
<div style="margin-top:8px"><span style="font-size:7px;padding:4px 10px;border-radius:5px;background:#0ab39c;color:#fff;font-weight:600;cursor:pointer">Send to LegiDraft™ →</span></div>
</div>
</div>
</div>
</div>`,
  },
  {
    id: "doc-checklist",
    icon: "ri-checkbox-circle-line",
    label: "Document Checklist",
    title: "Document Checklist & Tracking",
    desc: "Track every required document across your PI case — police reports, medical records, bills, wage documentation, insurance papers, photos, and witness statements. Status workflow moves documents from missing → requested → received with overdue alerts and completeness scoring.",
    bullets: ["Visual completeness score (0–100%) at a glance", "Status workflow: Missing → Requested → Received with timestamps", "Overdue alerts for documents not received within expected timeframes", "One-click Email/SMS request to providers, employers, or clients", "Categorized by type: Police, Medical, Bills, Insurance, Wages, Photos"],
    mockupKey: "mockup_doc_checklist",
  },
  {
    id: "settlement",
    icon: "ri-money-dollar-circle-line",
    label: "Settlement Tracker",
    title: "Settlement Negotiation Tracker",
    desc: "Full negotiation timeline tracking every demand, offer, and counter-offer with dates, amounts, and notes. Visual timeline shows the progression of negotiations. Negotiation gap analysis shows how close you are to settlement.",
    bullets: ["Log demands, offers, and counter-offers with timestamps", "Visual timeline showing negotiation progression", "Negotiation gap analysis — see the spread at a glance", "Notes field for recording conversation details and strategy", "Save negotiations directly to the case record"],
    mockupKey: "mockup_settlement",
  },
  {
    id: "case-overview",
    icon: "ri-bar-chart-box-line",
    label: "Case Overview",
    title: "PI Case Overview Dashboard",
    desc: "Complete case snapshot with case value, medical totals, days since injury, settlement status, and all party information. The tabbed interface gives instant access to Summary, Valuation, Documents, Settlement, and Medical sections.",
    bullets: ["At-a-glance KPIs: case value, medical total, days since injury, settlement", "Complete party info: client, defendant, carrier, adjuster", "5-tab navigation: Summary, Valuation, Documents, Settlement, Medical", "Policy limit tracking with automatic alert when damages approach limits", "Case timeline from injury date through resolution"],
    mockupKey: "mockup_case_detail",
  },
]


function Ic({c,s}){return c&&c.startsWith("ri-")?<Icon name={c} size={20} style={s||{}} />:<span style={s||{}}>{c}</span>}

export default function PIWorkspace() {
  const [activeTab, setActiveTab] = useState(0)
  const tool = piTools[activeTab]

  return <>
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(piWorkspaceSchema)}</script>
    </Helmet>
    <PageHero badge="Personal Injury Workspace" title="Purpose-Built Tools for" gradient="PI Attorneys." subtitle="Four specialized modules that no general practice management software offers — damage calculators, document tracking, settlement negotiation, and comprehensive case overviews." />

    {/* Tool Tabs */}
    <section className="section" style={{ background: "#fff", paddingBottom: 0 }}>
      <div className="container">
        <motion.div className="tabs tabs--center" style={{ marginBottom: 0 }} initial="hidden" animate="visible" variants={stagger}>
          {piTools.map((t, i) => (
            <motion.button key={i} variants={fadeUp} className={`tab ${activeTab === i ? "tab--active" : ""}`} onClick={() => setActiveTab(i)}><Ic c={t.icon} /> {t.label}</motion.button>
          ))}
        </motion.div>
      </div>
    </section>

    {/* Active Tool Detail */}
    <section className="section" style={{ background: "#fff", paddingTop: 32 }}>
      <div className="container">
        <div key={activeTab} className="fd-grid" style={{ gap: 40, alignItems: "start" }}>
          <div>
            <span className="label" style={{ marginBottom: 12 }}>{tool.label}</span>
            <h2 className="h2" style={{ marginTop: 12, fontSize: "1.6rem" }}>{tool.title}</h2>
            <p style={{ marginTop: 12, fontSize: "0.9rem", color: "var(--gray-500)", lineHeight: 1.7 }}>{tool.desc}</p>
            <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 8 }}>
              {tool.bullets.map((b, j) => (
                <div key={j} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: "0.85rem", color: "var(--gray-500)" }}>
                  <span style={{ color: "var(--accent)", fontWeight: 700, flexShrink: 0 }}>✓</span>{b}
                </div>
              ))}
            </div>
            <Link to="/contact" className="btn btn--primary" style={{ marginTop: 24 }}>Apply for Early Access →</Link>
          </div>
          <div style={{ borderRadius: 16, overflow: "hidden", boxShadow: "0 20px 60px -12px rgba(0,0,0,0.15)" }}>
            {tool.mockupKey ? (
              <div dangerouslySetInnerHTML={{ __html: tool.mockupKey === "mockup_settlement" ? mockup_settlement : tool.mockupKey === "mockup_doc_checklist" ? mockup_doc_checklist : mockup_case_detail }} />
            ) : (
              <div dangerouslySetInnerHTML={{ __html: tool.mockup }} />
            )}
          </div>
        </div>
      </div>
    </section>

    {/* Key Differentiators */}
    <section className="section section--dark"><div className="bg-grid" /><div className="bg-noise" />
      <div className="container" style={{ position: "relative", zIndex: 1 }}>
        <SectionHead badge="Why Legience PI Tools" title="What Makes This Different" subtitle="No other platform combines AI-powered medical record extraction with damage calculations and settlement tracking." light />
        <motion.div
          className="feat-grid feat-grid--3col"
          style={{ gap: 16 }}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
        >
          {[
            ["ri-robot-line", "AI Extracts from Messy PDFs", "Upload scanned records, handwritten notes, faxed documents. AI handles it all — no manual data entry required."],
            ["ri-file-line", "Citations for Every Data Point", "Every extracted diagnosis, billing amount, and clinical note includes the exact page number and excerpt for attorney verification."],
            ["ri-link", "Auto-Populating Damages", "Billing amounts extracted from medical records flow directly into the damage calculator. No double entry."],
            ["ri-bar-chart-box-line", "AI Settlement Ranges", "Comparable case analysis from relevant PI precedents generates low/mid/high settlement recommendations with confidence levels."],
            ["ri-file-text-line", "One-Click Demand Narratives", "AI Medical Summary generates the medical narrative section of your demand letter. Send directly to LegiDraft™."],
            ["$0", "Zero Per-Case Fees", "EvenUp charges $300–800 per demand. Precedent charges $275. Legience includes everything in your subscription."],
          ].map(([icon, title, desc], i) => (
            <motion.div key={i} variants={fadeUp} className="diff-card"
              style={{ padding: "20px 16px", borderRadius: 14, display: "flex", gap: 14, alignItems: "flex-start" }}>
              <span style={{ fontSize: "1.3rem", flexShrink: 0, marginTop: 2 }}><Ic c={icon} /></span>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "rgba(255,255,255,0.85)" }}>{title}</div>
                <p style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.55)", marginTop: 6, lineHeight: 1.6 }}>{desc}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>

    {/* CTA */}
    <section className="section" style={{ background: "#fff" }}>
      <div className="container" style={{ textAlign: "center" }}>
        <SectionHead badge="Get Started" title="See PI Tools in Action" subtitle="Apply for early access to get full access to every PI workspace tool — damage calculator, document checklist, settlement tracker, and case overview." />
        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
          <Link to="/contact" className="btn btn--primary btn--lg btn--pulse">Apply for Early Access →</Link>
        </motion.div>
      </div>
    </section>
  </>
}
