import PageHero from "../components/ui/PageHero"

export default function CookiePolicy() {
  return <>
    <PageHero badge="Legal" title="Cookie Policy" subtitle="Last updated: March 30, 2026. This policy explains how Legience uses cookies and similar tracking technologies." />
    <section className="section"><div className="container" style={{ maxWidth: 800, margin: "0 auto" }}>
      <div className="legal-content">
        <h2>1. What Are Cookies?</h2>
        <p>Cookies are small text files stored on your device when you visit a website. They help websites remember your preferences, understand how you use the site, and improve your experience.</p>

        <h2>2. Cookies We Use</h2>

        <h3>2.1 Essential Cookies (Required)</h3>
        <p>These cookies are necessary for the Platform to function. They cannot be disabled.</p>
        <ul>
          <li><strong>Authentication:</strong> Keeps you logged in securely across pages and sessions.</li>
          <li><strong>Session Management:</strong> Maintains your session state and security tokens.</li>
          <li><strong>CSRF Protection:</strong> Prevents cross-site request forgery attacks.</li>
        </ul>

        <h3>2.2 Functional Cookies (Optional)</h3>
        <p>These cookies remember your preferences and settings.</p>
        <ul>
          <li><strong>Theme Preferences:</strong> Remembers your display settings.</li>
          <li><strong>Dashboard Layout:</strong> Saves your dashboard configuration.</li>
          <li><strong>Language Settings:</strong> Stores your language preference.</li>
        </ul>

        <h3>2.3 Analytics Cookies (Optional)</h3>
        <p>These cookies help us understand how you use the Platform so we can improve it.</p>
        <ul>
          <li><strong>Usage Patterns:</strong> Which features you use most, page load times, error rates.</li>
          <li><strong>Aggregated Statistics:</strong> Total users, feature adoption rates, performance metrics.</li>
        </ul>
        <p>We do NOT use third-party advertising cookies. We do NOT track you across other websites. We do NOT sell cookie data.</p>

        <h2>3. Managing Cookies</h2>
        <p>You can control cookies through your browser settings. Note that disabling essential cookies may prevent the Platform from functioning properly. You can also contact us at privacy@legience.com to manage your cookie preferences.</p>

        <h2>4. Third-Party Cookies</h2>
        <p>Our integrated services may set their own cookies:</p>
        <ul>
          <li><strong>Stripe:</strong> Payment processing cookies for secure transactions.</li>
          <li><strong>BoldSign:</strong> E-signature session cookies during document signing.</li>
        </ul>
        <p>We do not control third-party cookies. Please review their respective privacy policies for details.</p>

        <h2>5. Updates to This Policy</h2>
        <p>We may update this Cookie Policy from time to time. Changes will be posted on this page with an updated revision date.</p>

        <h2>6. Contact</h2>
        <p>For questions about our cookie practices: privacy@legience.com.</p>
      </div>
    </div></section>
  </>
}
