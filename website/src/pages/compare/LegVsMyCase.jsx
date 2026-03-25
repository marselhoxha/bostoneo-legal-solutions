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
  {cat:"E-Signatures",leg:"Unlimited (BoldSign)",comp:"Limited / add-on"},
  {cat:"Client Portal",leg:"Free, unlimited seats",comp:"Included (Pro+)"},
  {cat:"CRM / Intake",leg:"Built-in (Pro+)",comp:"Basic intake forms"},
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
  {q:"What does Legience offer that MyCase does not?",a:"The biggest difference is AI. Legience includes AI legal research (LegiSearch), AI document drafting (LegiDraft with 30+ templates including demand letters at $0/case), and AI medical records analysis (LegiLyze). MyCase has no AI research, no AI drafting, and no medical records automation. Legience also includes unlimited e-signatures via BoldSign, a full CRM pipeline, automated conflict checking under ABA Rules 1.7/1.9/1.10, and free staff seats."},
  {q:"Is MyCase cheaper than Legience?",a:"MyCase's sticker price is lower: $39-89/user/month vs. Legience's $99-249/user/month. But MyCase does not include AI research (you would need Westlaw or Fastcase separately at $100-400+/mo), e-signatures require an add-on or third-party tool, and every staff seat is billed at full price. When you add the tools most firms actually need, Legience typically costs less overall."},
  {q:"Can I switch from MyCase to Legience?",a:"Yes. Professional and Firm plans include free, white-glove migration. Our team imports cases, contacts, documents, billing records, and time entries from MyCase. Most migrations complete within 48 hours. Starter plan users get a self-service import tool with step-by-step guides."},
  {q:"Does Legience support the same practice areas as MyCase?",a:"Legience supports all common practice areas including personal injury, family law, criminal defense, immigration, estate planning, and business litigation. Unlike MyCase, Legience offers practice-area-specific AI workflows -- for example, PI firms get AI demand letters, medical records analysis, settlement tracking, and a damage calculator built into the platform."},
]

