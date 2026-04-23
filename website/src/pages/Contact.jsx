import{useState,useRef}from"react"
import{Link}from"react-router-dom"
import emailjs from"@emailjs/browser"
import PageHero from"../components/ui/PageHero"
import Icon from"../components/ui/Icon"
import{Shield,Lock,ClipboardList}from"lucide-react"

const EMAILJS_SERVICE  = "service_d3g9frm"
const EMAILJS_TEMPLATE = "template_38dl00l"
const EMAILJS_KEY      = "PwYuPgJNcyy2NISuj"

export default function Contact(){
  const formRef = useRef(null)
  const successRef = useRef(null)
  const[sent,setSent]=useState(false)
  const[sending,setSending]=useState(false)
  const[error,setError]=useState("")

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")

    const fd = new FormData(formRef.current)
    const firstName = fd.get("firstName")?.toString().trim()
    const lastName  = fd.get("lastName")?.toString().trim()
    const email     = fd.get("email")?.toString().trim()
    const firmName  = fd.get("firmName")?.toString().trim()

    if (!firstName || !lastName || !email || !firmName) {
      setError("Please fill in all required fields.")
      return
    }

    if (!EMAILJS_SERVICE || !EMAILJS_TEMPLATE || !EMAILJS_KEY) {
      setError("Email service is not configured. Please contact us at hello@legience.com.")
      return
    }

    setSending(true)
    try {
      await emailjs.sendForm(EMAILJS_SERVICE, EMAILJS_TEMPLATE, formRef.current, { publicKey: EMAILJS_KEY })
      setSent(true)
      setTimeout(() => successRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100)
    } catch (err) {
      console.error("EmailJS error:", err)
      setError("Something went wrong. Please try again or email us at hello@legience.com.")
    } finally {
      setSending(false)
    }
  }

  return<>
    <PageHero badge="Get Started" title="Apply for" gradient="Early Access." subtitle="We're onboarding a limited number of law firms during our early access program. Apply now for priority onboarding, founding member pricing, and direct access to our development team."/>

    <section className="section"><div className="container">
      <div className="fd-grid" style={{gap:48}}>
        {/* Form */}
        <div>{sent?<div ref={successRef} style={{background:"var(--accent-subtle)",border:"1px solid var(--accent)",borderRadius:"var(--radius-xl)",padding:48,textAlign:"center"}}>
          <div style={{fontSize:"3rem",marginBottom:16}}>✅</div>
          <h3 style={{fontSize:"1.3rem",fontWeight:700}}>Thank You!</h3>
          <p style={{color:"var(--gray-500)",marginTop:8}}>We'll review your application and reach out within 24 hours. Early access firms get priority onboarding and founding member pricing.</p>
          <Link to="/" className="btn btn--outline" style={{marginTop:20}}>Back to Home</Link>
        </div>
        :<form ref={formRef} onSubmit={handleSubmit} style={{background:"#fff",border:"1px solid var(--gray-100)",borderRadius:"var(--radius-xl)",padding:36,boxShadow:"0 8px 32px -8px rgba(0,0,0,0.06)"}}>
          <h2 style={{fontSize:"1.3rem",fontWeight:700,marginBottom:4}}>Apply for Early Access</h2>
          <p style={{fontSize:"0.85rem",color:"var(--gray-400)",marginBottom:24}}>Limited spots available for law firms across America. We review every application.</p>
          {error && <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:"0.85rem",color:"#dc2626"}}>{error}</div>}
          <div className="form-row-2col">
            <div className="form-group"><label className="form-label">First Name *</label><input name="firstName" placeholder="Jane" className="form-input" required/></div>
            <div className="form-group"><label className="form-label">Last Name *</label><input name="lastName" placeholder="Doe" className="form-input" required/></div>
          </div>
          <div className="form-group"><label className="form-label">Work Email *</label><input name="email" type="email" placeholder="jane@yourfirm.com" className="form-input" required/></div>
          <div className="form-group"><label className="form-label">Firm Name *</label><input name="firmName" placeholder="Your Firm Name" className="form-input" required/></div>
          <div className="form-group"><label className="form-label">Phone (optional)</label><input name="phone" type="tel" placeholder="(617) 000-0000" className="form-input"/></div>
          <div className="form-row-2col">
            <div className="form-group"><label className="form-label">Firm Size</label><select name="firmSize" className="form-input"><option>Solo practitioner</option><option>2-5 attorneys</option><option>6-10 attorneys</option><option>11-25 attorneys</option><option>26-50 attorneys</option><option>50+ attorneys</option></select></div>
            <div className="form-group"><label className="form-label">I'd Like To</label><select name="interest" className="form-input"><option>Apply for early access</option><option>Book a live demo</option><option>Get pricing info</option><option>Ask a question</option></select></div>
          </div>
          <div className="form-group"><label className="form-label">What's your biggest challenge? (optional)</label><textarea name="message" rows={3} placeholder="Tell us about your current setup — what tools do you use, what's frustrating, what would you change?" className="form-input form-input--textarea"/></div>
          <button type="submit" disabled={sending} className="btn btn--primary btn--lg" style={{width:"100%",justifyContent:"center",marginTop:8,opacity:sending?0.7:1}}>
            {sending ? "Sending..." : "Submit Application →"}
          </button>
          <p style={{fontSize:"0.72rem",color:"var(--gray-400)",textAlign:"center",marginTop:12}}>No credit card required. 14-day full-access trial. Cancel anytime.</p>
        </form>}</div>

        {/* Sidebar */}
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          {[{icon:"ri-mail-line",t:"Email Us",v:"hello@legience.com",s:"We respond within 4 business hours."},{icon:"ri-phone-line",t:"Schedule a Call",v:"Book a 15-min demo",s:"Pick a time that works for your firm."},{icon:"ri-timer-line",t:"Free Trial",v:"Early Access Program",s:"Priority onboarding. Founding pricing. Direct team access."},{icon:"ri-refresh-line",t:"Free Data Migration",v:"From Clio, MyCase, or spreadsheets",s:"Our team handles the import on Professional & Firm plans."}].map((c,i)=><div key={i} style={{display:"flex",gap:14,padding:20,background:"var(--gray-50)",borderRadius:14}}>
            <div style={{width:48,height:48,borderRadius:12,background:"var(--accent-subtle)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Icon name={c.icon} size={22} style={{color:"var(--accent)"}} /></div>
            <div><div style={{fontWeight:700,color:"var(--ink-800)",fontSize:"0.92rem"}}>{c.t}</div><div style={{color:"var(--accent)",fontWeight:600,fontSize:"0.88rem"}}>{c.v}</div><div style={{fontSize:"0.75rem",color:"var(--gray-400)",marginTop:2}}>{c.s}</div></div>
          </div>)}

          <div style={{background:"var(--ink-950)",borderRadius:14,padding:28,textAlign:"center",marginTop:8}}>
            <div style={{fontSize:"1.1rem",fontWeight:700,color:"#fff",marginBottom:8}}>Enterprise? (10+ attorneys)</div>
            <p style={{color:"rgba(255,255,255,0.6)",fontSize:"0.85rem",lineHeight:1.6}}>Custom integrations, dedicated account manager, SLA guarantees, SSO/SAML, and white-label portal.</p>
            <button className="btn btn--secondary" style={{marginTop:16,width:"100%",justifyContent:"center"}}>Contact Enterprise Sales</button>
          </div>

          <div style={{padding:20,background:"var(--gray-50)",borderRadius:14,textAlign:"center"}}>
            <div style={{fontSize:"0.82rem",fontWeight:600,color:"var(--ink-800)",display:"flex",alignItems:"center",justifyContent:"center",gap:12}}>
              <span style={{display:"inline-flex",alignItems:"center",gap:4}}><Shield size={14} /> AES-256</span>
              <span>·</span>
              <span style={{display:"inline-flex",alignItems:"center",gap:4}}><Lock size={14} /> 201 CMR 17.00</span>
              <span>·</span>
              <span style={{display:"inline-flex",alignItems:"center",gap:4}}><ClipboardList size={14} /> Zero AI Training</span>
            </div>
            <div style={{fontSize:"0.72rem",color:"var(--gray-400)",marginTop:4}}>Enterprise-grade security on every plan</div>
          </div>
        </div>
      </div>
    </div></section>
  </>
}
