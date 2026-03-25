export default function SectionHead({badge,title,subtitle,light}){
  return<div style={{textAlign:"center",marginBottom:"48px"}}>
    {badge&&<span className="label" style={light?{color:"var(--accent-light)",background:"rgba(56,182,255,0.08)"}:{}}>{badge}</span>}
    <h2 className="h2" style={{marginTop:"12px",...(light?{color:"white"}:{})}}>{title}</h2>
    {subtitle&&<p className="sub" style={{marginTop:"12px",maxWidth:"560px",marginLeft:"auto",marginRight:"auto",...(light?{color:"rgba(255,255,255,0.65)"}:{})}}>{subtitle}</p>}
  </div>
}
