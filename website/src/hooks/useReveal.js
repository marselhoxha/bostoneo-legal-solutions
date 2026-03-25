import { useEffect } from "react"
import { useLocation } from "react-router-dom"

export default function useReveal() {
  const { pathname } = useLocation()
  
  useEffect(() => {
    // Small delay to let React render new DOM elements after route change
    const timer = setTimeout(() => {
      const els = document.querySelectorAll(".reveal:not(.visible)")
      if (!els.length) return
      
      const obs = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add("visible")
              obs.unobserve(e.target)
            }
          })
        },
        { threshold: 0.04, rootMargin: "0px 0px -20px 0px" }
      )
      
      els.forEach((el) => obs.observe(el))
      
      // Also immediately show elements that are already in viewport
      els.forEach((el) => {
        const rect = el.getBoundingClientRect()
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          el.classList.add("visible")
        }
      })
      
      return () => obs.disconnect()
    }, 50)
    
    return () => clearTimeout(timer)
  }, [pathname]) // Re-run on every route change
}
