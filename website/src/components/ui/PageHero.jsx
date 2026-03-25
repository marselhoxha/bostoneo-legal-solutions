import{Link}from"react-router-dom"
export default function PageHero({badge,title,gradient,subtitle}){
  return<section className="hero" style={{minHeight:"auto",padding:"140px 0 64px"}}>
    <div className="bg-grid"/><div className="bg-noise"/>
    <div style={{position:"absolute",top:"20%",right:"-8%",width:"400px",height:"400px",borderRadius:"50%",background:"radial-gradient(circle,rgba(56,182,255,0.08),transparent 70%)",filter:"blur(60px)"}}/>
    <div className="container" style={{position:"relative",zIndex:1,textAlign:"center"}}>
      {badge&&<span className="label" style={{marginBottom:"16px"}}>{badge}</span>}
      <h1 className="h1" style={{color:"white",marginTop:"12px"}}>{title}{gradient&&<><br/><span className="text-gradient">{gradient}</span></>}</h1>
      {subtitle&&<p className="sub sub--light" style={{marginTop:"16px",maxWidth:"600px",marginLeft:"auto",marginRight:"auto"}}>{subtitle}</p>}
    </div>
  </section>
}
