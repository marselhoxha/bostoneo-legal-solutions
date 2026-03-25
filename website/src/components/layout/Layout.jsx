import { useEffect } from "react"
import { useLocation } from "react-router-dom"
import Navbar from "./Navbar"
import Footer from "./Footer"
import CookieConsent from "./CookieConsent"
import SEO from "../../hooks/useSEO"

export default function Layout({ children }) {
  const { pathname } = useLocation()
  
  // Re-trigger scroll reveals on every route change
  useEffect(() => {
    const timer = setTimeout(() => {
      const els = document.querySelectorAll(".reveal:not(.visible)")
      
      const obs = new IntersectionObserver(
        (entries) => entries.forEach((e) => {
          if (e.isIntersecting) { e.target.classList.add("visible"); obs.unobserve(e.target) }
        }),
        { threshold: 0.04, rootMargin: "0px 0px -20px 0px" }
      )
      
      els.forEach((el) => {
        const rect = el.getBoundingClientRect()
        // If already in viewport, show immediately
        if (rect.top < window.innerHeight * 1.1 && rect.bottom > 0) {
          el.classList.add("visible")
        } else {
          obs.observe(el)
        }
      })
      
      return () => obs.disconnect()
    }, 80)
    
    return () => clearTimeout(timer)
  }, [pathname])
  
  return (
    <>
      <SEO />
      <Navbar />
      <main>{children}</main>
      <Footer />
      <CookieConsent />
    </>
  )
}
