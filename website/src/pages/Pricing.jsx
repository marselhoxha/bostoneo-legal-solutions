import{useState}from"react"
import{Link}from"react-router-dom"
import{motion}from"framer-motion"
import{Helmet}from"react-helmet-async"
import PageHero from"../components/ui/PageHero"
import SectionHead from"../components/ui/SectionHead"
import{Gift}from"lucide-react"

const plans=[
  {name:"Starter",desc:"Solo practitioners — one login, everything you need",m:99,a:79,features:["Unlimited cases & clients","LegiSearch™ (200 queries/mo + 100/extra atty)","LegiDraft™ (30+ types)","Time tracking & invoicing","E-Signatures via BoldSign (unlimited)","Client portal (free, unlimited seats)","Calendar & deadline tracking","Task management & Kanban","1 free staff seat included","Attorney + Client dashboards","Email & chat support","5GB document storage"]},
  {name:"Professional",desc:"Small firms with proper multi-tenancy & role access",m:169,a:139,per:"/user",pop:true,features:["Everything in Starter, plus:","500 AI queries/mo + 100/extra attorney","LegiDraft™ demand letters ($0/case)","PI damage calculator & settlement tracker","Medical records management with AI","CRM & lead pipeline with conflict checking","Automated conflict checking (ABA 1.7, 1.9, 1.10)","Expense tracking & management","All role-based dashboards (10+ types)","Advanced analytics & billing reports","Twilio SMS integration","3 free staff seats included","25GB document storage","Priority support"]},
  {name:"Firm",desc:"Mid-size firms needing enterprise security & scale",m:249,a:199,per:"/user",features:["Everything in Professional, plus:","Unlimited AI queries","Unlimited document storage","Unlimited free staff seats","Custom integrations & API access","Dedicated Customer Success Manager","White-glove onboarding & migration","SLA guarantees (99.9% uptime)","Multi-office support","SSO / SAML authentication","Custom role configurations","White-label client portal","Phone, video & priority support","Advanced audit & compliance"]},
]

const faqs=[
  {q:"How do AI query limits work?",a:"Starter includes 200 AI queries/month (+100 per extra attorney). Professional includes 500/month (+100 per extra attorney). Firm plans get unlimited queries. No per-query fees — your monthly allocation covers LegiSearch™, LegiDraft™ demand letters, and LegiLyze™ contract analysis."},
  {q:"How does pricing compare to Clio?",a:"A 5-attorney firm on Legience Professional: 5 × $169 = $845/mo with 3 free staff seats and 900 AI queries/mo. The same firm on Clio with Manage + Grow + Duo + e-signatures: $1,400–$1,800/mo — and every staff seat at full price. That's $555–$955/month in savings."},
  {q:"What happens after my 14-day trial?",a:"You choose a plan or your account pauses — no auto-charge, no surprise invoices. We never ask for a credit card upfront. Your data is preserved for 30 days after trial expiration so you don't lose anything."},
  {q:"Can I import data from Clio, MyCase, or spreadsheets?",a:"Yes. Free data migration for Professional and Firm plans. Our team handles the full import: cases, contacts, documents, billing records, and time entries. Solo/Starter plans include a self-service import tool and migration guides."},
  {q:"Is my data encrypted and secure?",a:"AES-256 encryption at rest, TLS in transit. Security practices aligned with 201 CMR 17.00 (Massachusetts data protection). AI processed through AWS Bedrock under BAA — zero training on your data. All data stored in AWS US-East (Ohio). Comprehensive audit logs for every action."},
  {q:"Do you charge per-case fees for AI demand letters?",a:"Never. LegiDraft™ is $0 per case on Professional and Firm plans, with unlimited volume. For comparison, EvenUp charges $500+ per demand letter and Precedent charges $275. We believe AI demand generation should be a feature, not a revenue stream."},
]

