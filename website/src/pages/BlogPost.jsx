import { useParams, Link } from "react-router-dom"
import { Helmet } from "react-helmet-async"
import { motion } from "framer-motion"
import { useEffect, useRef, useState } from "react"
import { Clock, User, Calendar, ChevronRight, ArrowRight } from "lucide-react"
import { getPostBySlug, getRelatedPosts } from "../data/blogPosts.jsx"
import SectionHead from "../components/ui/SectionHead"

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } }

export default function BlogPost() {
  const { slug } = useParams()
  const post = getPostBySlug(slug)
  const [activeId, setActiveId] = useState("")
  const contentRef = useRef(null)

  /* Track which section is visible via IntersectionObserver */
  useEffect(() => {
    if (!post?.toc?.length || !contentRef.current) return

    const headings = contentRef.current.querySelectorAll("h2[id]")
    if (!headings.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        }
      },
      { rootMargin: "-100px 0px -60% 0px", threshold: 0 }
    )
    headings.forEach((h) => observer.observe(h))
    return () => observer.disconnect()
  }, [post, slug])

  /* Reset active on slug change */
  useEffect(() => { setActiveId("") }, [slug])

  /* 404 fallback */
  if (!post) {
    return (
      <section className="section" style={{ textAlign: "center", minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div>
          <h1 className="h2">Article Not Found</h1>
          <p className="sub" style={{ marginTop: 12 }}>The article you're looking for doesn't exist or may have been moved.</p>
          <Link to="/blog" className="btn btn--primary" style={{ marginTop: 24, display: "inline-flex" }}>Back to Resources</Link>
        </div>
      </section>
    )
  }

  const related = getRelatedPosts(slug, 3)
  const dateFormatted = new Date(post.publishDate + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
  const formatDateShort = (d) =>
    new Date(d + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })

  /* JSON-LD Article structured data */
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    author: { "@type": "Organization", name: "Legience" },
    publisher: { "@type": "Organization", name: "Legience", url: "https://legience.com" },
    datePublished: post.publishDate,
    image: post.image,
    mainEntityOfPage: { "@type": "WebPage", "@id": `https://legience.com/blog/${post.slug}` },
  }

  const hasToc = post.toc && post.toc.length > 0

  return (
    <>
      {/* Per-post SEO */}
      <Helmet>
        <title>{post.title} | Legience</title>
        <meta name="description" content={post.description} />
        <meta name="keywords" content={post.keywords} />
        <link rel="canonical" href={`https://legience.com/blog/${post.slug}`} />
        <meta property="og:type" content="article" />
        <meta property="og:title" content={post.title} />
        <meta property="og:description" content={post.description} />
        <meta property="og:url" content={`https://legience.com/blog/${post.slug}`} />
        <meta property="og:image" content={post.image} />
        <meta property="article:published_time" content={post.publishDate} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content={post.image} />
        <meta name="robots" content="index, follow" />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      {/* ── DARK HERO HEADER ── */}
      <section className="blogpost-hero">
        <div className="bg-grid" /><div className="bg-noise" />
        <div className="blogpost-hero__orb" style={{ background: post.gradient }} />
        <motion.div className="container blogpost-hero__inner" initial="hidden" animate="visible" variants={fadeUp}>
          <nav className="blogpost-hero__breadcrumb" aria-label="Breadcrumb">
            <Link to="/">Home</Link>
            <ChevronRight size={14} />
            <Link to="/blog">Resources</Link>
            <ChevronRight size={14} />
            <span>{post.category}</span>
          </nav>
          <div className="blogpost-hero__cat">{post.category}</div>
          <h1 className="blogpost-hero__title">{post.title}</h1>
          <p className="blogpost-hero__subtitle">{post.description}</p>
          <div className="blogpost-hero__meta">
            <span><User size={14} /> {post.author}</span>
            <span className="blogpost-hero__sep" />
            <span><Calendar size={14} /> {dateFormatted}</span>
            <span className="blogpost-hero__sep" />
            <span><Clock size={14} /> {post.readTime}</span>
          </div>
        </motion.div>
      </section>

      {/* ── ARTICLE BODY — TWO COLUMN LAYOUT ── */}
      <motion.section className="section" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.5 }}>
        <div className="container">
          <div className={`blogpost-layout${hasToc ? "" : " blogpost-layout--single"}`}>

            {/* ── STICKY SIDEBAR TOC (desktop) ── */}
            {hasToc && (
              <aside className="blogpost-sidebar">
                <nav className="blogpost-sidebar__toc" aria-label="Table of Contents">
                  <div className="blogpost-sidebar__title">In This Article</div>
                  <ul className="blogpost-sidebar__list">
                    {post.toc.map((item) => (
                      <li key={item.id}>
                        <a
                          href={`#${item.id}`}
                          className={activeId === item.id ? "active" : ""}
                        >
                          {item.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>
              </aside>
            )}

            {/* ── MAIN CONTENT ── */}
            <div className="blogpost-content">
              {/* Mobile-only inline TOC */}
              {hasToc && (
                <nav className="blogpost-toc-mobile" aria-label="Table of Contents">
                  <div className="blogpost-sidebar__title">In This Article</div>
                  <ul className="blogpost-sidebar__list">
                    {post.toc.map((item) => (
                      <li key={item.id}>
                        <a href={`#${item.id}`}>{item.label}</a>
                      </li>
                    ))}
                  </ul>
                </nav>
              )}

              <div className="legal-content" ref={contentRef}>{post.content()}</div>

              {/* CTA */}
              <div className="blogpost-cta">
                <div className="blogpost-cta__inner">
                  <h3>Ready to See Legience in Action?</h3>
                  <p>14-day free trial. No credit card required. Full access to every feature.</p>
                  <Link to="/contact" className="btn btn--primary btn--lg">
                    Start Free Trial <ArrowRight size={18} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ── RELATED POSTS ── */}
      {related.length > 0 && (
        <section className="section section--muted">
          <div className="container">
            <SectionHead badge="Keep Reading" title="Related Articles" />
            <div className="blog-grid" style={{ maxWidth: 960, margin: "0 auto" }}>
              {related.map((r) => (
                <Link to={`/blog/${r.slug}`} key={r.slug} className="blog-card-v2">
                  <div className="blog-card-v2__img">
                    <img src={r.image} alt={r.title} loading="lazy" />
                    <div className="blog-card-v2__cat-badge">{r.category}</div>
                    <div className="blog-card-v2__read-badge"><Clock size={12} /> {r.readTime}</div>
                  </div>
                  <div className="blog-card-v2__body">
                    <h3 className="blog-card-v2__title">{r.title}</h3>
                    <p className="blog-card-v2__desc">{r.description}</p>
                    <div className="blog-card-v2__footer">
                      <div className="blog-card-v2__meta">
                        <span>{formatDateShort(r.publishDate)}</span>
                      </div>
                      <span className="blog-card-v2__cta">
                        Read <ArrowRight size={14} />
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  )
}
