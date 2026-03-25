import { useState, useEffect, useRef } from "react"
import { Link, useLocation } from "react-router-dom"
import { blueLogo, whiteLogo } from "../../assets/logos"
import {
  FolderOpen, Timer, Brain, FileText, ScanSearch,
  PenLine, UserCheck, BookUser, PieChart, Stethoscope, Scale, Users,
  ShieldCheck, Send, ChevronDown,
  X, Menu, ArrowRight, Sparkles
} from "lucide-react"

/* ── Nav data with Lucide icons ── */
const PLATFORM_CARDS = [
  { to: "/features#feat-0", name: "Case Management", desc: "9-tab case files with custom fields, deadlines, and court tracking." },
  { to: "/features#feat-5", name: "Time & Invoicing", desc: "One-click timers, approval workflows, branded invoices." },
  { to: "/features#feat-7", name: "CRM & Intake", desc: "Lead pipeline, scoring, conflict checks, intake forms." },
  { to: "/features#feat-8", name: "Client Portal", desc: "Branded portal for cases, docs, invoices, messaging." },
  { to: "/features#feat-6", name: "E-Signatures", desc: "Unlimited via BoldSign. Templates, tracking, no add-on." },
  { to: "/features#feat-9", name: "Task Management", desc: "Kanban boards, workflows, due dates, case-linked tasks." },
  { to: "/features#feat-10", name: "Document Manager", desc: "Case-organized storage, checklists, full-text search." },
  { to: "/features#feat-11", name: "Analytics", desc: "Revenue, utilization, and 10 role-based dashboards." },
  { to: "/features#feat-12", name: "Conflict Checking", desc: "Automated detection, resolution workflows, ABA compliant." },
]

const AI_CARDS = [
  { to: "/ai-platform#tool-0", name: "LegiSearch", desc: "Conversational research with verified citations." },
  { to: "/ai-platform#tool-1", name: "LegiDraft", desc: "30+ document types. Motions, pleadings, contracts." },
  { to: "/ai-platform#tool-2", name: "LegiLyze", desc: "Deep analysis with case context and conversation history.", badge: "NEW" },
  { to: "/ai-platform#tool-3", name: "LegiMed", desc: "AI summaries, ICD-10 extraction, gap detection." },
]

const PRACTICE_CARDS = [
  { to: "/pi-workspace", name: "Personal Injury", desc: "Damage calc, demand letters, settlement tracking." },
]

const COMPANY_CARDS = [
  { to: "/about", name: "About", desc: "Our mission, team, and why we built Legience." },
  { to: "/security", name: "Security & Compliance", desc: "AES-256 encryption, 201 CMR 17.00 compliance." },
  { to: "/contact", name: "Contact", desc: "Book a demo, get support, or start your free trial." },
]

/* ── Mega menu card component ── */
function MCard({ to, name, desc, featured, dashed, badge, onClick }) {
  if (dashed) {
    return (
      <Link to={to} className="nav__mcard nav__mcard--dashed" onClick={onClick}>
        {name}
      </Link>
    )
  }
  return (
    <Link to={to} className={`nav__mcard${featured ? " nav__mcard--featured" : ""}`} onClick={onClick}>
      <div className="nav__mcard__title">
        {name}
        {badge && <span className="nav__new">{badge}</span>}
        <svg className="nav__mcard__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      </div>
      <div className="nav__mcard__text">{desc}</div>
    </Link>
  )
}

