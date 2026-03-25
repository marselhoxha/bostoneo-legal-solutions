import { useState } from "react"
import { Link } from "react-router-dom"
import { Helmet } from "react-helmet-async"
import PageHero from "../components/ui/PageHero"
import SectionHead from "../components/ui/SectionHead"
import Icon from "../components/ui/Icon"

const features = [
  { icon: "ri-bar-chart-box-line", title: "Lead Scoring", desc: "Automatically score incoming leads based on configurable criteria: case type, injury severity, liability strength, referral source, and urgency. Prioritize the leads most likely to convert." },
  { icon: "ri-flow-chart", title: "Pipeline Management", desc: "Track leads through configurable intake stages — from initial contact to signed retainer. Visual pipeline shows exactly where every prospect stands and what action is needed next." },
  { icon: "ri-shield-check-line", title: "Conflict Checking", desc: "Automated conflict checks run against your entire client and case history when new leads enter the pipeline. ABA Rules 1.7, 1.9, and 1.10 compliant. No manual cross-referencing." },
  { icon: "ri-pie-chart-line", title: "Referral ROI Analytics", desc: "Track which referral sources generate the most leads, the highest conversion rates, and the best case outcomes. Know exactly where your marketing spend delivers ROI." },
  { icon: "ri-file-list-line", title: "Intake Forms", desc: "Customizable intake forms that capture case details, contact information, and preliminary case assessment. Data flows directly into the case record when a lead converts." },
  { icon: "ri-user-follow-line", title: "Lead-to-Case Conversion", desc: "One-click conversion from lead to active case. All intake data, documents, and communications transfer automatically — no re-entering information." },
]

const comparison = [
  { f: "Monthly cost (per user)", us: "Included ($99-249)", grow: "$49/user (add-on)", lawmatics: "$200+/mo base", ruler: "Custom pricing" },
  { f: "Case management included", us: "Yes (14 modules)", grow: "No (needs Manage)", lawmatics: "No (CRM only)", ruler: "No (CRM only)" },
  { f: "AI legal research", us: "Yes (LegiSearch)", grow: "No", lawmatics: "No", ruler: "No" },
  { f: "AI document drafting", us: "Yes (LegiDraft)", grow: "No", lawmatics: "No", ruler: "No" },
  { f: "Conflict checking", us: "Automated (ABA compliant)", grow: "Basic", lawmatics: "No", ruler: "No" },
  { f: "E-signatures", us: "Unlimited (included)", grow: "Add-on ($)", lawmatics: "No", ruler: "No" },
  { f: "Client portal", us: "Free (included)", grow: "Separate product", lawmatics: "No", ruler: "No" },
  { f: "Referral ROI tracking", us: "Yes", grow: "Basic", lawmatics: "Yes", ruler: "Yes" },
  { f: "Lead scoring", us: "Yes", grow: "Yes", lawmatics: "Yes", ruler: "Yes" },
]

const faqs = [
  { q: "What is a law firm CRM?", a: "A law firm CRM (Client Relationship Management) is software that manages your firm's intake pipeline — tracking leads from first contact through signed retainer, scoring lead quality, managing referral sources, and automating follow-up. It's the system that turns potential clients into paying clients." },
  { q: "How is Legience's CRM different from Clio Grow?", a: "Clio Grow is a standalone CRM that costs $49/user/month on top of Clio Manage. Legience includes CRM, intake management, and automated conflict checking as part of the full platform — alongside case management, AI research, document drafting, billing, and 10 other modules. No separate subscription, no data silos." },
  { q: "Does Legience replace Lawmatics?", a: "For most firms, yes. Lawmatics is a standalone CRM/intake tool starting at $200+/month. Legience includes the same core CRM functionality — lead scoring, pipeline management, intake forms, referral tracking — plus 13 additional modules including AI and case management. One platform, one price." },
  { q: "How does automated conflict checking work?", a: "When a new lead enters your pipeline, Legience automatically checks the lead's name, parties, and related entities against your entire client and case history. It flags potential conflicts under ABA Rules 1.7 (current client conflicts), 1.9 (former client conflicts), and 1.10 (imputed conflicts). Results are logged for compliance." },
  { q: "Can I customize intake forms?", a: "Yes. Create custom intake forms with fields tailored to your practice area. Capture case type, injury details, liability assessment, insurance information, and any other data your firm needs. Form submissions create lead records automatically." },
  { q: "How much does Legience's CRM cost?", a: "The CRM and intake management module is included in every Legience plan. Starter at $99/month, Professional at $169/month, and Firm at $249/month. No additional per-user fees for CRM features." },
]

