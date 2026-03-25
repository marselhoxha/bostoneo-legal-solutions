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
  {cat:"E-Signatures",leg:"Unlimited (BoldSign)",comp:"Via integration"},
  {cat:"Client Portal",leg:"Free, unlimited seats",comp:"Included"},
  {cat:"CRM / Intake",leg:"Built-in (Pro+)",comp:"Basic intake"},
  {cat:"Conflict Checking",leg:"ABA 1.7, 1.9, 1.10 (Pro+)",comp:"Basic"},
  {cat:"Billing & Invoicing",leg:true,comp:true},
  {cat:"Document Management",leg:true,comp:true},
  {cat:"Analytics & Reporting",leg:"Advanced (Pro+)",comp:"Basic"},
  {cat:"Expense Management",leg:"Built-in (Pro+)",comp:false},
  {cat:"Demand Letter Automation",leg:"$0/case (Pro+)",comp:false},
  {cat:"Settlement Tracker",leg:"Built-in (Pro+)",comp:false},
  {cat:"Staff Seats Included Free",leg:"1-3 depending on plan",comp:"None"},
]

const faqs=[
  {q:"What is the main advantage of Legience over PracticePanther?",a:"AI capabilities. PracticePanther is a solid general practice management platform, but it has no AI legal research, no AI document drafting, no AI medical records analysis, and no demand letter automation. Legience includes all four in every plan. For firms that want AI-powered workflows without cobbling together multiple tools, Legience is the more complete platform."},
  {q:"Is PracticePanther more affordable than Legience?",a:"PracticePanther's per-seat price ranges from $59-99/user/month, while Legience ranges from $99-249/user/month. However, PracticePanther does not include AI legal research (you need Westlaw or Fastcase separately at $100-400+/mo), e-signatures require a third-party integration, and all staff seats are billed at full price. The total cost of ownership often favors Legience."},
  {q:"Can I migrate from PracticePanther to Legience?",a:"Yes. Professional and Firm plans include free, white-glove data migration. We import cases, contacts, documents, billing records, and time entries from PracticePanther. Starter plan users get a self-service import tool. Most migrations complete within 48 hours."},
  {q:"Does Legience work for the same practice areas as PracticePanther?",a:"Yes. Both platforms support personal injury, family law, criminal defense, immigration, estate planning, business litigation, and other common practice areas. The difference is that Legience adds practice-area-specific AI tools -- for example, PI firms get AI demand letters, medical records analysis with injury severity scoring, settlement tracking, and a damage calculator."},
]

