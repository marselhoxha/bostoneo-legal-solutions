/**
 * Server entry point for build-time prerendering.
 * Imports all pages directly (no lazy loading) so renderToString
 * can produce full HTML without waiting for dynamic imports.
 */
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router'
import { HelmetProvider } from 'react-helmet-async'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'

// Direct imports — no lazy() for SSR
import Home from './pages/Home'
import Features from './pages/Features'
import AIPlatform from './pages/AIPlatform'
import PIWorkspace from './pages/PIWorkspace'
import PracticeAreas from './pages/PracticeAreas'
import Pricing from './pages/Pricing'
import Blog from './pages/Blog'
import BlogPost from './pages/BlogPost'
import Integrations from './pages/Integrations'
import About from './pages/About'
import Security from './pages/Security'
import Contact from './pages/Contact'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import CookiePolicy from './pages/CookiePolicy'
import ABAEthics from './pages/ABAEthics'
import LegVsClio from './pages/compare/LegVsClio'
import LegVsMyCase from './pages/compare/LegVsMyCase'
import LegVsPP from './pages/compare/LegVsPP'
import LegVsFilevine from './pages/compare/LegVsFilevine'
import LegVsCloudLex from './pages/compare/LegVsCloudLex'
import LegVsEvenUp from './pages/compare/LegVsEvenUp'
import SOLCalculator from './pages/tools/SOLCalculator'
import PISettlementCalculator from './pages/tools/PISettlementCalculator'
import CourtFilingFees from './pages/tools/CourtFilingFees'
import LegalDraftingSoftware from './pages/LegalDraftingSoftware'
import LegalResearchSoftware from './pages/LegalResearchSoftware'
import LawFirmCRM from './pages/LawFirmCRM'

export function render(url) {
  const helmetContext = {}
  const html = renderToString(
    <HelmetProvider context={helmetContext}>
      <StaticRouter location={url}>
        <Layout>
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
          </Routes>
        </Layout>
      </StaticRouter>
    </HelmetProvider>
  )
  return html
}