export default function LawFirmCRM() {
  const [openFaq, setOpenFaq] = useState(null)
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } }))
  }
  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Legience — Law Firm CRM & Intake Management",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: "Law firm CRM with lead scoring, intake pipeline management, automated conflict checking, and referral ROI analytics. Included in Legience legal practice management.",
    offers: { "@type": "AggregateOffer", lowPrice: "99", highPrice: "249", priceCurrency: "USD" }
  }

  return <>
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
      <script type="application/ld+json">{JSON.stringify(softwareSchema)}</script>
    </Helmet>

    <PageHero
      badge="Law Firm CRM"
      title="Law Firm CRM &"
      gradient="Intake Management."
      subtitle="Score leads, manage your intake pipeline, run automated conflict checks, and track referral ROI — all built into your practice management platform."
    />

    {/* Features */}
    <section className="section" style={{ background: "#fff" }}>
      <div className="container">
        <SectionHead badge="CRM Features" title="Everything You Need to Convert Leads" subtitle="From first contact to signed retainer — one system manages the entire intake process." />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
          {features.map((f, i) => (
            <div key={i} style={{ padding: "22px 18px", border: "1px solid var(--gray-100)", borderRadius: 14, transition: "all 0.3s" }}
              onMouseOver={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.transform = "translateY(-2px)" }}
              onMouseOut={e => { e.currentTarget.style.borderColor = "var(--gray-100)"; e.currentTarget.style.transform = "none" }}>
              <Icon name={f.icon} size={22} style={{ color: "var(--accent)" }} />
              <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--ink-800)", marginTop: 10 }}>{f.title}</div>
              <p style={{ fontSize: "0.82rem", color: "var(--gray-400)", marginTop: 6, lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* Why integrated CRM */}
    <section className="section section--muted">
      <div className="container" style={{ maxWidth: 800 }}>
        <SectionHead badge="Why Integrated" title="Why Your CRM Should Live Inside Your Practice Management" />
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[
            ["No data silos", "When a lead converts to a client, all their intake data, documents, and communications flow directly into the case record. No manual re-entry, no lost information."],
            ["Conflict checking at intake", "Standalone CRMs can't check conflicts against your case history because they don't have access to it. An integrated CRM checks every new lead against every client and matter automatically."],
            ["One subscription, one vendor", "Clio charges $49/user/month for Grow on top of $109/user for Manage. Lawmatics charges $200+/month as a standalone. Legience includes CRM in every plan from $99/month — alongside 13 other modules."],
            ["End-to-end visibility", "Track the full client lifecycle — from lead to case to settlement to billing — in one system. No switching between tools to understand a client's complete history."],
          ].map(([title, desc], i) => (
            <div key={i} style={{ background: "#fff", border: "1px solid var(--gray-100)", borderRadius: 12, padding: "18px 20px" }}>
              <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--ink-800)" }}>{title}</div>
              <p style={{ fontSize: "0.82rem", color: "var(--gray-400)", marginTop: 6, lineHeight: 1.6 }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* Comparison */}
    <section className="section" style={{ background: "#fff" }}>
      <div className="container">
        <SectionHead badge="Comparison" title="Legience CRM vs. Standalone Tools" subtitle="Why pay extra for a CRM when it should be part of your platform?" />
        <div className="comp-wrap">
          <table className="comp-table">
            <thead>
              <tr>
                <th style={{ width: "22%" }}>Feature</th>
                <th style={{ background: "rgba(30,86,182,0.04)", fontWeight: 800, color: "var(--accent)" }}>Legience</th>
                <th>Clio Grow</th>
                <th>Lawmatics</th>
                <th>Law Ruler</th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((r, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600, color: "var(--ink-800)" }}>{r.f}</td>
                  <td style={{ fontWeight: 700, color: "var(--accent)", background: "rgba(30,86,182,0.02)" }}>{r.us}</td>
                  <td>{r.grow}</td>
                  <td>{r.lawmatics}</td>
                  <td>{r.ruler}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>

    {/* FAQ */}
    <section className="section section--muted"><div className="container">
      <SectionHead badge="FAQ" title="Frequently Asked Questions" subtitle="Common questions about law firm CRM and intake management." />
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {faqs.map((f, i) => <div key={i} className={`faq-item ${openFaq === i ? "open" : ""}`}>
          <button className="faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)}><span>{f.q}</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18, transition: "0.3s", transform: openFaq === i ? "rotate(180deg)" : "none", flexShrink: 0 }}><path d="M6 9l6 6 6-6" /></svg></button>
          <div className="faq-a"><div className="faq-a__inner">{f.a}</div></div>
        </div>)}
      </div>
    </div></section>

    {/* CTA */}
    <section className="section" style={{ background: "linear-gradient(135deg, var(--ink-950), #0b1e40)", color: "#fff", textAlign: "center" }}>
      <div className="bg-grid" /><div className="bg-noise" />
      <div className="container" style={{ position: "relative", zIndex: 1 }}>
        <h2 className="h2" style={{ color: "#fff" }}>Stop Losing Leads to Disconnected Tools</h2>
        <p className="sub" style={{ color: "rgba(255,255,255,0.65)", marginTop: 12 }}>
          14-day free trial. No credit card required. Full CRM, conflict checking, and all 14 platform modules.
        </p>
        <div style={{ marginTop: 24, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link to="/contact" className="btn btn--primary btn--lg">Start Free Trial</Link>
          <Link to="/pricing" className="btn btn--secondary btn--lg" style={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}>View Pricing</Link>
        </div>
        <div style={{ marginTop: 20, display: "flex", gap: 24, justifyContent: "center", fontSize: "0.78rem", color: "rgba(255,255,255,0.5)", flexWrap: "wrap" }}>
          <span>Also see: <Link to="/features" style={{ color: "var(--accent-light)" }}>All 14 Features</Link></span>
          <span><Link to="/compare/legience-vs-clio" style={{ color: "var(--accent-light)" }}>Legience vs Clio</Link></span>
          <span><Link to="/blog/clio-alternatives-2026" style={{ color: "var(--accent-light)" }}>Clio Alternatives Guide</Link></span>
        </div>
      </div>
    </section>
  </>
}
