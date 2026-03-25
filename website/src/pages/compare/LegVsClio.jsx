import{useState}from"react"
import{Link}from"react-router-dom"
import{Helmet}from"react-helmet-async"
import PageHero from"../../components/ui/PageHero"
import SectionHead from"../../components/ui/SectionHead"

const features=[
  {cat:"Case Management",leg:true,comp:true},
  {cat:"AI Legal Research",leg:"LegiSearch (built-in)",comp:"CoCounsel add-on ($$$)"},
  {cat:"AI Document Drafting",leg:"LegiDraft (30+ types, $0/case)",comp:false},
  {cat:"AI Medical Records Analysis",leg:"LegiLyze (Pro+)",comp:false},
  {cat:"E-Signatures",leg:"Unlimited (BoldSign)",comp:"DocuSign add-on"},
  {cat:"Client Portal",leg:"Free, unlimited seats",comp:"$39/mo add-on"},
  {cat:"CRM / Intake",leg:"Built-in (Pro+)",comp:"Clio Grow ($49/user/mo)"},
  {cat:"Conflict Checking",leg:"ABA 1.7, 1.9, 1.10 (Pro+)",comp:"Basic"},
  {cat:"Billing & Invoicing",leg:true,comp:true},
  {cat:"Document Management",leg:true,comp:true},
  {cat:"Analytics & Reporting",leg:"Advanced (Pro+)",comp:true},
  {cat:"Expense Management",leg:"Built-in (Pro+)",comp:false},
  {cat:"Demand Letter Automation",leg:"$0/case (Pro+)",comp:false},
  {cat:"Settlement Tracker",leg:"Built-in (Pro+)",comp:false},
  {cat:"Staff Seats Included Free",leg:"1-3 depending on plan",comp:"None (full price each)"},
]

const faqs=[
  {q:"Is Legience a direct replacement for Clio Manage?",a:"Yes. Legience covers every core function in Clio Manage -- case management, contacts, calendaring, time tracking, billing, document management, and reporting. The difference is that Legience also bundles AI legal research, AI document drafting, e-signatures, client portal, CRM, and conflict checking at no extra cost. With Clio, each of those is a separate product or third-party add-on."},
  {q:"How does Legience AI compare to Clio's CoCounsel?",a:"CoCounsel is an add-on sold separately on top of Clio. It focuses on legal research and document review. Legience includes three AI engines in every plan: LegiSearch for case law research with verified citations, LegiDraft for drafting 30+ document types including demand letters at $0/case, and LegiLyze for medical records analysis. No add-on fees, no per-query charges beyond your monthly allocation."},
  {q:"Can I migrate my data from Clio to Legience?",a:"Yes. Professional and Firm plans include free, white-glove data migration. Our team imports your cases, contacts, documents, billing records, and time entries. Starter plan users get a self-service import tool with step-by-step guides. Most migrations complete within 48 hours."},
  {q:"Does Legience charge for Clio Grow-style CRM features?",a:"No. CRM, lead pipeline management, and intake workflows are built into Legience Professional and Firm plans at no additional cost. Clio charges $49/user/month for Clio Grow, or bundles it into Clio Duo at $125-175/user/month. With Legience, intake-to-invoice lives in one platform at one price."},
]

