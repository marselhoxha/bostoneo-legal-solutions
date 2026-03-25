import { Routes, Route, useLocation } from 'react-router-dom'
import { useEffect, lazy, Suspense } from 'react'
import Layout from './components/layout/Layout'
import Home from './pages/Home'

// Lazy-load all non-home pages for code-splitting
const Features = lazy(() => import('./pages/Features'))
const AIPlatform = lazy(() => import('./pages/AIPlatform'))
const PIWorkspace = lazy(() => import('./pages/PIWorkspace'))
const PracticeAreas = lazy(() => import('./pages/PracticeAreas'))
const Pricing = lazy(() => import('./pages/Pricing'))
const Blog = lazy(() => import('./pages/Blog'))
const BlogPost = lazy(() => import('./pages/BlogPost'))
const Integrations = lazy(() => import('./pages/Integrations'))
const About = lazy(() => import('./pages/About'))
const Security = lazy(() => import('./pages/Security'))
const Contact = lazy(() => import('./pages/Contact'))
const Privacy = lazy(() => import('./pages/Privacy'))
const Terms = lazy(() => import('./pages/Terms'))
const CookiePolicy = lazy(() => import('./pages/CookiePolicy'))
const ABAEthics = lazy(() => import('./pages/ABAEthics'))
const LegVsClio = lazy(() => import('./pages/compare/LegVsClio'))
const LegVsMyCase = lazy(() => import('./pages/compare/LegVsMyCase'))
const LegVsPP = lazy(() => import('./pages/compare/LegVsPP'))
const LegVsFilevine = lazy(() => import('./pages/compare/LegVsFilevine'))
const LegVsCloudLex = lazy(() => import('./pages/compare/LegVsCloudLex'))
const LegVsEvenUp = lazy(() => import('./pages/compare/LegVsEvenUp'))
const NotFound = lazy(() => import('./pages/NotFound'))
const SOLCalculator = lazy(() => import('./pages/tools/SOLCalculator'))
const PISettlementCalculator = lazy(() => import('./pages/tools/PISettlementCalculator'))
const CourtFilingFees = lazy(() => import('./pages/tools/CourtFilingFees'))
const LegalDraftingSoftware = lazy(() => import('./pages/LegalDraftingSoftware'))
const LegalResearchSoftware = lazy(() => import('./pages/LegalResearchSoftware'))
const LawFirmCRM = lazy(() => import('./pages/LawFirmCRM'))

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Layout>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/features" element={<Features />} />
            <Route path="/ai-platform" element={<AIPlatform />} />
            <Route path="/pi-workspace" element={<PIWorkspace />} />
            <Route path="/practice-areas" element={<PracticeAreas />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/blog/:slug" element={<BlogPost />} />
            <Route path="/integrations" element={<Integrations />} />
            <Route path="/about" element={<About />} />
            <Route path="/security" element={<Security />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/cookie-policy" element={<CookiePolicy />} />
            <Route path="/aba-ethics" element={<ABAEthics />} />
            <Route path="/tools/sol-calculator" element={<SOLCalculator />} />
            <Route path="/tools/pi-settlement-calculator" element={<PISettlementCalculator />} />
            <Route path="/tools/court-filing-fees" element={<CourtFilingFees />} />
            <Route path="/legal-drafting-software" element={<LegalDraftingSoftware />} />
            <Route path="/legal-research-software" element={<LegalResearchSoftware />} />
            <Route path="/law-firm-crm" element={<LawFirmCRM />} />
            <Route path="/compare/legience-vs-clio" element={<LegVsClio />} />
            <Route path="/compare/legience-vs-mycase" element={<LegVsMyCase />} />
            <Route path="/compare/legience-vs-practicepanther" element={<LegVsPP />} />
            <Route path="/compare/legience-vs-filevine" element={<LegVsFilevine />} />
            <Route path="/compare/legience-vs-cloudlex" element={<LegVsCloudLex />} />
            <Route path="/compare/legience-vs-evenup" element={<LegVsEvenUp />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </Layout>
    </>
  )
}
