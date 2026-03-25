import{useState,useRef}from"react"
import{Link}from"react-router-dom"
import{Helmet}from"react-helmet-async"
import{motion,AnimatePresence}from"framer-motion"
import PageHero from"../../components/ui/PageHero"
import SectionHead from"../../components/ui/SectionHead"
import{DollarSign,AlertTriangle,ArrowRight,BookOpen,TrendingUp,TrendingDown,Copy,Check,Shield,Activity,Clock,Heart,UserX,FileText,Ban,Smartphone,XCircle,Calculator}from"lucide-react"

/* ── MULTIPLIER LEVELS ── */
const MULTIPLIER_LEVELS = [
  { value: 1.5, label: "1.5x", desc: "Minor injuries, full recovery expected" },
  { value: 2, label: "2x", desc: "Moderate injuries, some lasting effects" },
  { value: 3, label: "3x", desc: "Significant injuries, extended recovery" },
  { value: 4, label: "4x", desc: "Severe injuries, permanent limitations" },
  { value: 5, label: "5x", desc: "Catastrophic or life-altering injuries" },
]

/* ── STATE CAPS ── */
const STATE_CAPS = {
  "Alabama": null,
  "Alaska": { cap: 400000, notes: "Non-economic damages capped; higher for severe injuries" },
  "Colorado": { cap: 642180, notes: "Adjusted periodically for inflation" },
  "Florida": null,
  "Georgia": { cap: 350000, notes: "Per facility/provider in medical malpractice" },
  "Hawaii": { cap: 375000, notes: "Non-economic damages in medical malpractice" },
  "Idaho": { cap: 433509, notes: "Non-economic damages cap, adjusted annually" },
  "Indiana": { cap: 500000, notes: "Total damages cap in medical malpractice" },
  "Kansas": { cap: 325000, notes: "Non-economic damages cap" },
  "Maryland": { cap: 920000, notes: "Non-economic damages, increases $15K/year" },
  "Mississippi": { cap: 1000000, notes: "Non-economic damages cap" },
  "Montana": { cap: 250000, notes: "Non-economic damages in medical malpractice" },
  "Nevada": { cap: 350000, notes: "Non-economic damages in medical malpractice" },
  "Ohio": { cap: 350000, notes: "Non-economic, or 3x economic (whichever greater)" },
  "Oklahoma": { cap: 350000, notes: "Non-economic damages cap" },
  "Tennessee": { cap: 750000, notes: "Non-economic damages cap; $1M for catastrophic" },
  "Texas": { cap: 250000, notes: "Non-economic damages in medical malpractice per defendant" },
  "Virginia": { cap: 2550000, notes: "Total medical malpractice damages cap" },
  "West Virginia": { cap: 500000, notes: "Non-economic damages cap" },
  "Wisconsin": { cap: 750000, notes: "Non-economic damages in medical malpractice" },
}

const STATES_WITH_CAPS = Object.keys(STATE_CAPS).sort()

/* ── INJURY BENCHMARKS ── */
const INJURY_BENCHMARKS = [
  { type: "Whiplash / Soft Tissue", range: "$10,000 – $100,000", factors: "Recovery time, severity, pre-existing conditions" },
  { type: "Broken Bones", range: "$50,000 – $250,000", factors: "Location, surgery required, long-term impact" },
  { type: "Herniated Disc", range: "$100,000 – $500,000", factors: "Need for surgery, nerve damage, chronic pain" },
  { type: "TBI / Concussion", range: "$100,000 – $1,000,000+", factors: "Severity, cognitive impact, long-term prognosis" },
  { type: "Spinal Cord Injury", range: "$500,000 – $5,000,000+", factors: "Paralysis level, life care costs, lost earnings" },
  { type: "Wrongful Death", range: "$500,000 – $10,000,000+", factors: "Age, earnings, dependents, circumstances" },
]

