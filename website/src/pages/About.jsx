import Icon from "../components/ui/Icon"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import PageHero from "../components/ui/PageHero"
import SectionHead from "../components/ui/SectionHead"

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] } } }

const stats = [
  { value: "14", label: "Integrated Modules", color: "#5bb8e8" },
  { value: "50+", label: "States Supported", color: "#0ab39c" },
  { value: "30+", label: "AI Document Types", color: "#a78bfa" },
  { value: "10", label: "Role-Based Dashboards", color: "#f7b84b" },
]

const story = [
  { num: "01", title: "The Problem", text: "Law firms were paying for 5-6 disconnected tools — one for case management, another for research, another for signatures, a separate CRM, billing software, and a client portal. Each with its own login, its own invoice, its own data silo. Attorneys spent more time switching between tools than practicing law.", color: "#f48168" },
  { num: "02", title: "The Insight", text: "We talked to dozens of attorneys and found the same pattern: they didn't need better point solutions. They needed one platform that actually connected everything — where a case file links to its documents, which link to billing entries, which feed into analytics. No imports, no exports, no middleware.", color: "#f7b84b" },
  { num: "03", title: "The Platform", text: "Legience is the result. A comprehensive practice management platform with AI-powered research and drafting built in from day one — not bolted on as an afterthought. Every module shares the same data layer, the same permission model, and the same interface. One login. One platform. One price.", color: "#0ab39c" },
]

const values = [
  { icon: "ri-focus-3-line", title: "Everything Connected", desc: "No data silos. Your cases, documents, billing, tasks, calendar, and communications all live in one system and reference each other automatically. A change in one place ripples everywhere it matters.", accent: "#5bb8e8" },
  { icon: "ri-lock-line", title: "Security Without Compromise", desc: "AES-256 encryption at rest, TLS in transit. AI processing through AWS Bedrock under BAA — your data is never used to train models. Security practices aligned with 201 CMR 17.00. Attorney-client privilege is non-negotiable.", accent: "#0ab39c" },
  { icon: "ri-lightbulb-line", title: "AI That Augments, Not Replaces", desc: "Claude AI handles research, drafting, and analysis — but you stay in control. Every citation is verified. Every document is yours to review. The AI does the heavy lifting; you make the decisions.", accent: "#a78bfa" },
  { icon: "ri-money-dollar-circle-line", title: "Transparent, Predictable Pricing", desc: "One subscription includes every module. No per-case AI fees. No per-send e-signature charges. No surprise invoices. What you see on the pricing page is exactly what you pay — forever.", accent: "#f7b84b" },
  { icon: "ri-rocket-line", title: "Continuous Innovation", desc: "We ship improvements every week based on direct attorney feedback. New AI capabilities, workflow automations, and integrations. Your firm gets better tools without ever having to migrate again.", accent: "#f48168" },
  { icon: "ri-government-line", title: "Built for Legal, Not Adapted", desc: "Every feature is designed around how law firms actually operate — from statute of limitations tracking to conflict checking to IOLTA compliance. We don't retrofit generic tools for legal; we build legal-first.", accent: "#299cdb" },
]

const whyItems = [
  { text: "14 modules in one platform — no stitching together separate tools", icon: "ri-dashboard-3-line" },
  { text: "AI-powered research, drafting, and document analysis built in", icon: "ri-brain-line" },
  { text: "Practice-area-specific workflows, not generic templates", icon: "ri-scales-3-line" },
  { text: "Multi-tenant architecture with complete data isolation per firm", icon: "ri-shield-check-line" },
  { text: "Designed by people who understand how law firms actually work", icon: "ri-government-line" },
]

function Ic({ c, size = 22 }) { return c && c.startsWith("ri-") ? <Icon name={c} size={size} /> : <span>{c}</span> }

