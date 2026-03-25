import Icon from "../components/ui/Icon"
import{Link}from"react-router-dom"
import PageHero from"../components/ui/PageHero"
import SectionHead from"../components/ui/SectionHead"

const core=[
  {icon:"ri-bank-card-line",name:"Stripe",cat:"Payments",desc:"Accept credit cards, ACH, and bank transfers directly from invoices. Clients pay via secure Stripe checkout. Automatic reconciliation with your billing records. PCI DSS Level 1 compliant.",status:"Live"},
  {icon:"ri-quill-pen-line",name:"BoldSign",cat:"E-Signatures",desc:"Unlimited legally-binding e-signatures. Send, track, and auto-file signed documents to case records. Reusable templates for retainers, releases, and medical authorizations. No per-send fees.",status:"Live"},
  {icon:"ri-robot-line",name:"Claude AI",cat:"by Anthropic",desc:"Powers LegiSearch™, LegiDraft™, and LegiLyze™. Zero-knowledge architecture means your data is processed in real-time and never stored or used for training.",status:"Live"},
  {icon:"ri-cloud-line",name:"AWS",cat:"Cloud Infrastructure",desc:"US-East hosted with ECS Fargate containers, RDS PostgreSQL databases, S3 document storage, and CloudFront CDN. Auto-scaling, automated backups, and 99.9% uptime SLA.",status:"Live"},
  {icon:"ri-smartphone-line",name:"Twilio",cat:"SMS & Messaging",desc:"Built-in SMS for client communication directly from Legience. Appointment reminders, case status updates, deadline notifications, and two-way messaging. Configurable per case type.",status:"Live"},
]
const roadmap=[
  {name:"Calendly",cat:"Scheduling",desc:"Automated consultation booking with calendar sync"},
  {name:"Gmail / Outlook",cat:"Email",desc:"Two-way email sync with case-linked threading"},
  {name:"QuickBooks",cat:"Accounting",desc:"Automated sync of invoices, payments, and expense records"},
  {name:"Court Filing APIs",cat:"Court Filing",desc:"Integration with state court e-filing systems"},
  {name:"Google Drive",cat:"Storage",desc:"Sync case documents with Google Drive folders"},
  {name:"Dropbox",cat:"Storage",desc:"Import and sync documents from Dropbox"},
  {name:"Slack",cat:"Communication",desc:"Case updates and deadline alerts in Slack channels"},
  {name:"Zoom",cat:"Video",desc:"Schedule and join client meetings from case records"},
]


function Ic({c,s}){return c&&c.startsWith("ri-")?<Icon name={c} size={20} style={s||{}} />:<span style={s||{}}>{c}</span>}

export default function Integrations(){
  return<>
    <PageHero badge="Integrations" title="Connected to the Tools" gradient="You Already Use." subtitle="Built-in integrations for secure payments, legally-binding e-signatures, AI-powered research, client messaging, and enterprise cloud infrastructure — all included at no extra cost."/>
    
    <section className="section"><div className="container">
      <SectionHead badge="Core Platform" title="Built-In Integrations" subtitle="No setup fees, no add-on costs, no per-use charges. These integrations are part of every Legience plan."/>
      <div style={{gap:20}} className="feat-grid feat-grid--2col">
        {core.map((c,i)=><div key={i} className="integ-card reveal" style={{transitionDelay:`${i*.08}s`,flexDirection:"column",alignItems:"flex-start"}}>
          <div style={{display:"flex",alignItems:"center",gap:14,width:"100%"}}>
            <div className="integ-icon" style={{background:"var(--accent-subtle)"}}><Ic c={c.icon} /></div>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}><span className="integ-name">{c.name}</span><span style={{fontSize:"0.65rem",fontWeight:700,color:"var(--success)",background:"rgba(10,179,156,0.08)",padding:"2px 8px",borderRadius:4}}>{c.status}</span></div>
              <div className="integ-cat">{c.cat}</div>
            </div>
          </div>
          <p className="integ-desc" style={{marginTop:12}}>{c.desc}</p>
        </div>)}
      </div>
    </div></section>

    <section className="section section--dark reveal"><div className="bg-grid"/><div className="bg-noise"/>
      <div className="container" style={{position:"relative",zIndex:1}}>
        <SectionHead badge="Coming Soon" title="On Our Roadmap" subtitle="We're building integrations with the tools attorneys use most. Vote for what you need." light/>
        <div style={{gap:12,maxWidth:720,margin:"0 auto"}} className="feat-grid feat-grid--2col reveal">
          {roadmap.map((r,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:14,padding:"16px 18px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,transition:"all 0.3s"}}>
            <div style={{width:40,height:40,borderRadius:10,background:"rgba(56,182,255,0.06)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:"0.72rem",fontWeight:700,color:"var(--accent-light)"}}>Soon</span></div>
            <div><div style={{fontWeight:700,fontSize:"0.88rem",color:"rgba(255,255,255,0.8)"}}>{r.name}</div><div style={{fontSize:"0.75rem",color:"rgba(255,255,255,0.5)",marginTop:2}}>{r.desc}</div></div>
          </div>)}
        </div>
        <div style={{textAlign:"center",marginTop:32}}><Link to="/contact" className="btn btn--primary">Request an Integration →</Link></div>
      </div>
    </section>
  </>
}