export default function LegVsMyCase(){
  const[openFaq,setOpenFaq]=useState(null)
  const faqSchema={
    "@context":"https://schema.org",
    "@type":"FAQPage",
    mainEntity:faqs.map(f=>({"@type":"Question",name:f.q,acceptedAnswer:{"@type":"Answer",text:f.a}}))
  }

  return<>
    <Helmet>
      <title>Legience vs MyCase (2026) — Feature & Pricing Comparison | Legience</title>
      <meta name="description" content="Detailed comparison of Legience vs MyCase for law firms. See how AI research, document drafting, and all-inclusive pricing stack up."/>
      <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
    </Helmet>

    <PageHero badge="Comparison" title="Legience vs MyCase" gradient="AI Changes Everything." subtitle="MyCase covers the basics well. Legience covers the basics and adds AI legal research, AI drafting, medical records analysis, and unlimited e-signatures -- all included in one price."/>

    {/* At a Glance */}
    <section className="section"><div className="container">
      <SectionHead badge="At a Glance" title="Why Firms Choose Legience Over MyCase" subtitle="Three areas where the platforms differ most."/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:"24px",maxWidth:"960px",margin:"0 auto"}}>
        {[
          {title:"AI-Powered From Day One",desc:"MyCase has no AI legal research, no AI document drafting, and no AI medical records analysis. Legience ships with three purpose-built AI engines: LegiSearch for case law research with verified citations, LegiDraft for generating 30+ document types, and LegiLyze for analyzing medical records."},
          {title:"No Hidden Tooling Costs",desc:"With MyCase, you still need Westlaw or Fastcase for research ($100-400+/mo), a separate e-signature tool, and manual demand letter processes. Legience bundles AI research, AI drafting, e-signatures, CRM, and client portal into a single price."},
          {title:"Purpose-Built for PI",desc:"If your firm handles personal injury cases, Legience offers an entire PI workspace: AI demand letters at $0/case, medical records analysis, settlement tracking, a damage calculator, and document checklists. MyCase provides general case management without PI-specific automation."},
        ].map((c,i)=><div key={i} style={{padding:"28px",background:"var(--off-white)",borderRadius:"var(--radius-lg)",border:"1px solid var(--gray-100)"}}>
          <h3 style={{fontSize:"1.05rem",fontWeight:700,color:"var(--ink-800)",marginBottom:"8px"}}>{c.title}</h3>
          <p style={{fontSize:"0.88rem",color:"var(--gray-500)",lineHeight:1.7}}>{c.desc}</p>
        </div>)}
      </div>
    </div></section>

    {/* Feature Comparison Table */}
    <section className="section section--muted"><div className="container">
      <SectionHead badge="Feature Comparison" title="Side-by-Side Features" subtitle="What each platform includes in the base price."/>
      <div className="comp-wrap" style={{maxWidth:"860px",margin:"0 auto"}}>
        <table className="comp-table">
          <thead><tr>
            <th style={{width:"40%"}}>Feature</th>
            <th style={{width:"30%",color:"var(--accent)"}}>Legience</th>
            <th style={{width:"30%"}}>MyCase</th>
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
              <th>MyCase</th>
            </tr></thead>
            <tbody>
              <tr><td style={{fontWeight:600,color:"var(--ink-800)"}}>Entry / Basic</td><td className="check">$99/user/mo</td><td>$39/user/mo (Basic)</td></tr>
              <tr><td style={{fontWeight:600,color:"var(--ink-800)"}}>Mid-Tier</td><td className="check">$169/user/mo</td><td>$69/user/mo (Pro)</td></tr>
              <tr><td style={{fontWeight:600,color:"var(--ink-800)"}}>Top Tier</td><td className="check">$249/user/mo</td><td>$89/user/mo (Advanced)</td></tr>
              <tr><td style={{fontWeight:600,color:"var(--ink-800)"}}>AI Research</td><td className="check">Included (all plans)</td><td>Not available</td></tr>
              <tr><td style={{fontWeight:600,color:"var(--ink-800)"}}>AI Document Drafting</td><td className="check">Included (all plans)</td><td>Not available</td></tr>
              <tr><td style={{fontWeight:600,color:"var(--ink-800)"}}>E-Signatures</td><td className="check">Included (all plans)</td><td>Limited / add-on</td></tr>
              <tr><td style={{fontWeight:600,color:"var(--ink-800)"}}>Free Staff Seats</td><td className="check">1-3 included</td><td>None</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div></section>

    {/* Total Cost for 5-Attorney Firm */}
    <section className="section section--muted"><div className="container">
      <SectionHead badge="Real-World Math" title="Total Cost: 5-Attorney Firm" subtitle="What it actually costs when you factor in the tools most firms need."/>
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
          name="MyCase + Required Add-Ons"
          lines={[
            {label:"5 attorneys x $89/mo (Advanced)",val:"$445"},
            {label:"3 staff x $89/mo",val:"$267"},
            {label:"Westlaw / Fastcase (~$200/user)",val:"$1,000"},
            {label:"E-signatures (DocuSign ~$25/user)",val:"$125"},
            {label:"CRM tool (est. $30-50/user)",val:"$150+"},
            {label:"Demand letters (manual or EvenUp)",val:"$500+/case"},
          ]}
          total="$1,987+/mo"
        />
      </div>
      <p style={{textAlign:"center",marginTop:"24px",fontSize:"0.92rem",color:"var(--gray-500)",maxWidth:"640px",margin:"24px auto 0"}}>
        MyCase looks cheaper per seat, but once you add the research, drafting, and signature tools most firms need, Legience saves an estimated <strong style={{color:"var(--accent)"}}>$1,100+ per month</strong> -- over <strong style={{color:"var(--accent)"}}>$13,000 per year</strong> -- with better AI capabilities built in.
      </p>
    </div></section>

    {/* FAQ */}
    <section className="section"><div className="container">
      <SectionHead badge="FAQ" title="Common Questions" subtitle="Answers for firms evaluating Legience against MyCase."/>
      <div style={{maxWidth:"720px",margin:"0 auto"}}>
        {faqs.map((f,i)=><div key={i} className={`faq-item ${openFaq===i?"open":""}`}>
          <button className="faq-q" onClick={()=>setOpenFaq(openFaq===i?null:i)}><span>{f.q}</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:18,height:18,transition:"0.3s",transform:openFaq===i?"rotate(180deg)":"none",flexShrink:0}}><path d="M6 9l6 6 6-6"/></svg></button>
          <div className="faq-a"><div className="faq-a__inner">{f.a}</div></div>
        </div>)}
      </div>
    </div></section>

    {/* CTA */}
    <section className="section section--dark"><div className="container" style={{textAlign:"center"}}>
      <SectionHead light badge="Ready to Upgrade?" title="Go Beyond Basic Case Management" subtitle="14-day free trial. No credit card required. Free data migration on Professional and Firm plans."/>
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