/* ── FAQs ── */
const faqs = [
  { q: "How accurate is this PI settlement calculator?", a: "This calculator uses the multiplier method commonly employed by insurance companies to estimate settlement ranges. However, actual settlements depend on many variables including liability, evidence quality, insurance policy limits, jurisdiction, and attorney skill. Use this as a starting point for understanding potential case value." },
  { q: "What is the pain and suffering multiplier?", a: "The multiplier method calculates pain and suffering damages by multiplying your total medical expenses by a factor between 1.5 and 5. Minor injuries typically use a 1.5-2x multiplier, while severe or permanent injuries may warrant 4-5x. Insurance adjusters and attorneys commonly use this approach in settlement negotiations." },
  { q: "How much does an attorney take from a settlement?", a: "Personal injury attorneys typically work on contingency, taking 33% (one-third) if the case settles before trial and 40% if litigation is required. Some attorneys negotiate different rates. The fee is taken from the gross settlement before the client receives their portion." },
  { q: "What is the average personal injury settlement?", a: "There is no single 'average' — settlements range from $10,000 for minor soft tissue injuries to millions for catastrophic injuries. The median personal injury settlement is roughly $50,000-$75,000, but this varies enormously by injury type, state, and case circumstances." },
  { q: "Do state damage caps affect my settlement?", a: "About 15 states cap non-economic damages (pain and suffering) at specific dollar amounts. These caps primarily affect medical malpractice cases but may apply to other personal injury claims depending on the state. Caps do not affect economic damages like medical bills and lost wages." },
  { q: "Should I accept the insurance company's first offer?", a: "Insurance companies' initial offers are almost always below fair value. Studies show first offers are typically 25-50% lower than eventual settlement amounts. Always consult with a personal injury attorney before accepting any settlement offer." },
]

/* ── HELPERS ── */
const fmt = v => "$" + Math.round(v).toLocaleString("en-US", { maximumFractionDigits: 0 })

function parseCurrency(str) {
  if (!str) return 0
  const cleaned = String(str).replace(/[^0-9]/g, "")
  return parseInt(cleaned, 10) || 0
}

function formatCurrencyInput(val) {
  if (!val && val !== 0) return ""
  const num = parseCurrency(val)
  if (num === 0) return ""
  return "$" + num.toLocaleString("en-US")
}