/* ── Dropdown wrapper ── */
function NavDropdown({ label, children, isAI, hover, idx, open, close, small, extraSmall, style }) {
  const isOpen = hover === idx
  return (
    <div className="nav__item" onMouseEnter={() => open(idx)} onMouseLeave={close}>
      {isAI ? (
        <button className="nav__ai-btn">
          <Sparkles size={12} /> AI
          <ChevronDown size={10} style={{ opacity: 0.5, transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "none" }} />
        </button>
      ) : (
        <button className="nav__trigger">
          {label}
          <svg style={{ width: 10, height: 10, transition: "transform 0.2s", opacity: 0.5, transform: isOpen ? "rotate(180deg)" : "none" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6"/></svg>
        </button>
      )}
      <div
        className={`nav__mega${small ? " nav__mega--sm" : ""}${extraSmall ? " nav__mega--xs" : ""}`}
        style={isOpen ? { opacity: 1, visibility: "visible", pointerEvents: "auto", transform: "translateX(-50%) translateY(0)", ...style } : style}
      >
        {children}
      </div>
    </div>
  )
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mob, setMob] = useState(false)
  const [hover, setHover] = useState(null)
  const loc = useLocation()
  const closeTimer = useRef(null)

  useEffect(() => {
    const f = () => setScrolled(scrollY > 40)
    addEventListener("scroll", f, { passive: true }); f()
    return () => removeEventListener("scroll", f)
  }, [])

  useEffect(() => { setMob(false); setHover(null) }, [loc.pathname, loc.hash])

  const open = (i) => { clearTimeout(closeTimer.current); setHover(i) }
  const close = () => { closeTimer.current = setTimeout(() => setHover(null), 150) }
  const dismiss = () => setHover(null)

  return (
    <nav className={`nav ${scrolled ? "nav--scrolled" : ""}`}>
      <div className="nav__inner">
        <Link to="/" className="nav__logo" aria-label="Legience Home" dangerouslySetInnerHTML={{ __html: scrolled ? blueLogo : whiteLogo }} />

        <div className="nav__links">
          {/* Platform — 3-col mega */}
          <NavDropdown label="Platform" idx={0} hover={hover} open={open} close={close}>
            <div className="nav__mega-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
              {PLATFORM_CARDS.map((c, i) => <MCard key={i} {...c} onClick={dismiss} />)}
              <MCard to="/features" name="View all features →" dashed onClick={dismiss} />
            </div>
          </NavDropdown>

          {/* AI — 2-col mega with special AI button */}
          <NavDropdown isAI idx={1} hover={hover} open={open} close={close} small>
            <div className="nav__mega-grid">
              {AI_CARDS.map((c, i) => <MCard key={i} {...c} onClick={dismiss} />)}
              <MCard to="/ai-platform" name="View LegiSpace platform →" dashed onClick={dismiss} />
            </div>
          </NavDropdown>

          {/* Practice Areas — 2-col mega */}
          <NavDropdown label="Practice Areas" idx={2} hover={hover} open={open} close={close} small>
            <div className="nav__mega-grid">
              {PRACTICE_CARDS.map((c, i) => <MCard key={i} {...c} onClick={dismiss} />)}
              <MCard to="/practice-areas" name="All practice areas →" dashed onClick={dismiss} />
            </div>
          </NavDropdown>

          <Link to="/pricing" className="nav__link">Pricing</Link>

          <NavDropdown label={<>Resources <span style={{ fontSize: "0.55rem", padding: "1px 5px", background: "var(--accent, #1e56b6)", color: "white", borderRadius: 3, fontWeight: 700 }}>NEW</span></>} idx={3} hover={hover} open={open} close={close} extraSmall style={{ minWidth: 320 }}>
            <div className="nav__mega-grid" style={{ gridTemplateColumns: "1fr" }}>
              <MCard to="/blog" name="Blog" desc="Guides, case studies & legal tech insights." onClick={dismiss} />
              <MCard to="/tools/sol-calculator" name="SOL Calculator" desc="Statute of limitations deadlines for all 50 states." onClick={dismiss} badge="FREE" />
              <MCard to="/tools/pi-settlement-calculator" name="PI Settlement Calculator" desc="Estimate personal injury settlement value instantly." onClick={dismiss} badge="FREE" />
              <MCard to="/tools/court-filing-fees" name="Court Filing Fee Lookup" desc="Filing fees for all 50 states by court type." onClick={dismiss} badge="FREE" />
            </div>
          </NavDropdown>

          {/* Company — 1-col mega */}
          <NavDropdown label="Company" idx={5} hover={hover} open={open} close={close} extraSmall style={{ minWidth: 320 }}>
            <div className="nav__mega-grid" style={{ gridTemplateColumns: "1fr" }}>
              {COMPANY_CARDS.map((c, i) => <MCard key={i} {...c} onClick={dismiss} />)}
            </div>
          </NavDropdown>
        </div>

        <div className="nav__cta">
          <Link to="/contact" className="nav__login">Log in</Link>
          <Link to="/contact" className="btn btn--primary" style={{ padding: "10px 22px", fontSize: "0.82rem", display: "inline-flex", alignItems: "center", gap: 6 }}>
            Book a Demo <ArrowRight size={14} />
          </Link>
          <button className="nav__mob" onClick={() => setMob(!mob)} aria-label="Menu">
            {mob ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {mob && (
        <div className="nav__mob-menu open">
          <Link to="/features" onClick={() => setMob(false)}>Platform</Link>
          <Link to="/ai-platform" onClick={() => setMob(false)}>LegiSpace AI</Link>
          <Link to="/practice-areas" onClick={() => setMob(false)}>Practice Areas</Link>
          <Link to="/pricing" onClick={() => setMob(false)}>Pricing</Link>
          <Link to="/blog" onClick={() => setMob(false)}>Blog</Link>
          <Link to="/tools/sol-calculator" onClick={() => setMob(false)}>SOL Calculator</Link>
          <Link to="/tools/pi-settlement-calculator" onClick={() => setMob(false)}>PI Settlement Calculator</Link>
          <Link to="/tools/court-filing-fees" onClick={() => setMob(false)}>Court Filing Fees</Link>
          <Link to="/about" onClick={() => setMob(false)}>About</Link>
          <Link to="/security" onClick={() => setMob(false)}>Security</Link>
          <Link to="/contact" onClick={() => setMob(false)}>Contact</Link>
          <Link to="/contact" onClick={() => setMob(false)} style={{ color: "var(--accent, #1e56b6)", fontWeight: 600 }}>Book a Demo →</Link>
        </div>
      )}
    </nav>
  )
}
