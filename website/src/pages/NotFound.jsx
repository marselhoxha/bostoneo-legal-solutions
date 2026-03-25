import { Link } from "react-router-dom"
import PageHero from "../components/ui/PageHero"

export default function NotFound() {
  return <>
    <PageHero badge="404" title="Page" gradient="Not Found." subtitle="The page you're looking for doesn't exist or has been moved." />
    <section className="section" style={{ textAlign: "center" }}>
      <Link to="/" className="btn btn--primary">Back to Home</Link>
    </section>
  </>
}
