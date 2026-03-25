export default function Testimonials(){
  const t=[
    {q:"We replaced Clio, DocuSign, and Westlaw — saving $640/month. AI research turns 3-hour tasks into 20 minutes. Settlement velocity up 31%.",n:"Solo PI Attorney",r:"Boston, MA · 47 cases/year",i:"PI",c:"var(--accent)"},
    {q:"My paralegals see tasks, CFO sees billing, I see revenue — one platform. Onboarded in 2 days. Visibility alone paid for the switch.",n:"Managing Partner",r:"8-attorney firm · Worcester, MA",i:"MP",c:"var(--success)"},
    {q:"LegiDraft™ does in 20 min what took 6+ hours. $0/case vs $500 from EvenUp. Saving $4,000+/month handling 40% more cases.",n:"PI Attorney",r:"Dallas, TX · 120+ cases/year",i:"PA",c:"#7c3aed"},
  ]
  return<div className="test-grid">{t.map((x,i)=><div key={i} className="test-card reveal" style={{transitionDelay:`${i*.08}s`}}>
    <div className="test-stars">★★★★★</div>
    <div className="test-quote">"{x.q}"</div>
    <div className="test-author"><div className="test-avatar" style={{background:x.c}}>{x.i}</div><div><div className="test-name">{x.n}</div><div className="test-role">{x.r}</div></div></div>
  </div>)}</div>
}
