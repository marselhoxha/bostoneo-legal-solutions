import { useState } from "react"
import { Link } from "react-router-dom"
import { Helmet } from "react-helmet-async"
import { motion, AnimatePresence } from "framer-motion"
import { Clock, ArrowRight, User, Calendar } from "lucide-react"
import PageHero from "../components/ui/PageHero"
import SectionHead from "../components/ui/SectionHead"
import { blogPosts, categories } from "../data/blogPosts.jsx"

const collectionPageSchema = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "Legal Technology Blog — AI Research, Case Management & Firm Growth",
  description: "Guides, comparisons & case studies on legal AI, practice management & firm growth. Written for attorneys by legal tech experts.",
  url: "https://legience.com/blog",
  isPartOf: { "@type": "WebSite", name: "Legience", url: "https://legience.com" },
  publisher: {
    "@type": "Organization",
    name: "Legience",
    url: "https://legience.com",
    logo: { "@type": "ImageObject", url: "https://legience.com/og-image.png" },
  },
  mainEntity: {
    "@type": "ItemList",
    itemListElement: blogPosts.map((post, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `https://legience.com/blog/${post.slug}`,
      name: post.title,
    })),
  },
}

const formatDate = (d) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })

export default function Blog() {
  const [active, setActive] = useState("All")

  const featured = blogPosts.find((p) => p.featured) || blogPosts[0]

  // When "All" is selected: show all posts except featured (featured has its own section)
  // When a specific category: show ALL posts in that category (including featured)
  const filtered = active === "All"
    ? blogPosts.filter((p) => !p.featured)
    : blogPosts.filter((p) => p.category === active)

  return (
    <>
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(collectionPageSchema)}</script>
      </Helmet>
      <PageHero
        badge="Resources"
        title="Insights for"
        gradient="Modern Law Firms."
        subtitle="Expert guides, ROI analyses, case studies, and compliance advice for attorneys navigating AI, practice management, and firm growth."
      />

      {/* Featured article — only show when "All" tab */}
      {active === "All" && (
        <section className="section section--muted">
          <div className="container">
            <Link to={`/blog/${featured.slug}`} className="blog-featured">
              <img src={featured.image} alt={featured.title} className="blog-featured__img" />
              <div className="blog-featured__overlay" />
              <div className="blog-featured__content">
                <div className="label" style={{ background: "rgba(255,255,255,0.15)", color: "#fff", marginBottom: 16 }}>Featured Guide</div>
                <h2 className="blog-featured__title">{featured.title}</h2>
                <p className="blog-featured__desc">{featured.description}</p>
                <div className="blog-featured__meta-row">
                  <span><Calendar size={14} /> {formatDate(featured.publishDate)}</span>
                  <span><Clock size={14} /> {featured.readTime}</span>
                </div>
                <span className="btn" style={{ background: "#fff", color: "var(--accent-dark)", marginTop: 20 }}>
                  Read the Full Guide <ArrowRight size={16} />
                </span>
              </div>
            </Link>
          </div>
        </section>
      )}

      {/* Category tabs + article grid */}
      <section className="section">
        <div className="container">
          <SectionHead badge="Latest" title="From the Blog" />

          {/* Tabs */}
          <div className="tabs tabs--center" style={{ marginBottom: 40 }}>
            {categories.map((cat) => (
              <button
                key={cat}
                className={`tab${active === cat ? " tab--active" : ""}`}
                onClick={() => setActive(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Grid */}
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="blog-grid"
            >
              {filtered.map((a, i) => (
                <motion.div
                  key={a.slug}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: i * 0.06 }}
                >
                  <Link to={`/blog/${a.slug}`} className="blog-card-v2">
                    <div className="blog-card-v2__img">
                      <img src={a.image} alt={a.title} loading="lazy" />
                      <div className="blog-card-v2__cat-badge">{a.category}</div>
                      <div className="blog-card-v2__read-badge"><Clock size={12} /> {a.readTime}</div>
                    </div>
                    <div className="blog-card-v2__body">
                      <h3 className="blog-card-v2__title">{a.title}</h3>
                      <p className="blog-card-v2__desc">{a.description}</p>
                      <div className="blog-card-v2__footer">
                        <div className="blog-card-v2__meta">
                          <User size={13} />
                          <span>{a.author}</span>
                          <span className="blog-card-v2__dot" />
                          <span>{formatDate(a.publishDate)}</span>
                        </div>
                        <span className="blog-card-v2__cta">
                          Read <ArrowRight size={14} />
                        </span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}

              {filtered.length === 0 && (
                <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "64px 0", color: "var(--gray-400)" }}>
                  <p style={{ fontSize: "1rem" }}>No articles in this category yet. Check back soon!</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* Newsletter */}
      <section className="section section--muted">
        <div className="container" style={{ textAlign: "center" }}>
          <SectionHead badge="Stay Updated" title="Get Legal Tech Insights Monthly" subtitle="Join attorneys who get our monthly newsletter on AI, practice management, and firm growth." />
          <div style={{ maxWidth: 480, margin: "0 auto", display: "flex", gap: 8 }}>
            <input type="email" placeholder="your@email.com" aria-label="Email address" className="form-input" style={{ flex: 1 }} />
            <button className="btn btn--primary">Subscribe</button>
          </div>
          <p style={{ fontSize: "0.72rem", color: "var(--gray-400)", marginTop: 8 }}>No spam. Unsubscribe anytime. We respect your inbox.</p>
        </div>
      </section>
    </>
  )
}
