import{useState,useMemo,useRef}from"react"
import{Link}from"react-router-dom"
import{Helmet}from"react-helmet-async"
import{motion,AnimatePresence}from"framer-motion"
import PageHero from"../../components/ui/PageHero"
import SectionHead from"../../components/ui/SectionHead"
import{Calendar,Clock,AlertTriangle,CheckCircle,Info,ArrowRight,Scale,BookOpen,Shield,Copy,Check,Search}from"lucide-react"

/* ── SOL DATA ── */
const SOL_DATA = {
  "Alabama":{pi:2,mm:2,pd:6,bc:6,pl:1,wd:2,fr:2,df:2,notes:{mm:"Must file within 6 months of discovery, max 4 years from act."}},
  "Alaska":{pi:2,mm:2,pd:6,bc:3,pl:2,wd:2,fr:2,df:2,notes:{}},
  "Arizona":{pi:2,mm:2,pd:2,bc:6,pl:2,wd:2,fr:3,df:1,notes:{}},
  "Arkansas":{pi:3,mm:2,pd:3,bc:5,pl:3,wd:3,fr:5,df:3,notes:{mm:"2-year statute with 3-year statute of repose."}},
  "California":{pi:2,mm:3,pd:3,bc:4,pl:2,wd:2,fr:3,df:1,notes:{mm:"3 years from discovery or 1 year from discovery of injury, whichever comes first.",pi:"1 year from discovery if injury not immediately apparent."}},
  "Colorado":{pi:2,mm:2,pd:2,bc:3,pl:2,wd:2,fr:3,df:1,notes:{mm:"2 years from discovery, 3-year statute of repose."}},
  "Connecticut":{pi:2,mm:2,pd:2,bc:6,pl:3,wd:2,fr:3,df:2,notes:{}},
  "Delaware":{pi:2,mm:2,pd:2,bc:3,pl:2,wd:2,fr:3,df:2,notes:{}},
  "District of Columbia":{pi:3,mm:3,pd:3,bc:3,pl:3,wd:2,fr:3,df:1,notes:{}},
  "Florida":{pi:2,mm:2,pd:4,bc:5,pl:4,wd:2,fr:4,df:2,notes:{pi:"Reduced from 4 to 2 years for incidents after March 24, 2023 (HB 837).",mm:"2-year statute with 4-year statute of repose."}},
  "Georgia":{pi:2,mm:2,pd:4,bc:6,pl:2,wd:2,fr:4,df:1,notes:{mm:"Subject to 5-year statute of repose."}},
  "Hawaii":{pi:2,mm:2,pd:2,bc:6,pl:2,wd:2,fr:6,df:2,notes:{}},
  "Idaho":{pi:2,mm:2,pd:3,bc:5,pl:2,wd:2,fr:3,df:2,notes:{}},
  "Illinois":{pi:2,mm:2,pd:5,bc:5,pl:2,wd:2,fr:5,df:1,notes:{mm:"2 years from discovery, max 4 years from act."}},
  "Indiana":{pi:2,mm:2,pd:2,bc:6,pl:2,wd:2,fr:6,df:2,notes:{mm:"Filed as proposed complaint with Indiana Dept. of Insurance within 2 years."}},
  "Iowa":{pi:2,mm:2,pd:5,bc:5,pl:2,wd:2,fr:5,df:2,notes:{mm:"2 years from discovery, 6-year statute of repose."}},
  "Kansas":{pi:2,mm:2,pd:2,bc:5,pl:2,wd:2,fr:2,df:1,notes:{mm:"2 years from act, 4-year statute of repose."}},
  "Kentucky":{pi:1,mm:1,pd:5,bc:5,pl:1,wd:1,fr:5,df:1,notes:{pi:"One of the shortest SOL periods at 1 year.",mm:"1 year from discovery, 5-year statute of repose."}},
  "Louisiana":{pi:1,mm:1,pd:1,bc:3,pl:1,wd:1,fr:1,df:1,notes:{pi:"Uses prescriptive period. 1 year from injury or discovery.",mm:"1 year from discovery, 3-year prescriptive period."}},
  "Maine":{pi:6,mm:3,pd:6,bc:6,pl:6,wd:2,fr:6,df:2,notes:{pi:"One of the longest SOL periods at 6 years."}},
  "Maryland":{pi:3,mm:5,pd:3,bc:3,pl:3,wd:3,fr:3,df:1,notes:{mm:"5 years from injury or 3 years from discovery, whichever is shorter."}},
  "Massachusetts":{pi:3,mm:3,pd:3,bc:6,pl:3,wd:3,fr:3,df:3,notes:{mm:"3 years from discovery. 7-year statute of repose."}},
  "Michigan":{pi:3,mm:2,pd:3,bc:6,pl:3,wd:3,fr:6,df:1,notes:{mm:"2 years from act or 6 months from discovery, whichever is later."}},
  "Minnesota":{pi:2,mm:4,pd:6,bc:6,pl:4,wd:3,fr:6,df:2,notes:{}},
  "Mississippi":{pi:3,mm:2,pd:3,bc:3,pl:3,wd:3,fr:3,df:1,notes:{}},
  "Missouri":{pi:5,mm:2,pd:5,bc:5,pl:5,wd:3,fr:5,df:2,notes:{}},
  "Montana":{pi:3,mm:3,pd:2,bc:5,pl:3,wd:3,fr:2,df:2,notes:{mm:"3 years from injury or discovery, 5-year statute of repose."}},
  "Nebraska":{pi:4,mm:2,pd:4,bc:5,pl:4,wd:2,fr:4,df:1,notes:{mm:"2 years from discovery. 10-year statute of repose."}},
  "Nevada":{pi:2,mm:3,pd:3,bc:6,pl:2,wd:2,fr:3,df:2,notes:{mm:"3 years from injury or 1 year from discovery, whichever is earlier."}},
  "New Hampshire":{pi:3,mm:2,pd:3,bc:3,pl:3,wd:3,fr:3,df:3,notes:{}},
  "New Jersey":{pi:2,mm:2,pd:6,bc:6,pl:2,wd:2,fr:6,df:1,notes:{mm:"Discovery rule applies."}},
  "New Mexico":{pi:3,mm:3,pd:4,bc:6,pl:3,wd:3,fr:4,df:3,notes:{}},
  "New York":{pi:3,mm:2.5,pd:3,bc:6,pl:3,wd:2,fr:6,df:1,notes:{mm:"2 years 6 months from act. Continuous treatment doctrine may extend."}},
  "North Carolina":{pi:3,mm:3,pd:3,bc:3,pl:6,wd:2,fr:3,df:1,notes:{mm:"3 years from last act, 4-year statute of repose."}},
  "North Dakota":{pi:6,mm:2,pd:6,bc:6,pl:6,wd:2,fr:6,df:2,notes:{}},
  "Ohio":{pi:2,mm:1,pd:2,bc:6,pl:2,wd:2,fr:4,df:1,notes:{mm:"1 year from discovery, 4-year statute of repose."}},
  "Oklahoma":{pi:2,mm:2,pd:2,bc:5,pl:2,wd:2,fr:2,df:1,notes:{}},
  "Oregon":{pi:2,mm:2,pd:6,bc:6,pl:2,wd:3,fr:2,df:1,notes:{mm:"2 years from discovery, 5-year statute of repose."}},
  "Pennsylvania":{pi:2,mm:2,pd:2,bc:4,pl:2,wd:2,fr:2,df:1,notes:{mm:"2 years from discovery. 7-year statute of repose."}},
  "Rhode Island":{pi:3,mm:3,pd:10,bc:10,pl:3,wd:3,fr:10,df:1,notes:{}},
  "South Carolina":{pi:3,mm:3,pd:3,bc:3,pl:3,wd:3,fr:3,df:2,notes:{mm:"3 years from treatment or discovery. 6-year statute of repose."}},
  "South Dakota":{pi:3,mm:2,pd:6,bc:6,pl:3,wd:3,fr:6,df:2,notes:{}},
  "Tennessee":{pi:1,mm:1,pd:3,bc:6,pl:1,wd:1,fr:3,df:1,notes:{pi:"One of the shortest SOL periods at 1 year.",mm:"1 year from discovery, 3-year statute of repose."}},
  "Texas":{pi:2,mm:2,pd:2,bc:4,pl:2,wd:2,fr:4,df:1,notes:{mm:"2 years from act. 10-year statute of repose."}},
  "Utah":{pi:4,mm:2,pd:3,bc:6,pl:2,wd:2,fr:3,df:1,notes:{mm:"2 years from discovery. 4-year statute of repose."}},
  "Vermont":{pi:3,mm:3,pd:3,bc:6,pl:3,wd:2,fr:6,df:3,notes:{mm:"3 years from act. 7-year statute of repose."}},
  "Virginia":{pi:2,mm:2,pd:5,bc:5,pl:2,wd:2,fr:2,df:1,notes:{mm:"2 years from act. 10-year statute of repose."}},
  "Washington":{pi:3,mm:3,pd:3,bc:6,pl:3,wd:3,fr:3,df:2,notes:{mm:"3 years from act or 1 year from discovery, whichever is later."}},
  "West Virginia":{pi:2,mm:2,pd:2,bc:10,pl:2,wd:2,fr:2,df:1,notes:{mm:"2 years from injury or discovery. 10-year statute of repose."}},
  "Wisconsin":{pi:3,mm:3,pd:6,bc:6,pl:3,wd:3,fr:6,df:2,notes:{mm:"3 years from injury. 5-year statute of repose."}},
  "Wyoming":{pi:4,mm:2,pd:4,bc:8,pl:4,wd:2,fr:4,df:1,notes:{mm:"2 years from act or discovery. 2-year statute of repose."}},
}

