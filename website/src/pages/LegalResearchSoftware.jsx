import { useState } from "react"
import { Link } from "react-router-dom"
import { Helmet } from "react-helmet-async"
import PageHero from "../components/ui/PageHero"
import SectionHead from "../components/ui/SectionHead"
import Icon from "../components/ui/Icon"

const comparison = [
  { f: "Monthly cost (per user)", us: "Included ($99-249)", westlaw: "$85-300+", lexis: "$85-250+", cocounsel: "$100+" },
  { f: "Natural language queries", us: "Yes", westlaw: "Yes", lexis: "Yes", cocounsel: "Yes" },
  { f: "Citation verification", us: "Yes", westlaw: "Yes", lexis: "Yes", cocounsel: "Yes" },
  { f: "Case management integrated", us: "Native", westlaw: "No (standalone)", lexis: "No (standalone)", cocounsel: "No (standalone)" },
  { f: "AI document drafting", us: "Yes (LegiDraft)", westlaw: "No", lexis: "No", cocounsel: "Limited" },
  { f: "Research saved to case", us: "Automatic", westlaw: "Manual export", lexis: "Manual export", cocounsel: "Manual" },
  { f: "E-signatures included", us: "Yes", westlaw: "No", lexis: "No", cocounsel: "No" },
  { f: "CRM & billing included", us: "Yes", westlaw: "No", lexis: "No", cocounsel: "No" },
  { f: "No AI training on your data", us: "Yes (AWS Bedrock BAA)", westlaw: "Varies", lexis: "Varies", cocounsel: "Yes" },
]

const benefits = [
  { icon: "ri-timer-line", title: "3-5x Faster Research", desc: "Tasks that took 3-6 hours with manual research take 15-30 minutes with LegiSearch. The AI identifies relevant authorities, synthesizes holdings, and presents cited results." },
  { icon: "ri-shield-check-line", title: "Verified Citations", desc: "Every case cited is checked against real databases. No hallucinated citations — the #1 risk with consumer AI tools. Every citation includes a link to the source." },
  { icon: "ri-link", title: "Integrated with Your Cases", desc: "Research results are automatically saved to the relevant case file. No copying between systems. LegiDraft can reference your research when generating documents." },
  { icon: "ri-money-dollar-box-line", title: "Included in Your Plan", desc: "No separate subscription. LegiSearch is included in every Legience plan from $99/mo — AI research built directly into your case management workflow." },
  { icon: "ri-lock-line", title: "Secure AI Processing", desc: "AI queries processed through AWS Bedrock under our Business Associate Agreement. Your data is never used for AI training. AES-256 encryption, US-only hosting, ABA Opinion 512 compliant." },
  { icon: "ri-chat-3-line", title: "Plain English Queries", desc: "Ask legal questions in natural language. No Boolean operators required. The AI understands context, jurisdiction, and legal concepts." },
]

const faqs = [
  { q: "How does AI legal research work in Legience?", a: "LegiSearch uses Claude AI with retrieval-augmented generation (RAG). When you ask a legal question, the system retrieves relevant case law and statutes from verified databases, then synthesizes a cited answer. Every citation is verified — no hallucinated references." },
  { q: "How does LegiSearch compare to traditional research platforms?", a: "LegiSearch is an AI-assisted research tool built into your case management workflow. It's ideal for day-to-day legal questions, case law lookups, and jurisdiction-specific queries. Some firms use it alongside traditional research platforms for specialized or exhaustive research needs. It's included in your Legience subscription ($99-249/mo) with no additional cost." },
  { q: "How much does LegiSearch cost?", a: "LegiSearch is included in every Legience plan. Starter ($99/mo) includes 200 queries/month, Professional ($169/mo) includes 500 queries/month, and Firm ($249/mo) includes unlimited queries. No per-query fees." },
  { q: "Can I trust AI legal research results?", a: "AI legal research is a research accelerator, not a replacement for attorney judgment. Every result should be verified by the attorney — just as you would verify research from an associate. LegiSearch verifies citations against source databases, but the attorney's professional duty of competence (ABA Rule 1.1) requires independent review." },
  { q: "Is my research data kept private?", a: "Yes. AI queries are processed through AWS Bedrock under our Business Associate Agreement (BAA). Your data is never used for model training. AES-256 encryption at rest, TLS encryption in transit, US-only hosting." },
  { q: "What jurisdictions does LegiSearch cover?", a: "LegiSearch covers federal case law and all 50 US states. Results include jurisdiction-specific authorities and are filtered by the state and court level relevant to your query." },
]