export default function Pricing(){
  const[annual,setAnnual]=useState(false)
  const[openFaq,setOpenFaq]=useState(null)
  const faqSchema={
    "@context":"https://schema.org",
    "@type":"FAQPage",
    mainEntity:faqs.map(f=>({
      "@type":"Question",
      name:f.q,
      acceptedAnswer:{"@type":"Answer",text:f.a}
    }))
  }
  const productSchema={
    "@context":"https://schema.org",
    "@type":"SoftwareApplication",
    name:"Legience Legal Practice Management",
    description:"AI-powered legal practice management software with 14 integrated modules: case management, AI legal research, document drafting, billing, e-signatures, CRM, client portal, conflict checking, and analytics.",
    applicationCategory:"BusinessApplication",
    operatingSystem:"Web-based",
    brand:{"@type":"Brand",name:"Legience"},
    url:"https://legience.com/pricing",
    image:"https://legience.com/og-image.png",
    offers:plans.map(p=>({
      "@type":"Offer",
      name:p.name,
      price:String(p.m),
      priceCurrency:"USD",
      priceValidUntil:"2026-12-31",
      availability:"https://schema.org/InStock",
      url:"https://legience.com/pricing"
    }))
  }
  return<>
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
      <script type="application/ld+json">{JSON.stringify(productSchema)}</script>
    </Helmet>
    <PageHero badge="Transparent Pricing" title="One Price." gradient="Everything Included." subtitle="No per-case AI fees. No e-signature surcharges. No research add-ons. No CRM upsells. Compare our all-inclusive pricing to Clio ($750+/user/mo with add-ons) and MyCase ($500+/user/mo)."/>
    
    <section className="section"><div className="container">
      {/* Toggle */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"12px",marginBottom:"40px"}}>
        <span style={{fontSize:"0.88rem",fontWeight:600,color:!annual?"var(--ink-800)":"var(--gray-400)"}}>Monthly</span>
        <button onClick={()=>setAnnual(!annual)} style={{width:"48px",height:"26px",borderRadius:"13px",background:annual?"var(--accent)":"var(--gray-200)",border:"none",cursor:"pointer",position:"relative",transition:"0.3s"}}><div style={{width:"22px",height:"22px",borderRadius:"50%",background:"#fff",position:"absolute",top:"2px",left:annual?"24px":"2px",transition:"0.3s",boxShadow:"0 2px 4px rgba(0,0,0,0.15)"}}/></button>
        <span style={{fontSize:"0.88rem",fontWeight:600,color:annual?"var(--ink-800)":"var(--gray-400)"}}>Annual</span>
        <span className="label" style={{fontSize:"0.68rem"}}>Save 22%</span>
      </div>

      <div className="price-grid">
        {plans.map((p,i)=><div key={i} className={`price-card ${p.pop?"price-card--pop":""}`}>
          {p.pop&&<div className="price-card__pop-tag">Most Popular</div>}
          <div className="price-card__name">{p.name}</div>
          <div className="price-card__desc">{p.desc}</div>
          <div className="price-card__price" style={{marginTop:"16px"}}>
            <span className="price-card__amt">${annual?p.a:p.m}</span>
            <span className="price-card__per">/{annual?"mo (billed annually)":"month"}{p.per||""}</span>
          </div>
          <div style={{marginTop:"16px"}}><Link to="/contact" className={`btn ${p.pop?"btn--primary":"btn--outline"} btn--lg`} style={{width:"100%",justifyContent:"center"}}>{p.name==="Firm"?"Contact Sales":"Apply for Early Access"}{p.pop?" →":""}</Link></div>
          <div className="price-card__divider"/>
          {p.features.map((f,j)=><div key={j} className="price-card__feat">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:16,height:16,color:"var(--accent)",flexShrink:0}}><path d="M20 6L9 17l-5-5"/></svg>
            {f}
          </div>)}
        </div>)}
      </div>

      {/* Money-back guarantee */}
      <div style={{textAlign:"center",marginTop:"32px",padding:"20px",background:"var(--accent-subtle)",borderRadius:"var(--radius-lg)",maxWidth:"600px",margin:"32px auto 0"}}>
        <div style={{fontWeight:700,color:"var(--accent)",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Gift size={16} /> 14-Day Free Trial • No Credit Card Required</div>
        <p style={{fontSize:"0.85rem",color:"var(--gray-500)",marginTop:"4px"}}>Full access to every feature. Cancel anytime. Your data preserved for 30 days after trial.</p>
      </div>
    </div></section>

    {/* FAQ */}
    <section className="section section--muted"><div className="container">
      <SectionHead badge="FAQ" title="Common Questions" subtitle="Everything you need to know about pricing, features, and migration."/>
      <div style={{maxWidth:"720px",margin:"0 auto"}}>
        {faqs.map((f,i)=><div key={i} className={`faq-item ${openFaq===i?"open":""}`}>
          <button className="faq-q" onClick={()=>setOpenFaq(openFaq===i?null:i)}><span>{f.q}</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:18,height:18,transition:"0.3s",transform:openFaq===i?"rotate(180deg)":"none",flexShrink:0}}><path d="M6 9l6 6 6-6"/></svg></button>
          <div className="faq-a"><div className="faq-a__inner">{f.a}</div></div>
        </div>)}
      </div>
    </div></section>

    {/* ROI Calculator */}
    <section className="section reveal"><div className="container">
      <SectionHead badge="ROI Calculator" title="See Your Monthly Savings" subtitle="Estimate what you'd save by switching to Legience."/>
      <ROICalc/>
    </div></section>

  </>
}