export default function LegVsPP(){
  const[openFaq,setOpenFaq]=useState(null)
  const faqSchema={
    "@context":"https://schema.org",
    "@type":"FAQPage",
    mainEntity:faqs.map(f=>({"@type":"Question",name:f.q,acceptedAnswer:{"@type":"Answer",text:f.a}}))
  }

  return<>
    <Helmet>
      <title>Legience vs PracticePanther (2026) — Feature & Pricing Comparison | Legience</title>
      <meta name="description" content="Compare Legience and PracticePanther for law firms. Side-by-side feature comparison, real pricing data, and total cost analysis for a 5-attorney firm."/>
      <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
    </Helmet>

    <PageHero badge="Comparison" title="Legience vs PracticePanther" gradient="More Than Case Management." subtitle="PracticePanther handles the fundamentals. Legience handles the fundamentals and adds AI legal research, AI drafting, medical records analysis, and unlimited e-signatures -- no integrations needed."/>

    {/* At a Glance */}
    <section className="section"><div className="container">
      <SectionHead badge="At a Glance" title="Why Firms Choose Legience Over PracticePanther" subtitle="Three areas where the platforms diverge most."/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:"24px",maxWidth:"960px",margin:"0 auto"}}>
        {[
          {title:"AI That Actually Practices Law",desc:"PracticePanther has no AI features. Legience includes LegiSearch for case law research with verified citations, LegiDraft for drafting 30+ document types including demand letters at $0/case, and LegiLyze for medical records analysis. All three engines are included in every plan."},
          {title:"No Integration Tax",desc:"PracticePanther relies on third-party integrations for e-signatures, legal research, and document automation. Each integration adds cost, complexity, and potential points of failure. Legience builds these capabilities natively, so you manage one platform instead of five."},
          {title:"Free Staff Seats Save Real Money",desc:"PracticePanther charges full per-user price for every seat -- paralegals, legal assistants, office managers. Legience includes 1 to 3 free staff seats depending on your plan. For a firm with 3 support staff at $89/mo each, that is $267/month in savings on staff seats alone."},
        ].map((c,i)=><div key={i} style={{padding:"28px",background:"var(--off-white)",borderRadius:"var(--radius-lg)",border:"1px solid var(--gray-100)"}}>
          <h3 style={{fontSize:"1.05rem",fontWeight:700,color:"var(--ink-800)",marginBottom:"8px"}}>{c.title}</h3>
          <p style={{fontSize:"0.88rem",color:"var(--gray-500)",lineHeight:1.7}}>{c.desc}</p>
        </div>)}
      </div>
    </div></section>

    {/* Feature Comparison Table */}
    <section className="section section--muted"><div className="container">
      <SectionHead badge="Feature Comparison" title="Side-by-Side Features" subtitle="What each platform includes out of the box."/>
      <div className="comp-wrap" style={{maxWidth:"860px",margin:"0 auto"}}>
        <table className="comp-table">
          <thead><tr>
            <th style={{width:"40%"}}>Feature</th>
            <th style={{width:"30%",color:"var(--accent)"}}>Legience</th>
            <th style={{width:"30%"}}>PracticePanther</th>
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
              <th>PracticePanther</th>
            </tr></thead>
            <tbody>
              <tr><td style={{fontWeight:600,color:"var(--ink-800)"}}>Solo / Entry</td><td className="check">$99/user/mo</td><td>$59/user/mo (Solo)</td></tr>
              <tr><td style={{fontWeight:600,color:"var(--ink-800)"}}>Mid-Tier</td><td className="check">$169/user/mo</td><td>$89/user/mo (Essential)</td></tr>
              <tr><td style={{fontWeight:600,color:"var(--ink-800)"}}>Top Tier</td><td className="check">$249/user/mo</td><td>$99/user/mo (Business)</td></tr>
              <tr><td style={{fontWeight:600,color:"var(--ink-800)"}}>AI Research</td><td className="check">Included (all plans)</td><td>Not available</td></tr>
              <tr><td style={{fontWeight:600,color:"var(--ink-800)"}}>AI Document Drafting</td><td className="check">Included (all plans)</td><td>Not available</td></tr>
              <tr><td style={{fontWeight:600,color:"var(--ink-800)"}}>E-Signatures</td><td className="check">Included (all plans)</td><td>Via integration</td></tr>
              <tr><td style={{fontWeight:600,color:"var(--ink-800)"}}>Free Staff Seats</td><td className="check">1-3 included</td><td>None</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div></section>

    {/* Total Cost for 5-Attorney Firm */}
    <section className="section section--muted"><div className="container">
      <SectionHead badge="Real-World Math" title="Total Cost: 5-Attorney Firm" subtitle="What you actually pay when you account for the full toolset a modern firm needs."/>
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
          name="PracticePanther + Required Tools"
          lines={[
            {label:"5 attorneys x $99/mo (Business)",val:"$495"},
            {label:"3 staff x $99/mo",val:"$297"},
            {label:"Westlaw / Fastcase (~$200/user)",val:"$1,000"},
            {label:"E-signatures (DocuSign ~$25/user)",val:"$125"},
            {label:"CRM tool (est. $30-50/user)",val:"$150+"},
            {label:"Demand letters (manual or EvenUp)",val:"$500+/case"},
          ]}
          total="$2,067+/mo"
        />
      </div>
      <p style={{textAlign:"center",marginTop:"24px",fontSize:"0.92rem",color:"var(--gray-500)",maxWidth:"640px",margin:"24px auto 0"}}>
        PracticePanther's per-seat price looks attractive, but the total stack cost tells a different story. Legience saves an estimated <strong style={{color:"var(--accent)"}}>$1,200+ per month</strong> -- over <strong style={{color:"var(--accent)"}}>$14,000 per year</strong> -- while delivering AI capabilities PracticePanther simply does not have.
      </p>
    </div></section>

    {/* FAQ */}
    <section className="section"><div className="container">
      <SectionHead badge="FAQ" title="Common Questions" subtitle="Answers for firms evaluating Legience against PracticePanther."/>
      <div style={{maxWidth:"720px",margin:"0 auto"}}>
        {faqs.map((f,i)=><div key={i} className={`faq-item ${openFaq===i?"open":""}`}>
          <button className="faq-q" onClick={()=>setOpenFaq(openFaq===i?null:i)}><span>{f.q}</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:18,height:18,transition:"0.3s",transform:openFaq===i?"rotate(180deg)":"none",flexShrink:0}}><path d="M6 9l6 6 6-6"/></svg></button>
          <div className="faq-a"><div className="faq-a__inner">{f.a}</div></div>
        </div>)}
      </div>
    </div></section>

    {/* CTA */}
    <section className="section section--dark"><div className="container" style={{textAlign:"center"}}>
      <SectionHead light badge="Ready for More?" title="Replace Your Entire Tool Stack" subtitle="14-day free trial. No credit card required. Free data migration on Professional and Firm plans."/>
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