/* ── COMPONENT ── */
export default function PISettlementCalculator() {
  const [medicalBills, setMedicalBills] = useState("")
  const [futureMedical, setFutureMedical] = useState("")
  const [lostWages, setLostWages] = useState("")
  const [futureLostWages, setFutureLostWages] = useState("")
  const [propertyDamage, setPropertyDamage] = useState("")
  const [outOfPocket, setOutOfPocket] = useState("")
  const [multiplier, setMultiplier] = useState(3)
  const [selectedState, setSelectedState] = useState("")
  const [feeStage, setFeeStage] = useState("pretrial") // pretrial = 33%, litigation = 40%
  const [openFaq, setOpenFaq] = useState(null)
  const [copied, setCopied] = useState(false)
  const [result, setResult] = useState(null)
  const resultRef = useRef(null)

  const feeRate = feeStage === "pretrial" ? 0.33 : 0.40
  const feeLabel = feeStage === "pretrial" ? "33%" : "40%"

  const handleCurrencyInput = (setter) => (e) => {
    const raw = e.target.value.replace(/[^0-9]/g, "")
    setter(raw ? "$" + parseInt(raw, 10).toLocaleString("en-US") : "")
  }

  const hasInput = parseCurrency(medicalBills) + parseCurrency(futureMedical) + parseCurrency(lostWages) + parseCurrency(futureLostWages) + parseCurrency(propertyDamage) + parseCurrency(outOfPocket) > 0

  const handleCalculate = () => {
    const mb = parseCurrency(medicalBills)
    const fm = parseCurrency(futureMedical)
    const lw = parseCurrency(lostWages)
    const flw = parseCurrency(futureLostWages)
    const pd = parseCurrency(propertyDamage)
    const oop = parseCurrency(outOfPocket)

    const economicDamages = mb + fm + lw + flw + pd + oop
    if (economicDamages === 0) return

    const medicalTotal = mb + fm

    let nonEconomicLow = medicalTotal * (multiplier - 0.5)
    let nonEconomicMid = medicalTotal * multiplier
    let nonEconomicHigh = medicalTotal * (multiplier + 0.5)

    // State cap check
    const capInfo = selectedState ? STATE_CAPS[selectedState] : null
    let capApplied = false
    if (capInfo && capInfo.cap) {
      if (nonEconomicLow > capInfo.cap) { nonEconomicLow = capInfo.cap; capApplied = true }
      if (nonEconomicMid > capInfo.cap) { nonEconomicMid = capInfo.cap; capApplied = true }
      if (nonEconomicHigh > capInfo.cap) { nonEconomicHigh = capInfo.cap; capApplied = true }
    }

    const totalLow = economicDamages + nonEconomicLow
    const totalMid = economicDamages + nonEconomicMid
    const totalHigh = economicDamages + nonEconomicHigh

    const attorneyFeeLow = totalLow * feeRate
    const attorneyFeeMid = totalMid * feeRate
    const attorneyFeeHigh = totalHigh * feeRate

    const netLow = totalLow - attorneyFeeLow
    const netMid = totalMid - attorneyFeeMid
    const netHigh = totalHigh - attorneyFeeHigh

    setResult({
      economicDamages,
      medicalTotal,
      mb, fm, lw, flw, pd, oop,
      nonEconomicLow, nonEconomicMid, nonEconomicHigh,
      totalLow, totalMid, totalHigh,
      attorneyFeeLow, attorneyFeeMid, attorneyFeeHigh,
      netLow, netMid, netHigh,
      capInfo, capApplied,
    })

    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 100)
  }

  const handleCopy = () => {
    if (!result) return
    const lines = [
      "PI Settlement Estimate",
      `Economic Damages: ${fmt(result.economicDamages)}`,
      `Pain & Suffering (${multiplier}x): ${fmt(result.nonEconomicMid)}`,
      `Gross Settlement: ${fmt(result.totalMid)}`,
      `Attorney Fees (${feeLabel}): -${fmt(result.attorneyFeeMid)}`,
      `Net to Client: ${fmt(result.netMid)}`,
      `Range: ${fmt(result.totalLow)} – ${fmt(result.totalHigh)}`,
      "",
      "legience.com/tools/pi-settlement-calculator",
    ]
    navigator.clipboard.writeText(lines.join("\n")).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  const faqSchema = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }

  // Range bar position helpers
  const rangeBarPosition = (result) => {
    if (!result) return { lowPct: 0, midPct: 50, highPct: 100 }
    const range = result.totalHigh - result.totalLow
    if (range === 0) return { lowPct: 0, midPct: 50, highPct: 100 }
    const midPct = ((result.totalMid - result.totalLow) / range) * 100
    return { lowPct: 0, midPct, highPct: 100 }
  }

  return <>
    <Helmet>
      <title>Personal Injury Settlement Calculator — Free Estimate | Legience</title>
      <meta name="description" content="Free personal injury settlement calculator. Estimate your case value using the multiplier method — calculate pain and suffering, attorney fees, and net settlement amount." />
      <meta name="keywords" content="personal injury settlement calculator, PI calculator, pain and suffering calculator, settlement estimate, injury compensation calculator" />
      <link rel="canonical" href="https://legience.com/tools/pi-settlement-calculator" />
      <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
    </Helmet>

    <PageHero badge="Free Tool" title="Personal Injury Settlement" gradient="Calculator." subtitle="Estimate your case value using the multiplier method — the same approach insurance adjusters use to calculate settlements." />

    {/* ═══ CALCULATOR ═══ */}
    <section className="section"><div className="container">
      <div style={{ maxWidth: 860, margin: "0 auto" }}>

        {/* Input card */}
        <div style={{ background: "#fff", border: "1px solid var(--gray-100)", borderRadius: "var(--radius-xl)", padding: "28px 32px", boxShadow: "0 8px 32px -8px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--accent-subtle)", display: "flex", alignItems: "center", justifyContent: "center" }}><DollarSign size={20} style={{ color: "var(--accent)" }} /></div>
            <div>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--ink-800)" }}>Estimate Your Settlement</h2>
              <p style={{ fontSize: "0.78rem", color: "var(--gray-400)" }}>Enter your case details to see estimated settlement range</p>
            </div>
          </div>

          {/* Row 1: 3-column */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Medical Bills</label>
              <input type="text" inputMode="numeric" value={medicalBills} onChange={handleCurrencyInput(setMedicalBills)} placeholder="$0" className="form-input" />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Future Medical Costs</label>
              <input type="text" inputMode="numeric" value={futureMedical} onChange={handleCurrencyInput(setFutureMedical)} placeholder="$0" className="form-input" />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Lost Wages</label>
              <input type="text" inputMode="numeric" value={lostWages} onChange={handleCurrencyInput(setLostWages)} placeholder="$0" className="form-input" />
            </div>
          </div>

          {/* Row 2: 3-column */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 20 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Future Lost Wages</label>
              <input type="text" inputMode="numeric" value={futureLostWages} onChange={handleCurrencyInput(setFutureLostWages)} placeholder="$0" className="form-input" />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Property Damage</label>
              <input type="text" inputMode="numeric" value={propertyDamage} onChange={handleCurrencyInput(setPropertyDamage)} placeholder="$0" className="form-input" />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Out-of-Pocket Expenses</label>
              <input type="text" inputMode="numeric" value={outOfPocket} onChange={handleCurrencyInput(setOutOfPocket)} placeholder="$0" className="form-input" />
            </div>
          </div>

          {/* Pain & Suffering Multiplier */}
          <div style={{ marginBottom: 20 }}>
            <label className="form-label" style={{ marginBottom: 8 }}>Pain & Suffering Multiplier</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {MULTIPLIER_LEVELS.map(m => (
                <button key={m.value} onClick={() => setMultiplier(m.value)} style={{
                  padding: "9px 18px", fontSize: "0.85rem", fontWeight: multiplier === m.value ? 700 : 500,
                  background: multiplier === m.value ? "var(--accent)" : "#fff",
                  color: multiplier === m.value ? "#fff" : "var(--gray-500)",
                  border: multiplier === m.value ? "1px solid var(--accent)" : "1px solid var(--gray-200)",
                  borderRadius: 8, cursor: "pointer", transition: "all 0.2s", flex: "1 1 0",
                  minWidth: 70, textAlign: "center",
                }}>{m.label}</button>
              ))}
            </div>
            <p style={{ fontSize: "0.78rem", color: "var(--gray-400)", marginTop: 8, marginBottom: 0 }}>
              {MULTIPLIER_LEVELS.find(m => m.value === multiplier)?.desc}
            </p>
          </div>

          {/* Row 3: State + Fee Stage */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">State <span style={{ fontWeight: 400, color: "var(--gray-300)" }}>(optional — for damage cap check)</span></label>
              <select value={selectedState} onChange={e => setSelectedState(e.target.value)} className="form-input">
                <option value="">Select state...</option>
                {STATES_WITH_CAPS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Attorney Fee Stage</label>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setFeeStage("pretrial")} style={{
                  flex: 1, padding: "9px 14px", fontSize: "0.82rem", fontWeight: feeStage === "pretrial" ? 700 : 500,
                  background: feeStage === "pretrial" ? "var(--accent)" : "#fff",
                  color: feeStage === "pretrial" ? "#fff" : "var(--gray-500)",
                  border: feeStage === "pretrial" ? "1px solid var(--accent)" : "1px solid var(--gray-200)",
                  borderRadius: 8, cursor: "pointer", transition: "all 0.2s",
                }}>Pre-Trial (33%)</button>
                <button onClick={() => setFeeStage("litigation")} style={{
                  flex: 1, padding: "9px 14px", fontSize: "0.82rem", fontWeight: feeStage === "litigation" ? 700 : 500,
                  background: feeStage === "litigation" ? "var(--accent)" : "#fff",
                  color: feeStage === "litigation" ? "#fff" : "var(--gray-500)",
                  border: feeStage === "litigation" ? "1px solid var(--accent)" : "1px solid var(--gray-200)",
                  borderRadius: 8, cursor: "pointer", transition: "all 0.2s",
                }}>Litigation (40%)</button>
              </div>
            </div>
          </div>

          {/* Calculate button */}
          <button onClick={handleCalculate} disabled={!hasInput} style={{
            width: "100%", marginTop: 20, padding: "14px 24px", fontSize: "0.95rem", fontWeight: 700,
            background: hasInput ? "var(--accent)" : "var(--gray-200)",
            color: hasInput ? "#fff" : "var(--gray-400)",
            border: "none", borderRadius: 10, cursor: hasInput ? "pointer" : "not-allowed",
            transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            <Calculator size={18} /> Calculate Settlement Estimate
          </button>
        </div>

        {/* ═══ RESULT ═══ */}
        <AnimatePresence>
          {result && (
            <motion.div
              ref={resultRef}
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              style={{ marginTop: 20, background: "rgba(10,179,156,0.04)", border: "1.5px solid rgba(10,179,156,0.15)", borderRadius: "var(--radius-xl)", padding: "28px 32px", overflow: "hidden" }}
            >
              {/* Header + copy */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", padding: "5px 14px", borderRadius: 100, color: "var(--accent)", border: "1px solid rgba(10,179,156,0.2)" }}>
                    <DollarSign size={13} /> Settlement Estimate
                  </span>
                  <span style={{ fontSize: "0.82rem", color: "var(--gray-500)", fontWeight: 500 }}>{multiplier}x Multiplier &middot; {feeLabel} Fee</span>
                </div>
                <button onClick={handleCopy} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 12px", fontSize: "0.72rem", fontWeight: 600, background: "#fff", border: "1px solid var(--gray-200)", borderRadius: 6, cursor: "pointer", color: "var(--gray-500)" }}>
                  {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                </button>
              </div>

              {/* 3-stat row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 20 }}>
                <div style={{ background: "#fff", borderRadius: 12, padding: "18px 20px", border: "1px solid var(--gray-100)", textAlign: "center" }}>
                  <div style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--gray-400)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Conservative</div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#d97706" }}>{fmt(result.totalLow)}</div>
                </div>
                <div style={{ background: "#fff", borderRadius: 12, padding: "18px 20px", border: "1.5px solid rgba(10,179,156,0.25)", textAlign: "center" }}>
                  <div style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Likely Range</div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--accent)" }}>{fmt(result.totalMid)}</div>
                </div>
                <div style={{ background: "#fff", borderRadius: 12, padding: "18px 20px", border: "1px solid var(--gray-100)", textAlign: "center" }}>
                  <div style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--gray-400)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>High End</div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#059669" }}>{fmt(result.totalHigh)}</div>
                </div>
              </div>

              {/* Range bar */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: "var(--gray-400)", marginBottom: 5 }}>
                  <span>{fmt(result.totalLow)}</span>
                  <span style={{ fontWeight: 600, color: "var(--accent)" }}>Estimated Range</span>
                  <span>{fmt(result.totalHigh)}</span>
                </div>
                <div style={{ height: 8, background: "rgba(0,0,0,0.05)", borderRadius: 99, overflow: "visible", position: "relative" }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    style={{ height: "100%", background: "linear-gradient(90deg, #d97706, var(--accent), #059669)", borderRadius: 99 }}
                  />
                  {/* Mid marker */}
                  <div style={{
                    position: "absolute", top: -4,
                    left: `${rangeBarPosition(result).midPct}%`,
                    width: 16, height: 16, borderRadius: "50%",
                    background: "var(--accent)", border: "2.5px solid #fff",
                    boxShadow: "0 1px 6px rgba(0,0,0,0.2)", transform: "translateX(-50%)",
                  }} />
                </div>
              </div>

              {/* Breakdown */}
              <div style={{ background: "#fff", borderRadius: 12, padding: "18px 20px", border: "1px solid var(--gray-100)", marginBottom: 16 }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--ink-800)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>Settlement Breakdown</div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {/* Economic damages */}
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.88rem" }}>
                    <span style={{ fontWeight: 600, color: "var(--ink-800)" }}>Economic Damages</span>
                    <span style={{ fontWeight: 700, color: "var(--ink-800)" }}>{fmt(result.economicDamages)}</span>
                  </div>
                  {/* Sub-items */}
                  <div style={{ paddingLeft: 16, display: "flex", flexDirection: "column", gap: 4, borderLeft: "2px solid var(--gray-100)" }}>
                    {result.mb > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: "var(--gray-500)" }}><span>Medical Bills</span><span>{fmt(result.mb)}</span></div>}
                    {result.fm > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: "var(--gray-500)" }}><span>Future Medical Costs</span><span>{fmt(result.fm)}</span></div>}
                    {result.lw > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: "var(--gray-500)" }}><span>Lost Wages</span><span>{fmt(result.lw)}</span></div>}
                    {result.flw > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: "var(--gray-500)" }}><span>Future Lost Wages</span><span>{fmt(result.flw)}</span></div>}
                    {result.pd > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: "var(--gray-500)" }}><span>Property Damage</span><span>{fmt(result.pd)}</span></div>}
                    {result.oop > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: "var(--gray-500)" }}><span>Out-of-Pocket Expenses</span><span>{fmt(result.oop)}</span></div>}
                  </div>

                  <div style={{ height: 1, background: "var(--gray-100)", margin: "4px 0" }} />

                  {/* Non-economic */}
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.88rem" }}>
                    <span style={{ fontWeight: 600, color: "var(--ink-800)" }}>Non-Economic (Pain & Suffering)</span>
                    <span style={{ fontWeight: 700, color: "var(--ink-800)" }}>{fmt(result.nonEconomicMid)}</span>
                  </div>
                  <div style={{ paddingLeft: 16, fontSize: "0.75rem", color: "var(--gray-400)", borderLeft: "2px solid var(--gray-100)" }}>
                    Medical total ({fmt(result.medicalTotal)}) &times; {multiplier}x multiplier
                  </div>

                  <div style={{ height: 1, background: "var(--gray-100)", margin: "4px 0" }} />

                  {/* Gross */}
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.88rem" }}>
                    <span style={{ fontWeight: 600, color: "var(--ink-800)" }}>Gross Settlement</span>
                    <span style={{ fontWeight: 700, color: "var(--ink-800)" }}>{fmt(result.totalMid)}</span>
                  </div>

                  {/* Attorney fees */}
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.88rem" }}>
                    <span style={{ color: "var(--gray-500)" }}>Attorney Fees ({feeLabel})</span>
                    <span style={{ fontWeight: 600, color: "#f06548" }}>-{fmt(result.attorneyFeeMid)}</span>
                  </div>

                  <div style={{ height: 1, background: "var(--accent)", margin: "4px 0", opacity: 0.3 }} />

                  {/* Net to client */}
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "1rem" }}>
                    <span style={{ fontWeight: 800, color: "var(--accent)" }}>Net to Client</span>
                    <span style={{ fontWeight: 800, color: "var(--accent)", fontSize: "1.15rem" }}>{fmt(result.netMid)}</span>
                  </div>
                </div>
              </div>

              {/* State cap warning */}
              {result.capApplied && result.capInfo && (
                <div style={{ display: "flex", gap: 10, padding: "12px 16px", background: "rgba(247,184,75,0.08)", borderRadius: 10, border: "1px solid rgba(247,184,75,0.2)", marginBottom: 14 }}>
                  <AlertTriangle size={15} style={{ color: "#d97706", flexShrink: 0, marginTop: 1 }} />
                  <div style={{ fontSize: "0.82rem", color: "var(--gray-500)", lineHeight: 1.6 }}>
                    <strong style={{ color: "#d97706" }}>{selectedState}</strong> caps non-economic damages at <strong style={{ color: "var(--ink-800)" }}>{fmt(result.capInfo.cap)}</strong>. {result.capInfo.notes}. Your pain and suffering estimate has been adjusted to reflect this cap.
                  </div>
                </div>
              )}

              {/* State cap info (no cap applied but state has one) */}
              {selectedState && result.capInfo && !result.capApplied && (
                <div style={{ display: "flex", gap: 10, padding: "12px 16px", background: "rgba(255,255,255,0.7)", borderRadius: 10, border: "1px solid var(--gray-100)", marginBottom: 14 }}>
                  <Shield size={15} style={{ color: "var(--accent)", flexShrink: 0, marginTop: 1 }} />
                  <div style={{ fontSize: "0.82rem", color: "var(--gray-500)", lineHeight: 1.6 }}>
                    <strong style={{ color: "var(--ink-800)" }}>{selectedState}</strong> has a non-economic damage cap of {fmt(result.capInfo.cap)}, but your estimate falls below this threshold. {result.capInfo.notes}.
                  </div>
                </div>
              )}

              {/* Disclaimer */}
              <div style={{ fontSize: "0.65rem", color: "var(--gray-400)", lineHeight: 1.4, borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: 10, marginTop: 6 }}>
                <strong>Disclaimer:</strong> This calculator provides rough estimates only and does not constitute legal advice. Actual settlement values depend on many factors including liability, jurisdiction, insurance policy limits, and negotiation. Every case is unique. Consult with a licensed personal injury attorney for an accurate case evaluation.
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div></section>

    {/* ═══ SETTLEMENT BENCHMARKS ═══ */}
    <section className="section section--muted"><div className="container">
      <SectionHead badge="Reference" title="Settlement Benchmarks by Injury Type" />
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          {INJURY_BENCHMARKS.map((b, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.3, delay: i * 0.06 }}
              style={{ background: "#fff", border: "1px solid var(--gray-100)", borderRadius: 12, padding: "20px 22px" }}
            >
              <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--ink-800)", marginBottom: 6 }}>{b.type}</div>
              <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--accent)", marginBottom: 8 }}>{b.range}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--gray-400)", lineHeight: 1.5 }}><strong style={{ color: "var(--gray-500)" }}>Key factors:</strong> {b.factors}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </div></section>

    {/* ═══ HOW IT WORKS ═══ */}
    <section className="section"><div className="container">
      <SectionHead badge="How It Works" title="Understanding the Multiplier Method" />
      <div style={{ maxWidth: 800, margin: "0 auto", display: "grid", gap: 36 }}>
        <div>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--ink-800)", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}><BookOpen size={17} style={{ color: "var(--accent)" }} /> The Multiplier Method</h3>
          <p style={{ fontSize: "0.9rem", color: "var(--gray-500)", lineHeight: 1.8, marginBottom: 10 }}>The multiplier method is one of the most common approaches insurance companies use to estimate the value of a personal injury claim. It works by taking your total medical expenses and multiplying them by a factor between 1.5 and 5 to calculate pain and suffering damages.</p>
          <p style={{ fontSize: "0.9rem", color: "var(--gray-500)", lineHeight: 1.8 }}>A lower multiplier (1.5-2x) is used for minor injuries with full recovery, while higher multipliers (4-5x) are reserved for severe, permanent, or life-altering injuries. The resulting non-economic damages are then added to your economic damages (medical bills, lost wages, etc.) to arrive at a total estimated settlement value.</p>
        </div>

        <div>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--ink-800)", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}><TrendingUp size={17} style={{ color: "#059669" }} /> Factors That Increase Your Settlement</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            {[
              { t: "Clear Liability", d: "When fault is obvious and well-documented, insurers settle higher to avoid trial risk.", icon: Shield },
              { t: "Severe Injuries", d: "Serious injuries requiring surgery, hospitalization, or long-term care command higher multipliers.", icon: Activity },
              { t: "Extensive Medical Treatment", d: "Consistent, documented medical care shows the severity and legitimacy of your injuries.", icon: Heart },
              { t: "Long Recovery Period", d: "Extended recovery times increase pain and suffering damages and demonstrate lasting impact.", icon: Clock },
              { t: "Permanent Disability", d: "Injuries causing permanent limitations or disfigurement significantly increase case value.", icon: UserX },
              { t: "Documented Pain", d: "Detailed medical records, pain journals, and expert testimony strengthen your claim.", icon: FileText },
            ].map((item, i) => {
              const Icon = item.icon
              return (
                <div key={i} style={{ padding: "14px 16px", background: "rgba(5,150,105,0.04)", borderRadius: 10, border: "1px solid rgba(5,150,105,0.1)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                    <Icon size={13} style={{ color: "#059669" }} />
                    <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "var(--ink-800)" }}>{item.t}</div>
                  </div>
                  <p style={{ fontSize: "0.78rem", color: "var(--gray-500)", lineHeight: 1.6, margin: 0 }}>{item.d}</p>
                </div>
              )
            })}
          </div>
        </div>

        <div>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--ink-800)", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}><TrendingDown size={17} style={{ color: "#f06548" }} /> Factors That May Decrease Your Settlement</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            {[
              { t: "Shared Fault", d: "If you were partially at fault, your settlement may be reduced by your percentage of blame.", icon: Ban },
              { t: "Pre-existing Conditions", d: "Insurers may argue that prior injuries contributed to your current condition, lowering the payout.", icon: Activity },
              { t: "Gaps in Treatment", d: "Periods without medical care suggest injuries aren't as serious as claimed.", icon: XCircle },
              { t: "Social Media Activity", d: "Posts showing physical activity or travel can undermine injury claims and reduce settlements.", icon: Smartphone },
              { t: "Low Policy Limits", d: "Insurance policy limits cap what the insurer will pay, regardless of your actual damages.", icon: Shield },
              { t: "Delayed Treatment", d: "Waiting too long to seek medical care weakens the connection between the accident and your injuries.", icon: Clock },
            ].map((item, i) => {
              const Icon = item.icon
              return (
                <div key={i} style={{ padding: "14px 16px", background: "rgba(240,101,72,0.04)", borderRadius: 10, border: "1px solid rgba(240,101,72,0.1)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                    <Icon size={13} style={{ color: "#f06548" }} />
                    <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "var(--ink-800)" }}>{item.t}</div>
                  </div>
                  <p style={{ fontSize: "0.78rem", color: "var(--gray-500)", lineHeight: 1.6, margin: 0 }}>{item.d}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div></section>

    {/* ═══ FAQ ═══ */}
    <section className="section section--muted"><div className="container">
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
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "20px 24px", background: "rgba(247,184,75,0.06)", border: "1px solid rgba(247,184,75,0.15)", borderRadius: 12, fontSize: "0.78rem", color: "var(--gray-500)", lineHeight: 1.7 }}>
        <strong style={{ color: "var(--ink-800)" }}>Important Disclaimer:</strong> This calculator provides rough estimates only and does not constitute legal advice. The multiplier method is one of several approaches used to value personal injury claims, and actual settlement amounts depend on many factors not captured here — including liability determination, quality of evidence, insurance policy limits, jurisdiction-specific laws, comparative negligence rules, and the skill of your legal representation. Pre-existing conditions, prior claims history, and the specific facts of your case will significantly affect the outcome. This tool is intended for educational purposes only. Always consult with a licensed personal injury attorney for an accurate evaluation of your specific case.
      </div>
    </div></section>

    {/* ═══ CTA ═══ */}
    <section className="section section--dark"><div className="container" style={{ textAlign: "center" }}>
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <SectionHead light badge="Automate Case Valuation" title="AI-Powered Demand Letters That Maximize Settlements" subtitle="Legience generates comprehensive demand letters analyzing medical records, calculating damages, and citing relevant case law — in minutes, not hours." />
        <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", marginTop: 8 }}>
          <Link to="/contact" className="btn btn--primary btn--lg">Start Free Trial <ArrowRight size={16} /></Link>
          <Link to="/pi-workspace" className="btn btn--secondary btn--lg">See PI Workspace</Link>
        </div>
      </div>
    </div></section>
  </>
}
