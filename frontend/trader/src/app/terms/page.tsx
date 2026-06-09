import { FileText } from 'lucide-react'

export const metadata = { title: 'Terms and Conditions — SwisDex' }

/**
 * Terms & Conditions — content sourced from the client-supplied PDF
 * "terms and condition.pdf" delivered 2026-06-09. Wording preserved
 * verbatim from the legal text; only the formatting + numbering follows
 * the existing SwisDex page layout. The Risk Disclaimer block at the
 * bottom is kept as the platform's standard trader-facing warning.
 */
export default function TermsPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <div className="max-w-3xl mx-auto px-6 lg:px-8 py-16">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-[#2962FF]/10 flex items-center justify-center">
            <FileText className="w-5 h-5 text-[#2962FF]" />
          </div>
          <h1 className="text-3xl font-bold text-text-primary">Terms and Conditions</h1>
        </div>

        <p className="text-lg font-semibold text-text-primary mt-8 mb-1">Swisdex — Terms and Conditions</p>
        <p className="text-sm text-text-secondary mb-10">Last updated: June 2026</p>

        <div className="space-y-8">
          <Section title="1. Acceptance of Terms">
            <p>
              <b className="text-text-primary">1.1</b> By accessing or using any services, products, platforms, or tools offered by Swisdex (hereinafter referred to as &quot;Swisdex&quot;), you agree to be bound by these Terms &amp; Conditions. If you do not agree with any part of these terms, you should not access or use any Swisdex services.
            </p>
            <p>
              <b className="text-text-primary">1.2</b> These Terms &amp; Conditions apply to all users, clients, visitors, and customers of Swisdex, whether registered or unregistered. By accessing or using the platform, you acknowledge and accept these Terms &amp; Conditions.
            </p>
          </Section>

          <Section title="2. Binding Agreement">
            <p>
              <b className="text-text-primary">2.1</b> By registering for an account or using Swisdex services, you enter into a legally binding agreement with Swisdex.
            </p>
            <p>
              <b className="text-text-primary">2.2</b> You acknowledge that your continued use of Swisdex services constitutes acceptance of these Terms &amp; Conditions and any additional policies, agreements, disclosures, or legal documentation published by Swisdex.
            </p>
          </Section>

          <Section title="3. Eligibility and Age Requirement">
            <p>
              <b className="text-text-primary">3.1</b> To use Swisdex services, you must be at least eighteen (18) years old or the legal age required to enter into a binding agreement in your jurisdiction.
            </p>
            <p>
              <b className="text-text-primary">3.2</b> By opening an account, you confirm that all information provided is accurate and that you meet the eligibility requirements.
            </p>
            <p>
              <b className="text-text-primary">3.3</b> Providing false information regarding your identity, age, or residency is strictly prohibited and may result in immediate account suspension or termination.
            </p>
          </Section>

          <Section title="4. Trading Risk Disclosure">
            <p>
              <b className="text-text-primary">4.1</b> Forex, commodities, cryptocurrencies, indices, and CFD trading involve substantial risk and may not be suitable for all investors.
            </p>
            <p>
              <b className="text-text-primary">4.2</b> You acknowledge that you may lose part or all of your deposited funds and that past performance does not guarantee future results.
            </p>
            <p>
              <b className="text-text-primary">4.3</b> Swisdex does not guarantee profits, returns, or successful trading outcomes unless explicitly stated under a specific promotional program governed by separate terms.
            </p>
            <p>
              <b className="text-text-primary">4.4</b> Clients are solely responsible for their trading decisions and investment activities.
            </p>
          </Section>

          <Section title="5. Account Registration and Security">
            <p>
              <b className="text-text-primary">5.1</b> Clients must provide accurate, complete, and up-to-date information during registration.
            </p>
            <p>
              <b className="text-text-primary">5.2</b> You are responsible for maintaining the confidentiality of your account credentials, passwords, and security information.
            </p>
            <p>
              <b className="text-text-primary">5.3</b> Swisdex shall not be liable for losses arising from unauthorized access resulting from your failure to protect account credentials.
            </p>
          </Section>

          <Section title="6. Deposits and Withdrawals">
            <p>
              <b className="text-text-primary">6.1</b> Clients may fund their accounts using payment methods approved by Swisdex.
            </p>
            <p>
              <b className="text-text-primary">6.2</b> Withdrawal requests are subject to verification, compliance checks, and anti-money laundering (AML) procedures.
            </p>
            <p>
              <b className="text-text-primary">6.3</b> Swisdex reserves the right to request additional identification documents before processing withdrawals.
            </p>
            <p>
              <b className="text-text-primary">6.4</b> Processing times may vary depending on the selected payment method and verification requirements.
            </p>
          </Section>

          <Section title="7. Bonuses, Promotions, and Trade Insurance">
            <p>
              <b className="text-text-primary">7.1</b> Any bonuses, deposit promotions, referral rewards, trade insurance programs, or special offers are subject to separate promotional terms.
            </p>
            <p>
              <b className="text-text-primary">7.2</b> Swisdex reserves the right to modify, suspend, or cancel promotional programs at any time without prior notice.
            </p>
            <p>
              <b className="text-text-primary">7.3</b> Abuse, manipulation, arbitrage, or fraudulent use of promotional programs may result in cancellation of rewards and account restrictions.
            </p>
          </Section>

          <Section title="8. Referral and Introducing Broker (IB) Program">
            <p>
              <b className="text-text-primary">8.1</b> Participants in the Referral Program and IB Program must comply with all applicable laws and ethical marketing standards.
            </p>
            <p>
              <b className="text-text-primary">8.2</b> Swisdex reserves the right to adjust, withhold, or revoke commissions generated through fraudulent, misleading, or prohibited activities.
            </p>
            <p>
              <b className="text-text-primary">8.3</b> Referral and IB commissions are subject to qualification requirements outlined in the relevant program documentation.
            </p>
          </Section>

          <Section title="9. Anti-Money Laundering (AML) and Compliance">
            <p>
              <b className="text-text-primary">9.1</b> Swisdex maintains strict AML and Know Your Customer (KYC) procedures.
            </p>
            <p>
              <b className="text-text-primary">9.2</b> Clients may be required to provide identification documents, proof of address, and other verification materials.
            </p>
            <p>
              <b className="text-text-primary">9.3</b> Swisdex reserves the right to suspend or terminate accounts involved in suspicious, illegal, or non-compliant activities.
            </p>
          </Section>

          <Section title="10. Limitation of Liability">
            <p>
              <b className="text-text-primary">10.1</b> Swisdex shall not be liable for any indirect, incidental, consequential, or special damages arising from the use of its services.
            </p>
            <p>
              <b className="text-text-primary">10.2</b> Swisdex is not responsible for losses resulting from market volatility, technical failures, internet disruptions, third-party service interruptions, or force majeure events.
            </p>
          </Section>

          <Section title="11. Suspension and Termination">
            <p>
              <b className="text-text-primary">11.1</b> Swisdex reserves the right to suspend, restrict, or terminate any account that violates these Terms &amp; Conditions or applicable regulations.
            </p>
            <p>
              <b className="text-text-primary">11.2</b> Upon termination, clients must immediately cease using Swisdex services.
            </p>
          </Section>

          <Section title="12. Amendments">
            <p>
              <b className="text-text-primary">12.1</b> Swisdex reserves the right to modify, update, or replace these Terms &amp; Conditions at any time.
            </p>
            <p>
              <b className="text-text-primary">12.2</b> Continued use of Swisdex services after updates become effective constitutes acceptance of the revised Terms &amp; Conditions.
            </p>
          </Section>

          <Section title="13. Governing Law">
            <p>
              <b className="text-text-primary">13.1</b> These Terms &amp; Conditions shall be governed by and interpreted in accordance with the laws applicable to the jurisdiction under which Swisdex operates.
            </p>
            <p>
              <b className="text-text-primary">13.2</b> Any disputes arising from these Terms &amp; Conditions shall be subject to the exclusive jurisdiction of the relevant courts or arbitration authorities.
            </p>
          </Section>

          <Section title="14. Contact Information">
            <p>For any questions, support requests, or concerns regarding these Terms &amp; Conditions, please contact:</p>
            <div
              className="rounded-xl p-4 mt-3 text-sm space-y-1"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}
            >
              <p className="font-semibold text-text-primary">Swisdex Support Team</p>
              <p>Email: <a href="mailto:support@swisdex.com" className="text-[#55a630] hover:underline">support@swisdex.com</a></p>
            </div>
            <p className="mt-4">
              By registering for an account and using Swisdex services, you confirm that you have read, understood, and agreed to these Terms &amp; Conditions.
            </p>
          </Section>

          {/* Risk Disclaimer — kept as the platform's standard warning */}
          <div
            className="rounded-xl p-6"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}
          >
            <h2 className="text-lg font-bold text-text-primary mb-3">Risk Disclaimer</h2>
            <p className="text-text-secondary text-sm leading-relaxed">
              Trading foreign exchange (forex) and other leveraged financial products carries a high level of risk and may not be suitable for all investors. Leverage can work both for and against you — while it amplifies potential profits, it equally amplifies potential losses. You could sustain a loss of some or all of your initial investment and should not invest money that you cannot afford to lose. You should be aware of all the risks associated with leveraged trading and seek independent financial advice if you have any doubts. Past performance is not indicative of future results.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-lg font-bold text-text-primary mb-3">{title}</h2>
      <div className="text-text-secondary text-sm leading-relaxed space-y-2">{children}</div>
    </div>
  )
}
