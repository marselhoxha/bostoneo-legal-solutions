import Icon from "../components/ui/Icon"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import PageHero from "../components/ui/PageHero"
import SectionHead from "../components/ui/SectionHead"
import MockupShowcase from "../components/mockups/MockupShowcase"
import { mockup_cases, mockup_ai_workspace, mockup_analytics } from "../assets/mockups"

const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } } }

const piTools = [
  { icon: "ri-file-text-line", title: "LegiDraft™ Demand Letters", desc: "AI generates comprehensive demand packages — medical summaries, damage calculations, liability analysis. Included in your plan's query allocation.", stat: "Incl.", statLabel: "in plan", vs: "EvenUp: $500+" },
  { icon: "ri-hospital-line", title: "Medical Records AI", desc: "Upload records for AI summaries, treatment timelines, injury categorization. Auto-identify documentation gaps.", stat: "20 min", statLabel: "vs 3+ hours", vs: "Manual review" },
  { icon: "ri-calculator-line", title: "Damage Calculator", desc: "Economic and non-economic damages with jurisdiction-specific multipliers, per diem methods, loss of consortium.", stat: "5x", statLabel: "faster", vs: "Spreadsheets" },
  { icon: "ri-line-chart-line", title: "Settlement Tracker", desc: "Track negotiations from first demand to resolution. Log offers, counteroffers, analyze patterns.", stat: "31%", statLabel: "faster close", vs: "Industry avg" },
  { icon: "ri-stethoscope-line", title: "Treatment Timeline", desc: "Visual timeline of every medical visit, procedure, diagnostic. Auto-calculate gaps and total expenses.", stat: "100%", statLabel: "documented", vs: "Manual tracking" },
  { icon: "ri-search-line", title: "Insurance Coverage AI", desc: "Analyze policies, identify limits, stack coverage, assess UIM/UM availability.", stat: "$47K", statLabel: "avg. more", vs: "Missed coverage" },
]

const caseTypes = [
  { icon: "ri-car-line", title: "Auto Accidents", desc: "From rear-end collisions to multi-vehicle pileups — automated police report extraction, PIP coordination, and property damage tracking.", color: "linear-gradient(135deg, #1e56b6, #38b6ff)", accent: "#38b6ff", stat: "40%", statLabel: "of all PI cases", features: ["Police report AI extraction", "Multi-vehicle tracking", "PIP/MedPay coordination", "Property damage + BI combined", "UM/UIM coverage analysis", "Accident reconstruction docs"] },
  { icon: "ri-building-line", title: "Premises Liability", desc: "Slip-and-fall, negligent security, hazardous conditions — with notice requirement tracking and building code violation research.", color: "linear-gradient(135deg, #059669, #34d399)", accent: "#34d399", stat: "15%", statLabel: "of all PI cases", features: ["Property inspection records", "Building code violation research", "Notice requirement tracking", "Prior incident analysis", "Surveillance footage logging", "Maintenance record requests"] },
  { icon: "ri-hammer-line", title: "Work Injuries", desc: "Workers' comp and third-party claims together — OSHA research, employer liability, and wage documentation all in one file.", color: "linear-gradient(135deg, #d97706, #fbbf24)", accent: "#fbbf24", stat: "20%", statLabel: "of all PI cases", features: ["Workers' comp + third-party coordination", "OSHA violation research", "Employer liability analysis", "Lost wage calculations", "Vocational rehab tracking", "Safety regulation lookups"] },
  { icon: "ri-hospital-line", title: "Medical Malpractice", desc: "Standard of care research, expert witness coordination, and multi-provider chronologies — the most document-intensive PI category, simplified.", color: "linear-gradient(135deg, #7c3aed, #a78bfa)", accent: "#a78bfa", stat: "8%", statLabel: "of all PI cases", features: ["Standard of care AI research", "Expert witness database", "Medical chronology generation", "Multi-provider tracking", "Informed consent analysis", "Peer-reviewed literature search"] },
]


