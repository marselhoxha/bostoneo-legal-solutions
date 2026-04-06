import Icon from "../components/ui/Icon"
import { useState, useEffect, useRef } from "react"
import { Link, useLocation } from "react-router-dom"
import { Helmet } from "react-helmet-async"
import { motion } from "framer-motion"
import PageHero from "../components/ui/PageHero"
import SectionHead from "../components/ui/SectionHead"
import MockupShowcase from "../components/mockups/MockupShowcase"

const featuresSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Legience",
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "Legal Practice Management Software",
  operatingSystem: "Web",
  url: "https://legience.com/features",
  description: "14 legal case management modules in one platform: cases, AI research, document drafting, billing, e-signatures, CRM, conflict checking, client portal & analytics. From $99/mo.",
  offers: {
    "@type": "AggregateOffer",
    lowPrice: "99",
    highPrice: "249",
    priceCurrency: "USD",
    offerCount: 3,
  },
  featureList: "Case Management, AI Legal Research (LegiSearch), AI Document Drafting (LegiDraft), AI Document Analysis (LegiLyze), Calendar & Deadlines, Time Tracking & Invoicing, E-Signatures, CRM & Lead Pipeline, Client Portal, Task Management, Document Manager, Firm Analytics, Conflict Checking, Expense Management",
  publisher: { "@type": "Organization", name: "Legience", url: "https://legience.com" },
}
import {
  mockup_cases, mockup_calendar, mockup_time_tracking, mockup_billing,
  mockup_esign, mockup_crm, mockup_client_portal, mockup_file_manager,
  mockup_tasks, mockup_analytics, mockup_admin, mockup_ai_workspace,
  mockup_legidraft, mockup_legilyze, mockup_legisearch, mockup_conflicts, mockup_expenses
} from "../assets/mockups"

const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } } }

