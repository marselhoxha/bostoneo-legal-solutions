import { Helmet } from 'react-helmet-async'
import { useLocation } from 'react-router-dom'
import seo from '../data/seo'
import { blogSeoMap } from '../data/blogPosts.jsx'

/* Breadcrumb label map for known routes */
const breadcrumbLabels = {
  features: 'Features',
  'ai-platform': 'AI Platform',
  'pi-workspace': 'PI Workspace',
  'practice-areas': 'Practice Areas',
  pricing: 'Pricing',
  blog: 'Blog',
  integrations: 'Integrations',
  about: 'About',
  security: 'Security',
  contact: 'Contact',
  privacy: 'Privacy Policy',
  terms: 'Terms of Service',
  'cookie-policy': 'Cookie Policy',
  'aba-ethics': 'ABA Ethics',
  'legal-drafting-software': 'AI Legal Drafting Software',
  'legal-research-software': 'AI Legal Research Software',
  'law-firm-crm': 'Law Firm CRM & Intake',
  compare: 'Compare',
  tools: 'Free Tools',
  'legience-vs-clio': 'Legience vs Clio',
  'legience-vs-mycase': 'Legience vs MyCase',
  'legience-vs-practicepanther': 'Legience vs PracticePanther',
  'legience-vs-filevine': 'Legience vs Filevine',
  'legience-vs-cloudlex': 'Legience vs CloudLex',
  'legience-vs-evenup': 'Legience vs EvenUp',
  'sol-calculator': 'Statute of Limitations Calculator',
  'pi-settlement-calculator': 'PI Settlement Calculator',
  'court-filing-fees': 'Court Filing Fees',
}

function buildBreadcrumbs(pathname) {
  const segments = pathname.split('/').filter(Boolean)
  if (!segments.length) return null

  const items = [{ name: 'Home', url: 'https://legience.com/' }]
  let path = ''
  for (const seg of segments) {
    path += '/' + seg
    const label = breadcrumbLabels[seg] || seg.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    items.push({ name: label, url: 'https://legience.com' + path })
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

export default function SEO() {
  const { pathname } = useLocation()
  const d = seo[pathname] || blogSeoMap[pathname] || seo['/']
  const breadcrumbs = buildBreadcrumbs(pathname)

  return <Helmet>
    <title>{d.t}</title>
    <meta name="description" content={d.d} />
    <meta name="keywords" content={d.k} />
    <link rel="canonical" href={d.u} />
    <meta property="og:title" content={d.t} />
    <meta property="og:description" content={d.d} />
    <meta property="og:url" content={d.u} />
    <meta property="og:type" content={pathname.startsWith('/blog/') ? 'article' : 'website'} />
    <meta property="og:image" content="https://legience.com/og-image.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content="https://legience.com/og-image.png" />
    <meta name="robots" content="index, follow" />
    <meta name="geo.placename" content="US" />
    {breadcrumbs && <script type="application/ld+json">{JSON.stringify(breadcrumbs)}</script>}
  </Helmet>
}