export default function LegalResearchSoftware() {
  const [openFaq, setOpenFaq] = useState(null)
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } }))
  }
  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "LegiSearch — AI Legal Research Software",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: "AI-assisted legal research software with case law citations. Natural language queries, integrated with case management. Included from $99/month.",
    offers: { "@type": "AggregateOffer", lowPrice: "99", highPrice: "249", priceCurrency: "USD" }
  }

  return <>
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
      <script type="application/ld+json">{JSON.stringify(softwareSchema)}</script>
    </Helmet>

    <PageHero
      badge="AI Legal Research"
      title="AI Legal Research Software"
      gradient="with Verified Citations."
      subtitle="Ask legal questions in plain English. Get cited case law answers in minutes. Included in every Legience plan — no separate research subscription needed."
    />

    {/* Benefits */}
    <section className="section" style={{ background: "#fff" }}>
      <div className="container">
        <SectionHead badge="Why LegiSearch" title="Legal Research, Reimagined" subtitle="Research that once took hours now takes minutes — with citations you can trust." />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
          {benefits.map((b, i) => (
            <div key={i} style={{ padding: "20px 18px", background: "#fff", border: "1px solid var(--gray-100)", borderRadius: 14, transition: "all 0.3s" }}
              onMouseOver={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.transform = "translateY(-2px)" }}
              onMouseOut={e => { e.currentTarget.style.borderColor = "var(--gray-100)"; e.currentTarget.style.transform = "none" }}>
              <span style={{ fontSize: "1.3rem", color: "var(--accent)" }}><Icon name={b.icon} size={22} /></span>
              <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--ink-800)", marginTop: 10 }}>{b.title}</div>
              <p style={{ fontSize: "0.82rem", color: "var(--gray-400)", marginTop: 6, lineHeight: 1.6 }}>{b.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* Comparison */}
    <section className="section section--muted">
      <div className="container">
        <SectionHead badge="Comparison" title="LegiSearch vs. Traditional Research" subtitle="How integrated AI research compares to standalone legal research platforms." />
        <div className="comp-wrap">
          <table className="comp-table">
            <thead>
              <tr>
                <th style={{ width: "22%" }}>Factor</th>
                <th style={{ background: "rgba(30,86,182,0.04)", fontWeight: 800, color: "var(--accent)" }}>LegiSearch™</th>
                <th>Westlaw</th>
                <th>Lexis+ AI</th>
                <th>CoCounsel</th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((r, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600, color: "var(--ink-800)" }}>{r.f}</td>
                  <td style={{ fontWeight: 700, color: "var(--accent)", background: "rgba(30,86,182,0.02)" }}>{r.us}</td>
                  <td>{r.westlaw}</td>
                  <td>{r.lexis}</td>
                  <td>{r.cocounsel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: "0.82rem", color: "var(--gray-400)", textAlign: "center", marginTop: 16 }}>
          Pricing as of 2026. Westlaw, Lexis, and CoCounsel prices reflect published or commonly reported rates.
        </p>
      </div>
    </section>

    {/* How it works */}
    <section className="section" style={{ background: "#fff" }}>
      <div className="container">
        <SectionHead badge="How It Works" title="Research in 3 Steps" subtitle="No Boolean operators. No separate login. Just ask." />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 24, maxWidth: 900, margin: "0 auto" }}>
          {[
            ["ri-chat-3-line", "Ask your question", "Type a legal question in plain English from any case in Legience. The AI understands jurisdiction, practice area, and legal context."],
            ["ri-search-line", "AI retrieves & verifies", "LegiSearch retrieves relevant case law from verified databases using RAG (retrieval-augmented generation). Every citation is verified against the source."],
            ["ri-file-text-line", "Review cited results", "Receive a synthesized answer with cited authorities, linked to source documents. Results save directly to your case file."],
          ].map(([icon, title, desc], i) => (
            <div key={i} style={{ textAlign: "center", padding: 24 }}>
              <div style={{ width: 56, height: 56, borderRadius: 14, background: "rgba(30,86,182,0.06)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <Icon name={icon} size={22} style={{ color: "var(--accent)" }} />
              </div>
              <div style={{ fontWeight: 700, fontSize: "0.92rem", color: "var(--ink-800)" }}>{title}</div>
              <p style={{ fontSize: "0.82rem", color: "var(--gray-400)", marginTop: 8, lineHeight: 1.6 }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* FAQ */}
    <section className="section section--muted"><div className="container">
      <SectionHead badge="FAQ" title="Frequently Asked Questions" subtitle="Common questions about AI legal research software." />
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
        <h2 className="h2" style={{ color: "#fff" }}>Try AI Legal Research Free for 14 Days</h2>
        <p className="sub" style={{ color: "rgba(255,255,255,0.65)", marginTop: 12 }}>
          No credit card required. Full access to LegiSearch, LegiDraft, and all 14 platform modules.
        </p>
        <div style={{ marginTop: 24, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link to="/contact" className="btn btn--primary btn--lg">Start Free Trial</Link>
          <Link to="/pricing" className="btn btn--secondary btn--lg" style={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}>View Pricing</Link>
        </div>
        <div style={{ marginTop: 20, display: "flex", gap: 24, justifyContent: "center", fontSize: "0.78rem", color: "rgba(255,255,255,0.5)", flexWrap: "wrap" }}>
          <span>Also see: <Link to="/ai-platform" style={{ color: "var(--accent-light)" }}>Full AI Platform</Link></span>
          <span><Link to="/legal-drafting-software" style={{ color: "var(--accent-light)" }}>AI Document Drafting</Link></span>
          <span><Link to="/blog/ai-legal-research-2026" style={{ color: "var(--accent-light)" }}>AI Research Guide</Link></span>
        </div>
      </div>
    </section>
  </>
}