export default function About() {
  return <>
    <PageHero badge="About Legience" title="One Platform to Replace" gradient="Five Disconnected Tools." subtitle="Legience is a comprehensive legal practice management platform built from the ground up for modern law firms — combining case management, billing, client relations, document handling, and AI-powered legal research into a single system." />

    {/* Our Story — vertical timeline */}
    <section className="section" style={{ background: "var(--off-white)" }}><div className="container">
      <SectionHead badge="Our Story" title="Why Legience Exists" subtitle="The journey from frustration to a platform that changes how law firms operate." />
      <div style={{ maxWidth: 700, margin: "0 auto", position: "relative", paddingLeft: 32 }}>
        {/* Vertical line */}
        <div style={{ position: "absolute", left: 11, top: 8, bottom: 8, width: 2, background: "linear-gradient(to bottom, #f48168, #f7b84b, #0ab39c)", borderRadius: 2 }} />
        {story.map((s, i) => (
          <motion.div key={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
            style={{ position: "relative", marginBottom: i < story.length - 1 ? 40 : 0 }}>
            {/* Dot */}
            <div style={{ position: "absolute", left: -27, top: 6, width: 14, height: 14, borderRadius: "50%", background: s.color, border: "3px solid var(--off-white)", boxShadow: `0 0 0 2px ${s.color}40` }} />
            <div style={{ padding: "24px 28px", background: "#fff", borderRadius: 16, border: "1px solid var(--gray-100)", transition: "all 0.3s" }}
              onMouseOver={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = `0 16px 40px -12px ${s.color}15`; e.currentTarget.style.borderColor = `${s.color}30` }}
              onMouseOut={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = "var(--gray-100)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "0.72rem", fontWeight: 700, color: s.color, letterSpacing: "0.04em" }}>{s.num}</span>
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem", fontWeight: 700, color: "var(--ink-800)" }}>{s.title}</h3>
              </div>
              <p style={{ fontSize: "0.9rem", color: "var(--gray-500)", lineHeight: 1.75 }}>{s.text}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div></section>

    {/* Mission — dramatic centered */}
    <section className="section section--dark" style={{ padding: "96px 0" }}><div className="bg-grid" /><div className="bg-noise" />
      <div className="container" style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} style={{ maxWidth: 680, margin: "0 auto" }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(56,182,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <Icon name="ri-focus-3-line" size={24} style={{ color: "var(--accent-light)" }} />
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 14px", background: "rgba(56,182,255,0.08)", borderRadius: 20, marginBottom: 20, fontSize: "0.72rem", fontWeight: 600, color: "var(--accent-light)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Our Mission</div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.5rem, 3.5vw, 2.2rem)", fontWeight: 700, color: "#fff", lineHeight: 1.35, letterSpacing: "-0.01em" }}>
            To give every law firm access to enterprise-grade practice management and AI tools — at a price that makes sense for firms of any size.
          </h2>
          <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.55)", lineHeight: 1.8, marginTop: 20, maxWidth: 600, marginLeft: "auto", marginRight: "auto" }}>
            We believe attorneys should spend their time on strategy, advocacy, and client relationships — not wrestling with disconnected software, manual data entry, or overpriced AI add-ons. Legience exists to make that possible.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 36, maxWidth: 600, marginLeft: "auto", marginRight: "auto" }}>
            <div style={{ padding: "16px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, textAlign: "center" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--accent-light)" }}>1</div>
              <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", marginTop: 4 }}>Platform for everything</div>
            </div>
            <div style={{ padding: "16px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, textAlign: "center" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--accent-light)" }}>0</div>
              <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", marginTop: 4 }}>Hidden fees or add-ons</div>
            </div>
            <div style={{ padding: "16px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, textAlign: "center" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--accent-light)" }}>100%</div>
              <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", marginTop: 4 }}>Attorney-controlled AI</div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>

    {/* Values — cards with accent top borders */}
    <section className="section" style={{ background: "#fff" }}><div className="container">
      <SectionHead badge="Our Values" title="What Guides Every Decision" subtitle="From architecture choices to pricing to how we handle your data." />
      <motion.div className="values-grid" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={{ visible: { transition: { staggerChildren: 0.07 } } }} style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
        {values.map((v, i) => (
          <motion.div key={i} variants={fadeUp}
            style={{ padding: "28px 24px", borderRadius: 16, border: "1px solid var(--gray-100)", position: "relative", overflow: "hidden", transition: "all 0.35s", background: "#fff" }}
            onMouseOver={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = `0 20px 48px -12px ${v.accent}18`; e.currentTarget.style.borderColor = `${v.accent}30` }}
            onMouseOut={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = "var(--gray-100)" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${v.accent}, transparent)` }} />
            <div style={{ width: 40, height: 40, borderRadius: 12, background: `${v.accent}12`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14, color: v.accent }}>
              <Ic c={v.icon} size={20} />
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.05rem", color: "var(--ink-800)" }}>{v.title}</div>
            <p style={{ fontSize: "0.85rem", color: "var(--gray-500)", marginTop: 8, lineHeight: 1.7 }}>{v.desc}</p>
          </motion.div>
        ))}
        {/* Last two centered */}
      </motion.div>
    </div></section>

    {/* Why Legience — split layout */}
    <section className="section" style={{ background: "var(--off-white)" }}><div className="container">
      <div className="built-diff" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 56, alignItems: "center" }}>
        <div>
          <div className="label" style={{ color: "var(--accent)", background: "rgba(30,86,182,0.06)", marginBottom: 12 }}>Why Legience</div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.4rem, 3vw, 1.9rem)", fontWeight: 700, color: "var(--ink-800)", lineHeight: 1.3 }}>Built Different,<br />On Purpose.</h2>
          <p style={{ fontSize: "0.92rem", color: "var(--gray-500)", lineHeight: 1.75, marginTop: 12 }}>
            We're not another generic tool adapted for legal. Legience was designed from the ground up for how law firms actually work — every decision informed by real attorney workflows.
          </p>
          <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
            <Link to="/features" className="btn btn--primary">Explore Features →</Link>
            <Link to="/pricing" className="btn btn--outline">View Pricing</Link>
          </div>
        </div>
        <div className="built-diff__items" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {whyItems.map((item, i) => (
            <motion.div key={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
              style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", background: "#fff", borderRadius: 14, border: "1px solid var(--gray-100)", transition: "all 0.3s" }}
              onMouseOver={e => { e.currentTarget.style.transform = "translateX(4px)"; e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 8px 24px -8px rgba(30,86,182,0.08)" }}
              onMouseOut={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.borderColor = "var(--gray-100)"; e.currentTarget.style.boxShadow = "none" }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--accent-subtle, rgba(30,86,182,0.06))", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "var(--accent)" }}>
                <Ic c={item.icon} size={18} />
              </div>
              <span style={{ fontSize: "0.88rem", color: "var(--gray-600)", fontWeight: 500 }}>{item.text}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </div></section>

  </>
}
