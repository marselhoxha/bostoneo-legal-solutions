import{useState}from"react"
import{Link}from"react-router-dom"
import{Helmet}from"react-helmet-async"
import PageHero from"../../components/ui/PageHero"
import SectionHead from"../../components/ui/SectionHead"

const features=[
  {cat:"Case Management",leg:true,comp:true},
  {cat:"AI Legal Research",leg:"LegiSearch (built-in)",comp:false},
  {cat:"AI Document Drafting",leg:"LegiDraft (30+ types, $0/case)",comp:false},
  {cat:"AI Medical Records Analysis",leg:"LegiLyze (Pro+)",comp:false},
  {cat:"E-Signatures",leg:"Unlimited (BoldSign)",comp:"DocuSign integration"},
  {cat:"Client Portal",leg:"Free, unlimited seats",comp:true},
  {cat:"CRM / Intake",leg:"Built-in (Pro+)",comp:true},
  {cat:"Conflict Checking",leg:"ABA 1.7, 1.9, 1.10 (Pro+)",comp:"Basic"},
  {cat:"Billing & Invoicing",leg:true,comp:true},
  {cat:"Document Management",leg:true,comp:true},
  {cat:"Analytics & Reporting",leg:"Advanced (Pro+)",comp:true},
  {cat:"Expense Management",leg:"Built-in (Pro+)",comp:false},
  {cat:"Demand Letter Automation",leg:"$0/case (Pro+)",comp:false},
  {cat:"Settlement Tracker",leg:"Built-in (Pro+)",comp:true},
  {cat:"Custom Workflows",leg:true,comp:"Highly configurable"},
  {cat:"Staff Seats Included Free",leg:"1-3 depending on plan",comp:"None (full price each)"},
]

const faqs=[
  {q:"Is Legience a replacement for Filevine?",a:"Yes. Legience covers all core Filevine functions -- case management, document management, billing, client communication, and workflows. The key difference is that Legience includes AI legal research (LegiSearch), AI document drafting (LegiDraft at $0/case), and AI medical records analysis (LegiLyze) as built-in features. Filevine does not offer built-in AI research or drafting capabilities."},
  {q:"How does pricing compare?",a:"Filevine uses custom, quote-based pricing that typically ranges from $50-100+/user/month depending on firm size and features selected. Legience offers transparent published pricing: Starter $99/mo, Professional $169/mo, Firm $249/mo. Legience includes AI tools, e-signatures, CRM, and client portal in every plan -- features Filevine charges extra for or does not offer."},
  {q:"Can I migrate from Filevine to Legience?",a:"Yes. Professional and Firm plans include free, white-glove data migration. Our team imports your cases, contacts, documents, and billing records. Starter plan users get a self-service import tool. Most migrations complete within 2-3 business days."},
  {q:"Is Filevine better for large firms?",a:"Filevine is popular with mid-to-large PI firms due to its highly configurable workflows. Legience also supports multi-office firms with custom workflows, but adds AI capabilities that Filevine lacks -- including AI legal research, $0/case demand letters, and medical records analysis. For firms that want configurability plus AI, Legience offers more out of the box."},
]

