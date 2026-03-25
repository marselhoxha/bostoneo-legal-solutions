import Icon from "../components/ui/Icon"
import{useState,useEffect}from"react"
import{Link,useLocation}from"react-router-dom"
import PageHero from"../components/ui/PageHero"
import SectionHead from"../components/ui/SectionHead"
import MockupShowcase from"../components/mockups/MockupShowcase"
import{mockup_ai_workspace}from"../assets/mockups"

const tools=[
  {icon:"ri-chat-3-line",tab:"LegiSearch",title:"LegiSearch™",desc:"Ask legal questions the way you'd ask a senior partner. Claude AI returns comprehensive, cited answers with federal and state case law, statute references, and jurisdiction-specific analysis. Unlike Westlaw's keyword-based search, Legience understands context and intent.",features:["Natural language queries — \"What's the statute of limitations for a rear-end collision?\"","Verified case citations across federal and state courts","applicable state laws chapter & section references","Follow-up questions that build on prior context","Export research memos directly to any case file","Conversation history with saved sessions and bookmarks"],highlights:["Federal & State Courts","Natural Language","Cited Results","Session History","Export to Case","Follow-up Queries"]},
  {icon:"ri-file-text-line",tab:"LegiDraft",title:"LegiDraft™",desc:"Generate 30+ document types and AI demand letters in minutes. Each document is tailored to your case facts, client details, and jurisdiction. Demand packages include medical summaries, damage calculations, liability analysis — all at $0/case. What EvenUp charges $500+ for, Legience includes free.",features:["Demand letters with case-specific facts and damages — $0/case","Medical record analysis with AI-generated treatment chronology","Motions to dismiss, compel, for summary judgment","Discovery requests, interrogatories, requests for production","Economic & non-economic damage calculations with jurisdiction multipliers","Custom templates: train the AI on your firm's formatting style"],highlights:["30+ Document Types","$0/case Demands","Any Jurisdiction","Custom Templates","Damage Calculations","Medical Chronology"]},
  {icon:"ri-search-line",tab:"LegiLyze",title:"LegiLyze™",desc:"Upload any legal document and get instant AI analysis. Key terms extraction, risk identification, clause-by-clause review, and plain-language summaries. Perfect for reviewing settlement offers, insurance policies, and opposing counsel documents.",features:["Key terms extraction with risk scoring (high/medium/low)","Clause-by-clause analysis with plain-language explanations","Compare documents against your templates for missing provisions","Insurance policy coverage analysis with limit identification","Settlement offer evaluation against comparable case data","Red-flag identification for unfavorable terms and conditions"],highlights:["Risk Scoring","Clause-by-Clause","Red Flag Alerts","Coverage Analysis","Template Compare","Plain Language"]},
  {icon:"ri-stethoscope-line",tab:"LegiMed",title:"LegiMed™",desc:"AI-powered medical records analysis built for PI attorneys. Upload medical records and get structured summaries, ICD-10 code extraction, treatment timelines, gap detection, and causation analysis — all in minutes instead of hours. Feed results directly into LegiDraft™ demand letters.",features:["AI-generated medical record summaries with key findings","ICD-10 code extraction and categorization","Treatment timeline reconstruction from multiple providers","Gap detection — identify missing records and treatment gaps","Causation analysis linking injuries to incident","Direct integration with LegiDraft™ demand letter generation"],highlights:["ICD-10 Extraction","Gap Detection","Timeline Builder","Causation Analysis","Multi-Provider","LegiDraft Integration"]},
]


const iconAnim=["search","draft","analyze","med"]
function Ic({c,s,size}){return c&&c.startsWith("ri-")?<Icon name={c} size={size||20} style={s||{}} />:<span style={s||{}}>{c}</span>}

