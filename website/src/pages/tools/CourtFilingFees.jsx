import { useState, useEffect, useMemo, useRef } from "react"
import { Link } from "react-router-dom"
import { Helmet } from "react-helmet-async"
import { motion, AnimatePresence } from "framer-motion"
import PageHero from "../../components/ui/PageHero"
import SectionHead from "../../components/ui/SectionHead"
import { Scale, FileText, Users, BookOpen, Building2, Copy, Check, Search, ArrowRight, Info, ExternalLink, DollarSign, Gavel, Shield, AlertTriangle } from "lucide-react"

/* ── CONSTANTS ── */
const COURT_TYPES = [
  { key: "civil", label: "State Civil", icon: Scale },
  { key: "smallClaims", label: "Small Claims", icon: FileText },
  { key: "family", label: "Family", icon: Users },
  { key: "probate", label: "Probate", icon: BookOpen },
  { key: "appeals", label: "Appeals", icon: Gavel },
  { key: "federal", label: "Federal", icon: Building2 },
]

const FEDERAL_FEES = {
  civil: { fee: 405, notes: "Uniform filing fee for all U.S. district courts" },
  appeals: { fee: 605, notes: "Circuit court of appeals filing fee" },
  bankruptcy: { chapter7: 338, chapter13: 313, chapter11: 1738, notes: "Filing fees vary by chapter" },
}

const ALL_STATES = [
  "Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut",
  "Delaware","District of Columbia","Florida","Georgia","Hawaii","Idaho","Illinois",
  "Indiana","Iowa","Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts",
  "Michigan","Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada",
  "New Hampshire","New Jersey","New Mexico","New York","North Carolina","North Dakota",
  "Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina",
  "South Dakota","Tennessee","Texas","Utah","Vermont","Virginia","Washington",
  "West Virginia","Wisconsin","Wyoming",
]

const ADDITIONAL_COSTS = [
  { label: "Service of Process", range: "$50 – $150", desc: "Serving the defendant with court documents via sheriff or process server." },
  { label: "Motion Filing", range: "$15 – $60", desc: "Fee charged each time you file a motion with the court." },
  { label: "Jury Demand", range: "$100 – $300", desc: "Additional fee when requesting a jury trial instead of a bench trial." },
  { label: "E-Filing Surcharge", range: "$5 – $25", desc: "Processing fee charged by e-filing service providers." },
  { label: "Certified Copies", range: "$10 – $25/page", desc: "Court-certified copies of orders, judgments, and other filings." },
  { label: "Appeals Bond", range: "Varies", desc: "Security deposit required when appealing a judgment, often the judgment amount." },
]

const faqs = [
  { q: "How much does it cost to file a lawsuit?", a: "State court civil filing fees typically range from $75 to $500 depending on the state and case type. Federal court civil filing is $405 nationwide. Additional costs include service of process, motion fees, and potential jury demand fees." },
  { q: "Can filing fees be waived?", a: "Yes. Courts offer fee waivers through the In Forma Pauperis (IFP) process for individuals who cannot afford filing fees. You must demonstrate financial hardship by filing an application with documentation of income, assets, and expenses." },
  { q: "Are federal court filing fees the same everywhere?", a: "Yes. Federal court filing fees are set by the Judicial Conference of the United States and are uniform across all 94 federal district courts. The current civil filing fee is $405." },
  { q: "What is the difference between filing fees and court costs?", a: "Filing fees are paid when you initiate a lawsuit. Court costs are broader and may include service of process, deposition fees, expert witness fees, jury fees, and transcript costs. Filing fees are just one component of the total cost of litigation." },
  { q: "Do filing fees differ by case type?", a: "Yes. Most states charge different fees for different case types. Small claims courts have the lowest fees (often $30–$100), while civil cases and appeals tend to have higher fees. Family and probate courts typically fall in between." },
]

const fmt = v => "$" + v.toLocaleString("en-US")