const features = [
  { num: "01", short: "Cases", title: "Case Management", tag: "Core", tagClass: "fd-tag--core", icon: "ri-scales-3-line",
    desc: "The nerve center of your practice. 9-tab case files that connect every document, note, billing entry, task, and communication to a single case record. Practice-area-specific fields, statute of limitations calculators, court and client tracking, and deadline management — all built in, not bolted on.",
    mockup: mockup_cases, mockupLabel: "Case Details — 9-Tab View",
    mockupCaption: "Case details with client info, court venue, important dates, and practice-area-specific fields.",
    callouts: [{ icon: "ri-clipboard-line", title: "9-Tab Files", desc: "Everything linked" }, { icon: "ri-price-tag-3-line", title: "Custom Fields", desc: "Per practice area" }, { icon: "ri-search-line", title: "Quick Search", desc: "Find any case" }, { icon: "ri-bar-chart-box-line", title: "Bulk Actions", desc: "Multi-select ops" }],
    bullets: ["9-tab organization: Overview, Documents, Billing, Tasks, Calendar, Notes, Contacts, Timeline, Custom", "Practice-area-specific fields: custom metadata tailored to each case type", "Color-coded priority (Urgent/High/Medium/Low) and status tracking", "Advanced search — find any case by client, number, type, status, or assignee", "Automatic deadline calculation based on case type and jurisdiction", "Bulk actions: reassign, change status, export across multiple cases"] },
  { num: "02", short: "LegiSearch", title: "LegiSearch™", tag: "AI", tagClass: "fd-tag--ai", icon: "ri-brain-line",
    desc: "Ask legal questions the way you'd ask a senior partner. Claude AI returns comprehensive, cited answers with federal and state case law, statutes, and jurisdiction-specific analysis. Every citation is checked. No Boolean operators needed. 200-500 queries/mo included, unlimited on Firm plans.",
    mockup: mockup_legisearch, mockupLabel: "LegiSearch — AI Research",
    mockupCaption: "Natural language queries with cited federal and state case law.",
    callouts: [{ icon: "ri-chat-3-line", title: "Plain English", desc: "No Boolean" }, { icon: "ri-book-open-line", title: "Cited", desc: "Verified case law" }, { icon: "ri-file-text-line", title: "30+ Docs", desc: "Motions, briefs" }, { icon: "ri-lock-line", title: "Secure AI", desc: "AWS Bedrock BAA" }],
    bullets: ["Natural language queries — ask like you'd ask a colleague", "Verified citations: Federal & state courts, verified statutes", "Jurisdiction-aware: state-specific case law and statutes", "Conversation history with saved sessions and bookmarks", "200–500 queries/mo included, unlimited on Firm plans", "Secure AI via AWS Bedrock — your data never used for training"] },
  { num: "03", short: "LegiDraft", title: "LegiDraft™", tag: "AI", tagClass: "fd-tag--ai", icon: "ri-file-text-line",
    desc: "AI-powered legal document generation. Draft demand letters, motions, interrogatories, employment agreements, and 30+ document types — linked to your cases for automatic context injection. Select jurisdiction, choose document type, and generate practice-ready drafts in minutes.",
    mockup: mockup_legidraft, mockupLabel: "LegiDraft — Document Generation",
    mockupCaption: "AI document drafting with case linking and jurisdiction awareness.",
    callouts: [{ icon: "ri-file-text-line", title: "30+ Types", desc: "Motions, briefs, more" }, { icon: "ri-clipboard-line", title: "Case-Linked", desc: "Auto context" }, { icon: "ri-scales-3-line", title: "Jurisdiction", desc: "State-specific" }, { icon: "ri-search-line", title: "Templates", desc: "Prompt tips" }],
    bullets: ["30+ document types: demand letters, motions, briefs, interrogatories, agreements", "Case-linked drafting: automatically pulls case facts, parties, and details", "Jurisdiction-aware generation with state-specific legal standards", "Prompt tips and templates to guide effective document requests", "Export to PDF or save directly to case file", "Included in your plan's AI query allocation"] },
  { num: "04", short: "LegiLyze", title: "LegiLyze™", tag: "AI", tagClass: "fd-tag--ai", icon: "ri-search-eye-line",
    desc: "Upload any legal document and get AI-powered analysis in minutes. Extract key facts, identify risks, flag deadlines, and get strategic recommendations. Analyze contracts, medical records, insurance policies, opposing counsel filings, and more.",
    mockup: mockup_legilyze, mockupLabel: "LegiLyze — Document Analysis",
    mockupCaption: "AI document analysis with goal-based context and strategic insights.",
    callouts: [{ icon: "ri-search-eye-line", title: "Deep Analysis", desc: "Key facts & risks" }, { icon: "ri-file-text-line", title: "Any Document", desc: "PDF, DOCX, TXT" }, { icon: "ri-focus-3-line", title: "Goal-Based", desc: "Context-aware" }, { icon: "ri-alarm-line", title: "Deadlines", desc: "Auto-extract" }],
    bullets: ["Upload PDF, DOCX, DOC, or TXT documents for analysis", "Goal-based analysis: respond, negotiate, explain to client, due diligence, or general review", "Extract key facts, risks, deadlines, and obligations automatically", "Contract analysis with clause-by-clause risk assessment", "Medical records timeline extraction and summarization", "Included in your plan's AI query allocation"] },
  { num: "05", short: "Calendar", title: "Calendar & Deadlines", tag: "Core", tagClass: "fd-tag--core", icon: "ri-calendar-line",
    desc: "Never miss a statute of limitations, court date, or filing deadline. Legal-specific calendar with automatic deadline calculation by case type and jurisdiction, team scheduling with workload visibility, and case-linked event tracking with email and SMS reminders.",
    mockup: mockup_calendar, mockupLabel: "Legal Calendar",
    mockupCaption: "court dates, SOL deadlines, and team scheduling.",
    callouts: [{ icon: "ri-alarm-line", title: "Auto Reminders", desc: "Email + SMS" }, { icon: "ri-calendar-line", title: "Court Dates", desc: "All state courts" }, { icon: "ri-scales-3-line", title: "SOL Tracking", desc: "State PI deadlines" }, { icon: "ri-team-line", title: "Team View", desc: "Workload balance" }],
    bullets: ["Deadline tracking with configurable reminders (email + SMS)", "Court date scheduling with multi-state court awareness", "SOL calculators for all case types in all 50 states", "Team calendar with availability and workload balancing", "Case-linked events", "iCal sync for Google Calendar and Outlook"] },
  { num: "06", short: "Billing", title: "Time Tracking & Invoicing", tag: "Financial", tagClass: "fd-tag--core", icon: "ri-timer-line",
    desc: "Legience handles the full billing workflow from time entry to invoice delivery. One-click timers, multiple billing rates per attorney/matter/client, time approval workflows, and branded invoice generation — all connected to your cases.",
    mockup: mockup_time_tracking, mockupLabel: "Time Tracking — Active Timers",
    mockupCaption: "One-click timers with billable categorization.",
    callouts: [{ icon: "ri-timer-line", title: "One-Click", desc: "Start/stop timers" }, { icon: "ri-file-line", title: "Invoicing", desc: "Time-to-invoice" }, { icon: "ri-checkbox-circle-line", title: "Approvals", desc: "Review workflow" }, { icon: "ri-money-dollar-box-line", title: "Expenses", desc: "Track & include" }],
    bullets: ["Built-in time tracking: one-click timers from desktop or mobile, log against cases and tasks", "Multiple billing rates per attorney, per matter, or per client", "Time-to-invoice generation: convert entries into professional invoices in clicks", "Customizable invoices: branded templates, PDF export, direct email delivery", "Time approval workflows: submit, review & approve before invoicing", "Expense tracking: log expenses alongside time entries, include in invoices"] },
  { num: "07", short: "E-Sign", title: "E-Signatures", tag: "Free", tagClass: "fd-tag--free", icon: "ri-quill-pen-line",
    desc: "Unlimited e-signatures on every plan. Send retainers, releases, medical authorizations for signature. Track status in real-time. Auto-file to case record. Clio charges $15/user/month extra.",
    mockup: mockup_esign, mockupLabel: "E-Signature Management",
    mockupCaption: "document tracking with signature status.",
    callouts: [{ icon: "ri-quill-pen-line", title: "Unlimited", desc: "No per-send fees" }, { icon: "ri-folder-open-line", title: "Auto-File", desc: "Signed → case" }, { icon: "ri-clipboard-line", title: "Templates", desc: "Retainers, releases" }, { icon: "ri-smartphone-line", title: "Mobile", desc: "Sign anywhere" }],
    bullets: ["Unlimited signatures — Clio charges $15/user/mo", "Reusable templates for common legal documents", "Real-time tracking: sent → viewed → signed → filed", "Auto-file with timestamp and audit trail", "Multiple signer workflows", "Mobile-friendly signing"] },
  { num: "08", short: "CRM", title: "CRM & Lead Pipeline", tag: "Growth", tagClass: "fd-tag--growth", icon: "ri-bar-chart-box-line",
    desc: "Built-in CRM with lead scoring, multi-stage pipeline, automated conflict checks, and referral tracking. Clio charges $49/user/month extra for their CRM (Grow).",
    mockup: mockup_crm, mockupLabel: "CRM — Lead Pipeline",
    mockupCaption: "lead scoring, pipeline stages, conversion tracking.",
    callouts: [{ icon: "ri-bar-chart-box-line", title: "Scoring", desc: "Auto-rank leads" }, { icon: "ri-refresh-line", title: "Pipeline", desc: "Visual stages" }, { icon: "ri-alert-line", title: "Conflicts", desc: "Auto-check" }, { icon: "ri-line-chart-line", title: "ROI", desc: "Source analytics" }],
    bullets: ["Lead scoring with configurable criteria", "Multi-stage pipeline with conversion tracking", "Automated conflict checking", "Referral source ROI analytics", "Intake forms with e-signature", "Pipeline analytics and bottleneck detection"] },
  { num: "09", short: "Portal", title: "Client Portal", tag: "Free", tagClass: "fd-tag--free", icon: "ri-team-line",
    desc: "Branded portal where clients check case status, upload documents, pay invoices, and message your team. Reduces calls by 80%. Included free — Clio and MyCase charge extra.",
    mockup: mockup_client_portal, mockupLabel: "Client Portal",
    mockupCaption: "what your clients see — status, docs, invoices.",
    callouts: [{ icon: "ri-eye-line", title: "Status", desc: "Real-time updates" }, { icon: "ri-bank-card-line", title: "Pay", desc: "Stripe checkout" }, { icon: "ri-attachment-line", title: "Upload", desc: "Drag-and-drop" }, { icon: "ri-chat-3-line", title: "Message", desc: "Encrypted chat" }],
    bullets: ["Real-time case status for clients", "Secure document upload and sharing", "Online invoice payment via Stripe", "Encrypted messaging with read receipts", "Appointment scheduling with calendar sync and client self-scheduling", "Mobile-responsive"] },
  { num: "10", short: "Tasks", title: "Task Management", tag: "Core", tagClass: "fd-tag--core", icon: "ri-checkbox-circle-line",
    desc: "Kanban boards, task assignments, due dates, and workflow templates. Every task links to a case. Auto-generate full task checklists when new cases are created.",
    mockup: mockup_tasks, mockupLabel: "Task Management — Kanban",
    mockupCaption: "tasks by status with due dates and assignees.",
    callouts: [{ icon: "ri-clipboard-line", title: "Kanban", desc: "Drag-and-drop" }, { icon: "ri-refresh-line", title: "Templates", desc: "Auto-generate" }, { icon: "ri-alarm-line", title: "Due Dates", desc: "Overdue alerts" }, { icon: "ri-attachment-line", title: "Case-Linked", desc: "Every task → case" }],
    bullets: ["Kanban board with drag-and-drop", "Task templates for legal workflows", "Due dates with overdue alerts", "Role-based assignment", "Case-linked tasks", "Recurring tasks"] },
  { num: "11", short: "Files", title: "Document Manager", tag: "Core", tagClass: "fd-tag--core", icon: "ri-folder-line",
    desc: "Centralized, secure document storage organized by case. Category folders, document checklists, full-text search, version control, and bulk upload.",
    mockup: mockup_file_manager, mockupLabel: "File Manager",
    mockupCaption: "organized folders with checklist tracking.",
    callouts: [{ icon: "ri-folder-line", title: "Folders", desc: "By category" }, { icon: "ri-checkbox-circle-line", title: "Checklists", desc: "Track missing docs" }, { icon: "ri-search-line", title: "Search", desc: "Full-text" }, { icon: "ri-upload-line", title: "Upload", desc: "Drag & drop" }],
    bullets: ["Case-linked folder organization", "Document checklist templates", "Full-text search", "Version control", "Bulk upload", "Client Portal sharing"] },
  { num: "12", short: "Analytics", title: "Firm Analytics", tag: "Insights", tagClass: "fd-tag--core", icon: "ri-line-chart-line",
    desc: "Real-time dashboards for revenue, pipeline, utilization, and KPIs. 10 role-based dashboard types — Admin, Attorney, Paralegal, Secretary, CFO, Manager.",
    mockup: mockup_analytics, mockupLabel: "Analytics Dashboard",
    mockupCaption: "revenue trends, pipeline, practice area breakdown.",
    callouts: [{ icon: "ri-line-chart-line", title: "Revenue", desc: "Monthly trends" }, { icon: "ri-focus-3-line", title: "Utilization", desc: "Billable tracking" }, { icon: "ri-dashboard-3-line", title: "10 Views", desc: "Per role" }, { icon: "ri-bar-chart-box-line", title: "Pipeline", desc: "Case distribution" }],
    bullets: ["Revenue by attorney, case type, period", "Utilization tracking", "Case pipeline visualization", "10 role-based dashboards", "CSV/PDF export", "KPI tracking"] },
  { num: "13", short: "Conflicts", title: "Conflict Checking", tag: "Compliance", tagClass: "fd-tag--core", icon: "ri-shield-check-line",
    desc: "Automated conflict of interest checking on every new client and matter. Multi-type detection catches client-vs-client and client-vs-opposing-party conflicts before they become ethical violations. Built-in resolution workflows with waiver documentation — compliant with ABA Rules 1.7, 1.9, and 1.10.",
    mockup: mockup_conflicts, mockupLabel: "Conflict Checking",
    mockupCaption: "Automated conflict detection with resolution workflow.",
    callouts: [{ icon: "ri-shield-check-line", title: "Auto-Check", desc: "Every new client" }, { icon: "ri-alert-line", title: "Multi-Type", desc: "All conflict types" }, { icon: "ri-checkbox-circle-line", title: "Resolution", desc: "Waiver workflow" }, { icon: "ri-government-line", title: "ABA Rules", desc: "1.7, 1.9, 1.10" }],
    bullets: ["Automated conflict detection on new clients and matters", "Multi-type detection: client vs. client, client vs. opposing party", "Conflict resolution workflow with waiver documentation", "Pending/unresolved conflict tracking and alerts", "Full audit trail for compliance reporting", "ABA Rules 1.7, 1.9, and 1.10 compliant"] },
  { num: "14", short: "Expenses", title: "Expense Management", tag: "Financial", tagClass: "fd-tag--core", icon: "ri-money-dollar-box-line",
    desc: "Track, categorize, and report on every case expense. Create expense entries linked to specific cases, manage vendors, attach receipts, and flow expenses directly into invoices. Custom categories, approval workflows, and expense analytics give you full visibility into case costs.",
    mockup: mockup_expenses, mockupLabel: "Expense Management",
    mockupCaption: "Expense tracking with categorization and case linking.",
    callouts: [{ icon: "ri-money-dollar-box-line", title: "Per-Case", desc: "Expense tracking" }, { icon: "ri-store-line", title: "Vendors", desc: "Receipt management" }, { icon: "ri-file-list-line", title: "Categories", desc: "Custom types" }, { icon: "ri-line-chart-line", title: "Analytics", desc: "Cost reporting" }],
    bullets: ["Expense creation and categorization per case", "Vendor management and receipt tracking", "Custom expense categories", "Expense analytics and cost reporting", "Direct integration with invoicing workflow", "Approval workflows for expense authorization"] },
]


