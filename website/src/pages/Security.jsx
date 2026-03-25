import Icon from "../components/ui/Icon"
import{Link}from"react-router-dom"
import PageHero from"../components/ui/PageHero"
import SectionHead from"../components/ui/SectionHead"

const features=[
  {icon:"ri-shield-keyhole-line",title:"AES-256 Encryption",desc:"All data encrypted at rest with AES-256 and in transit with TLS 1.3. Database-level encryption with customer-specific keys. Documents encrypted individually with unique keys per firm."},
  {icon:"ri-shield-line",title:"Continuous Security Monitoring",desc:"24/7 intrusion detection, vulnerability scanning, and automated security patching. Architecture designed to meet enterprise trust service criteria — security, availability, processing integrity, and confidentiality."},
  {icon:"ri-robot-line",title:"Zero-Knowledge AI",desc:"Claude AI processes queries in ephemeral memory without storing your data. No attorney-client data is used for model training, improvement, or any other purpose. Architecturally enforced, not just policy."},
  {icon:"ri-clipboard-line",title:"201 CMR 17.00",desc:"Full compliance with Massachusetts Standards for the Protection of Personal Information. Written information security plan, risk assessments, employee training, and breach notification procedures."},
  {icon:"ri-file-text-line",title:"Immutable Audit Logs",desc:"Every login, data access, modification, and export is recorded in tamper-proof audit logs. Complete chain of custody for every action taken in your firm's Legience account."},
  {icon:"ri-delete-bin-line",title:"Right to Delete",desc:"Request full data deletion at any time. Cryptographic proof of deletion provided within 30 days. No residual data, no backups retained, no exceptions."},
]

const compliance=["Attorney-Client Privilege Protected","201 CMR 17.00 Compliant","AES-256 Encryption at Rest","TLS 1.3 Encryption in Transit","Zero AI Training Guarantee","US-Only Data Residency","GDPR Ready","Immutable Audit Logs"]


function Ic({c,s}){return c&&c.startsWith("ri-")?<Icon name={c} size={20} style={s||{}} />:<span style={s||{}}>{c}</span>}

export default function Security(){
  return<>
    <PageHero badge="Security & Compliance" title="Your Data Is Sacred." gradient="We Treat It That Way." subtitle="Enterprise-grade security designed for attorney-client privilege. Built from the ground up to meet the most demanding security requirements in the legal industry."/>
    
    <section className="section"><div className="container">
      <SectionHead badge="Security Features" title="Defense in Depth" subtitle="Multiple independent layers of security protect your firm's data at every level — from encryption to access control to audit logging."/>
      <div style={{gap:20}} className="feat-grid feat-grid--2col">
        {features.map((f,i)=><div key={i} className="glow-card reveal" style={{transitionDelay:`${i*.06}s`}}><div className="glow-card__inner">
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
            <div style={{fontSize:"1.5rem"}}><Ic c={f.icon} /></div>
            <div style={{fontFamily:"var(--font-display)",fontWeight:700,color:"var(--ink-800)"}}>{f.title}</div>
          </div>
          <p style={{fontSize:"0.85rem",color:"var(--gray-500)",lineHeight:1.65}}>{f.desc}</p>
        </div></div>)}
      </div>
    </div></section>

    <section className="section section--muted"><div className="container">
      <SectionHead badge="Compliance Standards" title="Certifications & Standards We Meet"/>
      <div style={{gap:10,maxWidth:700,margin:"0 auto"}} className="feat-grid feat-grid--2col">
        {compliance.map((c,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:10,background:"#fff",padding:"14px 16px",borderRadius:10,border:"1px solid var(--gray-100)"}} className="reveal">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:18,height:18,color:"var(--accent)",flexShrink:0}}><path d="M20 6L9 17l-5-5"/></svg>
          <span style={{fontSize:"0.88rem",fontWeight:500,color:"var(--ink-800)"}}>{c}</span>
        </div>)}
      </div>
    </div></section>

  </>
}