export default function CourtFilingFees() {
  const [feeData, setFeeData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [state, setState] = useState("")
  const [courtType, setCourtType] = useState("civil")
  const [copied, setCopied] = useState(false)
  const [openFaq, setOpenFaq] = useState(null)
  const [stateSearch, setStateSearch] = useState("")
  const resultRef = useRef(null)
  const prevResult = useRef(null)

  useEffect(() => {
    fetch("/data/filing-fees.json")
      .then(r => r.json())
      .then(data => { setFeeData(data); setLoading(false) })
      .catch(() => { setError("Failed to load fee data"); setLoading(false) })
  }, [])

  const result = useMemo(() => {
    if (courtType === "federal") return null
    if (!state || !courtType || !feeData) return null
    const stateData = feeData[state]
    if (!stateData) return null
    const courtData = stateData[courtType]
    if (!courtData) return null
    const af = stateData.additionalFees || {}
    return {
      ...courtData,
      stateName: state,
      courtLabel: COURT_TYPES.find(c => c.key === courtType)?.label || "",
      serviceOfProcess: af.serviceOfProcess,
      motionFiling: af.motionFiling,
      juryDemand: af.juryDemand,
      feeWaiver: stateData.feeWaiver,
      courtUrl: stateData.courtUrl,
      lastVerified: stateData.lastVerified,
    }
  }, [state, courtType, feeData])

  const isFederal = courtType === "federal"

  // Scroll into view on first result
  if (result && !prevResult.current) {
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 100)
  }
  prevResult.current = result

  const handleCopy = () => {
    let text = ""
    if (isFederal) {
      text = `Federal Court Filing Fees\nCivil: ${fmt(FEDERAL_FEES.civil.fee)}\nAppeals: ${fmt(FEDERAL_FEES.appeals.fee)}\nBankruptcy Ch. 7: ${fmt(FEDERAL_FEES.bankruptcy.chapter7)}\nBankruptcy Ch. 13: ${fmt(FEDERAL_FEES.bankruptcy.chapter13)}\nBankruptcy Ch. 11: ${fmt(FEDERAL_FEES.bankruptcy.chapter11)}\n\nlegience.com/tools/court-filing-fees`
    } else if (result) {
      text = `Court Filing Fee — ${result.stateName}\nCourt: ${result.courtLabel}\nFiling Fee: ${fmt(result.fee)}\n${result.notes ? `Notes: ${result.notes}\n` : ""}${result.lastVerified ? `Verified: ${result.lastVerified}\n` : ""}\nlegience.com/tools/court-filing-fees`
    }
    if (!text) return
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  const filteredStates = stateSearch ? ALL_STATES.filter(s => s.toLowerCase().includes(stateSearch.toLowerCase())) : ALL_STATES

  const faqSchema = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }

  return <>
    <Helmet>
      <title>Court Filing Fees by State — All 50 States + Federal | Legience</title>
      <meta name="description" content="Free court filing fee lookup for all 50 states and federal courts. Find civil, small claims, family, probate, and appeals filing fees instantly." />
      <meta name="keywords" content="court filing fees, filing fee by state, how much to file a lawsuit, court costs, small claims filing fee, federal filing fee" />
      <link rel="canonical" href="https://legience.com/tools/court-filing-fees" />
      <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
    </Helmet>

    <PageHero badge="Free Tool" title="Court Filing Fees" gradient="Lookup." subtitle="Instantly look up filing fees for state and federal courts across all 50 states and DC." />

    {/* ═══ FEE LOOKUP ═══ */}
    <section className="section"><div className="container">
      <div style={{ maxWidth: 860, margin: "0 auto" }}>

        {/* Input card */}
        <div style={{ background: "#fff", border: "1px solid var(--gray-100)", borderRadius: "var(--radius-xl)", padding: "28px 32px", boxShadow: "0 8px 32px -8px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--accent-subtle)", display: "flex", alignItems: "center", justifyContent: "center" }}><Building2 size={20} style={{ color: "var(--accent)" }} /></div>
            <div>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--ink-800)" }}>Look Up Filing Fees</h2>
              <p style={{ fontSize: "0.78rem", color: "var(--gray-400)" }}>Select a state and court type to see current filing fees</p>
            </div>
          </div>

          {/* State selector */}
          <div className="form-group" style={{ margin: "0 0 18px 0" }}>
            <label className="form-label">State</label>
            <select value={state} onChange={e => setState(e.target.value)} className="form-input">
              <option value="">Select state...</option>
              {ALL_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Court type pills */}
          <div>
            <label className="form-label" style={{ marginBottom: 8 }}>Court Type</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {COURT_TYPES.map(c => {
                const Icon = c.icon
                const sel = courtType === c.key
                return (
                  <button key={c.key} onClick={() => setCourtType(c.key)} style={{
                    display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", fontSize: "0.82rem", fontWeight: sel ? 700 : 500,
                    background: sel ? "var(--ink-800)" : "#fff",
                    color: sel ? "#fff" : "var(--gray-500)",
                    border: sel ? "1px solid var(--ink-800)" : "1px solid var(--gray-200)",
                    borderRadius: 8, cursor: "pointer", transition: "all 0.2s"
                  }}>
                    <Icon size={14} />
                    {c.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* ═══ Loading / Error ═══ */}
        {loading && !isFederal && (
          <div style={{ marginTop: 20, textAlign: "center", padding: "40px 20px" }}>
            <div style={{ width: 32, height: 32, border: "3px solid var(--gray-100)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
            <p style={{ fontSize: "0.85rem", color: "var(--gray-400)" }}>Loading fee data...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        )}

        {error && !isFederal && (
          <div style={{ marginTop: 20, padding: "20px 24px", background: "rgba(240,101,72,0.06)", border: "1.5px solid rgba(240,101,72,0.2)", borderRadius: "var(--radius-xl)", display: "flex", alignItems: "center", gap: 10 }}>
            <AlertTriangle size={18} style={{ color: "#f06548", flexShrink: 0 }} />
            <p style={{ fontSize: "0.88rem", color: "#991b1b", margin: 0 }}>{error}. Please try refreshing the page.</p>
          </div>
        )}

        {/* ═══ RESULTS (single AnimatePresence to prevent overlap) ═══ */}
        <AnimatePresence mode="wait">
          {isFederal && (
            <motion.div
              key="federal"
              ref={resultRef}
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              style={{ marginTop: 20, background: "rgba(56,182,255,0.04)", border: "1.5px solid rgba(56,182,255,0.15)", borderRadius: "var(--radius-xl)", padding: "28px 32px", overflow: "hidden" }}
            >
              {/* Header + copy */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", padding: "5px 14px", borderRadius: 100, color: "var(--accent)", border: "1px solid rgba(56,182,255,0.2)" }}>
                    <Building2 size={13} /> Federal Courts
                  </span>
                  <span style={{ fontSize: "0.82rem", color: "var(--gray-500)", fontWeight: 500 }}>Uniform Nationwide Fees</span>
                </div>
                <button onClick={handleCopy} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 12px", fontSize: "0.72rem", fontWeight: 600, background: "#fff", border: "1px solid var(--gray-200)", borderRadius: 6, cursor: "pointer", color: "var(--gray-500)" }}>
                  {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                </button>
              </div>

              {/* Federal fee cards */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
                <div style={{ background: "#fff", borderRadius: 12, padding: "20px 22px", border: "1px solid var(--gray-100)" }}>
                  <div style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--gray-400)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>U.S. District Court (Civil)</div>
                  <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--accent)" }}>{fmt(FEDERAL_FEES.civil.fee)}</div>
                  <p style={{ fontSize: "0.78rem", color: "var(--gray-400)", marginTop: 6, margin: 0 }}>{FEDERAL_FEES.civil.notes}</p>
                </div>
                <div style={{ background: "#fff", borderRadius: 12, padding: "20px 22px", border: "1px solid var(--gray-100)" }}>
                  <div style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--gray-400)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Court of Appeals</div>
                  <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--accent)" }}>{fmt(FEDERAL_FEES.appeals.fee)}</div>
                  <p style={{ fontSize: "0.78rem", color: "var(--gray-400)", marginTop: 6, margin: 0 }}>{FEDERAL_FEES.appeals.notes}</p>
                </div>
              </div>

              {/* Bankruptcy */}
              <div style={{ background: "#fff", borderRadius: 12, padding: "20px 22px", border: "1px solid var(--gray-100)", marginBottom: 20 }}>
                <div style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--gray-400)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>Bankruptcy Court</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  {[
                    { label: "Chapter 7", fee: FEDERAL_FEES.bankruptcy.chapter7 },
                    { label: "Chapter 13", fee: FEDERAL_FEES.bankruptcy.chapter13 },
                    { label: "Chapter 11", fee: FEDERAL_FEES.bankruptcy.chapter11 },
                  ].map((b, i) => (
                    <div key={i} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--gray-500)", marginBottom: 4 }}>{b.label}</div>
                      <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--ink-800)" }}>{fmt(b.fee)}</div>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: "0.78rem", color: "var(--gray-400)", marginTop: 12, marginBottom: 0 }}>{FEDERAL_FEES.bankruptcy.notes}</p>
              </div>

              {/* Note */}
              <div style={{ display: "flex", gap: 10, padding: "12px 16px", background: "rgba(255,255,255,0.7)", borderRadius: 10, border: "1px solid var(--gray-100)" }}>
                <Info size={15} style={{ color: "var(--accent)", flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: "0.82rem", color: "var(--gray-500)", lineHeight: 1.6 }}>Federal fees are set by the Judicial Conference of the United States and are uniform across all federal courts.</div>
              </div>

              <div style={{ fontSize: "0.65rem", color: "var(--gray-400)", lineHeight: 1.4, borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: 10, marginTop: 14 }}>
                <strong>Disclaimer:</strong> Filing fees are verified as of the date shown and may change without notice. Additional fees (service of process, motion fees, e-filing surcharges) may apply. Always confirm the current fee with the clerk's office or official court website before filing.
              </div>
            </motion.div>
          )}

          {/* ═══ STATE RESULT ═══ */}
          {result && !isFederal && (
            <motion.div
              key="state"
              ref={resultRef}
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              style={{ marginTop: 20, background: "rgba(10,179,156,0.04)", border: "1.5px solid rgba(10,179,156,0.15)", borderRadius: "var(--radius-xl)", padding: "28px 32px", overflow: "hidden" }}
            >
              {/* Header + copy */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", padding: "5px 14px", borderRadius: 100, color: "#0ab39c", border: "1px solid rgba(10,179,156,0.2)" }}>
                    <DollarSign size={13} /> Filing Fee
                  </span>
                  <span style={{ fontSize: "0.82rem", color: "var(--gray-500)", fontWeight: 500 }}>{result.stateName} — {result.courtLabel}</span>
                </div>
                <button onClick={handleCopy} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 12px", fontSize: "0.72rem", fontWeight: 600, background: "#fff", border: "1px solid var(--gray-200)", borderRadius: 6, cursor: "pointer", color: "var(--gray-500)" }}>
                  {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                </button>
              </div>

              {/* Main fee display */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
                <div style={{ background: "#fff", borderRadius: 12, padding: "22px 24px", border: "1px solid var(--gray-100)", textAlign: "center" }}>
                  <div style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--gray-400)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Filing Fee</div>
                  <div style={{ fontSize: "2.2rem", fontWeight: 800, color: "var(--accent)" }}>{fmt(result.fee)}</div>
                  <div style={{ fontSize: "0.78rem", color: "var(--gray-400)", marginTop: 4 }}>{result.courtLabel} — {result.stateName}</div>
                </div>
                <div style={{ background: "#fff", borderRadius: 12, padding: "22px 24px", border: "1px solid var(--gray-100)" }}>
                  <div style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--gray-400)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Federal Comparison</div>
                  <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--ink-800)" }}>{fmt(405)}</div>
                  <div style={{ fontSize: "0.78rem", color: "var(--gray-400)", marginTop: 4 }}>Federal district court civil filing fee</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--accent)", fontWeight: 600, marginTop: 6 }}>
                    {result.fee > 405 ? `${fmt(result.fee - 405)} more than federal` : result.fee < 405 ? `${fmt(405 - result.fee)} less than federal` : "Same as federal"}
                  </div>
                </div>
              </div>

              {/* Notes */}
              {result.notes && (
                <div style={{ display: "flex", gap: 10, padding: "12px 16px", background: "rgba(255,255,255,0.7)", borderRadius: 10, border: "1px solid var(--gray-100)", marginBottom: 14 }}>
                  <Info size={15} style={{ color: "var(--accent)", flexShrink: 0, marginTop: 1 }} />
                  <div style={{ fontSize: "0.82rem", color: "var(--gray-500)", lineHeight: 1.6 }}><strong style={{ color: "var(--ink-800)" }}>{result.stateName}:</strong> {result.notes}</div>
                </div>
              )}

              {/* Additional Fees */}
              {(result.serviceOfProcess || result.motionFiling || result.juryDemand) && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--gray-400)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Additional Fees</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                    {result.serviceOfProcess && (
                      <div style={{ background: "#fff", borderRadius: 10, padding: "14px 16px", border: "1px solid var(--gray-100)", textAlign: "center" }}>
                        <div style={{ fontSize: "0.72rem", color: "var(--gray-400)", marginBottom: 4 }}>Service of Process</div>
                        <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--ink-800)" }}>{fmt(result.serviceOfProcess)}</div>
                      </div>
                    )}
                    {result.motionFiling && (
                      <div style={{ background: "#fff", borderRadius: 10, padding: "14px 16px", border: "1px solid var(--gray-100)", textAlign: "center" }}>
                        <div style={{ fontSize: "0.72rem", color: "var(--gray-400)", marginBottom: 4 }}>Motion Filing</div>
                        <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--ink-800)" }}>{fmt(result.motionFiling)}</div>
                      </div>
                    )}
                    {result.juryDemand && (
                      <div style={{ background: "#fff", borderRadius: 10, padding: "14px 16px", border: "1px solid var(--gray-100)", textAlign: "center" }}>
                        <div style={{ fontSize: "0.72rem", color: "var(--gray-400)", marginBottom: 4 }}>Jury Demand</div>
                        <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--ink-800)" }}>{fmt(result.juryDemand)}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Fee Waiver */}
              {result.feeWaiver && (
                <div style={{ display: "flex", gap: 10, padding: "14px 18px", background: "rgba(10,179,156,0.06)", borderRadius: 10, border: "1px solid rgba(10,179,156,0.15)", marginBottom: 14 }}>
                  <Shield size={16} style={{ color: "#0ab39c", flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--ink-800)", marginBottom: 2 }}>Fee Waivers Available</div>
                    <p style={{ fontSize: "0.78rem", color: "var(--gray-500)", lineHeight: 1.6, margin: 0 }}>Fee waivers are available for low-income litigants. Contact the clerk's office or visit the court website for eligibility details and forms.</p>
                  </div>
                </div>
              )}

              {/* Court URL + Last Verified */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: 14, marginBottom: 14 }}>
                {result.courtUrl && (
                  <a href={result.courtUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "0.78rem", fontWeight: 600, color: "var(--accent)", textDecoration: "none" }}>
                    <ExternalLink size={13} /> Official Court Website
                  </a>
                )}
                {result.lastVerified && (
                  <span style={{ fontSize: "0.72rem", color: "var(--gray-400)" }}>Last verified: {result.lastVerified}</span>
                )}
              </div>

              <div style={{ fontSize: "0.65rem", color: "var(--gray-400)", lineHeight: 1.4, borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: 10 }}>
                <strong>Disclaimer:</strong> Filing fees are verified as of the date shown and may change without notice. Additional fees (service of process, motion fees, e-filing surcharges) may apply. Always confirm the current fee with the clerk's office or official court website before filing.
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div></section>

    {/* ═══ STATE REFERENCE GRID ═══ */}
    <section className="section section--muted"><div className="container">
      <SectionHead badge="Reference" title="All 50 States + DC" subtitle="Click any state to look up its filing fees." />
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ position: "relative", maxWidth: 360, margin: "0 auto 20px" }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--gray-300)" }} />
          <input type="text" placeholder="Search states..." value={stateSearch} onChange={e => setStateSearch(e.target.value)} className="form-input" style={{ paddingLeft: 34, fontSize: "0.82rem" }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(175px, 1fr))", gap: 6 }}>
          {filteredStates.map(s => {
            const civilFee = feeData?.[s]?.civil?.fee
            const sel = s === state
            return (
              <button key={s} onClick={() => { setState(s); if (courtType === "federal") setCourtType("civil"); window.scrollTo({ top: 0, behavior: "smooth" }) }} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 14px", borderRadius: 8, cursor: "pointer", transition: "all 0.15s", textAlign: "left",
                background: sel ? "var(--accent)" : "#fff", border: sel ? "1px solid var(--accent)" : "1px solid var(--gray-100)", color: sel ? "#fff" : "var(--ink-800)"
              }}>
                <span style={{ fontSize: "0.78rem", fontWeight: sel ? 700 : 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s}</span>
                {civilFee != null && (
                  <span style={{ fontSize: "0.72rem", fontWeight: 700, padding: "2px 7px", borderRadius: 4, flexShrink: 0, background: sel ? "rgba(255,255,255,0.2)" : "rgba(56,182,255,0.08)", color: sel ? "#fff" : "var(--accent)" }}>{fmt(civilFee)}</span>
                )}
                {civilFee == null && !loading && (
                  <span style={{ fontSize: "0.72rem", fontWeight: 500, padding: "2px 7px", borderRadius: 4, flexShrink: 0, color: sel ? "rgba(255,255,255,0.6)" : "var(--gray-300)" }}>--</span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div></section>

    {/* ═══ FEDERAL COURT FEES SECTION ═══ */}
    <section className="section"><div className="container">
      <SectionHead badge="Federal Courts" title="Federal Court Filing Fees" />
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={{ background: "#fff", border: "1px solid var(--gray-100)", borderRadius: "var(--radius-xl)", padding: "28px 32px", boxShadow: "0 8px 32px -8px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
            {[
              { label: "U.S. District Court (Civil)", fee: FEDERAL_FEES.civil.fee },
              { label: "Court of Appeals", fee: FEDERAL_FEES.appeals.fee },
            ].map((item, i) => (
              <div key={i} style={{ background: "var(--gray-50)", borderRadius: 12, padding: "20px 22px", textAlign: "center" }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--gray-400)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{item.label}</div>
                <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--accent)" }}>{fmt(item.fee)}</div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--gray-400)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Bankruptcy Court</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
            {[
              { label: "Chapter 7", fee: FEDERAL_FEES.bankruptcy.chapter7 },
              { label: "Chapter 13", fee: FEDERAL_FEES.bankruptcy.chapter13 },
              { label: "Chapter 11", fee: FEDERAL_FEES.bankruptcy.chapter11 },
            ].map((b, i) => (
              <div key={i} style={{ background: "var(--gray-50)", borderRadius: 10, padding: "16px 18px", textAlign: "center" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--gray-500)", marginBottom: 4 }}>{b.label}</div>
                <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--ink-800)" }}>{fmt(b.fee)}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10, padding: "12px 16px", background: "var(--gray-50)", borderRadius: 10 }}>
            <Info size={15} style={{ color: "var(--accent)", flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: "0.82rem", color: "var(--gray-500)", lineHeight: 1.6 }}>Federal fees are set by the Judicial Conference of the United States and are uniform across all federal courts.</div>
          </div>
        </div>
      </div>
    </div></section>

    {/* ═══ EDUCATIONAL — What Filing Fees Cover ═══ */}
    <section className="section section--muted"><div className="container">
      <SectionHead badge="Understanding Fees" title="What Court Filing Fees Cover" />
      <div style={{ maxWidth: 800, margin: "0 auto", display: "grid", gap: 36 }}>

        {/* What's Included */}
        <div>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--ink-800)", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}><DollarSign size={17} style={{ color: "var(--accent)" }} /> What's Included</h3>
          <p style={{ fontSize: "0.9rem", color: "var(--gray-500)", lineHeight: 1.8 }}>Filing fees cover the court's administrative costs of processing your case: docketing, judge assignment, courtroom time, and facility overhead. They do not cover attorney fees, service of process, discovery costs, or other litigation expenses. Think of the filing fee as the "admission ticket" to the court system — the actual cost of litigation is significantly higher.</p>
        </div>

        {/* In Forma Pauperis */}
        <div>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--ink-800)", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}><Shield size={17} style={{ color: "var(--accent)" }} /> In Forma Pauperis (IFP)</h3>
          <p style={{ fontSize: "0.9rem", color: "var(--gray-500)", lineHeight: 1.8 }}>Courts may waive filing fees for individuals who cannot afford them. You must file an Application to Proceed In Forma Pauperis with evidence of your income, assets, expenses, and financial obligations. The court reviews the application and grants or denies the waiver. If granted, some courts waive the fee entirely while others allow installment payments. Most states and all federal courts offer this option.</p>
        </div>

        {/* Additional Costs grid */}
        <div>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--ink-800)", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}><Scale size={17} style={{ color: "var(--accent)" }} /> Additional Costs to Expect</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            {ADDITIONAL_COSTS.map((item, i) => (
              <div key={i} style={{ padding: "14px 16px", background: "#fff", borderRadius: 10, border: "1px solid var(--gray-100)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "var(--ink-800)" }}>{item.label}</div>
                  <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--accent)", background: "rgba(56,182,255,0.08)", padding: "2px 8px", borderRadius: 4 }}>{item.range}</span>
                </div>
                <p style={{ fontSize: "0.78rem", color: "var(--gray-500)", lineHeight: 1.6, margin: 0 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* E-Filing vs. Paper */}
        <div>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--ink-800)", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}><FileText size={17} style={{ color: "var(--accent)" }} /> E-Filing vs. Paper Filing</h3>
          <p style={{ fontSize: "0.9rem", color: "var(--gray-500)", lineHeight: 1.8 }}>Some courts offer reduced filing fees for electronic filing, while others add a small e-filing surcharge. Many jurisdictions now require e-filing for attorneys, though self-represented litigants can often still file on paper. E-filing systems like Odyssey, File & Serve, and PACER (federal) process filings instantly and provide immediate confirmation — a significant advantage over paper filing where processing can take days.</p>
        </div>
      </div>
    </div></section>

    {/* ═══ FAQ ═══ */}
    <section className="section"><div className="container">
      <SectionHead badge="FAQ" title="Common Questions" />
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {faqs.map((f, i) => <div key={i} className={`faq-item ${openFaq === i ? "open" : ""}`}>
          <button className="faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
            <span>{f.q}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18, transition: "0.3s", transform: openFaq === i ? "rotate(180deg)" : "none", flexShrink: 0 }}><path d="M6 9l6 6 6-6" /></svg>
          </button>
          <div className="faq-a"><div className="faq-a__inner">{f.a}</div></div>
        </div>)}
      </div>
    </div></section>

    {/* ═══ DISCLAIMER ═══ */}
    <section className="section"><div className="container">
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "20px 24px", background: "rgba(217,119,6,0.06)", border: "1.5px solid rgba(217,119,6,0.15)", borderRadius: "var(--radius-xl)", display: "flex", gap: 12 }}>
        <AlertTriangle size={20} style={{ color: "#d97706", flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#92400e", marginBottom: 4 }}>Important Disclaimer</div>
          <p style={{ fontSize: "0.82rem", color: "#78350f", lineHeight: 1.7, margin: 0 }}>Filing fees are verified as of the date shown and may change without notice. Additional fees (service of process, motion fees, e-filing surcharges) may apply. Always confirm the current fee with the clerk's office or official court website before filing. This tool is for informational purposes only and does not constitute legal advice.</p>
        </div>
      </div>
    </div></section>

    {/* ═══ CTA ═══ */}
    <section className="section section--dark"><div className="container" style={{ textAlign: "center" }}>
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <SectionHead light badge="Streamline Your Filing" title="Court Filing Integrated Into Your Workflow" subtitle="Track filing fees, deadlines, and court requirements for every case — all within your practice management platform." />
        <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", marginTop: 8 }}>
          <Link to="/contact" className="btn btn--primary btn--lg">Start Free Trial <ArrowRight size={16} /></Link>
          <Link to="/features" className="btn btn--secondary btn--lg">See All Features</Link>
        </div>
      </div>
    </div></section>
  </>
}
