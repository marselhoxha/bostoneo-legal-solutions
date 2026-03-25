/**
 * Post-build SEO injection script.
 * Creates route-specific index.html files with correct meta tags
 * so that crawlers (Google, AI bots, social media) see proper
 * titles, descriptions, OG tags, and structured data without
 * needing to execute JavaScript.
 *
 * Run after `vite build`: node scripts/inject-seo.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIST = join(__dirname, '..', 'dist')
const BASE = 'https://legience.com'
const OG_IMAGE = `${BASE}/og-image.png`

// ── Route SEO data ──
const pages = {
  '/': {
    title: 'Legience — #1 AI-Powered Legal Practice Management for Law Firms',
    desc: 'Replace Clio, Westlaw & DocuSign with one AI platform for attorneys. Case management, AI research, document drafting, billing & client portal — from $99/mo.',
    keywords: 'legal practice management, AI legal research, law firm software, Clio alternative, attorney case management',
  },
  '/features': {
    title: 'Features — 14 Modules: Cases, AI, Billing, Conflict Checking & More | Legience',
    desc: 'Case management, AI research, demand letters, billing, e-signatures, CRM, conflict checking, expense management, client portal & analytics — 14 modules, one platform.',
    keywords: 'legal case management, AI legal research, law firm billing, conflict checking',
  },
  '/ai-platform': {
    title: 'LegiSpace AI — LegiSearch, LegiDraft, LegiLyze | Legience',
    desc: 'Claude-powered LegiSearch™ with verified citations, LegiDraft™ at $0/case, LegiLyze™ contract analysis. Zero-knowledge AI for attorneys.',
    keywords: 'AI legal research, AI document drafting, LegiDraft, Claude AI',
  },
  '/pi-workspace': {
    title: 'PI Workspace — AI Case Management for Personal Injury | Legience',
    desc: 'All-in-one PI workspace: AI demand letters, medical records analysis, settlement tracking, document checklist & damage calculator.',
    keywords: 'PI workspace, personal injury case management, AI demand letters',
  },
  '/practice-areas': {
    title: 'Practice Area Solutions — PI, Family Law, Business & More | Legience',
    desc: 'Purpose-built tools for every practice area: personal injury, family law, business litigation & beyond.',
    keywords: 'law firm practice management, personal injury software, legal practice areas',
  },
  '/pricing': {
    title: 'Pricing — Plans from $99/mo | No Per-Case AI Fees | Legience',
    desc: 'Starter $99/mo, Professional $169/mo, Firm $249/mo. Unlimited AI, e-signatures & client portal included. Save 22% annually.',
    keywords: 'legal software pricing, Clio alternative pricing, law firm software cost',
  },
  '/blog': {
    title: 'Resources & Blog | Legience',
    desc: 'Guides, case studies & advice for attorneys on AI, practice management & firm growth.',
    keywords: 'legal tech blog, AI for lawyers, attorney resources',
  },
  '/integrations': {
    title: 'Integrations — Stripe, BoldSign, Claude AI & More | Legience',
    desc: 'Built-in integrations with Stripe, BoldSign, Claude AI, Twilio & AWS. No setup fees.',
    keywords: 'legal software integrations, Stripe for law firms',
  },
  '/about': {
    title: 'About Legience — Built for Modern Law Firms | Legience',
    desc: 'Born from frustration with 5-6 disconnected legal tools. One AI platform for attorneys who want to practice law, not manage software.',
    keywords: 'about Legience, legal tech startup',
  },
  '/security': {
    title: 'Security — AES-256, 201 CMR 17.00 Compliance | Legience',
    desc: 'AES-256 encryption, 201 CMR 17.00 compliant, zero-knowledge AI, US-only hosting, immutable audit logs.',
    keywords: 'legal software security, law firm data protection',
  },
  '/contact': {
    title: 'Start Free Trial — Book a Demo | Legience',
    desc: '14-day free trial, no credit card. Full access to AI research, case management & every feature.',
    keywords: 'legal software demo, Legience free trial',
  },
  '/privacy': {
    title: 'Privacy Policy | Legience',
    desc: 'How Legience by Bostoneo Solutions LLC collects, uses, and protects your personal information.',
    keywords: 'legal software privacy policy',
  },
  '/terms': {
    title: 'Terms of Service | Legience',
    desc: 'Terms governing your use of the Legience legal practice management platform.',
    keywords: 'legal software terms of service',
  },
  '/cookie-policy': {
    title: 'Cookie Policy | Legience',
    desc: 'How Legience uses cookies and tracking technologies.',
    keywords: 'legal software cookie policy',
  },
  '/aba-ethics': {
    title: 'ABA Ethics & AI Compliance | Legience',
    desc: 'How Legience addresses ABA Formal Opinion 512 and applicable Rules of Professional Conduct for AI in legal practice.',
    keywords: 'ABA ethics AI legal, Formal Opinion 512 compliance',
  },
  '/compare/legience-vs-clio': {
    title: 'Legience vs Clio (2026) — Feature & Pricing Comparison | Legience',
    desc: 'Side-by-side comparison of Legience vs Clio for law firms. Compare pricing, AI features, e-signatures, CRM, and total cost for a 5-attorney firm.',
    keywords: 'Legience vs Clio, Clio alternative, Clio comparison, law firm software comparison',
  },
  '/compare/legience-vs-mycase': {
    title: 'Legience vs MyCase (2026) — Feature & Pricing Comparison | Legience',
    desc: 'Detailed comparison of Legience vs MyCase for law firms. See how AI research, document drafting, and all-inclusive pricing stack up.',
    keywords: 'Legience vs MyCase, MyCase alternative, MyCase comparison, law firm software comparison',
  },
  '/compare/legience-vs-practicepanther': {
    title: 'Legience vs PracticePanther (2026) — Feature & Pricing Comparison | Legience',
    desc: 'Compare Legience and PracticePanther for law firms. Side-by-side feature comparison, real pricing data, and total cost analysis for a 5-attorney firm.',
    keywords: 'Legience vs PracticePanther, PracticePanther alternative, PracticePanther comparison, law firm software',
  },
  '/tools/sol-calculator': {
    title: 'Statute of Limitations Calculator — All 50 States | Legience',
    desc: 'Free statute of limitations calculator for all 50 states. Look up SOL deadlines for personal injury, medical malpractice, breach of contract, property damage, wrongful death, fraud, and more.',
    keywords: 'statute of limitations calculator, SOL calculator, statute of limitations by state, personal injury statute of limitations, medical malpractice deadline, filing deadline calculator',
  },
  '/tools/pi-settlement-calculator': {
    title: 'Personal Injury Settlement Calculator — Free Estimate | Legience',
    desc: 'Free PI settlement calculator using the multiplier method. Estimate pain and suffering damages, attorney fees, and net settlement for personal injury cases in all 50 states.',
    keywords: 'personal injury settlement calculator, PI settlement calculator, pain and suffering calculator, personal injury case value, settlement estimate calculator',
  },
  '/tools/court-filing-fees': {
    title: 'Court Filing Fees by State — All 50 States Lookup | Legience',
    desc: 'Look up court filing fees for all 50 states. Civil, small claims, family, probate, and appeals court fees with fee waiver info and official court links.',
    keywords: 'court filing fees, court filing fees by state, how much to file a lawsuit, small claims filing fee, civil court filing fee, court costs by state',
  },
}

// ── Blog posts (slug → SEO) ──
const blogPosts = [
  { slug: 'why-pi-firms-switching-clio-to-legience-2026', title: 'Why PI Firms Are Switching from Clio to Legience in 2026', desc: 'A detailed comparison of Clio vs Legience for personal injury law firms.' },
  { slug: 'ai-ethics-attorney-client-privilege', title: 'AI Ethics & Attorney-Client Privilege', desc: 'How AI legal tools handle confidentiality and ethical obligations.' },
  { slug: 'true-cost-of-clio-2026', title: 'The True Cost of Clio in 2026', desc: 'Hidden costs and add-on fees that make Clio more expensive than advertised.' },
  { slug: 'boston-pi-firm-replaced-5-tools', title: 'How a Boston PI Firm Replaced 5 Tools with Legience', desc: 'Case study: consolidating legal software into one platform.' },
  { slug: 'ai-demand-letters-legidraft', title: 'AI Demand Letters with LegiDraft', desc: 'How LegiDraft generates demand letters at $0/case vs $500+ competitors.' },
  { slug: '201-cmr-17-compliance-checklist', title: '201 CMR 17.00 Compliance Checklist for Law Firms', desc: 'Complete compliance checklist for Massachusetts data protection regulations.' },
  { slug: 'evenup-2b-valuation-legal-ai', title: 'EvenUp $2B Valuation & The Legal AI Market', desc: 'Analysis of the legal AI market and what EvenUp\'s valuation means for law firms.' },
  { slug: 'best-legal-practice-management-software-2026', title: 'Best Legal Practice Management Software in 2026: Complete Guide', desc: 'A comprehensive comparison of the best legal practice management software in 2026, including Clio, MyCase, PracticePanther, Smokeball, and Legience.' },
  { slug: 'clio-alternatives-2026', title: 'Clio Alternatives 2026: 5 Platforms That Do More for Less', desc: 'Frustrated with Clio pricing or missing AI features? Here are 5 Clio alternatives in 2026 that deliver more value.' },
  { slug: 'what-is-legal-practice-management-software', title: 'What Is Legal Practice Management Software? Everything Attorneys Need to Know', desc: 'The definitive guide to legal practice management software: what it is, why law firms need it, key features, and how to choose the right platform.' },
  { slug: 'ai-legal-research-2026', title: 'How AI Is Transforming Legal Research in 2026', desc: 'A comprehensive look at AI legal research tools in 2026, covering Westlaw, CoCounsel, LegiSearch, benefits, limitations, and ethical obligations.' },
  { slug: 'solo-attorney-software-guide', title: 'Solo Attorney Software: The Complete Guide to Running a Law Practice Alone', desc: 'The complete guide to software for solo attorneys covering case management, billing, AI research, document drafting, and client communication.' },
]

// ── Generate HTML ──
const template = readFileSync(join(DIST, 'index.html'), 'utf-8')

function buildHead(route, seo, ogImage = OG_IMAGE) {
  const url = route === '/' ? BASE + '/' : BASE + route
  const ogType = route.startsWith('/blog/') ? 'article' : 'website'

  return `
    <title>${seo.title}</title>
    <meta name="description" content="${seo.desc}">
    ${seo.keywords ? `<meta name="keywords" content="${seo.keywords}">` : ''}
    <link rel="canonical" href="${url}">
    <meta property="og:title" content="${seo.title}">
    <meta property="og:description" content="${seo.desc}">
    <meta property="og:url" content="${url}">
    <meta property="og:type" content="${ogType}">
    <meta property="og:image" content="${ogImage}">
    <meta property="og:site_name" content="Legience">
    <meta property="og:locale" content="en_US">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:image" content="${ogImage}">
    <meta name="robots" content="index, follow">`
}

function injectMeta(html, route, seo, ogImage) {
  const headTags = buildHead(route, seo, ogImage)
  // Replace the existing title and description, inject before </head>
  let result = html
    .replace(/<title>.*?<\/title>/, '')
    .replace(/<meta name="description"[^>]*>/, '')
    .replace('</head>', headTags + '\n  </head>')
  return result
}

let count = 0

// Process static pages
for (const [route, seo] of Object.entries(pages)) {
  const dir = route === '/' ? DIST : join(DIST, route.slice(1))
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  const html = injectMeta(template, route, seo)
  writeFileSync(join(dir, 'index.html'), html)
  count++
}

// Process blog posts
for (const post of blogPosts) {
  const route = `/blog/${post.slug}`
  const dir = join(DIST, 'blog', post.slug)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  const seo = { title: `${post.title} | Legience`, desc: post.desc, keywords: '' }
  const html = injectMeta(template, route, seo)
  writeFileSync(join(dir, 'index.html'), html)
  count++
}

console.log(`✓ SEO injected into ${count} routes`)
