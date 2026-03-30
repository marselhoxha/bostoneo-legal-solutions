import PageHero from "../components/ui/PageHero"
import SectionHead from "../components/ui/SectionHead"

export default function ABAEthics() {
  return <>
    <PageHero badge="Compliance" title="ABA Ethics &" gradient="AI Compliance" subtitle="How Legience addresses ethical obligations under ABA Formal Opinion 512, applicable Rules of Professional Conduct, and emerging AI ethics standards for legal practice." />
    <section className="section"><div className="container" style={{ maxWidth: 800, margin: "0 auto" }}>
      <div className="legal-content reveal">
        <h2>ABA Formal Opinion 512: Generative AI Tools</h2>
        <p>In July 2024, the American Bar Association issued Formal Opinion 512, providing guidance on attorneys' ethical obligations when using generative AI tools. Legience is designed to help attorneys comply with every requirement outlined in this opinion.</p>

        <h2>1. Competence (Rule 1.1)</h2>
        <p>Attorneys must understand the AI tools they use sufficiently to assess their reliability and limitations.</p>
        <div style={{ background: "var(--accent-subtle)", borderRadius: 12, padding: 20, margin: "16px 0" }}>
          <strong style={{ color: "var(--accent)" }}>How Legience Helps:</strong>
          <ul>
            <li>Every AI-generated response includes verified citations that link to source material.</li>
            <li>AI clearly labels its outputs as "AI-Generated — Review Required" to prompt attorney review.</li>
            <li>We provide documentation on how our AI works, its limitations, and best practices for use.</li>
            <li>LegiSearch™ includes confidence indicators to help attorneys assess reliability.</li>
          </ul>
        </div>

        <h2>2. Confidentiality (Rule 1.6)</h2>
        <p>Attorneys must ensure that client information shared with AI tools remains confidential.</p>
        <div style={{ background: "var(--accent-subtle)", borderRadius: 12, padding: 20, margin: "16px 0" }}>
          <strong style={{ color: "var(--accent)" }}>How Legience Helps:</strong>
          <ul>
            <li><strong>Secure AI Processing:</strong> AI features powered through AWS Bedrock under our Business Associate Agreement (BAA).</li>
            <li><strong>No AI Training:</strong> Attorney-client data is never used to train, fine-tune, or improve any AI model.</li>
            <li><strong>AES-256 Encryption:</strong> All data encrypted at rest and in transit.</li>
            <li><strong>US-Only Processing:</strong> All data remains in AWS US-East (Ohio). No offshore processing.</li>
            <li><strong>Conversation Management:</strong> AI conversation history is stored in our database for continuity. You can delete individual conversations at any time.</li>
          </ul>
        </div>

        <h2>3. Supervision (Rules 5.1 and 5.3)</h2>
        <p>Attorneys must supervise AI outputs as they would supervise a junior associate or paralegal.</p>
        <div style={{ background: "var(--accent-subtle)", borderRadius: 12, padding: 20, margin: "16px 0" }}>
          <strong style={{ color: "var(--accent)" }}>How Legience Helps:</strong>
          <ul>
            <li>All AI outputs require explicit attorney review before being used or sent to clients.</li>
            <li>AI-generated documents are saved as drafts, not final versions, requiring manual approval.</li>
            <li>LegiDraft™ demand letters include a review checklist before submission.</li>
            <li>Audit logs track who reviewed and approved every AI-generated document.</li>
          </ul>
        </div>

        <h2>4. Communication (Rule 1.4)</h2>
        <p>Attorneys should communicate with clients about the use of AI in their matters when appropriate.</p>
        <div style={{ background: "var(--accent-subtle)", borderRadius: 12, padding: 20, margin: "16px 0" }}>
          <strong style={{ color: "var(--accent)" }}>How Legience Helps:</strong>
          <ul>
            <li>Our platform includes optional AI disclosure language for engagement letters and retainer agreements.</li>
            <li>Template AI disclosure clauses are available in the document library.</li>
            <li>Client Portal can display a notice about AI-assisted case management if your firm chooses to include one.</li>
          </ul>
        </div>

        <h2>5. Billing (Rule 1.5)</h2>
        <p>Attorneys must ensure that billing for AI-assisted work is reasonable and transparent.</p>
        <div style={{ background: "var(--accent-subtle)", borderRadius: 12, padding: 20, margin: "16px 0" }}>
          <strong style={{ color: "var(--accent)" }}>How Legience Helps:</strong>
          <ul>
            <li>Time tracking clearly distinguishes between attorney time and AI-assisted time.</li>
            <li>AI-generated documents include metadata showing generation time vs. review time.</li>
            <li>Billing reports can flag AI-assisted entries for review before invoicing.</li>
          </ul>
        </div>

        <h2>State-Specific Compliance</h2>
        <p>In addition to ABA guidance, Legience addresses jurisdiction-specific requirements:</p>
        <ul>
          <li><strong>201 CMR 17.00:</strong> Full compliance with the Massachusetts Standards for the Protection of Personal Information, including Written Information Security Program (WISP), risk assessments, and breach notification.</li>
          <li><strong>applicable Rules of Professional Conduct:</strong> Our platform is designed to support compliance with MRPC Rules 1.1, 1.6, 1.15, 5.1, and 5.3 as they apply to AI-assisted legal practice.</li>
          <li><strong>Conflict Checking:</strong> Automated conflict of interest checking compliant with MRPC Rules 1.7, 1.9, and 1.10 — multi-type detection, resolution workflows, and waiver documentation.</li>
        </ul>

        <h2>Our Commitment</h2>
        <p>Legience is built by people who understand that attorney-client privilege is sacred and that ethical AI use requires more than marketing promises — it requires architectural decisions. Our secure AI processing through AWS Bedrock, encryption standards, and audit capabilities are designed to make ethical AI compliance the default, not an afterthought.</p>

        <h2>Questions?</h2>
        <p>For questions about our ethics compliance: ethics@legience.com or legal@legience.com.</p>
      </div>
    </div></section>
  </>
}