function ROICalc(){
  const[a,setA]=useState(8),[t,setT]=useState(600)
  const cur=a*t,leg=a*(a<=1?99:a<=10?169:249),sav=cur-leg
  return<div style={{maxWidth:560,margin:"0 auto",background:"white",border:"1px solid var(--gray-100)",borderRadius:"var(--radius-xl)",padding:32,boxShadow:"0 8px 32px -8px rgba(0,0,0,0.06)"}}>
    <div className="roi-inputs" style={{marginBottom:20}}>
      <div className="form-group"><label className="form-label">Attorneys</label><select value={a} onChange={e=>setA(+e.target.value)} className="form-input"><option value={1}>1 (Solo)</option><option value={3}>2-5</option><option value={8}>6-10</option><option value={15}>11-20</option><option value={30}>21-50</option></select></div>
      <div className="form-group"><label className="form-label">Current Monthly Cost/User</label><select value={t} onChange={e=>setT(+e.target.value)} className="form-input"><option value={400}>Clio + add-ons (~$400)</option><option value={600}>Clio + Westlaw + DocuSign (~$600)</option><option value={750}>Full stack (~$750)</option><option value={200}>Basic tools (~$200)</option></select></div>
    </div>
    <div style={{background:"var(--ink-950)",borderRadius:"var(--radius-lg)",padding:24,textAlign:"center"}}>
      <div style={{fontSize:"0.78rem",color:"rgba(255,255,255,0.55)"}}>Estimated Monthly Savings</div>
      <div className="text-gradient" style={{fontSize:"2.8rem",fontWeight:800}}>${sav.toLocaleString()}</div>
      <div className="roi-results" style={{marginTop:16}}>
        <div><div style={{fontSize:"1.1rem",fontWeight:700,color:"#f48168"}}>${cur.toLocaleString()}</div><div style={{fontSize:"0.68rem",color:"rgba(255,255,255,0.45)"}}>Current</div></div>
        <div><div style={{fontSize:"1.1rem",fontWeight:700,color:"#34d0b6"}}>${leg.toLocaleString()}</div><div style={{fontSize:"0.68rem",color:"rgba(255,255,255,0.45)"}}>Legience</div></div>
        <div><div style={{fontSize:"1.1rem",fontWeight:700,color:"#fcd34d"}}>${(sav*12).toLocaleString()}</div><div style={{fontSize:"0.68rem",color:"rgba(255,255,255,0.45)"}}>Annual</div></div>
      </div>
    </div>
    <Link to="/contact" className="btn btn--primary btn--lg" style={{width:"100%",marginTop:16,justifyContent:"center"}}>Start Free Trial — See Real Savings →</Link>
  </div>
}
