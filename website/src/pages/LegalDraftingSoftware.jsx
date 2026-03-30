import { useState } from "react"
import { Link } from "react-router-dom"
import { Helmet } from "react-helmet-async"
import PageHero from "../components/ui/PageHero"
import SectionHead from "../components/ui/SectionHead"
import Icon from "../components/ui/Icon"

const docTypes = [
  { cat: "Demand & Litigation", items: ["Demand letters", "Motions to compel", "Summary judgment motions", "Complaints", "Answers & affirmative defenses", "Interrogatories", "Discovery requests"] },
  { cat: "Client Communications", items: ["Engagement letters", "Retainer agreements", "Status update letters", "Settlement offer letters", "Case closure letters", "Medical authorization forms"] },
  { cat: "Briefs & Memos", items: ["Legal memoranda", "Trial briefs", "Appellate briefs", "Research summaries", "Case analysis reports", "Opposition briefs"] },
  { cat: "Transactional", items: ["Contracts & agreements", "Lease reviews", "Corporate resolutions", "Operating agreements", "Non-disclosure agreements", "Settlement agreements"] },
]

const comparison = [
  { f: "Cost per demand letter", us: "$0 (included)", evenup: "$500+", precedent: "$275+", manual: "4-8 hrs attorney time" },
  { f: "Document types", us: "30+", evenup: "Demand only", precedent: "Demand only", manual: "Unlimited (manual)" },
  { f: "Case data integration", us: "Native (auto-pull)", evenup: "Manual upload", precedent: "Manual upload", manual: "N/A" },
  { f: "Medical records AI", us: "Integrated", evenup: "Separate", precedent: "No", manual: "N/A" },
  { f: "Generation time", us: "15-30 min", evenup: "24-72 hrs", precedent: "24-48 hrs", manual: "4-8 hrs" },
  { f: "Attorney review required", us: "Yes", evenup: "Yes", precedent: "Yes", manual: "N/A" },
  { f: "Includes legal research", us: "Yes (LegiSearch)", evenup: "No", precedent: "No", manual: "Separate tool" },
  { f: "Practice management included", us: "Yes (14 modules)", evenup: "No", precedent: "No", manual: "Separate tool" },
]

const faqs = [
  { q: "How does AI legal document drafting work?", a: "LegiDraft™ reads your case data, medical records, and research directly from the Legience platform. It generates a structured first draft — with cited authorities, damage calculations, and case-specific facts — in 15-30 minutes. Every draft requires attorney review and approval before use." },
  { q: "Is AI document drafting accurate enough for legal use?", a: "LegiDraft generates comprehensive first drafts, not final products. Every document requires attorney review, editing, and professional judgment before use. The AI handles the time-consuming structure and research synthesis; the attorney provides the legal expertise and quality control." },
  { q: "How much does LegiDraft cost per document?", a: "$0 per document on all Legience plans. LegiDraft is included in your subscription — no per-case fees, no per-document charges. EvenUp charges $500+ per demand letter. Precedent charges $275+. We include drafting as a feature, not a revenue stream." },
  { q: "What document types can LegiDraft generate?", a: "30+ legal document types including demand letters, motions, briefs, complaints, discovery requests, engagement letters, settlement agreements, legal memoranda, and more. The system adapts to your practice area and jurisdiction." },
  { q: "Can I customize the AI-generated documents?", a: "Yes. Every draft is fully editable. You can adjust arguments, modify the demand amount, add case-specific details, change the tone, and apply your firm's formatting preferences before finalizing." },
  { q: "Is my client data safe when using AI drafting?", a: "Yes. AI features are powered through AWS Bedrock under our Business Associate Agreement (BAA). Your data is never used for AI model training. AES-256 encryption, US-only hosting. See our Security page for details." },
]

