import Icon from "../components/ui/Icon"
import { useState, useEffect, useRef } from "react"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { Helmet } from "react-helmet-async"
import MockupShowcase from "../components/mockups/MockupShowcase"
import LegiSpaceMockup from "../components/mockups/LegiSpaceMockup"
import SectionHead from "../components/ui/SectionHead"
import {
  mockup_cases, mockup_crm, mockup_analytics, mockup_ai_workspace,
  mockup_esign, mockup_time_tracking, mockup_tasks, mockup_calendar,
  mockup_client_portal, mockup_billing, mockup_file_manager, mockup_admin,
  mockup_attorney_dashboard, mockup_legisearch
} from "../assets/mockups"

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } } }
const stagger = { visible: { transition: { staggerChildren: 0.08 } } }

/* ── Tabbed features data ── */
const productTabs = [
  { label: "LegiSpace", icon: "ri-brain-line", title: "LegiSpace™ — AI Legal Workspace", desc: "Your all-in-one AI workspace for legal research, document drafting, and case analysis. Ask questions in plain English and get cited answers from federal and state case law. Generate motions, demand letters, briefs, and 30+ document types linked to your cases. Analyze uploaded documents for key facts, risks, and deadlines — all powered by Claude AI through AWS Bedrock with BAA coverage.", mockup: mockup_ai_workspace, bullets: ["LegiSearch: natural language legal research with cited case law", "LegiDraft: 30+ document types generated from case context", "Document analysis: extract key facts, risks & deadlines from uploads", "Case workflow automation with jurisdiction awareness", "200–500 AI queries/mo included, unlimited on Firm plans", "Secure AI: your data is never used for AI training"] },
  { label: "Cases", icon: "ri-scales-3-line", title: "Case Management", desc: "9-tab case files connecting every document, billing entry, task, calendar event, and contact to a single case record. Track status, priority, and assignments across your entire caseload — with practice-area-specific fields, court tracking, and deadline management. Unlike generic tools that force you to adapt, every field and workflow is tailored to how your firm actually operates.", mockup: mockup_cases, bullets: ["9-tab case organization with custom fields per practice area", "Color-coded priority & status tracking", "Client, court & deadline tracking built in", "Statute of limitations calculators by jurisdiction", "Advanced search across all cases", "Bulk actions: reassign, update status, export"] },
  { label: "Billing", icon: "ri-timer-line", title: "Time Tracking & Invoicing", desc: "Legience handles the full billing workflow from time entry to invoice delivery, and integrates with the accounting tools you already use for everything else.", mockup: mockup_time_tracking, bullets: ["Built-in time tracking: one-click timers, multiple rates per attorney/matter/client", "Time-to-invoice generation: convert entries into professional invoices in clicks", "Customizable invoices: branded templates, PDF export, direct email delivery", "Time approval workflows: submit, review & approve before invoicing", "Expense tracking: log expenses alongside time entries, include in invoices"] },
  { label: "E-Sign", icon: "ri-quill-pen-line", title: "E-Signatures", desc: "Unlimited e-signatures included on every plan. Send retainers, releases, medical authorizations for legally-binding signature. Track status in real-time and auto-file signed documents to the case record. Clio charges $15/user/mo extra for this.", mockup: mockup_esign, bullets: ["Unlimited signatures — no per-send fees", "Reusable templates for common legal documents", "Real-time tracking: sent → viewed → signed", "Auto-file to case record"] },
  { label: "CRM", icon: "ri-bar-chart-box-line", title: "CRM & Lead Pipeline", desc: "Built-in CRM that scores incoming leads, manages your intake pipeline through configurable stages, runs automated conflict checks against your entire case history, and tracks referral sources with ROI analytics.", mockup: mockup_crm, bullets: ["Lead scoring with configurable criteria", "Multi-stage pipeline with conversion tracking", "Automated conflict checking", "Referral source ROI analytics"] },
  { label: "Portal", icon: "ri-team-line", title: "Client Portal", desc: "Branded portal where clients check their case status, upload documents, view and pay invoices, and exchange secure messages with your team — 24/7 from any device. Reduces status-check calls by 80%. Free on every plan.", mockup: mockup_client_portal, bullets: ["Real-time case status for clients", "Secure document upload & sharing", "Online invoice viewing & payment", "Encrypted attorney-client messaging", "Appointment scheduling with calendar sync & self-scheduling"] },
  { label: "Analytics", icon: "ri-line-chart-line", title: "Firm Analytics", desc: "Real-time dashboards showing revenue trends, case pipeline health, attorney utilization, and firm-wide KPIs. 10 role-based dashboard types — Admin, Attorney, Paralegal, Secretary, CFO, Manager — so everyone sees exactly what they need.", mockup: mockup_analytics, bullets: ["Revenue by attorney, case type & period", "Case pipeline visualization", "10 role-based dashboards", "Export to CSV/PDF with custom date ranges"] },
]