export default function LegVsFilevine(){
  const[openFaq,setOpenFaq]=useState(null)
  const faqSchema={
    "@context":"https://schema.org",
    "@type":"FAQPage",
    mainEntity:faqs.map(f=>({"@type":"Question",name:f.q,acceptedAnswer:{"@type":"Answer",text:f.a}}))
  }

  return<>
    <Helmet>
      <title>Legience vs Filevine (2026) — Feature & Pricing Comparison | Legience</title>
      <meta name="description" content="Side-by-side comparison of Legience vs Filevine for law firms. Compare AI features, pricing, workflows, and total cost. See why PI firms choose Legience."/>
      <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
    </Helmet>

    <PageHero badge="Comparison" title="Legience vs Filevine" gradient="The Full Picture." subtitle="Filevine is a configurable case management platform. Legience adds AI legal research, document drafting at $0/case, and medical records analysis -- all included in one price."/>

    {/* At a Glance */}
    <section className="section"><div className="container">
      <SectionHead badge="At a Glance" title="Why Firms Choose Legience over Filevine" subtitle="Three differences that matter most when evaluating your next platform."/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:"24px",maxWidth:"960px",margin:"0 auto"}}>
        {[
          {title:"AI Built In, Not Missing",desc:"Filevine has no built-in AI legal research, no AI document drafting, and no AI medical records analysis. Legience ships with LegiSearch, LegiDraft, and LegiLyze in every plan -- no add-ons, no per-case fees."},
          {title:"Transparent Pricing",desc:"Filevine uses custom, quote-based pricing with no public price list. Legience publishes every plan price: $99, $169, or $249/user/month. No surprises, no sales calls required to learn the cost."},
          {title:"$0/Case Demand Letters",desc:"Filevine does not include demand letter automation. PI firms using Filevine typically pay EvenUp $500+/letter or Precedent $275+/letter. Legience includes LegiDraft demand letters at $0/case on Professional and Firm plans."},
        ].map((c,i)=><div key={i} style={{padding:"28px",background:"var(--off-white)",borderRadius:"var(--radius-lg)",border:"1px solid var(--gray-100)"}}>
          <h3 style={{fontSize:"1.05rem",fontWeight:700,color:"var(--ink-800)",marginBottom:"8px"}}>{c.title}</h3>
          <p style={{fontSize:"0.88rem",color:"var(--gray-500)",lineHeight:1.7}}>{c.desc}</p>
        </div>)}
      </div>
    </div></section>

    {/* Feature Comparison Table */}
    <section className="section section--muted"><div className="container">
      <SectionHead badge="Feature Comparison" title="Side-by-Side Features" subtitle="What is included in the base price vs. what costs extra."/>
      <div className="comp-wrap" style={{maxWidth:"860px",margin:"0 auto"}}>
        <table className="comp-table">
          <thead><tr>
            <th style={{width:"40%"}}>Feature</th>
            <th style={{width:"30%",color:"var(--accent)"}}>Legience</th>
            <th style={{width:"30%"}}>Filevine</th>
          </tr></thead>
          <tbody>{features.map((f,i)=><tr key={i}>
            <td style={{fontWeight:600,color:"var(--ink-800)"}}>{f.cat}</td>
            <td>{renderCell(f.leg,true)}</td>
            <td>{renderCell(f.comp,false)}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </div></section>

    {/* Total Cost for 5-Attorney Firm */}
    <section className="section"><div className="container">
      <SectionHead badge="Real-World Math" title="Total Cost: 5-Attorney PI Firm" subtitle="Apples-to-apples monthly cost with the features PI firms actually need."/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))",gap:"24px",maxWidth:"860px",margin:"0 auto"}}>
        <CostCard
          name="Legience Professional"
          highlight
          lines={[
            {label:"5 attorneys x $169/mo",val:"$845"},
            {label:"3 staff seats",val:"Free"},
            {label:"AI research & drafting",val:"Included"},
            {label:"E-signatures (unlimited)",val:"Included"},
            {label:"CRM & intake pipeline",val:"Included"},
            {label:"Client portal",val:"Included"},
          ]}
          total="$845/mo"
        />
        <CostCard
          name="Filevine + Third-Party Tools"
          lines={[
            {label:"5 attorneys (est. $75-100/user)",val:"$375-500"},
            {label:"3 staff seats (est. $75-100/user)",val:"$225-300"},
            {label:"EvenUp demand letters (10/mo)",val:"$5,000+"},
            {label:"Westlaw Edge (5 users)",val:"$425-750"},
            {label:"DocuSign e-signatures",val:"$125"},
            {label:"Standalone CRM (optional)",val:"$100-200"},
          ]}
          total="$6,250-6,875+/mo"
        />
      </div>
      <p style={{textAlign:"center",marginTop:"24px",fontSize:"0.92rem",color:"var(--gray-500)",maxWidth:"640px",margin:"24px auto 0"}}>
        The biggest cost difference is AI demand letters. At $500+/letter from EvenUp, a firm handling 10 cases/month spends <strong style={{color:"var(--accent)"}}>$5,000+/month</strong> on demand letters alone. With Legience, that cost is <strong style={{color:"var(--accent)"}}>$0</strong>.
      </p>
    </div></section>

    {/* FAQ */}
    <section className="section section--muted"><div className="container">
      <SectionHead badge="FAQ" title="Common Questions" subtitle="Answers for firms evaluating Legience against Filevine."/>
      <div style={{maxWidth:"720px",margin:"0 auto"}}>
        {faqs.map((f,i)=><div key={i} className={`faq-item ${openFaq===i?"open":""}`}>
          <button className="faq-q" onClick={()=>setOpenFaq(openFaq===i?null:i)}><span>{f.q}</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:18,height:18,transition:"0.3s",transform:openFaq===i?"rotate(180deg)":"none",flexShrink:0}}><path d="M6 9l6 6 6-6"/></svg></button>
          <div className="faq-a"><div className="faq-a__inner">{f.a}</div></div>
        </div>)}
      </div>
    </div></section>

    {/* CTA */}
    <section className="section section--dark"><div className="container" style={{textAlign:"center"}}>
      <SectionHead light badge="Ready to Switch?" title="See Why PI Firms Choose Legience" subtitle="14-day free trial. No credit card required. Free data migration on Professional and Firm plans."/>
      <div style={{display:"flex",gap:"12px",justifyContent:"center",flexWrap:"wrap"}}>
        <Link to="/contact" className="btn btn--primary btn--lg">Start Free Trial</Link>
        <Link to="/pricing" className="btn btn--secondary btn--lg">View Pricing</Link>
      </div>
      <div style={{marginTop:16,display:"flex",gap:20,justifyContent:"center",fontSize:"0.78rem",color:"rgba(255,255,255,0.5)",flexWrap:"wrap"}}>
        <span>Also compare: <Link to="/compare/legience-vs-clio" style={{color:"var(--accent-light)"}}>vs Clio</Link></span>
        <span><Link to="/compare/legience-vs-cloudlex" style={{color:"var(--accent-light)"}}>vs CloudLex</Link></span>
        <span><Link to="/compare/legience-vs-evenup" style={{color:"var(--accent-light)"}}>vs EvenUp</Link></span>
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
      <span style={{fontWeight:600,color:l.val==="Free"||l.val==="Included"?"var(--success)":"var(--ink-800)"}}>{l.val}</span>
    </div>)}
    <div style={{display:"flex",justifyContent:"space-between",padding:"14px 0 0",marginTop:"8px",borderTop:"2px solid var(--gray-200)",fontSize:"1.05rem"}}>
      <span style={{fontWeight:700,color:"var(--ink-800)"}}>Total</span>
      <span style={{fontWeight:800,color:highlight?"var(--accent)":"var(--ink-800)"}}>{total}</span>
    </div>
  </div>
}