function Ic({c,s}){return c&&c.startsWith("ri-")?<Icon name={c} size={20} style={s||{}} />:<span style={s||{}}>{c}</span>}

export default function Features() {
  const [active, setActive] = useState(0)
  const [showTabs, setShowTabs] = useState(true)
  const { hash } = useLocation()
  const detailRef = useRef(null)

  useEffect(() => {
    if (hash) {
      const idx = parseInt(hash.replace('#feat-', ''))
      if (!isNaN(idx) && idx >= 0 && idx < features.length) {
        setActive(idx)
        setTimeout(() => {
          document.getElementById('feature-detail')?.scrollIntoView({ behavior: 'smooth' })
        }, 100)
      }
    }
  }, [hash])

  useEffect(() => {
    const el = detailRef.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => setShowTabs(entry.isIntersecting), { threshold: 0, rootMargin: "-120px 0px 0px 0px" })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const f = features[active]

  return <>
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(featuresSchema)}</script>
    </Helmet>
    <PageHero badge="Platform Features" title="14 Modules. One Platform." gradient="Zero Add-On Fees." subtitle="Case management, AI research, demand letters, billing, e-signatures, CRM, conflict checking, client portal, tasks, documents, calendar, analytics, expense management & admin — all connected. Every feature included in every plan." />

    {/* Feature selector — compact icon tabs */}
    <section style={{ padding: "20px 0", borderBottom: "1px solid var(--gray-100)", background: "#fff", position: "sticky", top: 56, zIndex: 40, transform: showTabs ? "translateY(0)" : "translateY(-100%)", opacity: showTabs ? 1 : 0, transition: "transform 0.3s ease, opacity 0.3s ease", pointerEvents: showTabs ? "auto" : "none" }}>
      <div className="container">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, justifyContent: "center" }}>
          {features.map((ft, i) => (
            <button key={i} onClick={() => setActive(i)}
              onMouseOver={e => { if (active !== i) { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; e.currentTarget.style.background = "var(--accent-subtle)" } }}
              onMouseOut={e => { if (active !== i) { e.currentTarget.style.borderColor = "var(--gray-200)"; e.currentTarget.style.color = "var(--gray-500)"; e.currentTarget.style.background = "transparent" } }}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "7px 10px", borderRadius: 10, border: "1.5px solid",
                borderColor: active === i ? "var(--accent)" : "var(--gray-200)",
                background: active === i ? "var(--accent-subtle)" : "transparent",
                color: active === i ? "var(--accent)" : "var(--gray-500)",
                fontWeight: 600, fontSize: "0.75rem", cursor: "pointer",
                whiteSpace: "nowrap", transition: "all 0.2s",
                fontFamily: "inherit",
              }}>
              <span style={{ fontSize: "1rem" }}><Icon name={ft.icon} size={16} /></span> {ft.short}
            </button>
          ))}
        </div>
      </div>
    </section>

    {/* Active feature detail */}
    <section ref={detailRef} className="section" id="feature-detail" style={{ scrollMarginTop: 140 }}>
      <div className="container">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "0.82rem" }}>{f.num}</div>
            <div className={`fd-tag ${f.tagClass}`} style={{ marginBottom: 0 }}>{f.tag}</div>
          </div>

          <div className="feature-showcase" style={{ borderBottom: "none", paddingTop: 16, gridTemplateColumns: "0.85fr 1.5fr" }}>
            <div className="feature-showcase__content">
              <h2 className="feature-showcase__title" style={{ fontSize: "clamp(1.4rem,3vw,2rem)" }}>{f.title}</h2>
              <p className="feature-showcase__desc">{f.desc}</p>
              <div className="feature-showcase__bullets">
                {f.bullets.map((b, j) => <div key={j} className="feature-showcase__bullet"><div className="feature-showcase__bullet-check">✓</div>{b}</div>)}
              </div>
              <div className="feature-showcase__cta" style={{ display: "flex", gap: 12 }}>
                <Link to="/contact" className="btn btn--primary">Apply for Early Access →</Link>
                {active < features.length - 1 && <button onClick={() => setActive(active + 1)} className="btn btn--outline">Next: {features[active + 1].short} →</button>}
              </div>
            </div>
            <div className="feature-showcase__visual">
              <MockupShowcase html={f.mockup} label={f.mockupLabel} caption={f.mockupCaption} callouts={f.callouts} glow={active < 3} />
            </div>
          </div>
        </div>
      </div>
    </section>

    {/* Why attorneys switch */}
    <section className="section section--muted">
      <div className="container">
        <SectionHead badge="Why Switch?" title="What Attorneys Say About Switching" subtitle="Common pain points that bring firms to Legience — and how we solve each one." />
        <div style={{ gap: 20 }} className="feat-grid feat-grid--2col">
          {[
            ["ri-emotion-unhappy-line", "Paying for 5+ separate tools", "Legience consolidates case management, AI research, e-signatures, CRM & client portal into one subscription. One login, one invoice, one vendor.", "from-blue"],
            ["ri-money-dollar-box-line", "AI features cost extra everywhere", "EvenUp charges $300-800/case for demands. Clio charges $50/mo for AI. Legience includes 200–500 AI queries/mo in every plan — no per-query fees.", "from-purple"],
            ["ri-tools-line", "Generic tools adapted for PI", "Clio and MyCase are built for all practice areas. Legience is built from the ground up for PI — insurance tracking, SOL calculators, damage multipliers.", "from-green"],
            ["ri-bar-chart-box-line", "Can't see firm-wide performance", "Most platforms give you basic reports. Legience has 10 role-based dashboards — Admin, Attorney, Paralegal, CFO — each with the metrics that role needs.", "from-amber"],
            ["ri-lock-line", "Worried about AI and client data", "Secure AI processing through AWS Bedrock under BAA. Your data is never used for training. Tenant-isolated PostgreSQL. Full audit trail.", "from-red"],
            ["ri-alarm-line", "Spending hours on demand letters", "LegiDraft™ generates comprehensive demand packages — medical summaries, damage calculations, liability analysis — in 20 minutes instead of 6 hours.", "from-teal"],
          ].map(([icon, pain, solution, color], i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 16, padding: 24, background: "#fff", border: "1px solid var(--gray-100)", borderRadius: 16, transition: "all 0.3s" }}
              className="reveal" onMouseOver={e => {e.currentTarget.style.transform="translateY(-3px)";e.currentTarget.style.boxShadow="0 12px 32px -8px rgba(0,0,0,0.08)"}} onMouseOut={e => {e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none"}}>
              <div style={{ fontSize: "2rem", width: 48, height: 48, display: "flex", alignItems: "center", justifyContent: "center" }}><Ic c={icon} /></div>
              <div>
                <div style={{ fontWeight: 700, color: "var(--ink-800)", fontSize: "0.95rem" }}>{pain}</div>
                <p style={{ fontSize: "0.82rem", color: "var(--gray-500)", marginTop: 6, lineHeight: 1.65 }}>{solution}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* Admin section */}
    <section className="section section--dark"><div className="bg-grid" /><div className="bg-noise" />
      <div className="container" style={{ position: "relative", zIndex: 1 }}>
        <div className="feature-showcase" style={{ borderBottom: "none" }}>
          <div className="feature-showcase__content">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(56,182,255,0.15)", color: "var(--accent-light)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "0.82rem" }}>13</div>
              <span className="fd-tag" style={{ background: "rgba(56,182,255,0.08)", color: "var(--accent-light)" }}>Administration</span>
            </div>
            <h2 className="feature-showcase__title" style={{ color: "#fff" }}>Enterprise-Grade Administration</h2>
            <p style={{ color: "rgba(255,255,255,0.65)", marginTop: 12, lineHeight: 1.75 }}>Comprehensive audit logs, role-based access across 10+ roles, multi-tenant data isolation, and 201 CMR 17.00 aligned security practices.</p>
            <div className="feature-showcase__bullets" style={{ marginTop: 16 }}>
              {["Comprehensive audit logs for every action", "Role-based permissions across 10+ configurable roles", "Multi-tenant architecture with complete data isolation", "201 CMR 17.00 compliance monitoring", "User invitation workflow with verification", "Firm settings, branding, and customization"].map((b, j) => <div key={j} className="feature-showcase__bullet" style={{ color: "rgba(255,255,255,0.7)" }}><div className="feature-showcase__bullet-check">✓</div>{b}</div>)}
            </div>
          </div>
          <div className="feature-showcase__visual">
            <MockupShowcase html={mockup_admin} label="Audit Logs" caption="Comprehensive audit trail." />
          </div>
        </div>
      </div>
    </section>

    {/* Testimonials */}
    <section className="section">
      <div className="container">
        <SectionHead badge="Early Access" title="Join the First Wave" />
        <div style={{ textAlign: "center", padding: "32px", background: "var(--accent-subtle)", borderRadius: "var(--radius-xl)" }}>
          <div style={{ fontSize: "1.5rem", marginBottom: 12 }}><Icon name="ri-rocket-line" size={24} /></div>
          <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--ink-800)" }}>Join Our Early Access Program</h3>
          <p style={{ fontSize: "0.88rem", color: "var(--gray-500)", marginTop: 8, maxWidth: 400, marginLeft: "auto", marginRight: "auto" }}>Be among the first PI firms across America to use Legience. Priority onboarding, founding member pricing, and direct team access.</p>
          <Link to="/contact" className="btn btn--primary" style={{ marginTop: 16 }}>Apply for Early Access →</Link>
        </div>
  
      </div>
    </section>
  </>
}