const STATES = Object.keys(SOL_DATA).sort()
const CLAIM_TYPES = [
  {key:"pi",label:"Personal Injury"},
  {key:"mm",label:"Medical Malpractice"},
  {key:"pd",label:"Property Damage"},
  {key:"bc",label:"Breach of Contract"},
  {key:"pl",label:"Product Liability"},
  {key:"wd",label:"Wrongful Death"},
  {key:"fr",label:"Fraud"},
  {key:"df",label:"Defamation"},
]

const faqs = [
  {q:"What happens if I miss the statute of limitations?",a:"The court will dismiss your case. For attorneys, missing an SOL deadline is one of the most common grounds for malpractice claims."},
  {q:"Does the SOL start from the date of injury or discovery?",a:"It depends on the state. Most use the injury date, but many apply the \"discovery rule\" — the clock starts when you knew or should have known about the injury."},
  {q:"Can the statute of limitations be extended?",a:"Yes — through tolling. Common reasons: plaintiff was a minor, mental incapacity, defendant left the state, or defendant concealed the wrongdoing."},
  {q:"What is the discovery rule?",a:"A doctrine that delays the SOL start until the plaintiff discovers the injury and its cause. Common in medical malpractice and fraud."},
  {q:"Do statutes of limitations apply to minors?",a:"Most states pause the clock for minors until they turn 18. Some cap the total tolling period. Rules vary by state."},
]