export default function LegVsClio(){
  const[openFaq,setOpenFaq]=useState(null)
  const faqSchema={
    "@context":"https://schema.org",
    "@type":"FAQPage",
    mainEntity:faqs.map(f=>({"@type":"Question",name:f.q,acceptedAnswer:{"@type":"Answer",text:f.a}}))
  }

  return<>
    <Helmet>
      <title>Legience vs Clio (2026) — Feature & Pricing Comparison | Legience</title>
      <meta name="description" content="Side-by-side comparison of Legience vs Clio for law firms. Compare pricing, AI features, e-signatures, CRM, and total cost for a 5-attorney firm."/>
      <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
    </Helmet>

    <PageHero badge="Comparison" title="Legience vs Clio" gradient="The Full Picture." subtitle="Clio is the industry incumbent. Legience is the AI-native alternative that bundles research, drafting, e-signatures, CRM, and client portal into one price -- no add-ons required."/>

    {/* At a Glance */}
    <section className="section"><div className="container">
      <SectionHead badge="At a Glance" title="Why Firms Switch from Clio" subtitle="Three differences that matter most when evaluating your next platform."/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:"24px",maxWidth:"960px",margin:"0 auto"}}>
        {[
          {title:"All-Inclusive Pricing",desc:"Clio requires separate purchases for Manage, Grow, e-signatures, and AI. Legience includes everything -- AI research, drafting, e-signatures, CRM, client portal -- in a single per-user price. No surprise invoices."},
          {title:"AI Built In, Not Bolted On",desc:"Clio's CoCounsel is an expensive add-on with limited scope. Legience ships with three AI engines from day one: LegiSearch for research, LegiDraft for document generation, and LegiLyze for medical records analysis."},
          {title:"Free Staff Seats",desc:"Clio charges full price for every staff seat -- paralegals, assistants, bookkeepers. Legience includes 1 to 3 free staff seats depending on your plan, saving hundreds per month for firms with support staff."},
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
            <th style={{width:"30%"}}>Clio</th>
          </tr></thead>
          <tbody>{features.map((f,i)=><tr key={i}>
            <td style={{fontWeight:600,color:"var(--ink-800)"}}>{f.cat}</td>
            <td>{renderCell(f.leg,true)}</td>
            <td>{renderCell(f.comp,false)}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </div></section>

    {/* Pricing Comparison */}
    <section className="section"><div className="container">
      <SectionHead badge="Pricing" title="Plan-by-Plan Pricing" subtitle="Monthly per-user pricing for comparable tiers."/>
      <div style={{maxWidth:"860px",margin:"0 auto"}}>
        <div className="comp-wrap">
          <table className="comp-table">
            <thead><tr>
              <th>Tier</th>
              <th style={{color:"var(--accent)"}}>Legience</th>
              <th>Clio</th>
            </tr></thead>
            <tbody>
              <tr><td style={{fontWeight:600,color:"var(--ink-800)"}}>Entry / Essentials</td><td className="check">$99/user/mo</td><td>$89/user/mo (EssentialsPlus)</td></tr>
              <tr><td style={{fontWeight:600,color:"var(--ink-800)"}}>Mid-Tier</td><td className="check">$169/user/mo</td><td>$129/user/mo (Advanced)</td></tr>
              <tr><td style={{fontWeight:600,color:"var(--ink-800)"}}>Top Tier</td><td className="check">$249/user/mo</td><td>$149/user/mo (Complete)</td></tr>
              <tr><td style={{fontWeight:600,color:"var(--ink-800)"}}>CRM / Intake</td><td className="check">Included (Pro+)</td><td>+$49/user/mo (Clio Grow)</td></tr>
              <tr><td style={{fontWeight:600,color:"var(--ink-800)"}}>E-Signatures</td><td className="check">Included (all plans)</td><td>Extra (DocuSign integration)</td></tr>
              <tr><td style={{fontWeight:600,color:"var(--ink-800)"}}>AI Legal Research</td><td className="check">Included (all plans)</td><td>CoCounsel add-on ($$$)</td></tr>
              <tr><td style={{fontWeight:600,color:"var(--ink-800)"}}>Client Portal</td><td className="check">Free, unlimited seats</td><td>$39/mo add-on</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div></section>

    {/* Total Cost for 5-Attorney Firm */}
    <section className="section section--muted"><div className="container">
      <SectionHead badge="Real-World Math" title="Total Cost: 5-Attorney Firm" subtitle="Apples-to-apples monthly cost with the features most firms actually need."/>
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
          name="Clio (Manage + Grow)"
          lines={[
            {label:"5 attorneys x $149/mo (Complete)",val:"$745"},
            {label:"3 staff x $149/mo",val:"$447"},
            {label:"Clio Grow x 5 attorneys ($49/mo)",val:"$245"},
            {label:"E-signatures (DocuSign ~$25/user)",val:"$125"},
            {label:"CoCounsel AI (est. $50-100/user)",val:"$250+"},
            {label:"Client portal add-on",val:"$39"},
          ]}
          total="$1,851+/mo"
        />
      </div>
      <p style={{textAlign:"center",marginTop:"24px",fontSize:"0.92rem",color:"var(--gray-500)",maxWidth:"640px",margin:"24px auto 0"}}>
        With Legience, that same 5-attorney firm saves an estimated <strong style={{color:"var(--accent)"}}>$1,000+ per month</strong> -- over <strong style={{color:"var(--accent)"}}>$12,000 per year</strong> -- while gaining AI capabilities that Clio charges extra for or does not offer at all.
      </p>
    </div></section>

    {/* FAQ */}
    <section className="section"><div className="container">
      <SectionHead badge="FAQ" title="Common Questions" subtitle="Answers for firms evaluating Legience against Clio."/>
      <div style={{maxWidth:"720px",margin:"0 auto"}}>
        {faqs.map((f,i)=><div key={i} className={`faq-item ${openFaq===i?"open":""}`}>
          <button className="faq-q" onClick={()=>setOpenFaq(openFaq===i?null:i)}><span>{f.q}</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:18,height:18,transition:"0.3s",transform:openFaq===i?"rotate(180deg)":"none",flexShrink:0}}><path d="M6 9l6 6 6-6"/></svg></button>
          <div className="faq-a"><div className="faq-a__inner">{f.a}</div></div>
        </div>)}
      </div>
    </div></section>

    {/* CTA */}
    <section className="section section--dark"><div className="container" style={{textAlign:"center"}}>
      <SectionHead light badge="Ready to Switch?" title="See Why Firms Leave Clio for Legience" subtitle="14-day free trial. No credit card required. Free data migration on Professional and Firm plans."/>
      <div style={{display:"flex",gap:"12px",justifyContent:"center",flexWrap:"wrap"}}>
        <Link to="/contact" className="btn btn--primary btn--lg">Start Free Trial</Link>
        <Link to="/pricing" className="btn btn--secondary btn--lg">View Pricing</Link>
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
