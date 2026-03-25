import{useState}from"react"
import{Link}from"react-router-dom"
import{Helmet}from"react-helmet-async"
import PageHero from"../../components/ui/PageHero"
import SectionHead from"../../components/ui/SectionHead"

const features=[
  {cat:"AI Demand Letters",leg:"$0/case (30+ doc types)",comp:"$500+/letter"},
  {cat:"AI Legal Research",leg:"LegiSearch (built-in)",comp:false},
  {cat:"AI Medical Records Analysis",leg:"LegiLyze (Pro+)",comp:true},
  {cat:"AI Document Analysis",leg:"LegiLyze (contracts, briefs)",comp:false},
  {cat:"Case Management",leg:"Full platform (14 modules)",comp:false},
  {cat:"Billing & Invoicing",leg:true,comp:false},
  {cat:"E-Signatures",leg:"Unlimited (BoldSign)",comp:false},
  {cat:"Client Portal",leg:"Free, unlimited seats",comp:false},
  {cat:"CRM / Intake",leg:"Built-in (Pro+)",comp:false},
  {cat:"Conflict Checking",leg:"ABA 1.7, 1.9, 1.10 (Pro+)",comp:false},
  {cat:"Settlement Tracker",leg:"Built-in (Pro+)",comp:false},
  {cat:"Damage Calculator",leg:true,comp:false},
  {cat:"Calendar & Tasks",leg:true,comp:false},
  {cat:"Expense Management",leg:"Built-in (Pro+)",comp:false},
  {cat:"Analytics & Reporting",leg:"Advanced (Pro+)",comp:"Limited"},
]

const faqs=[
  {q:"Is Legience a replacement for EvenUp?",a:"It depends on what you use EvenUp for. If you use EvenUp solely for AI demand letters, yes -- LegiDraft generates demand letters at $0/case on Professional and Firm plans. If you also use EvenUp's case valuation insights, Legience's damage calculator and AI settlement analysis provide similar capabilities. The key difference: Legience is a complete practice management platform, while EvenUp is a demand-letter-only tool."},
  {q:"How does LegiDraft quality compare to EvenUp?",a:"Both tools generate comprehensive demand letter drafts that require attorney review. EvenUp has been in the market longer and processes thousands of letters monthly. LegiDraft integrates directly with your case data, medical records, and AI research -- eliminating the data re-entry that EvenUp requires. Both produce quality drafts; LegiDraft's advantage is integration and zero per-case cost."},
  {q:"Why does EvenUp charge $500+ per letter while Legience charges $0?",a:"EvenUp is a standalone tool that charges per-case to fund its specialized AI infrastructure and human review process. Legience includes demand letter generation as one feature of a 14-module platform. The economics are different: Legience makes revenue from the monthly subscription, not per-document fees. This means the more cases you handle, the more you save with Legience."},
  {q:"Can I use both EvenUp and Legience?",a:"Yes, but most firms find it unnecessary. LegiDraft covers demand letter generation at $0/case. If your firm handles high-value complex cases where you want a second opinion, you could use EvenUp for select cases while using LegiDraft for the majority. But at $500+/letter, most firms prefer to draft all demands with LegiDraft and allocate that budget elsewhere."},
  {q:"Does Legience do everything EvenUp does?",a:"Legience does everything EvenUp does (AI demand letters, medical records analysis) and much more -- case management, billing, e-signatures, CRM, legal research, client portal, conflict checking, analytics, and 6 other modules. EvenUp is a point solution for demand letters only. Legience is a complete practice management platform with demand letters included."},
]