export default function LegalDraftingSoftware() {
  const [openFaq, setOpenFaq] = useState(null)
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } }))
  }
  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "LegiDraft — AI Legal Document Drafting",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: "AI-powered legal document drafting software that generates demand letters, motions, briefs, and 30+ document types at $0 per case.",
    offers: { "@type": "AggregateOffer", lowPrice: "99", highPrice: "249", priceCurrency: "USD" }
  }

  return <>
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
      <script type="application/ld+json">{JSON.stringify(softwareSchema)}</script>
    </Helmet>

    <PageHero
      badge="AI Legal Drafting"
      title="AI Legal Document Drafting"
      gradient="at $0 Per Case."
      subtitle="Generate demand letters, motions, briefs, and 30+ document types from your case data in minutes — not hours. Included in every Legience plan."
    />

    {/* How it works */}
    <section className="section" style={{ background: "#fff" }}>
      <div className="container">
        <SectionHead badge="How It Works" title="From Case File to Draft in 4 Steps" subtitle="LegiDraft reads your case data, medical records, and research — no duplicate data entry." />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 24, maxWidth: 960, margin: "0 auto" }}>
          {[
            ["1", "Open any case", "LegiDraft pulls facts, parties, medical records, and research directly from your case file."],
            ["2", "Choose document type", "Select from 30+ templates: demand letters, motions, briefs, correspondence, agreements, and more."],
            ["3", "AI generates draft", "Claude AI synthesizes your case data into a structured, cited document draft in 15-30 minutes."],
            ["4", "Review & finalize", "Edit the draft, adjust arguments, and finalize. Every document requires attorney approval."],
          ].map(([num, title, desc], i) => (
            <div key={i} style={{ textAlign: "center", padding: "24px 16px" }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", fontWeight: 800, margin: "0 auto 16px" }}>{num}</div>
              <div style={{ fontWeight: 700, fontSize: "0.92rem", color: "var(--ink-800)" }}>{title}</div>
              <p style={{ fontSize: "0.82rem", color: "var(--gray-400)", marginTop: 8, lineHeight: 1.6 }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* Document types */}
    <section className="section section--muted">
      <div className="container">
        <SectionHead badge="30+ Document Types" title="Every Document Your Firm Needs" subtitle="From demand letters to settlement agreements — one AI drafting engine covers it all." />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
          {docTypes.map((group, gi) => (
            <div key={gi} style={{ background: "#fff", border: "1px solid var(--gray-100)", borderRadius: 14, padding: "20px 18px" }}>
              <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--accent)", marginBottom: 12 }}>{group.cat}</div>
              {group.items.map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderTop: i ? "1px solid var(--gray-50)" : "none" }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" style={{ width: 14, height: 14, flexShrink: 0 }}><path d="M20 6L9 17l-5-5" /></svg>
                  <span style={{ fontSize: "0.82rem", color: "var(--ink-700)" }}>{item}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* Comparison table */}
    <section className="section" style={{ background: "#fff" }}>
      <div className="container">
        <SectionHead badge="Cost Comparison" title="LegiDraft vs. The Alternatives" subtitle="Stop paying per-case fees. AI document drafting should be a feature, not a billing line item." />
        <div className="comp-wrap">
          <table className="comp-table">
            <thead>
              <tr>
                <th style={{ width: "24%" }}>Factor</th>
                <th style={{ background: "rgba(30,86,182,0.04)", fontWeight: 800, color: "var(--accent)" }}>LegiDraft™</th>
                <th>EvenUp</th>
                <th>Precedent</th>
                <th>Manual Drafting</th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((r, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600, color: "var(--ink-800)" }}>{r.f}</td>
                  <td style={{ fontWeight: 700, color: "var(--accent)", background: "rgba(30,86,182,0.02)" }}>{r.us}</td>
                  <td>{r.evenup}</td>
                  <td>{r.precedent}</td>
                  <td>{r.manual}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: "0.82rem", color: "var(--gray-400)", textAlign: "center", marginTop: 16 }}>
          Pricing as of 2026. EvenUp and Precedent prices reflect published or commonly reported rates.
        </p>
      </div>
    </section>

    {/* FAQ */}
    <section className="section section--muted"><div className="container">
      <SectionHead badge="FAQ" title="Frequently Asked Questions" subtitle="Common questions about AI legal document drafting." />
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
        <h2 className="h2" style={{ color: "#fff" }}>Draft Your First Document in Minutes</h2>
        <p className="sub" style={{ color: "rgba(255,255,255,0.65)", marginTop: 12 }}>
          14-day free trial. No credit card required. Full access to LegiDraft and all 14 modules.
        </p>
        <div style={{ marginTop: 24, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link to="/contact" className="btn btn--primary btn--lg">Start Free Trial</Link>
          <Link to="/pricing" className="btn btn--secondary btn--lg" style={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}>View Pricing</Link>
        </div>
        <div style={{ marginTop: 20, display: "flex", gap: 24, justifyContent: "center", fontSize: "0.78rem", color: "rgba(255,255,255,0.5)", flexWrap: "wrap" }}>
          <span>Also see: <Link to="/ai-platform" style={{ color: "var(--accent-light)" }}>AI Platform</Link></span>
          <span><Link to="/blog/ai-demand-letters-legidraft" style={{ color: "var(--accent-light)" }}>How LegiDraft Works</Link></span>
          <span><Link to="/compare/legience-vs-clio" style={{ color: "var(--accent-light)" }}>Legience vs Clio</Link></span>
        </div>
      </div>
    </section>
  </>
}
