import { Link } from "react-router-dom"
import { blueLogo } from "../../assets/logos"
import { Shield, Lock, ClipboardList } from "lucide-react"

export default function Footer() {
  return <>
    {/* Footer */}
    <footer className="footer"><div className="container--wide">
      <div className="footer__grid">
        <div>
          <div className="nav__logo" style={{ height: 24 }} dangerouslySetInnerHTML={{ __html: blueLogo }} />
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.82rem", lineHeight: 1.7, marginTop: 12 }}>
            All-in-one legal practice management software with AI-powered research, drafting, and case analytics.
          </p>
          <div style={{ display: "flex", gap: 12, marginTop: 16, fontSize: "0.72rem", color: "rgba(255,255,255,0.5)", alignItems: "center" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Shield size={11} /> AES-256</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Lock size={11} /> Zero AI Training</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><ClipboardList size={11} /> 201 CMR 17.00</span>
          </div>
        </div>
        <div>
          <div className="footer__title">Platform</div>
          {[["All Features", "/features"], ["AI Research & Drafting", "/ai-platform"], ["PI Workspace", "/pi-workspace"], ["Practice Areas", "/practice-areas"], ["Pricing", "/pricing"]].map(([l, t], i) => <Link key={i} to={t} className="footer__link">{l}</Link>)}
        </div>
        <div className="footer__compare">
          <div className="footer__title">Compare</div>
          {[["vs Clio", "/compare/legience-vs-clio"], ["vs MyCase", "/compare/legience-vs-mycase"], ["vs PracticePanther", "/compare/legience-vs-practicepanther"], ["vs Filevine", "/compare/legience-vs-filevine"], ["vs CloudLex", "/compare/legience-vs-cloudlex"], ["vs EvenUp", "/compare/legience-vs-evenup"]].map(([l, t], i) => <Link key={i} to={t} className="footer__link">{l}</Link>)}
        </div>
        <div>
          <div className="footer__title">Free Tools</div>
          {[["SOL Calculator", "/tools/sol-calculator"], ["PI Settlement Calculator", "/tools/pi-settlement-calculator"], ["Court Filing Fees", "/tools/court-filing-fees"]].map(([l, t], i) => <Link key={i} to={t} className="footer__link">{l}</Link>)}
        </div>
        <div>
          <div className="footer__title">Resources</div>
          {[["Blog", "/blog"], ["Security", "/security"], ["About", "/about"], ["Contact", "/contact"]].map(([l, t]) => <Link key={t} to={t} className="footer__link">{l}</Link>)}
        </div>
        <div>
          <div className="footer__title">Legal</div>
          <Link to="/privacy" className="footer__link">Privacy Policy</Link>
          <Link to="/terms" className="footer__link">Terms of Service</Link>
          <Link to="/cookie-policy" className="footer__link">Cookie Policy</Link>
          <Link to="/aba-ethics" className="footer__link">ABA Ethics Compliance</Link>
        </div>
      </div>
      <div className="footer__bottom">
        <span>© 2026 Legience by Bostoneo Solutions LLC. All rights reserved.</span>
        <span>Built for modern law firms.</span>
      </div>
    </div></footer>
  </>
}