export default function LegVsEvenUp(){
  const[openFaq,setOpenFaq]=useState(null)
  const faqSchema={
    "@context":"https://schema.org",
    "@type":"FAQPage",
    mainEntity:faqs.map(f=>({"@type":"Question",name:f.q,acceptedAnswer:{"@type":"Answer",text:f.a}}))
  }

  return<>
    <Helmet>
      <title>Legience vs EvenUp (2026) — AI Demand Letters Comparison | Legience</title>
      <meta name="description" content="Compare Legience ($0/case demand letters) vs EvenUp ($500+/letter). See why PI firms choose an all-in-one platform over per-case pricing for AI demand letters."/>
      <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
    </Helmet>

    <PageHero badge="Comparison" title="Legience vs EvenUp" gradient="$0/Case vs $500+/Letter." subtitle="EvenUp charges $500+ per demand letter. Legience includes AI demand letters, legal research, medical records analysis, and 11 other modules -- at $0 per case."/>

    {/* At a Glance */}
    <section className="section"><div className="container">
      <SectionHead badge="At a Glance" title="Platform vs. Point Solution" subtitle="EvenUp does one thing. Legience does everything."/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:"24px",maxWidth:"960px",margin:"0 auto"}}>
        {[
          {title:"$0/Case vs $500+/Letter",desc:"EvenUp charges $500+ per demand letter. For a firm handling 10 cases/month, that's $5,000+/month just for demand letters. LegiDraft is included in every Legience plan at $0 per case -- saving $60,000+/year for the same firm."},
          {title:"Complete Platform, Not Just Demands",desc:"EvenUp generates demand letters. That's it. Legience includes case management, billing, CRM, e-signatures, client portal, conflict checking, analytics, and more -- 14 modules in one platform. EvenUp users still need Clio or Filevine for everything else."},
          {title:"No Data Re-Entry",desc:"EvenUp requires you to upload case files to their platform separately. LegiDraft reads directly from your case data, medical records, and research already in Legience. Zero duplicate data entry, zero file transfers, zero waiting for turnaround."},
        ].map((c,i)=><div key={i} style={{padding:"28px",background:"var(--off-white)",borderRadius:"var(--radius-lg)",border:"1px solid var(--gray-100)"}}>
          <h3 style={{fontSize:"1.05rem",fontWeight:700,color:"var(--ink-800)",marginBottom:"8px"}}>{c.title}</h3>
          <p style={{fontSize:"0.88rem",color:"var(--gray-500)",lineHeight:1.7}}>{c.desc}</p>
        </div>)}
      </div>
    </div></section>

    {/* Feature Comparison Table */}
    <section className="section section--muted"><div className="container">
      <SectionHead badge="Feature Comparison" title="Side-by-Side Capabilities" subtitle="A demand letter tool vs. a complete legal practice management platform."/>
      <div className="comp-wrap" style={{maxWidth:"860px",margin:"0 auto"}}>
        <table className="comp-table">
          <thead><tr>
            <th style={{width:"40%"}}>Feature</th>
            <th style={{width:"30%",color:"var(--accent)"}}>Legience</th>
            <th style={{width:"30%"}}>EvenUp</th>
          </tr></thead>
          <tbody>{features.map((f,i)=><tr key={i}>
            <td style={{fontWeight:600,color:"var(--ink-800)"}}>{f.cat}</td>
            <td>{renderCell(f.leg,true)}</td>
            <td>{renderCell(f.comp,false)}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </div></section>

    {/* Cost Comparison */}
    <section className="section"><div className="container">
      <SectionHead badge="Real-World Math" title="Annual Cost: 5-Attorney PI Firm" subtitle="What a firm handling 10 PI cases/month actually pays per year."/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))",gap:"24px",maxWidth:"860px",margin:"0 auto"}}>
        <CostCard
          name="Legience Professional"
          highlight
          lines={[
            {label:"5 attorneys x $169/mo x 12",val:"$10,140/yr"},
            {label:"AI demand letters (120/yr)",val:"Included"},
            {label:"AI legal research",val:"Included"},
            {label:"AI medical records",val:"Included"},
            {label:"E-signatures, CRM, portal",val:"Included"},
            {label:"Separate case mgmt (Clio, etc.)",val:"Not needed"},
          ]}
          total="$10,140/yr"
        />
        <CostCard
          name="EvenUp + Case Management"
          lines={[
            {label:"EvenUp (120 letters x $500)",val:"$60,000/yr"},
            {label:"Clio Manage (5 x $149/mo x 12)",val:"$8,940/yr"},
            {label:"Clio Grow (5 x $49/mo x 12)",val:"$2,940/yr"},
            {label:"Westlaw (5 x $100/mo x 12)",val:"$6,000/yr"},
            {label:"DocuSign e-signatures",val:"$1,500/yr"},
            {label:"Staff seats (3 x $149/mo x 12)",val:"$5,364/yr"},
          ]}
          total="$84,744/yr"
        />
      </div>
      <p style={{textAlign:"center",marginTop:"24px",fontSize:"0.92rem",color:"var(--gray-500)",maxWidth:"640px",margin:"24px auto 0"}}>
        The difference: <strong style={{color:"var(--accent)"}}>$74,604/year</strong>. That's a paralegal's salary, a significant marketing budget, or pure profit -- redirected from per-case demand letter fees to your firm's bottom line.
      </p>
    </div></section>

    {/* FAQ */}
    <section className="section section--muted"><div className="container">
      <SectionHead badge="FAQ" title="Common Questions" subtitle="Answers for firms evaluating Legience against EvenUp."/>
      <div style={{maxWidth:"720px",margin:"0 auto"}}>
        {faqs.map((f,i)=><div key={i} className={`faq-item ${openFaq===i?"open":""}`}>
          <button className="faq-q" onClick={()=>setOpenFaq(openFaq===i?null:i)}><span>{f.q}</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:18,height:18,transition:"0.3s",transform:openFaq===i?"rotate(180deg)":"none",flexShrink:0}}><path d="M6 9l6 6 6-6"/></svg></button>
          <div className="faq-a"><div className="faq-a__inner">{f.a}</div></div>
        </div>)}
      </div>
    </div></section>

    {/* CTA */}
    <section className="section section--dark"><div className="container" style={{textAlign:"center"}}>
      <SectionHead light badge="Stop Paying Per Case" title="AI Demand Letters at $0/Case" subtitle="14-day free trial. No credit card required. Generate your first demand letter in minutes."/>
      <div style={{display:"flex",gap:"12px",justifyContent:"center",flexWrap:"wrap"}}>
        <Link to="/contact" className="btn btn--primary btn--lg">Start Free Trial</Link>
        <Link to="/pricing" className="btn btn--secondary btn--lg">View Pricing</Link>
      </div>
      <div style={{marginTop:16,display:"flex",gap:20,justifyContent:"center",fontSize:"0.78rem",color:"rgba(255,255,255,0.5)",flexWrap:"wrap"}}>
        <span>Also compare: <Link to="/compare/legience-vs-clio" style={{color:"var(--accent-light)"}}>vs Clio</Link></span>
        <span><Link to="/compare/legience-vs-filevine" style={{color:"var(--accent-light)"}}>vs Filevine</Link></span>
        <span><Link to="/compare/legience-vs-cloudlex" style={{color:"var(--accent-light)"}}>vs CloudLex</Link></span>
      </div>
    </div></section>
  </>
}

