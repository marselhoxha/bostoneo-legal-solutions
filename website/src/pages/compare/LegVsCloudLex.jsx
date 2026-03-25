import{useState}from"react"
import{Link}from"react-router-dom"
import{Helmet}from"react-helmet-async"
import PageHero from"../../components/ui/PageHero"
import SectionHead from"../../components/ui/SectionHead"

const features=[
  {cat:"Case Management",leg:true,comp:true},
  {cat:"AI Legal Research",leg:"LegiSearch (built-in)",comp:false},
  {cat:"AI Document Drafting",leg:"LegiDraft (30+ types, $0/case)",comp:false},
  {cat:"AI Medical Records Analysis",leg:"LegiLyze (Pro+)",comp:"RecordXtract (built-in)"},
  {cat:"E-Signatures",leg:"Unlimited (BoldSign)",comp:"Third-party integration"},
  {cat:"Client Portal",leg:"Free, unlimited seats",comp:true},
  {cat:"CRM / Intake",leg:"Built-in (Pro+)",comp:true},
  {cat:"Conflict Checking",leg:"ABA 1.7, 1.9, 1.10 (Pro+)",comp:false},
  {cat:"Billing & Invoicing",leg:true,comp:true},
  {cat:"Document Management",leg:true,comp:true},
  {cat:"Analytics & Reporting",leg:"Advanced (Pro+)",comp:true},
  {cat:"Expense Management",leg:"Built-in (Pro+)",comp:false},
  {cat:"Demand Letter Automation",leg:"$0/case (Pro+)",comp:false},
  {cat:"Settlement Tracker",leg:"Built-in (Pro+)",comp:true},
  {cat:"Lexee AI Assistant",leg:"N/A",comp:"Built-in AI assistant"},
  {cat:"Staff Seats Included Free",leg:"1-3 depending on plan",comp:"Pricing not public"},
]

const faqs=[
  {q:"Is Legience a replacement for CloudLex?",a:"Yes. Legience covers all core CloudLex functions -- PI case management, medical records, settlement tracking, client portal, and intake. The key additions are AI legal research (LegiSearch with verified citations), AI document drafting (LegiDraft at $0/case for demand letters and 30+ document types), and ABA-compliant conflict checking -- features CloudLex does not offer."},
  {q:"How does medical records handling compare?",a:"CloudLex offers RecordXtract for medical records management within their platform. Legience offers LegiLyze for AI-powered medical records analysis with automated ICD-10 extraction, treatment timeline generation, and gap detection. Both handle records in-platform, but Legience adds AI analysis capabilities on top."},
  {q:"How does pricing compare?",a:"CloudLex uses custom, quote-based pricing with no public price list. Legience publishes transparent pricing: Starter $99/mo, Professional $169/mo, Firm $249/mo. Legience includes AI research, AI drafting, e-signatures, CRM, and client portal in every plan. CloudLex requires third-party tools for legal research, demand letters, and e-signatures."},
  {q:"Can I migrate from CloudLex to Legience?",a:"Yes. Professional and Firm plans include free, white-glove data migration. Our team imports your cases, contacts, documents, medical records, and billing data. Most migrations complete within 2-3 business days."},
  {q:"Is CloudLex better for PI firms?",a:"CloudLex was built specifically for PI and is a strong PI-focused platform. Legience is also purpose-built for PI (with the PI Workspace, damage calculators, settlement tracking, and SOL alerts) but adds AI capabilities CloudLex lacks -- including $0/case demand letters, AI legal research, and AI document analysis. For PI firms that want AI-powered workflows, Legience offers more."},
]