const comingSoonAreas = [
  { icon: "ri-group-line", title: "Family Law", desc: "Divorce, custody, child support, prenuptial agreements" },
  { icon: "ri-scales-3-line", title: "Employment Law", desc: "Wrongful termination, discrimination, wage disputes" },
  { icon: "ri-building-line", title: "Real Estate Law", desc: "Property transactions, title disputes, landlord-tenant" },
  { icon: "ri-globe-line", title: "Immigration Law", desc: "Visas, green cards, asylum, citizenship" },
  { icon: "ri-shield-line", title: "Criminal Law", desc: "Defense strategy, case tracking, plea negotiations" },
]

function Ic({c,s}){return c&&c.startsWith("ri-")?<Icon name={c} size={20} style={s||{}} />:<span style={s||{}}>{c}</span>}

export default function PracticeAreas() {
  return <>
    <PageHero badge="Practice Areas" title="Specialized Tools for" gradient="Every Practice Area." subtitle="Legience builds practice-specific workflows, AI tools, and case management features tailored to how your firm actually works — with deep specialization in Personal Injury and expanding to Family Law, Business Litigation, and more." />

    {/* Case Lifecycle with Mockup */}
    <section className="section"><div className="container">
      <div className="feature-showcase reveal">
        <div className="feature-showcase__content">
          <div className="feature-showcase__eyebrow"><div className="feature-showcase__eyebrow-num">★</div> Featured: Personal Injury</div>
          <h2 className="feature-showcase__title">Case Management Built for Personal Injury</h2>
          <p className="feature-showcase__desc">Unlike Clio or MyCase, Legience doesn't force you to adapt a generic tool. Every field, workflow, and dashboard is designed around how PI firms actually work — insurance carrier tracking, SOL calculators, lien management, and treatment timelines are native, not add-ons.</p>
          <div className="feature-showcase__bullets">
            {["PI case types: Auto, Premises, Work Injury, Med Mal, Product Liability", "Status tracking: Pre-lit, Lit, Discovery, Mediation, Trial, Settlement", "Insurance fields: carrier, adjuster, policy limits, claim numbers", "Statute of limitations with automatic state-specific deadline alerts", "Lien tracking: Medicare, Medicaid, health insurance subrogation"].map((b, j) => <div key={j} className="feature-showcase__bullet"><div className="feature-showcase__bullet-check">✓</div>{b}</div>)}
          </div>
        </div>
        <div className="feature-showcase__visual">
          <MockupShowcase html={mockup_cases} label="PI Case Dashboard" caption="Case list with PI-specific statuses, priorities, and insurance tracking." glow />
        </div>
      </div>
    </div></section>

    {/* PI-Specific Tools — Dark section with grid */}
    <section className="section section--dark"><div className="bg-grid" /><div className="bg-noise" />
      <div className="container" style={{ position: "relative", zIndex: 1 }}>
        <SectionHead badge="PI-Specific" title="Tools That Clio and MyCase Don't Have" subtitle="Specialized personal injury features built from scratch — not generic modules adapted for PI." light />
        <motion.div style={{ gap: 16 }} className="feat-grid feat-grid--3col" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={{ visible: { transition: { staggerChildren: 0.06 } } }}>
          {piTools.map((t, i) => (
            <motion.div key={i} variants={fadeUp} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "24px 22px", transition: "all 0.35s", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, var(--accent-light), transparent)" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                <span style={{ fontSize: "1.5rem" }}><Ic c={t.icon} /></span>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--accent-light)" }}>{t.stat}</div>
                  <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.5)" }}>{t.statLabel}</div>
                </div>
              </div>
              <div style={{ fontWeight: 700, color: "#fff", fontSize: "0.95rem" }}>{t.title}</div>
              <p style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.6)", marginTop: 6, lineHeight: 1.65 }}>{t.desc}</p>
              <div style={{ marginTop: 12, padding: "6px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 6, fontSize: "0.68rem", color: "rgba(255,255,255,0.45)" }}>vs. {t.vs}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>

    {/* Case Types — Premium cards on white */}
    <section className="section" style={{ background: "#fff" }}><div className="container">
      <SectionHead badge="Case Types" title="Specialized for Every PI Category" subtitle="Custom workflows, document checklists, AI research prompts, and deadline calculators for each injury type." />
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {caseTypes.map((c, i) => (
          <div key={i} className="reveal pi-case-card" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderRadius: 20, overflow: "hidden", border: `1px solid ${c.accent}20`, transition: "all 0.4s", background: "#fff", position: "relative" }}
            onMouseOver={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = `0 24px 48px -16px ${c.accent}20` }}
            onMouseOut={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none" }}>
            {/* Left — info */}
            <div style={{ padding: "36px 36px 32px", borderRight: `1px solid ${c.accent}12` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: c.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem", color: "#fff", boxShadow: `0 8px 20px -4px ${c.accent}40` }}><Ic c={c.icon} /></div>
                <div>
                  <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem", fontWeight: 800, color: "var(--ink-800)" }}>{c.title}</h3>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                    <span style={{ fontSize: "0.92rem", fontWeight: 800, color: c.accent }}>{c.stat}</span>
                    <span style={{ fontSize: "0.68rem", color: "var(--gray-400)" }}>{c.statLabel}</span>
                  </div>
                </div>
              </div>
              <p style={{ fontSize: "0.85rem", color: "var(--gray-500)", lineHeight: 1.7 }}>{c.desc}</p>
            </div>
            {/* Right — features grid */}
            <div style={{ padding: "32px 36px", background: `linear-gradient(135deg, ${c.accent}04, ${c.accent}08)`, display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px" }}>
                {c.features.map((f, j) => (
                  <div key={j} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: "0.82rem", color: "var(--gray-600)", lineHeight: 1.5 }}>
                    <div style={{ width: 18, height: 18, borderRadius: 6, background: `${c.accent}12`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke={c.accent} strokeWidth="3" style={{ width: 10, height: 10 }}><path d="M20 6L9 17l-5-5" /></svg>
                    </div>
                    {f}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div></section>

    {/* AI + Analytics Mockups — Dark */}
    <section className="section section--dark"><div className="bg-grid" /><div className="bg-noise" />
      <div className="container" style={{ position: "relative", zIndex: 1 }}>
        <SectionHead badge="PI Analytics" title="Data-Driven Personal Injury Practice" subtitle="AI research tuned for PI law in your state, combined with analytics that show settlement patterns and firm performance." light />
        <div style={{ gap: 20 }} className="showcase-grid">
          <MockupShowcase html={mockup_analytics} label="PI Analytics Dashboard" caption="Revenue trends, case pipeline, and practice area breakdown." />
          <MockupShowcase html={mockup_ai_workspace} label="LegiSearch for PI" caption="Ask PI-specific legal questions, get cited state-specific answers." />
        </div>
        <div style={{ textAlign: "center", marginTop: 32 }}>
          <Link to="/contact" className="btn btn--primary btn--lg">Apply for Early Access →</Link>
        </div>
      </div>
    </section>

    {/* Coming Soon Practice Areas */}
    <section className="section" style={{ background: "#fff" }}><div className="container">
      <SectionHead badge="Coming Soon" title="More Practice Areas on the Way" subtitle="We're building the same depth of specialized tools for additional practice areas. Request early access to shape what we build next." />
      <motion.div className="coming-soon-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={{ visible: { transition: { staggerChildren: 0.08 } } }}>
        {comingSoonAreas.map((a, i) => (
          <motion.div key={i} variants={fadeUp} style={{ background: "#fff", border: "1px solid var(--gray-200)", borderRadius: 16, padding: "28px 24px", transition: "all 0.35s", position: "relative", cursor: "default" }}
            onMouseOver={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 16px 40px -12px rgba(0,0,0,0.1)"; e.currentTarget.style.borderColor = "var(--accent-light)" }}
            onMouseOut={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = "var(--gray-200)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--accent-light-bg, #f0f4ff)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.25rem", color: "var(--accent)" }}><Ic c={a.icon} /></div>
              <span style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--accent)", background: "var(--accent-light-bg, #f0f4ff)", padding: "4px 10px", borderRadius: 20 }}>Coming Soon</span>
            </div>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.05rem", fontWeight: 800, color: "var(--ink-800)", marginBottom: 6 }}>{a.title}</h3>
            <p style={{ fontSize: "0.82rem", color: "var(--gray-500)", lineHeight: 1.65, margin: 0 }}>{a.desc}</p>
          </motion.div>
        ))}
      </motion.div>
      <div style={{ textAlign: "center", marginTop: 32 }}>
        <Link to="/contact" className="btn btn--outline btn--lg">Request a Practice Area →</Link>
      </div>
    </div></section>
  </>
}