const comparison = [
  { f: "Case Management", us: "✓", clio: "✓", mycase: "✓", evenup: "✗", litify: "✓" },
  { f: "LegiSearch", us: "Unlimited", clio: "$50/mo add-on", mycase: "✗", evenup: "✗", litify: "Add-on" },
  { f: "AI Demand Letters", us: "$0/case", clio: "✗", mycase: "✗", evenup: "$500+/case", litify: "Per-case" },
  { f: "E-Signatures", us: "Unlimited", clio: "$15/user/mo", mycase: "Add-on", evenup: "✗", litify: "✓" },
  { f: "Client Portal", us: "Free", clio: "Separate product", mycase: "$10/mo", evenup: "✗", litify: "✗" },
  { f: "CRM & Intake", us: "Included", clio: "$49/user/mo", mycase: "$15/mo", evenup: "✗", litify: "✓" },
  { f: "PI Damage Calculator", us: "✓", clio: "✗", mycase: "✗", evenup: "✗", litify: "✗" },
  { f: "Medical Records AI", us: "✓", clio: "✗", mycase: "✗", evenup: "✓", litify: "✗" },
  { f: "Conflict Checking", us: "✓", clio: "Basic", mycase: "✗", evenup: "✗", litify: "✗" },
  { f: "Expense Management", us: "✓", clio: "Via QuickBooks", mycase: "Basic", evenup: "✗", litify: "Add-on" },
  { f: "10 Role Dashboards", us: "✓", clio: "Limited", mycase: "Limited", evenup: "✗", litify: "✓" },
  { f: "Tools Needed", us: "1", clio: "4–5", mycase: "3–4", evenup: "N/A", litify: "2–3" },
  { f: "Starting Price", us: "$99/mo", clio: "$49/mo+add-ons", mycase: "$49/mo", evenup: "Custom", litify: "$150/mo" },
]

/* ── Animated counter ── */
function AnimNum({ value }) {
  const [d, setD] = useState("0"); const ref = useRef(null)
  useEffect(() => {
    const n = parseInt(value.replace(/[^0-9]/g, ""))
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        if (!n) { setD(value); obs.disconnect(); return }
        const t0 = performance.now()
        const run = (t) => { const p = Math.min((t - t0) / 1400, 1); setD(Math.round(n * (1 - Math.pow(1 - p, 3))).toLocaleString()); if (p < 1) requestAnimationFrame(run) }
        requestAnimationFrame(run); obs.disconnect()
      }
    }, { threshold: 0.3 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [value])
  return <span ref={ref}>{value.includes("$") ? "$" : ""}{d}{value.replace(/[0-9$,]/g, "")}</span>
}


function Ic({c,s}){return c&&c.startsWith("ri-")?<Icon name={c} size={20} style={s||{}} />:<span style={s||{}}>{c}</span>}

