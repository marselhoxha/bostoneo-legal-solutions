import { useState, useEffect, useCallback } from "react"
import { Link } from "react-router-dom"

const GTM_ID = "GTM-T77B2FD4"
const CONSENT_KEY = "legience_cookie_consent"

function loadGTM() {
  if (document.querySelector(`script[src*="gtm.js?id=${GTM_ID}"]`)) return
  const s = document.createElement("script")
  s.async = true
  s.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}&l=dataLayer`
  document.head.appendChild(s)
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push({ "gtm.start": new Date().getTime(), event: "gtm.js" })
}

function grantConsent() {
  window.dataLayer = window.dataLayer || []
  function gtag() { window.dataLayer.push(arguments) }
  gtag("consent", "update", {
    ad_storage: "granted", ad_user_data: "granted",
    ad_personalization: "granted", analytics_storage: "granted",
  })
  loadGTM()
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(true)
  const [showCustomize, setShowCustomize] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CONSENT_KEY)
      if (stored === "accepted") {
        grantConsent()
        setVisible(false)
      }
    } catch (e) {}
  }, [])

  const handleAccept = useCallback(() => {
    try { localStorage.setItem(CONSENT_KEY, "accepted") } catch (e) {}
    grantConsent()
    setVisible(false)
  }, [])

  const handleEssentialOnly = useCallback(() => {
    try { localStorage.setItem(CONSENT_KEY, "essential") } catch (e) {}
    setVisible(false)
  }, [])

  if (!visible) return null

  return (
    <div className="cookie-banner">
      <style>{`
        .cookie-banner{position:fixed;bottom:0;left:0;right:0;z-index:99999;background:rgba(12,14,26,0.97);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-top:1px solid rgba(255,255,255,0.06);padding:16px 24px}
        .cookie-inner{max-width:1200px;margin:0 auto;display:flex;align-items:center;gap:20px}
        .cookie-text{flex:1;font-size:0.82rem;color:rgba(255,255,255,0.55);line-height:1.6;margin:0}
        .cookie-text a{color:rgba(56,182,255,0.8);text-decoration:underline;text-underline-offset:2px}
        .cookie-actions{display:flex;align-items:center;gap:14px;flex-shrink:0}
        .cookie-link{background:none;border:none;font-size:0.85rem;font-weight:500;color:rgba(56,182,255,0.8);cursor:pointer;font-family:inherit;text-decoration:underline;text-underline-offset:3px;padding:0}
        .cookie-accept{padding:10px 26px;font-size:0.85rem;font-weight:600;background:linear-gradient(135deg,#1e56b6,#004aad);border:none;border-radius:8px;color:#fff;cursor:pointer;font-family:inherit;white-space:nowrap;box-shadow:0 4px 12px rgba(30,86,182,0.3)}
        .cookie-close{background:none;border:none;font-size:1.3rem;color:rgba(255,255,255,0.3);cursor:pointer;padding:4px;line-height:1;font-family:inherit}
        .cookie-close:hover{color:rgba(255,255,255,0.6)}
        .cookie-customize{border-top:1px solid rgba(255,255,255,0.06);padding:16px 24px;margin-top:12px}
        .cookie-cats{display:flex;gap:12px;margin-bottom:14px}
        .cookie-cat{flex:1;padding:12px 14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:8px}
        .cookie-cat-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}
        .cookie-cat-name{font-size:0.82rem;font-weight:600;color:rgba(255,255,255,0.85)}
        .cookie-cat-badge{font-size:0.68rem;font-weight:500;padding:2px 7px;border-radius:4px}
        .cookie-cat-desc{font-size:0.75rem;color:rgba(255,255,255,0.4);line-height:1.5;margin:0}
        .cookie-cat-btns{display:flex;gap:8px;justify-content:flex-end}
        .cookie-btn-ess{padding:8px 18px;font-size:0.82rem;font-weight:600;background:none;border:1px solid rgba(255,255,255,0.12);border-radius:6px;color:rgba(255,255,255,0.6);cursor:pointer;font-family:inherit}
        .cookie-btn-all{padding:8px 22px;font-size:0.82rem;font-weight:600;background:linear-gradient(135deg,#1e56b6,#004aad);border:none;border-radius:6px;color:#fff;cursor:pointer;font-family:inherit}
        @media(max-width:768px){
          .cookie-inner{flex-direction:column;align-items:stretch;gap:12px}
          .cookie-actions{justify-content:space-between}
          .cookie-cats{flex-direction:column}
          .cookie-banner{padding:14px 16px}
          .cookie-customize{padding:12px 0;margin-top:8px}
        }
      `}</style>

      <div className="cookie-inner">
        <p className="cookie-text">
          When you visit our website, we and our third-party partners may use cookies, tracking pixels, and similar technologies to collect information about you. This may be used to optimize your experience, analyze traffic, and personalize content. You can manage your preferences at any time by clicking "Customize".{" "}
          <Link to="/cookie-policy">Cookie Policy</Link>
        </p>
        <div className="cookie-actions">
          <button className="cookie-link" onClick={() => setShowCustomize(!showCustomize)}>Customize</button>
          <button className="cookie-accept" onClick={handleAccept}>Accept Cookies</button>
          <button className="cookie-close" onClick={handleAccept} aria-label="Close">&times;</button>
        </div>
      </div>

      {showCustomize && (
        <div className="cookie-customize">
          <div className="cookie-cats">
            <div className="cookie-cat">
              <div className="cookie-cat-head">
                <span className="cookie-cat-name">Essential</span>
                <span className="cookie-cat-badge" style={{ color: "#34d0b6", background: "rgba(10,179,156,0.1)" }}>Always Active</span>
              </div>
              <p className="cookie-cat-desc">Required for the site to function.</p>
            </div>
            <div className="cookie-cat">
              <div className="cookie-cat-head">
                <span className="cookie-cat-name">Analytics</span>
                <span className="cookie-cat-badge" style={{ color: "#38b6ff", background: "rgba(56,182,255,0.1)" }}>Recommended</span>
              </div>
              <p className="cookie-cat-desc">Helps us understand how visitors use the site.</p>
            </div>
            <div className="cookie-cat">
              <div className="cookie-cat-head">
                <span className="cookie-cat-name">Marketing</span>
                <span className="cookie-cat-badge" style={{ color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.04)" }}>Optional</span>
              </div>
              <p className="cookie-cat-desc">Used for targeted ads and campaign measurement.</p>
            </div>
          </div>
          <div className="cookie-cat-btns">
            <button className="cookie-btn-ess" onClick={handleEssentialOnly}>Essential Only</button>
            <button className="cookie-btn-all" onClick={handleAccept}>Accept All</button>
          </div>
        </div>
      )}
    </div>
  )
}
