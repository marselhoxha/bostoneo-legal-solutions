/**
 * Post-build prerendering script.
 * 1. Injects route-specific meta tags (title, description, OG, canonical)
 * 2. Injects SSR-rendered body content so crawlers see real HTML
 *    without needing to execute JavaScript.
 *
 * Run after `vite build && vite build --ssr`:
 *   node scripts/prerender.mjs
 *
 * If the SSR bundle is missing or a route fails to render,
 * falls back to meta-only injection (no body content).
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { pathToFileURL } from 'url'
import seo from '../src/data/seo.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIST = join(__dirname, '..', 'dist')
const SERVER_DIR = join(DIST, 'server')
const BASE = 'https://legience.com'
const OG_IMAGE = `${BASE}/og-image.png`

// ── Build pages object from seo.js (single source of truth) ──
// seo.js entries have both short keys (t/d/k/u) and long keys (title/desc/keywords).
// prerender.mjs uses the long keys.
const pages = {}
for (const [route, data] of Object.entries(seo)) {
  pages[route] = {
    title: data.title,
    desc: data.desc,
    keywords: data.keywords,
  }
}

// ── Blog posts (build-time only, not needed at runtime) ──
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
  { slug: 'best-ai-legal-research-tools-2026', title: 'Best AI Legal Research Tools in 2026', desc: 'Compare the best AI legal research tools of 2026 including LegiSearch, CoCounsel, and Westlaw AI.' },
  { slug: 'best-legal-document-automation-software-2026', title: 'Best Legal Document Automation Software in 2026', desc: 'Compare the top legal document automation platforms of 2026.' },
]

// ── Try to load SSR render function ──
let render = null
const ssrEntry = join(SERVER_DIR, 'entry-server.js')
if (existsSync(ssrEntry)) {
  try {
    const mod = await import(pathToFileURL(ssrEntry).href)
    render = mod.render
    console.log('✓ SSR bundle loaded — will inject prerendered body content')
  } catch (e) {
    console.warn('⚠ SSR bundle failed to load, falling back to meta-only injection')
    console.warn('  ', e.message)
  }
} else {
  console.warn('⚠ No SSR bundle found at dist/server/ — meta-only injection')
}

// ── Helpers ──
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

/**
 * Strip head-related tags from SSR body output.
 * React Helmet renders <title>, <meta>, <link rel="canonical"> inline in the
 * component tree. These duplicate the tags already injected into <head> by
 * buildHead() and confuse Google (duplicate titles, multiple canonicals).
 */
function stripHeadTagsFromBody(html) {
  return html
    .replace(/<title>.*?<\/title>/g, '')
    .replace(/<meta[^>]*>/g, '')
    .replace(/<link[^>]*rel="canonical"[^>]*>/g, '')
}

function processRoute(template, route, seo) {
  const headTags = buildHead(route, seo)

  // 1. Inject meta tags into <head> — remove template defaults first to avoid duplicates
  let html = template
    .replace(/<title>.*?<\/title>/, '')
    .replace(/<meta name="description"[^>]*>/, '')
    .replace(/<meta name="robots"[^>]*>/, '')
    .replace('</head>', headTags + '\n  </head>')

  // 2. Try SSR body content injection
  if (render) {
    try {
      let bodyHtml = render(route)
      if (bodyHtml && bodyHtml.length > 50) {
        // Remove head tags from SSR output — they're already in <head> via buildHead()
        bodyHtml = stripHeadTagsFromBody(bodyHtml)
        html = html.replace(
          '<div id="root"></div>',
          `<div id="root">${bodyHtml}</div>`
        )
      }
    } catch (e) {
      console.warn(`  ⚠ SSR failed for ${route}: ${e.message}`)
    }
  }

  return html
}

// ── Generate HTML files ──
const template = readFileSync(join(DIST, 'index.html'), 'utf-8')
let count = 0
let ssrCount = 0

// Process static pages
for (const [route, seo] of Object.entries(pages)) {
  const dir = route === '/' ? DIST : join(DIST, route.slice(1))
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  const html = processRoute(template, route, seo)
  writeFileSync(join(dir, 'index.html'), html)
  count++
  if (render && html.includes('</nav>')) ssrCount++
}

// Process blog posts
for (const post of blogPosts) {
  const route = `/blog/${post.slug}`
  const dir = join(DIST, 'blog', post.slug)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  const seo = { title: `${post.title} | Legience`, desc: post.desc, keywords: '' }
  const html = processRoute(template, route, seo)
  writeFileSync(join(dir, 'index.html'), html)
  count++
  if (render && html.includes('</nav>')) ssrCount++
}

// Clean up server build (not needed in production)
if (existsSync(SERVER_DIR)) {
  rmSync(SERVER_DIR, { recursive: true })
  console.log('✓ Cleaned up SSR build artifacts')
}

console.log(`✓ Prerendered ${count} routes (${ssrCount} with SSR body content)`)