function renderCell(val,isLegience){
  if(val===true)return<span className="check" style={isLegience?{color:"var(--success)"}:{}}>Included</span>
  if(val===false)return<span className="cross">Not available</span>
  return<span style={isLegience?{color:"var(--success)",fontWeight:600}:{color:"var(--gray-500)"}}>{val}</span>
}

function CostCard({name,lines,total,highlight}){
  return<div style={{padding:"28px",borderRadius:"var(--radius-lg)",border:highlight?"2px solid var(--accent)":"1px solid var(--gray-100)",background:"#fff"}}>
    <div style={{fontSize:"1rem",fontWeight:700,color:highlight?"var(--accent)":"var(--ink-800)",marginBottom:"16px"}}>{name}</div>
    {lines.map((l,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid var(--gray-50)",fontSize:"0.88rem"}}>
      <span style={{color:"var(--gray-500)"}}>{l.label}</span>
      <span style={{fontWeight:600,color:l.val==="Free"||l.val==="Included"||l.val==="Not needed"?"var(--success)":"var(--ink-800)"}}>{l.val}</span>
    </div>)}
    <div style={{display:"flex",justifyContent:"space-between",padding:"14px 0 0",marginTop:"8px",borderTop:"2px solid var(--gray-200)",fontSize:"1.05rem"}}>
      <span style={{fontWeight:700,color:"var(--ink-800)"}}>Total</span>
      <span style={{fontWeight:800,color:highlight?"var(--accent)":"var(--ink-800)"}}>{total}</span>
    </div>
  </div>
}