function fmtYr(y){return y===2.5?"2 yr 6 mo":y===1?"1 year":y+" years"}
function fmtYrShort(y){return y===2.5?"2.5yr":y+"yr"}
function solColor(y){return y<=1?"#f06548":y<=2?"#f7b84b":y<=3?"#38b6ff":y<=4?"#0ab39c":"#059669"}

function getDistribution(key){
  const b={}
  STATES.forEach(s=>{const y=SOL_DATA[s][key];b[y]=(b[y]||0)+1})
  return Object.entries(b).sort((a,c)=>Number(a[0])-Number(c[0])).map(([y,c])=>({years:Number(y),count:c}))
}

export default function SOLCalculator(){
  const[state,setState]=useState("")
  const[claimType,setClaimType]=useState("pi")
  const[incidentDate,setIncidentDate]=useState("")
  const[openFaq,setOpenFaq]=useState(null)
  const[copied,setCopied]=useState(false)
  const[chartClaim,setChartClaim]=useState("pi")
  const[stateSearch,setStateSearch]=useState("")
  const dateRef=useRef(null)
  const resultRef=useRef(null)

  const result=useMemo(()=>{
    if(!state||!claimType||!incidentDate) return null
    const d=SOL_DATA[state]; if(!d) return null
    const years=d[claimType]; if(!years) return null
    const incident=new Date(incidentDate+"T00:00:00")
    if(isNaN(incident.getTime())) return null
    const deadline=new Date(incident)
    deadline.setFullYear(deadline.getFullYear()+Math.floor(years))
    if(years%1!==0) deadline.setMonth(deadline.getMonth()+Math.round((years%1)*12))
    const now=new Date();now.setHours(0,0,0,0)
    const totalMs=deadline.getTime()-incident.getTime()
    const elapsedMs=now.getTime()-incident.getTime()
    const remainingMs=deadline.getTime()-now.getTime()
    const daysRemaining=Math.ceil(remainingMs/(1000*60*60*24))
    const progress=Math.min(Math.max(elapsedMs/totalMs,0),1)
    const expired=daysRemaining<=0
    const claimLabel=CLAIM_TYPES.find(c=>c.key===claimType)?.label||""
    const note=d.notes?.[claimType]||null
    let status="safe"
    if(expired) status="expired"
    else if(daysRemaining<=30) status="critical"
    else if(daysRemaining<=180) status="warning"
    const otherClaims=CLAIM_TYPES.filter(c=>c.key!==claimType).map(c=>({key:c.key,label:c.label,years:d[c.key]}))
    return{years,deadline,daysRemaining,progress,expired,status,claimLabel,note,state,otherClaims}
  },[state,claimType,incidentDate])

  const prevResult=useRef(null)
  if(result&&!prevResult.current){setTimeout(()=>resultRef.current?.scrollIntoView({behavior:"smooth",block:"center"}),100)}
  prevResult.current=result

  const handleCopy=()=>{
    if(!result) return
    navigator.clipboard.writeText(`SOL — ${result.state}\nClaim: ${result.claimLabel}\nPeriod: ${fmtYr(result.years)}\nDeadline: ${result.deadline.toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}\nDays Remaining: ${result.expired?"EXPIRED":result.daysRemaining}\n\nlegience.com/tools/sol-calculator`).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000)})
  }

  const distribution=useMemo(()=>getDistribution(chartClaim),[chartClaim])
  const maxCount=Math.max(...distribution.map(d=>d.count))
  const filteredStates=stateSearch?STATES.filter(s=>s.toLowerCase().includes(stateSearch.toLowerCase())):STATES

  const faqSchema={"@context":"https://schema.org","@type":"FAQPage",mainEntity:faqs.map(f=>({"@type":"Question",name:f.q,acceptedAnswer:{"@type":"Answer",text:f.a}}))}

  const sc={
    safe:{bg:"rgba(10,179,156,0.06)",border:"rgba(10,179,156,0.2)",text:"#0ab39c",bar:"#0ab39c",label:"Within Period",Icon:CheckCircle},
    warning:{bg:"rgba(247,184,75,0.06)",border:"rgba(247,184,75,0.2)",text:"#d97706",bar:"#f7b84b",label:"Approaching",Icon:Clock},
    critical:{bg:"rgba(240,101,72,0.06)",border:"rgba(240,101,72,0.2)",text:"#f06548",bar:"#f06548",label:"Urgent",Icon:AlertTriangle},
    expired:{bg:"rgba(153,27,27,0.06)",border:"rgba(153,27,27,0.2)",text:"#991b1b",bar:"#991b1b",label:"Expired",Icon:AlertTriangle},
  }

  // Quick preview when state + claim selected but no date
  const preview = state && claimType && !incidentDate ? SOL_DATA[state]?.[claimType] : null

  return<>
    <Helmet>
      <title>Statute of Limitations Calculator — All 50 States | Legience</title>
      <meta name="description" content="Free statute of limitations calculator for all 50 states. Look up SOL deadlines for personal injury, medical malpractice, breach of contract, property damage, and more."/>
      <meta name="keywords" content="statute of limitations calculator, SOL calculator, statute of limitations by state, personal injury statute of limitations"/>
      <link rel="canonical" href="https://legience.com/tools/sol-calculator"/>
      <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
    </Helmet>

    <PageHero badge="Free Tool" title="Statute of Limitations" gradient="Calculator." subtitle="Instantly calculate filing deadlines for any claim type across all 50 states and DC."/>

    {/* ═══ CALCULATOR ═══ */}
    <section className="section"><div className="container">
      <div style={{maxWidth:860,margin:"0 auto"}}>

        {/* Input card */}
        <div style={{background:"#fff",border:"1px solid var(--gray-100)",borderRadius:"var(--radius-xl)",padding:"28px 32px",boxShadow:"0 8px 32px -8px rgba(0,0,0,0.06)"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:24}}>
            <div style={{width:40,height:40,borderRadius:10,background:"var(--accent-subtle)",display:"flex",alignItems:"center",justifyContent:"center"}}><Scale size={20} style={{color:"var(--accent)"}}/></div>
            <div>
              <h2 style={{fontSize:"1.1rem",fontWeight:700,color:"var(--ink-800)"}}>Calculate Your Deadline</h2>
              <p style={{fontSize:"0.78rem",color:"var(--gray-400)"}}>Results appear instantly as you fill in each field</p>
            </div>
          </div>

          {/* 3-column input row */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14}}>
            <div className="form-group" style={{margin:0}}>
              <label className="form-label">State</label>
              <select value={state} onChange={e=>setState(e.target.value)} className="form-input">
                <option value="">Select state...</option>
                {STATES.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group" style={{margin:0}}>
              <label className="form-label">Claim Type</label>
              <select value={claimType} onChange={e=>setClaimType(e.target.value)} className="form-input">
                {CLAIM_TYPES.map(c=><option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            <div className="form-group" style={{margin:0}}>
              <label className="form-label">Date of Incident</label>
              <input ref={dateRef} type="date" value={incidentDate} onChange={e=>setIncidentDate(e.target.value)} onClick={()=>dateRef.current?.showPicker?.()} className="form-input" max={new Date().toISOString().split("T")[0]} style={{cursor:"pointer"}}/>
            </div>
          </div>

          {/* Quick preview */}
          {preview && (
            <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} style={{marginTop:16,padding:"14px 18px",background:"var(--gray-50)",borderRadius:"var(--radius-md)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div>
                <span style={{fontSize:"0.78rem",color:"var(--gray-400)"}}>SOL period in {state} for {CLAIM_TYPES.find(c=>c.key===claimType)?.label}:</span>
                <span style={{fontSize:"1.1rem",fontWeight:800,color:"var(--accent)",marginLeft:10}}>{fmtYr(preview)}</span>
              </div>
              <span style={{fontSize:"0.72rem",color:"var(--gray-400)"}}>Enter incident date to calculate deadline</span>
            </motion.div>
          )}
        </div>

        {/* ═══ RESULT ═══ */}
        <AnimatePresence>
          {result&&(
            <motion.div
              ref={resultRef}
              initial={{opacity:0,y:20,scale:0.98}}
              animate={{opacity:1,y:0,scale:1}}
              exit={{opacity:0,y:-10}}
              transition={{duration:0.35,ease:[0.16,1,0.3,1]}}
              style={{marginTop:20,background:sc[result.status].bg,border:`1.5px solid ${sc[result.status].border}`,borderRadius:"var(--radius-xl)",padding:"28px 32px",overflow:"hidden"}}
            >
              {/* Status + copy */}
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:8}}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <span style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:"0.7rem",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",padding:"5px 14px",borderRadius:100,color:result.expired?"#fff":sc[result.status].text,background:result.expired?"#991b1b":"transparent",border:`1px solid ${sc[result.status].border}`}}>
                    {(()=>{const I=sc[result.status].Icon;return<I size={13}/>})()}{sc[result.status].label}
                  </span>
                  <span style={{fontSize:"0.82rem",color:"var(--gray-500)",fontWeight:500}}>{result.state} — {result.claimLabel}</span>
                </div>
                <button onClick={handleCopy} style={{display:"inline-flex",alignItems:"center",gap:4,padding:"5px 12px",fontSize:"0.72rem",fontWeight:600,background:"#fff",border:"1px solid var(--gray-200)",borderRadius:6,cursor:"pointer",color:"var(--gray-500)"}}>
                  {copied?<><Check size={12}/> Copied</>:<><Copy size={12}/> Copy</>}
                </button>
              </div>

              {/* Main stats row */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14,marginBottom:20}}>
                <div style={{background:"#fff",borderRadius:12,padding:"18px 20px",border:"1px solid var(--gray-100)",textAlign:"center"}}>
                  <div style={{fontSize:"0.65rem",fontWeight:600,color:"var(--gray-400)",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6}}>SOL Period</div>
                  <div style={{fontSize:"1.5rem",fontWeight:800,color:"var(--ink-800)"}}>{fmtYr(result.years)}</div>
                </div>
                <div style={{background:"#fff",borderRadius:12,padding:"18px 20px",border:"1px solid var(--gray-100)",textAlign:"center"}}>
                  <div style={{fontSize:"0.65rem",fontWeight:600,color:"var(--gray-400)",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6,display:"flex",alignItems:"center",justifyContent:"center",gap:3}}><Calendar size={10}/>Filing Deadline</div>
                  <div style={{fontSize:"1.5rem",fontWeight:800,color:"var(--ink-800)"}}>{result.deadline.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</div>
                </div>
                <div style={{background:"#fff",borderRadius:12,padding:"18px 20px",border:"1px solid var(--gray-100)",textAlign:"center"}}>
                  <div style={{fontSize:"0.65rem",fontWeight:600,color:"var(--gray-400)",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6,display:"flex",alignItems:"center",justifyContent:"center",gap:3}}><Clock size={10}/>Remaining</div>
                  <div style={{fontSize:"1.5rem",fontWeight:800,color:sc[result.status].text}}>{result.expired?"EXPIRED":`${result.daysRemaining.toLocaleString()} days`}</div>
                </div>
              </div>

              {/* Timeline progress */}
              <div style={{marginBottom:16}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:"0.68rem",color:"var(--gray-400)",marginBottom:5}}>
                  <span>{incidentDate}</span>
                  <span style={{fontWeight:600,color:sc[result.status].text}}>{Math.round(result.progress*100)}% elapsed</span>
                  <span>{result.deadline.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</span>
                </div>
                <div style={{height:8,background:"rgba(0,0,0,0.05)",borderRadius:99,overflow:"hidden",position:"relative"}}>
                  <motion.div initial={{width:0}} animate={{width:`${Math.min(result.progress*100,100)}%`}} transition={{duration:0.8,ease:[0.16,1,0.3,1]}} style={{height:"100%",background:sc[result.status].bar,borderRadius:99}}/>
                  {/* Today marker */}
                  {!result.expired && <div style={{position:"absolute",top:-2,left:`${Math.min(result.progress*100,100)}%`,width:12,height:12,borderRadius:"50%",background:sc[result.status].bar,border:"2px solid #fff",boxShadow:"0 1px 4px rgba(0,0,0,0.15)",transform:"translateX(-50%)"}}/>}
                </div>
              </div>

              {/* Note */}
              {result.note&&(
                <div style={{display:"flex",gap:10,padding:"12px 16px",background:"rgba(255,255,255,0.7)",borderRadius:10,border:"1px solid var(--gray-100)",marginBottom:14}}>
                  <Info size={15} style={{color:"var(--accent)",flexShrink:0,marginTop:1}}/>
                  <div style={{fontSize:"0.82rem",color:"var(--gray-500)",lineHeight:1.6}}><strong style={{color:"var(--ink-800)"}}>{result.state}:</strong> {result.note}</div>
                </div>
              )}

              {/* Other claims */}
              <div style={{borderTop:"1px solid rgba(0,0,0,0.06)",paddingTop:14}}>
                <div style={{fontSize:"0.72rem",fontWeight:600,color:"var(--gray-400)",marginBottom:8}}>Other claim types in {result.state}:</div>
                <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                  {result.otherClaims.map((c,i)=>(
                    <button key={i} onClick={()=>setClaimType(c.key)} style={{padding:"4px 10px",fontSize:"0.72rem",fontWeight:600,background:"#fff",border:"1px solid var(--gray-200)",borderRadius:6,cursor:"pointer",color:"var(--gray-500)",transition:"all 0.15s"}}>
                      {c.label}: <span style={{color:"var(--ink-800)"}}>{fmtYrShort(c.years)}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{fontSize:"0.65rem",color:"var(--gray-400)",lineHeight:1.4,borderTop:"1px solid rgba(0,0,0,0.06)",paddingTop:10,marginTop:14}}>
                <strong>Disclaimer:</strong> Informational only, not legal advice. Tolling, discovery rules, and exceptions may apply. Consult a licensed attorney.
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div></section>

    {/* ═══ DISTRIBUTION CHART (with its own claim selector) ═══ */}
    <section className="section section--muted"><div className="container">
      <SectionHead badge="Data" title="SOL Distribution Across States"/>
      <div style={{maxWidth:760,margin:"0 auto"}}>

        {/* Claim type pills for chart */}
        <div style={{display:"flex",justifyContent:"center",flexWrap:"wrap",gap:5,marginBottom:32}}>
          {CLAIM_TYPES.map(c=>(
            <button key={c.key} onClick={()=>setChartClaim(c.key)} style={{
              padding:"7px 14px",fontSize:"0.78rem",fontWeight:chartClaim===c.key?700:500,
              background:chartClaim===c.key?"var(--ink-800)":"#fff",
              color:chartClaim===c.key?"#fff":"var(--gray-500)",
              border:chartClaim===c.key?"1px solid var(--ink-800)":"1px solid var(--gray-200)",
              borderRadius:8,cursor:"pointer",transition:"all 0.2s"
            }}>{c.label}</button>
          ))}
        </div>

        {/* Chart */}
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {distribution.map((d,i)=>{
            const pct=(d.count/maxCount)*100
            const color=solColor(d.years)
            return(
              <motion.div key={d.years} initial={{opacity:0,x:-16}} animate={{opacity:1,x:0}} transition={{duration:0.3,delay:i*0.04}} style={{display:"grid",gridTemplateColumns:"80px 1fr 50px",alignItems:"center",gap:12}}>
                <div style={{fontSize:"0.85rem",fontWeight:700,color:"var(--ink-800)",textAlign:"right"}}>{fmtYr(d.years)}</div>
                <div style={{height:36,background:"rgba(0,0,0,0.03)",borderRadius:8,overflow:"hidden",position:"relative"}}>
                  <motion.div
                    initial={{width:0}}
                    animate={{width:`${pct}%`}}
                    transition={{duration:0.6,delay:i*0.06,ease:[0.16,1,0.3,1]}}
                    style={{height:"100%",borderRadius:8,background:`linear-gradient(90deg, ${color}, ${color}dd)`,display:"flex",alignItems:"center",paddingLeft:12,minWidth:2}}
                  />
                </div>
                <div style={{fontSize:"0.82rem",fontWeight:600,color:"var(--gray-500)"}}>{d.count} {d.count===1?"state":"states"}</div>
              </motion.div>
            )
          })}
        </div>

        {/* Stats summary */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginTop:28}}>
          {[
            {label:"Shortest",value:fmtYr(Math.min(...STATES.map(s=>SOL_DATA[s][chartClaim]))),sub:STATES.filter(s=>SOL_DATA[s][chartClaim]===Math.min(...STATES.map(s2=>SOL_DATA[s2][chartClaim]))).slice(0,3).join(", "),color:"#f06548"},
            {label:"Most Common",value:fmtYr(distribution.reduce((a,b)=>b.count>a.count?b:a).years),sub:`${distribution.reduce((a,b)=>b.count>a.count?b:a).count} states`,color:"var(--accent)"},
            {label:"Longest",value:fmtYr(Math.max(...STATES.map(s=>SOL_DATA[s][chartClaim]))),sub:STATES.filter(s=>SOL_DATA[s][chartClaim]===Math.max(...STATES.map(s2=>SOL_DATA[s2][chartClaim]))).slice(0,3).join(", "),color:"#059669"},
          ].map((s,i)=>(
            <div key={i} style={{background:"#fff",border:"1px solid var(--gray-100)",borderRadius:12,padding:"18px 20px",textAlign:"center"}}>
              <div style={{fontSize:"0.68rem",fontWeight:600,color:"var(--gray-400)",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6}}>{s.label}</div>
              <div style={{fontSize:"1.3rem",fontWeight:800,color:s.color}}>{s.value}</div>
              <div style={{fontSize:"0.72rem",color:"var(--gray-400)",marginTop:4}}>{s.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div></section>

    {/* ═══ STATE REFERENCE GRID ═══ */}
    <section className="section"><div className="container">
      <SectionHead badge="Reference" title="All States at a Glance" subtitle="Click any state to load it in the calculator above."/>
      <div style={{maxWidth:900,margin:"0 auto"}}>
        <div style={{position:"relative",maxWidth:360,margin:"0 auto 20px"}}>
          <Search size={14} style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:"var(--gray-300)"}}/>
          <input type="text" placeholder="Search states..." value={stateSearch} onChange={e=>setStateSearch(e.target.value)} className="form-input" style={{paddingLeft:34,fontSize:"0.82rem"}}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(155px, 1fr))",gap:6}}>
          {filteredStates.map(s=>{
            const yrs=SOL_DATA[s][claimType||"pi"]
            const sel=s===state
            return(
              <button key={s} onClick={()=>{setState(s);window.scrollTo({top:0,behavior:"smooth"})}} style={{
                display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 14px",borderRadius:8,cursor:"pointer",transition:"all 0.15s",textAlign:"left",
                background:sel?"var(--accent)":"#fff",border:sel?"1px solid var(--accent)":"1px solid var(--gray-100)",color:sel?"#fff":"var(--ink-800)"
              }}>
                <span style={{fontSize:"0.78rem",fontWeight:sel?700:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s}</span>
                <span style={{fontSize:"0.72rem",fontWeight:700,padding:"2px 7px",borderRadius:4,flexShrink:0,background:sel?"rgba(255,255,255,0.2)":`${solColor(yrs)}15`,color:sel?"#fff":solColor(yrs)}}>{yrs}yr</span>
              </button>
            )
          })}
        </div>
      </div>
    </div></section>

    {/* ═══ EDUCATIONAL ═══ */}
    <section className="section section--muted"><div className="container">
      <SectionHead badge="Understanding SOL" title="What Is a Statute of Limitations?"/>
      <div style={{maxWidth:800,margin:"0 auto",display:"grid",gap:36}}>
        <div>
          <h3 style={{fontSize:"1.05rem",fontWeight:700,color:"var(--ink-800)",marginBottom:10,display:"flex",alignItems:"center",gap:8}}><BookOpen size={17} style={{color:"var(--accent)"}}/> The Basics</h3>
          <p style={{fontSize:"0.9rem",color:"var(--gray-500)",lineHeight:1.8,marginBottom:10}}>A statute of limitations sets the maximum time after an event within which legal proceedings may be initiated. Once expired, the claim is permanently barred regardless of merit. Every state sets its own periods, varying by claim type — personal injury typically allows 1 to 6 years, while breach of contract often allows 3 to 10 years.</p>
          <p style={{fontSize:"0.9rem",color:"var(--gray-500)",lineHeight:1.8}}>The clock generally starts on the date of injury, though many states apply a "discovery rule" that delays the start until the plaintiff knew or should have known about the injury.</p>
        </div>
        <div>
          <h3 style={{fontSize:"1.05rem",fontWeight:700,color:"var(--ink-800)",marginBottom:10,display:"flex",alignItems:"center",gap:8}}><Scale size={17} style={{color:"var(--accent)"}}/> Common Exceptions</h3>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
            {[
              {t:"Discovery Rule",d:"Clock starts when plaintiff discovers the injury. Common in med mal."},
              {t:"Minors",d:"Most states pause until the plaintiff turns 18."},
              {t:"Defendant Absence",d:"Tolled while defendant is outside the state."},
              {t:"Mental Incapacity",d:"Paused while plaintiff is incapacitated."},
              {t:"Fraudulent Concealment",d:"Tolled when defendant hides wrongdoing."},
              {t:"Government Claims",d:"Often shorter deadlines and require notice of claim."},
            ].map((item,i)=>(
              <div key={i} style={{padding:"14px 16px",background:"#fff",borderRadius:10,border:"1px solid var(--gray-100)"}}>
                <div style={{fontWeight:700,fontSize:"0.82rem",color:"var(--ink-800)",marginBottom:3}}>{item.t}</div>
                <p style={{fontSize:"0.78rem",color:"var(--gray-500)",lineHeight:1.6,margin:0}}>{item.d}</p>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 style={{fontSize:"1.05rem",fontWeight:700,color:"var(--ink-800)",marginBottom:10,display:"flex",alignItems:"center",gap:8}}><AlertTriangle size={17} style={{color:"#f06548"}}/> Why This Matters</h3>
          <p style={{fontSize:"0.9rem",color:"var(--gray-500)",lineHeight:1.8}}>Missing an SOL deadline is one of the most common causes of legal malpractice claims. The ABA ranks "failure to know or apply the statute of limitations" among the top reasons for malpractice suits. Systematic deadline tracking through <Link to="/features" style={{color:"var(--accent)",fontWeight:600}}>practice management software</Link> is a professional responsibility.</p>
        </div>
      </div>
    </div></section>

    {/* ═══ FAQ ═══ */}
    <section className="section"><div className="container">
      <SectionHead badge="FAQ" title="Common Questions"/>
      <div style={{maxWidth:720,margin:"0 auto"}}>
        {faqs.map((f,i)=><div key={i} className={`faq-item ${openFaq===i?"open":""}`}>
          <button className="faq-q" onClick={()=>setOpenFaq(openFaq===i?null:i)}>
            <span>{f.q}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:18,height:18,transition:"0.3s",transform:openFaq===i?"rotate(180deg)":"none",flexShrink:0}}><path d="M6 9l6 6 6-6"/></svg>
          </button>
          <div className="faq-a"><div className="faq-a__inner">{f.a}</div></div>
        </div>)}
      </div>
    </div></section>

    {/* ═══ CTA ═══ */}
    <section className="section section--dark"><div className="container" style={{textAlign:"center"}}>
      <div style={{maxWidth:600,margin:"0 auto"}}>
        <SectionHead light badge="Never Miss a Deadline" title="Automated SOL Tracking Built Into Your Practice" subtitle="Legience automatically tracks statute of limitations deadlines for every case. Calendar alerts, dashboard warnings, and team notifications."/>
        <div style={{display:"flex",gap:14,justifyContent:"center",flexWrap:"wrap",marginTop:8}}>
          <Link to="/contact" className="btn btn--primary btn--lg">Start Free Trial <ArrowRight size={16}/></Link>
          <Link to="/features" className="btn btn--secondary btn--lg">See All Features</Link>
        </div>
      </div>
    </div></section>
  </>
}