export default function AIPlatform(){
  const[tab,setTab]=useState(0)
  const{hash}=useLocation()

  useEffect(()=>{
    if(hash){
      const idx=parseInt(hash.replace('#tool-',''))
      if(!isNaN(idx)&&idx>=0&&idx<tools.length){
        setTab(idx)
        setTimeout(()=>{
          document.getElementById('ai-tool-detail')?.scrollIntoView({behavior:'smooth'})
        },100)
      }
    }
  },[hash])

  const t=tools[tab]
  return<>
    <PageHero badge="LegiSpace AI" title="AI That Understands" gradient="Personal Injury Law." subtitle="Claude-powered LegiSearch™ with verified citations, LegiDraft™ for 30+ document types and $0/case demand letters, and LegiLyze™ for contract analysis. Zero-knowledge architecture — your data is never used for AI training."/>

    {/* AI Workspace Hero */}
    <section className="section"><div className="container">
      <div className="feature-showcase reveal">
        <div className="feature-showcase__content">
          <div className="feature-showcase__eyebrow"><div className="feature-showcase__eyebrow-num">AI</div> LegiSpace</div>
          <h2 className="feature-showcase__title">Your AI Legal Assistant — Always On, Always Cited</h2>
          <p className="feature-showcase__desc">One unified workspace for research, drafting, and analysis. Every AI interaction is linked to your cases, accessible from any screen, and exportable to your case files. Powered by Claude AI with zero-knowledge architecture.</p>
          <div className="ai-intro-grid" style={{marginTop:20}}>
            {[["💬 LegiSearch","Ask any legal question"],["📝 LegiDraft","30+ docs & demand letters"],["🔍 LegiLyze","Upload & review docs"],["🏥 LegiMed","Medical records AI"]].map(([t,d],i)=><div key={i} style={{padding:14,background:"var(--accent-subtle)",borderRadius:10}}>
              <div style={{fontWeight:700,fontSize:"0.88rem",color:"var(--accent)"}}>{t}</div>
              <div style={{fontSize:"0.75rem",color:"var(--gray-400)",marginTop:2}}>{d}</div>
            </div>)}
          </div>
          <div style={{display:"flex",gap:12,marginTop:24}}>
            <Link to="/contact" className="btn btn--primary">Try AI Free for 14 Days →</Link>
            <Link to="/pricing" className="btn btn--outline">See Pricing</Link>
          </div>
        </div>
        <div className="feature-showcase__visual">
          <MockupShowcase html={mockup_ai_workspace} label="LegiSearch™ Workspace" caption="Natural language queries, cited responses, conversation history." glow callouts={[{icon:"ri-chat-3-line",title:"Plain English",desc:"No Boolean needed"},{icon:"ri-book-open-line",title:"Verified Citations",desc:"case law"},{icon:"ri-file-text-line",title:"Export to Case",desc:"One-click save"},{icon:"ri-lock-line",title:"Zero-Knowledge",desc:"Data never stored"}]}/>
        </div>
      </div>
    </div></section>

    {/* Tabbed AI Tools */}
    <section id="ai-tool-detail" className="section section--dark" style={{padding:"80px 0 96px"}}><div className="bg-grid"/><div className="bg-noise"/>
      <div className="container" style={{position:"relative",zIndex:1}}>
        <SectionHead badge="Four AI Engines" title="Research. Draft. Analyze. Diagnose." subtitle="Click each tab to explore the AI capabilities in detail." light/>
        <div className="tabs tabs--center">
          {tools.map((x,i)=><button key={i} className={`tab ${tab===i?"tab--active":""}`} onClick={()=>setTab(i)}><Icon name={x.icon} size={14} style={{marginRight:4}} /> {x.tab}</button>)}
        </div>
        <div className="tab-panel" key={tab}>
          <div className="feature-tab-content" style={{color:"rgba(255,255,255,0.75)"}}>
            <div className="feature-tab-content__text">
              <div className="label" style={{color:"var(--accent-light)",background:"rgba(56,182,255,0.08)",marginBottom:12}}>{t.tab}</div>
              <h3 style={{color:"#fff",fontSize:"1.4rem"}}>{t.title}</h3>
              <p style={{marginTop:12,lineHeight:1.75}}>{t.desc}</p>
              <div style={{marginTop:20,display:"flex",flexDirection:"column",gap:10}}>
                {t.features.map((f,j)=><div key={j} style={{display:"flex",alignItems:"flex-start",gap:10,fontSize:"0.88rem"}}>
                  <span style={{color:"var(--accent-light)",fontWeight:700,flexShrink:0}}>✓</span>{f}
                </div>)}
              </div>
            </div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:16}}>
              <div className={`ai-tool-visual ai-tool-visual--${iconAnim[tab]}`}>
                <div className="ai-tool-visual__glow"/>
                {tab===0&&<div className="ai-tool-visual__typing"><span/><span/><span/></div>}
                {tab===1&&<div className="ai-tool-visual__lines"><span/><span/><span/><span/></div>}
                {tab===2&&<div className="ai-tool-visual__scan"/>}
                {tab===3&&<svg className="ai-tool-visual__ekg" viewBox="0 0 200 40" width="200" height="40"><path d="M0,20 L50,20 L60,20 L65,4 L70,36 L75,12 L80,20 L120,20 L130,20 L135,4 L140,36 L145,12 L150,20 L200,20" stroke="rgba(56,182,255,0.5)" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                <div className="ai-tool-visual__icon"><Ic c={t.icon} size={72}/></div>
              </div>
              <div className="ai-tool-highlights">
                {t.highlights.map((h,j)=><div key={j} className="ai-tool-highlight">{h}</div>)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    {/* Zero Knowledge */}
    <section className="section reveal"><div className="container">
      <SectionHead badge="Security" title="Zero-Knowledge AI Architecture" subtitle="Your case data, client information, and research queries are never stored, never used for training, and never accessible to anyone but you."/>
      <div className="process-steps" style={{maxWidth:900,margin:"0 auto"}}>
        {[["ri-lock-line","No AI Training","Your data is never used to train or improve any AI model. Period. This is architecturally enforced, not just a policy promise."],["ri-delete-bin-line","Ephemeral Processing","Queries are processed in real-time memory, then permanently deleted. No logs, no storage, no retrieval possible."],["ri-shield-check-line","US-Only Hosting","All data processed and stored exclusively on AWS US-East servers. No offshore processing, no cross-border transfers. Enterprise-grade security from day one."]].map(([icon,title,desc],i)=><div key={i} className="process-step reveal" style={{transitionDelay:`${i*.1}s`}}>
          <div style={{fontSize:"2rem",marginBottom:12}}><Ic c={icon} /></div>
          <div className="process-step__title">{title}</div>
          <div className="process-step__desc">{desc}</div>
        </div>)}
      </div>
    </div></section>
  </>
}
