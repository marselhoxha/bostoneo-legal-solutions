import PageHero from "../components/ui/PageHero"

export default function Terms() {
  return <>
    <PageHero badge="Legal" title="Terms of Service" subtitle="Last updated: March 1, 2026. These terms govern your use of the Legience platform operated by Bostoneo Solutions LLC." />
    <section className="section"><div className="container" style={{ maxWidth: 800, margin: "0 auto" }}>
      <div className="legal-content">
        <h2>1. Acceptance of Terms</h2>
        <p>By accessing or using Legience ("the Platform"), you agree to be bound by these Terms of Service ("Terms"). If you are using the Platform on behalf of a law firm or organization, you represent that you have authority to bind that entity to these Terms. If you do not agree to these Terms, do not use the Platform.</p>

        <h2>2. Description of Service</h2>
        <p>Legience is an AI-powered legal practice management platform designed for personal injury attorneys. The Platform provides case management, AI-powered legal research, document drafting, demand letter generation, time tracking, billing, e-signatures, CRM, client portal, task management, document management, and analytics features.</p>

        <h2>3. Account Registration</h2>
        <p>To use the Platform, you must create an account and provide accurate, current, and complete information. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must notify us immediately of any unauthorized access.</p>

        <h2>4. Subscription Plans and Payment</h2>
        <ul>
          <li><strong>Plans:</strong> Starter ($99/month), Professional ($169/user/month), and Firm ($249/user/month). Annual billing available with 22% discount.</li>
          <li><strong>Payment:</strong> Subscription fees are billed monthly or annually in advance via Stripe. All fees are non-refundable except as required by law.</li>
          <li><strong>Price Changes:</strong> We may change pricing with 30 days' notice. Early access founding members retain their locked-in pricing.</li>
          <li><strong>Cancellation:</strong> You may cancel at any time. Your account remains active until the end of the current billing period.</li>
        </ul>

        <h2>5. Your Data</h2>
        <p><strong>You own your data.</strong> All case data, client information, documents, and other content you upload to or create within the Platform remains your property. We claim no ownership rights over your data. You grant us a limited license to host, process, and display your data solely to provide the Platform's services.</p>

        <h2>6. AI Features</h2>
        <ul>
          <li><strong>AI-Assisted, Not AI-Replaced:</strong> LegiSearch™, LegiDraft™, and LegiLyze™ are tools to assist your legal practice. They do not constitute legal advice. You are responsible for reviewing, verifying, and approving all AI-generated content before use.</li>
          <li><strong>Citation Verification:</strong> While we verify AI-generated citations, you should independently confirm all case citations and legal references before relying on them in legal proceedings.</li>
          <li><strong>Zero-Knowledge:</strong> Your data is not used for AI model training. See our Privacy Policy for details.</li>
        </ul>

        <h2>7. Acceptable Use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use the Platform for any unlawful purpose or to violate any applicable laws or regulations.</li>
          <li>Attempt to gain unauthorized access to the Platform or other user accounts.</li>
          <li>Interfere with or disrupt the Platform's infrastructure.</li>
          <li>Reverse engineer, decompile, or disassemble any part of the Platform.</li>
          <li>Use the Platform to process data for purposes unrelated to legal practice management.</li>
          <li>Share account credentials or allow unauthorized individuals to access the Platform.</li>
        </ul>

        <h2>8. Intellectual Property</h2>
        <p>The Platform, including its design, code, features, and documentation, is owned by Bostoneo Solutions LLC and protected by intellectual property laws. "Legience," "LegiSpace," "LegiSearch," "LegiDraft," "LegiLyze," "LegiPI," "LegiMed," "LegiValue," and "LegiTrack" are trademarks of Bostoneo Solutions LLC.</p>

        <h2>9. Limitation of Liability</h2>
        <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, BOSTONEO SOLUTIONS LLC SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, OR USE, ARISING FROM YOUR USE OF THE PLATFORM. Our total liability shall not exceed the amount you paid us in the 12 months preceding the claim.</p>

        <h2>10. Indemnification</h2>
        <p>You agree to indemnify and hold harmless Bostoneo Solutions LLC from any claims, damages, or expenses arising from your use of the Platform, your violation of these Terms, or your violation of any third-party rights.</p>

        <h2>11. Termination</h2>
        <p>Either party may terminate this agreement at any time. Upon termination, your data will be preserved for 30 days, after which it will be permanently deleted. You may request data export before termination.</p>

        <h2>12. Governing Law</h2>
        <p>These Terms are governed by the laws of the Commonwealth of Massachusetts, without regard to conflict of laws principles. Any disputes shall be resolved in the courts of Suffolk County, Massachusetts.</p>

        <h2>13. Changes to Terms</h2>
        <p>We may modify these Terms with 30 days' notice via email. Continued use after the notice period constitutes acceptance of the updated Terms.</p>

        <h2>14. Contact</h2>
        <p>For questions about these Terms: legal@legience.com or Bostoneo Solutions LLC, Malden, MA 02148.</p>
      </div>
    </div></section>
  </>
}