export default function LegVsCloudLex(){
  const[openFaq,setOpenFaq]=useState(null)
  const faqSchema={
    "@context":"https://schema.org",
    "@type":"FAQPage",
    mainEntity:faqs.map(f=>({"@type":"Question",name:f.q,acceptedAnswer:{"@type":"Answer",text:f.a}}))
  }

  return<>
    <Helmet>
      <title>Legience vs CloudLex (2026) — PI Software Comparison | Legience</title>
      <meta name="description" content="Side-by-side comparison of Legience vs CloudLex for PI law firms. Compare AI features, medical records, pricing, and demand letter capabilities."/>
      <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
    </Helmet>

    <PageHero badge="Comparison" title="Legience vs CloudLex" gradient="For PI Firms." subtitle="CloudLex is a PI-focused case management platform. Legience adds AI legal research, $0/case demand letters, and AI document analysis -- all included in one price."/>

    {/* At a Glance */}
    <section className="section"><div className="container">
      <SectionHead badge="At a Glance" title="Why PI Firms Choose Legience over CloudLex" subtitle="Three differences that matter most for personal injury practices."/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:"24px",maxWidth:"960px",margin:"0 auto"}}>
        {[
          {title:"AI Research & Drafting Included",desc:"CloudLex has no built-in legal research or document drafting. PI firms using CloudLex must subscribe to Westlaw ($85-300+/mo) and EvenUp ($500+/letter) separately. Legience includes LegiSearch and LegiDraft in every plan."},
          {title:"$0/Case Demand Letters",desc:"The biggest cost difference for PI firms. CloudLex users typically pay $500+/letter for AI demand letters from EvenUp. With Legience, LegiDraft generates demand packages from your case data at $0 per case. For a firm handling 10 cases/month, that's $5,000+/month in savings."},
          {title:"Complete Platform, Not Just PI",desc:"CloudLex is PI-only. If your firm handles any other practice areas (family law, business litigation, etc.), you need a second platform. Legience supports all practice areas with one subscription while still offering PI-specific tools."},
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
            <th style={{width:"30%"}}>CloudLex</th>
          </tr></thead>
          <tbody>{features.map((f,i)=><tr key={i}>
            <td style={{fontWeight:600,color:"var(--ink-800)"}}>{f.cat}</td>
            <td>{renderCell(f.leg,true)}</td>
            <td>{renderCell(f.comp,false)}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </div></section>

    {/* Total Cost */}
    <section className="section"><div className="container">
      <SectionHead badge="Real-World Math" title="Total Cost: 5-Attorney PI Firm" subtitle="Apples-to-apples monthly cost with the tools PI firms actually need."/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))",gap:"24px",maxWidth:"860px",margin:"0 auto"}}>
        <CostCard
          name="Legience Professional"
          highlight
          lines={[
            {label:"5 attorneys x $169/mo",val:"$845"},
            {label:"3 staff seats",val:"Free"},
            {label:"AI research & drafting",val:"Included"},
            {label:"AI demand letters ($0/case)",val:"Included"},
            {label:"E-signatures (unlimited)",val:"Included"},
            {label:"Conflict checking (ABA)",val:"Included"},
          ]}
          total="$845/mo"
        />
        <CostCard
          name="CloudLex + Third-Party Tools"
          lines={[
            {label:"CloudLex (custom pricing, est.)",val:"$500-800"},
            {label:"Westlaw Edge (5 users)",val:"$425-750"},
            {label:"EvenUp demand letters (10/mo)",val:"$5,000+"},
            {label:"DocuSign e-signatures",val:"$125"},
            {label:"Conflict checking tool",val:"$50-100"},
            {label:"Staff seats (est.)",val:"$200-400"},
          ]}
          total="$6,300-7,175+/mo"
        />
      </div>
      <p style={{textAlign:"center",marginTop:"24px",fontSize:"0.92rem",color:"var(--gray-500)",maxWidth:"640px",margin:"24px auto 0"}}>
        For PI firms, the demand letter savings alone justify the switch. At 10 letters/month, Legience saves <strong style={{color:"var(--accent)"}}>$5,000+/month</strong> -- over <strong style={{color:"var(--accent)"}}>$60,000/year</strong> -- compared to a CloudLex + EvenUp stack.
      </p>
    </div></section>

    {/* FAQ */}
    <section className="section section--muted"><div className="container">
      <SectionHead badge="FAQ" title="Common Questions" subtitle="Answers for PI firms evaluating Legience against CloudLex."/>
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
        <span><Link to="/compare/legience-vs-filevine" style={{color:"var(--accent-light)"}}>vs Filevine</Link></span>
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
