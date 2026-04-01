import PageHero from "../components/ui/PageHero"

export default function Privacy() {
  return <>
    <PageHero badge="Legal" title="Privacy Policy" subtitle="Last updated: March 30, 2026. This policy describes how Legience by Bostoneo Solutions LLC collects, uses, and protects your personal information." />
    <section className="section"><div className="container" style={{ maxWidth: 800, margin: "0 auto" }}>
      <div className="legal-content">
        <h2>1. Information We Collect</h2>
        <h3>1.1 Information You Provide</h3>
        <p>When you create an account, contact us, or use our platform, we collect information you voluntarily provide, including:</p>
        <ul>
          <li><strong>Account Information:</strong> Name, email address, firm name, bar number, professional title, and billing information.</li>
          <li><strong>Case Data:</strong> Case details, client information, documents, notes, billing entries, and other data you enter into the platform.</li>
          <li><strong>Communications:</strong> Messages you send through the platform, support requests, and feedback.</li>
          <li><strong>Payment Information:</strong> Credit card and billing details processed securely through Stripe. We do not store full credit card numbers on our servers.</li>
        </ul>

        <h3>1.2 Information Collected Automatically</h3>
        <p>When you use our platform, we automatically collect:</p>
        <ul>
          <li><strong>Usage Data:</strong> Pages visited, features used, time spent, and actions taken within the platform.</li>
          <li><strong>Device Information:</strong> Browser type, operating system, IP address, and device identifiers.</li>
          <li><strong>Cookies:</strong> See our Cookie Policy for details on how we use cookies and similar technologies.</li>
        </ul>

        <h2>2. How We Use Your Information</h2>
        <p>We use your information to:</p>
        <ul>
          <li>Provide, maintain, and improve the Legience platform and its features.</li>
          <li>Process payments and manage your account.</li>
          <li>Send transactional communications (account verification, billing notices, security alerts).</li>
          <li>Provide customer support and respond to your requests.</li>
          <li>Analyze platform usage to improve features and user experience.</li>
          <li>Comply with legal obligations, including Massachusetts 201 CMR 17.00.</li>
        </ul>

        <h2>3. How We Protect Your Information</h2>
        <p>We implement robust security measures to protect your data:</p>
        <ul>
          <li><strong>Encryption:</strong> AES-256 encryption at rest and TLS encryption in transit for all connections.</li>
          <li><strong>201 CMR 17.00:</strong> Our security practices are designed to meet the requirements of Massachusetts Standards for the Protection of Personal Information.</li>
          <li><strong>US-Only Data Residency:</strong> All data stored in AWS US-East. No offshore processing.</li>
          <li><strong>Role-Based Access:</strong> Configurable permissions ensure users only access data relevant to their role.</li>
          <li><strong>Audit Logs:</strong> Comprehensive logs of access, modification, and export actions across the platform.</li>
        </ul>

        <h2>4. AI and Your Data</h2>
        <p><strong>AI Data Protection:</strong> When you use LegiSearch™, LegiDraft™, or LegiLyze™:</p>
        <ul>
          <li>AI queries are processed through AWS Bedrock, which operates under our AWS Business Associate Agreement (BAA) with encryption at rest and in transit.</li>
          <li>Your data is <strong>never</strong> used to train, fine-tune, or improve any AI model.</li>
          <li>AI conversation history is stored in our database to provide continuity features. You can delete conversations at any time from within the platform.</li>
          <li>We do not share your data with AI providers for any purpose other than processing your requests.</li>
        </ul>

        <h2>5. Data Sharing</h2>
        <p>We do not sell your personal information. We share data only with:</p>
        <ul>
          <li><strong>Service Providers:</strong> Stripe (payments), BoldSign (e-signatures), Twilio (SMS), and AWS (hosting and AI processing via Bedrock) — each bound by applicable service agreements and data protection terms.</li>
          <li><strong>Legal Requirements:</strong> When required by law, subpoena, or court order.</li>
          <li><strong>Your Direction:</strong> When you explicitly authorize sharing (e.g., sending documents to clients via the Client Portal).</li>
        </ul>

        <h2>6. Data Retention and Deletion</h2>
        <p>We retain your data for as long as your account is active. Upon account termination:</p>
        <ul>
          <li>Your data is preserved for 90 days to allow reactivation or data export.</li>
          <li>After 90 days, all data is permanently and irreversibly deleted.</li>
          <li>You may request immediate deletion at any time by contacting privacy@legience.com.</li>
        </ul>

        <h2>7. Your Rights</h2>
        <p>You have the right to:</p>
        <ul>
          <li>Access, correct, or delete your personal information.</li>
          <li>Export your data in standard formats (CSV, PDF).</li>
          <li>Opt out of non-essential communications.</li>
          <li>Request information about how your data is processed.</li>
        </ul>

        <h2>8. Massachusetts Residents</h2>
        <p>If you are a Massachusetts resident, you have additional rights under applicable state laws Chapter 93H and 201 CMR 17.00, including the right to know what personal information we hold about you and the right to request deletion.</p>

        <h2>9. Children's Privacy</h2>
        <p>Legience is not intended for individuals under the age of 18. We do not knowingly collect personal information from children.</p>

        <h2>10. Changes to This Policy</h2>
        <p>We may update this policy from time to time. We will notify you of material changes via email or in-platform notification at least 30 days before the changes take effect.</p>

        <h2>11. Contact Us</h2>
        <p>For privacy-related questions or requests:</p>
        <ul>
          <li><strong>Email:</strong> privacy@legience.com</li>
          <li><strong>Mail:</strong> Bostoneo Solutions LLC, Malden, MA 02148</li>
        </ul>
      </div>
    </div></section>
  </>
}