export default function Home() {
  const [activeTab, setActiveTab] = useState(0)

  const softwareSchema={
    "@context":"https://schema.org",
    "@type":"SoftwareApplication",
    name:"Legience",
    applicationCategory:"BusinessApplication",
    operatingSystem:"Web",
    offers:{"@type":"AggregateOffer",lowPrice:"99",highPrice:"249",priceCurrency:"USD",offerCount:"3"}
  }
  const homeFaqSchema={
    "@context":"https://schema.org",
    "@type":"FAQPage",
    mainEntity:[
      {"@type":"Question",name:"What is Legience?",acceptedAnswer:{"@type":"Answer",text:"Legience is an all-in-one, AI-powered legal practice management platform that combines 14 modules — case management, AI legal research, document drafting, billing, e-signatures, CRM, client portal, conflict checking, and analytics — into a single subscription starting at $99/month per user."}},
      {"@type":"Question",name:"How is Legience different from Clio?",acceptedAnswer:{"@type":"Answer",text:"Legience includes AI legal research, document drafting, CRM, e-signatures, and client portal in every plan at no extra cost. Clio charges separately for Manage, Grow, Duo AI, and e-signatures — totaling $300+/user/month. A 5-attorney firm saves $555–955/month with Legience."}},
      {"@type":"Question",name:"How much do AI demand letters cost with Legience?",acceptedAnswer:{"@type":"Answer",text:"$0 per case on Professional and Firm plans. LegiDraft generates demand letters, motions, briefs, and 30+ document types included in your subscription. EvenUp charges $500+ per demand letter for comparison."}},
      {"@type":"Question",name:"Is Legience secure enough for law firms?",acceptedAnswer:{"@type":"Answer",text:"Yes. Legience uses AES-256 encryption at rest, TLS in transit, security practices aligned with 201 CMR 17.00, AI processing through AWS Bedrock under BAA (no client data used for training), US-only hosting, and comprehensive audit logs."}},
      {"@type":"Question",name:"Does Legience offer a free trial?",acceptedAnswer:{"@type":"Answer",text:"Yes. Legience offers a 14-day free trial with no credit card required. You get full access to every feature and module during the trial period."}},
      {"@type":"Question",name:"What practice areas does Legience support?",acceptedAnswer:{"@type":"Answer",text:"Legience supports personal injury, family law, business litigation, real estate, immigration, employment law, criminal defense, estate planning, and more. Core features like AI research, document drafting, case management, and billing work across every practice area. The PI Workspace adds specialized tools like demand letters, medical records analysis, and settlement tracking."}},
    ]
  }
  return <>
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(softwareSchema)}</script>
      <script type="application/ld+json">{JSON.stringify(homeFaqSchema)}</script>
    </Helmet>
    {/* ═══════════ HERO ═══════════ */}
    <section className="hero">
      <div className="bg-grid" /><div className="bg-noise" />
      <div className="bg-orb" style={{ width: 600, height: 600, top: "5%", right: "-10%", background: "radial-gradient(circle,rgba(56,182,255,0.12),transparent 70%)" }} />
      <div className="bg-orb" style={{ width: 400, height: 400, bottom: "10%", left: "-8%", background: "radial-gradient(circle,rgba(0,74,173,0.1),transparent 70%)", animationDelay: "-3s" }} />
      <div className="container" style={{ position: "relative", zIndex: 1 }}>
        <div className="hero-grid">
          <motion.div initial="hidden" animate="visible" variants={stagger}>
            <motion.div variants={fadeUp} style={{ marginBottom: 20 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: 100, fontSize: "0.78rem", fontWeight: 500, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}>
                ✦ AI-Powered Legal Platform
              </span>
            </motion.div>
            <motion.h1 variants={fadeUp} className="h1" style={{ color: "white", fontSize: "clamp(2.2rem, 5vw, 3.6rem)", lineHeight: 1.05, letterSpacing: "-0.02em" }}>
              One Platform to<br /><span className="text-gradient">Run Your Entire Firm.</span>
            </motion.h1>
            <motion.p variants={fadeUp} className="sub sub--light" style={{ marginTop: 20, maxWidth: 480, fontSize: "1.05rem", lineHeight: 1.7 }}>
              Cases, research, documents, billing, e-signatures, and client portal — all connected through AI. One login. One price.
            </motion.p>
            <motion.div variants={fadeUp} className="btn-row" style={{ marginTop: 28, gap: 12 }}>
              <Link to="/contact" className="btn btn--primary btn--lg">Book a Demo →</Link>
              <Link to="/contact" className="btn btn--secondary btn--lg" style={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", animation: "btnPulse 3s ease-in-out infinite" }}>Apply for Early Access</Link>
            </motion.div>
            <motion.div variants={fadeUp} className="hero-trust-badges" style={{ marginTop: 24 }}>
              {["No credit card required", "Free data migration", "Cancel anytime"].map((t, i) => (
                <span key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.75rem", color: "rgba(255,255,255,0.55)" }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#34d0b6" strokeWidth="2.5" style={{ width: 13, height: 13 }}><path d="M20 6L9 17l-5-5" /></svg>
                  {t}
                </span>
              ))}
            </motion.div>
          </motion.div>
          {/* Desktop mockup */}
          <motion.div className="hero-mockup-col hero-mockup--desktop" initial={{ opacity: 0, y: 40, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 1.2, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}>
            <MockupShowcase html={mockup_attorney_dashboard} label="Attorney Dashboard" glow />
          </motion.div>
          {/* Mobile phone-frame mockup */}
          <motion.div className="hero-mockup--mobile" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}>
            <div style={{ width: "100%", maxWidth: 360, margin: "0 auto", background: "#0a0d1a", borderRadius: 36, padding: "10px", boxShadow: "0 32px 80px -20px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.08), inset 0 0 0 1px rgba(255,255,255,0.03)", position: "relative" }}>
              {/* Dynamic Island */}
              <div style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", width: 90, height: 24, borderRadius: 14, background: "#000", zIndex: 3 }} />
              {/* Screen */}
              <div style={{ borderRadius: 28, overflow: "hidden", background: "#0f1629" }}>
                {/* Status bar */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 20px 0", fontFamily: "system-ui" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>9:41</span>
                  <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                    <svg width="14" height="10" viewBox="0 0 14 10" fill="rgba(255,255,255,0.9)"><rect x="0" y="4" width="3" height="6" rx="0.5"/><rect x="4" y="2" width="3" height="8" rx="0.5"/><rect x="8" y="0" width="3" height="10" rx="0.5"/></svg>
                    <svg width="12" height="10" viewBox="0 0 12 10" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1"><path d="M1 8 L6 2 L11 8"/><path d="M3 8 L6 4 L9 8"/></svg>
                    <div style={{ width: 22, height: 10, borderRadius: 2, border: "1px solid rgba(255,255,255,0.4)", position: "relative", padding: 1 }}>
                      <div style={{ width: "70%", height: "100%", background: "#34d0b6", borderRadius: 1 }} />
                    </div>
                  </div>
                </div>
                {/* App header */}
                <div style={{ padding: "14px 18px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: "system-ui" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #38b6ff, #1e56b6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#fff" }}>L</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Legience</div>
                      <div style={{ fontSize: 8, color: "rgba(255,255,255,0.4)" }}>Attorney Dashboard</div>
                    </div>
                  </div>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: 3, height: 3, borderRadius: "50%", background: "rgba(255,255,255,0.5)", boxShadow: "0 -5px 0 rgba(255,255,255,0.5), 0 5px 0 rgba(255,255,255,0.5)" }} />
                  </div>
                </div>
                {/* Greeting */}
                <div style={{ padding: "6px 18px 14px", fontFamily: "system-ui" }}>
                  <div style={{ borderLeft: "2px solid #38b6ff", paddingLeft: 12 }}>
                    <div style={{ fontSize: 9, color: "rgba(56,182,255,0.7)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>Tuesday, February 24</div>
                    <div style={{ fontSize: 19, fontWeight: 700, color: "rgba(255,255,255,0.95)", marginTop: 2 }}>Good Evening, Jordan</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 4, lineHeight: 1.5 }}>4 events today. 2 items need your attention.</div>
                  </div>
                </div>
                {/* Cases card */}
                <div style={{ padding: "0 14px 10px", fontFamily: "system-ui" }}>
                  <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "14px 14px 10px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>Ongoing Cases</div>
                      <div style={{ fontSize: 9, color: "rgba(56,182,255,0.6)", border: "1px solid rgba(56,182,255,0.15)", padding: "3px 8px", borderRadius: 5, fontWeight: 500 }}>View All →</div>
                    </div>
                    {[
                      { init: "JT", name: "James Thompson", type: "Motor Vehicle Accident", color: "#38b6ff", status: "IN PROGRESS", due: "14d" },
                      { init: "SC", name: "Sarah Chen", type: "Premises Liability — Slip & Fall", color: "#34d0b6", status: "OPEN", due: "30d" },
                      { init: "RG", name: "R. Garcia", type: "Workers' Compensation", color: "#f7b84b", status: "REVIEW", due: "7d" },
                    ].map((c, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 0", borderTop: i ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: `${c.color}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: c.color, flexShrink: 0 }}>{c.init}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.88)" }}>{c.name}</div>
                          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.type}</div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
                          <span style={{ fontSize: 7, padding: "2px 7px", borderRadius: 4, background: `${c.color}12`, color: c.color, fontWeight: 700 }}>{c.status}</span>
                          <span style={{ fontSize: 8, color: "rgba(255,255,255,0.35)" }}>Due {c.due}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Schedule card */}
                <div style={{ padding: "0 14px 16px", fontFamily: "system-ui" }}>
                  <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(10,179,156,0.08)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: "#34d0b6", lineHeight: 1 }}>24</div>
                          <div style={{ fontSize: 6, color: "#34d0b6", textTransform: "uppercase", fontWeight: 700 }}>Feb</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>Today's Schedule</div>
                          <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
                            <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 3, background: "rgba(56,182,255,0.08)", color: "#7dd3fc" }}>3 Left</span>
                            <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 3, background: "rgba(247,184,75,0.08)", color: "#fbbf24" }}>4.5 hrs</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {[
                        { time: "1:00 – 2:30 PM", title: "Client Consultation", sub: "New case intake", color: "#38b6ff", tag: "1.5h" },
                        { time: "3:00 PM", title: "Deposition Prep", sub: "Thompson v. Metro Transit", color: "#f7b84b", tag: "Review" },
                        { time: "5:00 PM", title: "Filing Deadline", sub: "Motion to compel — Morrison", color: "#f06548", tag: "Urgent" },
                      ].map((e, i) => (
                        <div key={i} style={{ padding: "10px 12px", borderRadius: 10, borderLeft: `2.5px solid ${e.color}`, background: `${e.color}06` }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: 9, color: `${e.color}90` }}>{e.time}</span>
                            <span style={{ fontSize: 7, padding: "2px 6px", borderRadius: 3, background: `${e.color}10`, color: e.color, fontWeight: 600 }}>{e.tag}</span>
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.82)", marginTop: 3 }}>{e.title}</div>
                          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", marginTop: 1 }}>{e.sub}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                {/* Bottom nav bar */}
                <div style={{ display: "flex", justifyContent: "space-around", padding: "10px 16px 14px", borderTop: "1px solid rgba(255,255,255,0.04)", fontFamily: "system-ui" }}>
                  {[
                    { label: "Home", active: true },
                    { label: "Cases", active: false },
                    { label: "AI", active: false },
                    { label: "Tasks", active: false },
                    { label: "More", active: false },
                  ].map((n, i) => (
                    <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                      <div style={{ width: 18, height: 18, borderRadius: 5, background: n.active ? "rgba(56,182,255,0.12)" : "rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <div style={{ width: 8, height: 8, borderRadius: n.label === "AI" ? "50%" : 2, background: n.active ? "#38b6ff" : "rgba(255,255,255,0.2)" }} />
                      </div>
                      <span style={{ fontSize: 8, color: n.active ? "#38b6ff" : "rgba(255,255,255,0.35)", fontWeight: n.active ? 600 : 400 }}>{n.label}</span>
                    </div>
                  ))}
                </div>
                {/* Home indicator */}
                <div style={{ display: "flex", justifyContent: "center", paddingBottom: 6 }}>
                  <div style={{ width: 100, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)" }} />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>

    {/* ═══════════ NUMBERS ═══════════ */}
    <section style={{ padding: "56px 0", background: "var(--ink-950)", borderTop: "1px solid rgba(255,255,255,0.04)" }}><div className="container" style={{ textAlign: "center" }}>
      <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.5rem, 2.5vw, 2rem)", fontWeight: 800, color: "#fff", marginBottom: 40, fontStyle: "italic" }}>The Numbers Behind the Platform</h2>
      <div style={{ gap: 0 }} className="feat-grid">
        {[
          ["70%", "Faster document drafting with AI"],
          ["100+", "Hours recovered per attorney per year"],
          ["$30K+", "Additional revenue per attorney annually"],
          ["20x", "Return on investment vs. subscription cost"],
        ].map(([val, label], i) => (
          <div key={i} style={{ padding: "0 20px", borderRight: i < 3 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2rem, 3.5vw, 3rem)", fontWeight: 800, background: "linear-gradient(135deg, #38b6ff, #1e56b6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1 }}><AnimNum value={val} /></div>
            <div style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.55)", marginTop: 10, lineHeight: 1.5 }}>{label}</div>
          </div>
        ))}
      </div>
    </div></section>


    {/* ═══════════ THE PROBLEM ═══════════ */}
    <section className="section" style={{ background: "#fff", position: "relative" }}>
      <div className="container">
        <div className="fd-grid" style={{ gap: 48, alignItems: "center" }}>
          {/* Left: Text + total */}
          <div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 14px", borderRadius: 100, fontSize: "0.72rem", fontWeight: 600, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)", color: "#ef4444" }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#ef4444" }} /> The Problem
            </span>
            <h2 className="h2" style={{ marginTop: 16 }}>Your Firm Runs on Tools That Don't Talk to Each Other</h2>
            <p className="sub" style={{ marginTop: 12, textAlign: "left" }}>The average law firm uses 5–6 separate tools that don't share data. Every context switch costs time, creates errors, and drains revenue.</p>
            
            {/* Total cost callout */}
            <div style={{ marginTop: 28, padding: "20px 24px", borderRadius: 14, border: "1px dashed rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.02)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.88rem", color: "var(--gray-500)" }}>💸 Total cost per user</span>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.3rem", color: "#ef4444" }}>$750 – $1,800+<span style={{ fontSize: "0.72rem", fontWeight: 400, color: "var(--gray-400)" }}>/mo</span></span>
              </div>
              <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "#dc2626", marginTop: 10 }}>That's $9,000 – $21,600+ per year per attorney.</div>
              <div style={{ fontSize: "0.75rem", color: "var(--gray-400)", marginTop: 6 }}>+ attorneys lose <strong style={{ color: "var(--ink-800)" }}>500+ hours/year</strong> to context switching between tools</div>
            </div>

            {/* Legience solution */}
            <div style={{ marginTop: 12, padding: "16px 24px", borderRadius: 14, background: "linear-gradient(135deg, var(--accent), var(--accent-dark))", boxShadow: "0 8px 24px -8px rgba(30,86,182,0.3)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: "1rem" }}>✦</span>
                <span style={{ fontWeight: 700, fontSize: "0.92rem", color: "#fff" }}>Legience replaces all 5 tools</span>
              </div>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.3rem", color: "#fff" }}>$99<span style={{ fontSize: "0.72rem", fontWeight: 400, color: "rgba(255,255,255,0.6)" }}>/mo</span></span>
            </div>
          </div>

          {/* Right: Stacked tool cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              ["ri-computer-line", "Case Management + AI", "Clio + Duo AI", "$150–200", "/user/mo", "#ef4444"],
              ["ri-search-line", "AI Legal Research", "Standalone tools", "$220–500", "/month", "#ef4444"],
              ["ri-clipboard-line", "PI Demand Letters", "EvenUp / Precedent", "$300–800", "/case", "#f97316"],
              ["ri-quill-pen-line", "E-Signatures", "DocuSign / PandaDoc", "$15–45", "/user/mo", "#f97316"],
              ["ri-team-line", "CRM + Client Portal", "Clio Grow + extras", "$49–99", "/month", "#eab308"],
            ].map(([icon, title, vendor, price, unit, color], i) => (
              <div key={i} style={{
                display: "grid", gridTemplateColumns: "40px 1fr auto", alignItems: "center", gap: 14,
                padding: "14px 18px", background: "#fff", border: "1px solid var(--gray-200)",
                borderRadius: 12, borderLeft: `3px solid ${color}`,
                transition: "all 0.3s cubic-bezier(0.16,1,0.3,1)",
              }}
                onMouseOver={e => { e.currentTarget.style.transform = "translateX(4px)"; e.currentTarget.style.boxShadow = `0 4px 16px -4px ${color}15`; e.currentTarget.style.borderColor = color }}
                onMouseOut={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = "var(--gray-200)" }}>
                <span style={{ fontSize: "1.2rem", textAlign: "center" }}><Ic c={icon} /></span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--ink-800)" }}>{title}</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--gray-400)", marginTop: 1 }}>{vendor}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.05rem", color: color }}>{price}</span>
                  <span style={{ fontSize: "0.65rem", color: "var(--gray-400)", marginLeft: 2 }}>{unit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>


    {/* ═══════════ TABBED PRODUCT TOUR ═══════════ */}
    <section className="section section--dark" style={{ padding: "80px 0 96px" }}>
      <div className="bg-grid" /><div className="bg-noise" />
      <div className="container" style={{ position: "relative", zIndex: 1 }}>
        <SectionHead badge="Product Tour" title="Explore the Entire Platform" subtitle="See how one platform replaces the 5+ tools your firm pays for today." light />
        <div className="tabs tabs--center">
          {productTabs.map((t, i) => <button key={i} className={`tab ${activeTab === i ? "tab--active" : ""}`} onClick={() => setActiveTab(i)}><Ic c={t.icon} /> {t.label}</button>)}
        </div>
        <div className="tab-panel" key={activeTab}>
          <div className="feature-tab-content">
            <div className="feature-tab-content__text">
              <div className="label" style={{ color: "var(--accent-light)", background: "rgba(56,182,255,0.08)", marginBottom: 12 }}>{productTabs[activeTab].label}</div>
              <h3 style={{ fontSize: "1.5rem", color: "#fff" }}>{productTabs[activeTab].title}</h3>
              <p style={{ marginTop: 12, lineHeight: 1.75, color: "rgba(255,255,255,0.7)" }}>{productTabs[activeTab].desc}</p>
              <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
                {productTabs[activeTab].bullets.map((b, j) => <div key={j} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: "0.88rem", color: "rgba(255,255,255,0.7)" }}>
                  <span style={{ color: "var(--accent-light)", fontWeight: 700, flexShrink: 0 }}>✓</span>{b}
                </div>)}
              </div>
              <Link to="/features" className="btn btn--primary" style={{ marginTop: 24 }}>See All Features →</Link>
            </div>
            {productTabs[activeTab].label === "LegiSpace"
              ? <LegiSpaceMockup />
              : <MockupShowcase html={productTabs[activeTab].mockup} label={productTabs[activeTab].title} caption={`From the Legience ${productTabs[activeTab].label} module.`} glow />
            }
          </div>
        </div>
      </div>
    </section>

    {/* ═══════════ WHAT YOU GET ═══════════ */}
    <section className="section" style={{ background: "#fff" }}>
      <div className="container">
        <SectionHead badge="Complete Platform" title="One Subscription. Everything Included." subtitle="No modules to unlock. No per-case fees. No add-on charges." />
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          {[
            { cat: "Core Practice Management", color: "#38b6ff", items: [
              ["ri-scales-3-line", "Case Management", "9-tab case files, Kanban, deadline tracking, SOL alerts"],
              ["ri-calendar-line", "Calendar & Deadlines", "Court dates, SOL calculators, team scheduling, reminders"],
              ["ri-checkbox-circle-line", "Task Management", "Kanban boards, workflow templates, due dates, assignments"],
              ["ri-folder-line", "Document Manager", "Centralized storage, full-text search, version control"],
            ]},
            { cat: "AI & Intelligence", color: "#a78bfa", items: [
              ["ri-brain-line", "LegiSearch™", "Cited case law answers from Claude AI. Unlimited."],
              ["ri-file-text-line", "LegiDraft™", "AI demand packages at $0/case. EvenUp charges $500+."],
              ["ri-search-line", "LegiLyze™", "Upload any document for instant AI risk scoring and clause analysis."],
              ["ri-stethoscope-line", "LegiMed™", "AI medical records analysis, ICD-10 extraction, gap detection."],
            ]},
            { cat: "Billing, Clients & Growth", color: "#34d0b6", items: [
              ["ri-timer-line", "Time & Billing", "One-click timers, LEDES, auto-invoicing, Stripe payments"],
              ["ri-quill-pen-line", "E-Signatures", "Unlimited BoldSign. Templates. Auto-file. Free."],
              ["ri-team-line", "Client Portal", "24/7 status, doc upload, payments, messaging. Free."],
              ["ri-bar-chart-box-line", "CRM & Intake", "Lead scoring, pipeline, conflict checks, referral ROI."],
              ["ri-shield-check-line", "Conflict Checking", "Automated detection, resolution workflows, ABA compliant."],
              ["ri-money-dollar-box-line", "Expense Management", "Per-case expense tracking, vendors, receipts, reporting."],
              ["ri-line-chart-line", "Firm Analytics", "10 role-based dashboards — Admin, Attorney, Paralegal, CFO."],
              ["ri-history-line", "Audit Logs", "Full activity trail — who did what, when. Tamper-proof compliance records."],
            ]},
          ].map((group, gi) => (
            <div key={gi}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <div style={{ height: 1, flex: 1, background: `${group.color}20` }} />
                <span style={{ fontSize: "0.82rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: group.color, whiteSpace: "nowrap" }}>{group.cat}</span>
                <div style={{ height: 1, flex: 1, background: `${group.color}20` }} />
              </div>
              <div style={{ gap: 12 }} className="feat-grid">
                {group.items.map(([ic, t, d], i) => (
                  <div key={i} className="wg-card" style={{ padding: "20px 16px", background: "#fff", border: "1px solid var(--gray-100)", borderRadius: 14, transition: "all 0.3s" }}
                    onMouseOver={e => { e.currentTarget.style.background = `${group.color}08`; e.currentTarget.style.borderColor = `${group.color}40`; e.currentTarget.style.transform = "translateY(-2px)" }}
                    onMouseOut={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = "var(--gray-100)"; e.currentTarget.style.transform = "none" }}>
                    <span className="wg-card__icon" style={{ fontSize: "1.3rem" }}><Ic c={ic} /></span>
                    <div className="wg-card__body">
                      <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--ink-800)" }}>{t}</div>
                      <p style={{ fontSize: "0.75rem", color: "var(--gray-400)", marginTop: 4, lineHeight: 1.6 }}>{d}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: "center", marginTop: 32 }}>
          <Link to="/features" className="btn btn--primary">See All Features with Screenshots →</Link>
        </div>
      </div>
    </section>

    {/* ═══════════ EARLY ACCESS CTA ═══════════ */}
    <section className="section" style={{ background: "linear-gradient(135deg, var(--ink-950), #0b1e40)", color: "#fff", position: "relative", overflow: "hidden" }}>
      <div className="bg-grid" /><div className="bg-noise" />
      <div style={{ position: "absolute", top: "30%", right: "-5%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(56,182,255,0.06), transparent 70%)" }} />
      <div className="container" style={{ position: "relative", zIndex: 1 }}>
        <div className="fd-grid" style={{ gap: 48, alignItems: "center" }}>
          <div>
            <span className="label" style={{ color: "var(--accent-light)", background: "rgba(56,182,255,0.08)", marginBottom: 16 }}>Early Access Program</span>
            <h2 className="h2" style={{ marginTop: 16, color: "#fff" }}>Be Among the First Law Firms on Legience</h2>
            <p className="sub" style={{ marginTop: 12, color: "rgba(255,255,255,0.65)" }}>We're onboarding a limited number of firms. Get priority setup, direct team access, and founding member pricing — for life.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 24 }}>
              {[["ri-focus-3-line", "Priority Onboarding", "White-glove setup — data migrated in days, not weeks"],["ri-chat-3-line", "Direct Team Access", "Shape the product. Your feedback goes to our dev team"],["ri-money-dollar-circle-line", "Founding Pricing", "Locked in for life. No price increases, ever"],["ri-lock-unlock-line", "No Lock-In", "No long-term contracts. Export data anytime. Cancel anytime"]].map(([icon, title, desc], i) => (
                <div key={i} style={{ display: "flex", gap: 14, padding: "12px 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12 }}>
                  <span style={{ fontSize: "1.1rem", flexShrink: 0 }}><Ic c={icon} /></span>
                  <div><div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#fff" }}>{title}</div><div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.55)", marginTop: 2 }}>{desc}</div></div>
                </div>
              ))}
            </div>
            <Link to="/contact" className="btn btn--primary btn--lg" style={{ marginTop: 24 }}>Apply for Early Access →</Link>
          </div>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: 32, textAlign: "center" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--accent-light)", marginBottom: 20 }}>What Early Access Includes</div>
            {[["Full platform access", "Every feature, every module"],["LegiSearch™", "Unlimited during early access"],["LegiDraft™", "$0/case demand letters"],["White-glove migration", "From Clio, MyCase, or spreadsheets"],["Dedicated onboarding", "Personal setup assistance"],["Founding pricing", "Locked in forever"]].map(([title, desc], i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: i < 5 ? "1px solid rgba(255,255,255,0.04)" : "none", textAlign: "left" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#38b6ff" strokeWidth="2.5" style={{ width: 15, height: 15, flexShrink: 0 }}><path d="M20 6L9 17l-5-5" /></svg>
                <div><span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#fff" }}>{title}</span><span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.55)" }}> — {desc}</span></div>
              </div>
            ))}
            <div style={{ marginTop: 20, padding: "12px", background: "rgba(56,182,255,0.06)", border: "1px solid rgba(56,182,255,0.1)", borderRadius: 10 }}>
              <div style={{ fontSize: "0.78rem", color: "var(--accent-light)", fontWeight: 600 }}>7 spots remaining for Q2 2026</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    {/* ═══════════ COMPARISON TABLE ═══════════ */}
    <section className="section section--muted reveal"><div className="container">
      <SectionHead badge="How We Compare" title="Legience vs. The Competition" subtitle="Every feature they charge extra for, we include in every plan." />
      <div className="comp-wrap">
        <table className="comp-table">
          <thead><tr><th style={{ width: "22%" }}>Feature</th><th style={{ background: "rgba(30,86,182,0.04)", fontWeight: 800, color: "var(--accent)" }}>Legience</th><th>Clio</th><th>MyCase</th><th>EvenUp</th><th>Litify</th></tr></thead>
          <tbody>{comparison.map((r, i) => <tr key={i}>
            <td style={{ fontWeight: 600, color: "var(--ink-800)" }}>{r.f}</td>
            <td style={{ fontWeight: 700, color: "var(--accent)", background: "rgba(30,86,182,0.02)" }}>{r.us}</td>
            <td>{r.clio}</td><td>{r.mycase}</td><td>{r.evenup}</td><td>{r.litify}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <div style={{ textAlign: "center", marginTop: 24 }}>
        <p style={{ fontSize: "0.82rem", color: "var(--gray-400)", marginBottom: 12 }}>Pricing as of 2026. Clio costs include Manage + Grow + Duo + E-Sign add-ons.</p>
        <Link to="/pricing" className="btn btn--primary">See Legience Pricing →</Link>
      </div>
    </div></section>

  </>
}