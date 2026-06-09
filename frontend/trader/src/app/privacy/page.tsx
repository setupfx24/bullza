import LandingHeader from '@/components/landing/LandingHeader'
import LandingFooter from '@/components/landing/LandingFooter'

export const metadata = { title: 'Privacy Policy — SwisDex' }

/**
 * Privacy Policy — content sourced from the client-supplied PDF
 * "privcy policy.pdf" delivered 2026-06-09. Wording preserved verbatim
 * from the legal text; only the formatting + section structure follows
 * the existing SwisDex page layout (white card, gray prose, bullet
 * lists). Re-run the same rewrite if legal sends a revised PDF.
 */
export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <LandingHeader />

      <section className="bg-gradient-to-b from-white to-gray-50 pt-16 pb-12">
        <div className="max-w-4xl mx-auto px-6 lg:px-8">
          <h1 className="text-4xl font-extrabold text-gray-900 mb-2">Privacy Policy</h1>
          <p className="text-gray-500">Last updated: June 2026</p>
        </div>
      </section>

      <section className="py-12 bg-white">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 space-y-10">

          <Section title="Privacy Policy of Swisdex">
            <p>
              At Swisdex (&quot;Swisdex&quot;, &quot;Company&quot;, &quot;we&quot;, &quot;our&quot;, or &quot;us&quot;), protecting your privacy and personal information is one of our highest priorities. We are committed to collecting, processing, storing, and protecting your personal data responsibly and in accordance with applicable data protection laws and industry best practices.
            </p>
            <p>
              By accessing our website, opening an account, or using any Swisdex products and services, you consent to the collection and processing of your personal information as described in this Privacy Policy.
            </p>
          </Section>

          <Section title="1. Privacy Protection">
            <p>
              Swisdex maintains appropriate administrative, technical, and organizational measures designed to protect personal information from unauthorized access, misuse, loss, alteration, or disclosure.
            </p>
            <p>
              Client information is stored securely and accessed only by authorized personnel who require such information for legitimate business, compliance, or support purposes.
            </p>
            <p>
              While we implement reasonable security safeguards, no method of transmission over the internet or electronic storage system can be guaranteed to be completely secure.
            </p>
            <p>
              Clients are responsible for maintaining the confidentiality of their account credentials, passwords, and authentication devices.
            </p>
          </Section>

          <Section title="2. Personal Information We Collect">
            <p>When opening an account or using Swisdex services, we may collect the following information:</p>
            <Sub title="Identity Information">
              <List items={[
                'Full Name',
                'Date of Birth',
                'Nationality',
                'Government Identification Details',
                'Passport or National ID Copies',
                'Selfie Verification Images',
              ]} />
            </Sub>
            <Sub title="Contact Information">
              <List items={[
                'Email Address',
                'Telephone Number',
                'Residential Address',
              ]} />
            </Sub>
            <Sub title="Financial Information">
              <List items={[
                'Source of Funds Information',
                'Cryptocurrency Wallet Information',
                'Deposit and Withdrawal Records',
                'Transaction History',
              ]} />
            </Sub>
            <Sub title="Technical Information">
              <List items={[
                'IP Address',
                'Browser Information',
                'Device Information',
                'Operating System Information',
                'Website Usage Data',
              ]} />
            </Sub>
            <Sub title="Trading Information">
              <List items={[
                'Trading Activity',
                'Trading Preferences',
                'Account Performance',
                'Trading History',
              ]} />
            </Sub>
          </Section>

          <Section title="3. How We Use Your Personal Information">
            <p>Swisdex may process your personal information for the following purposes:</p>
            <Sub title="Account Registration and Management">
              To:
              <List items={[
                'Open and maintain trading accounts',
                'Verify identity',
                'Provide customer support',
                'Manage account security',
              ]} />
            </Sub>
            <Sub title="Compliance and Regulatory Requirements">
              To:
              <List items={[
                'Perform KYC verification',
                'Conduct AML screening',
                'Prevent fraud and financial crime',
                'Comply with legal obligations',
              ]} />
            </Sub>
            <Sub title="Service Delivery">
              To:
              <List items={[
                'Process deposits and withdrawals',
                'Facilitate trading activities',
                'Operate client accounts',
                'Provide platform functionality',
              ]} />
            </Sub>
            <Sub title="Risk Management">
              To:
              <List items={[
                'Monitor suspicious activity',
                'Protect account security',
                'Prevent abuse of promotions and bonuses',
                'Detect unauthorized transactions',
              ]} />
            </Sub>
            <Sub title="Communication">
              To:
              <List items={[
                'Respond to inquiries',
                'Send service-related notifications',
                'Deliver security alerts',
                'Provide account updates',
              ]} />
            </Sub>
            <Sub title="Marketing Communications">
              <p>Subject to applicable laws and your preferences, Swisdex may send information regarding:</p>
              <List items={[
                'New products',
                'Platform updates',
                'Promotions',
                'Educational content',
                'Market insights',
              ]} />
              <p className="mt-3">Clients may opt out of marketing communications at any time.</p>
            </Sub>
          </Section>

          <Section title="4. Legal Basis for Processing">
            <p>We process personal information based on one or more of the following legal grounds:</p>
            <Sub title="Contract Performance">
              <p>Processing necessary to provide services requested by the client.</p>
            </Sub>
            <Sub title="Legal and Regulatory Obligations">
              <p>Processing required to comply with applicable laws, AML regulations, sanctions requirements, and compliance obligations.</p>
            </Sub>
            <Sub title="Legitimate Business Interests">
              <p>Processing necessary for:</p>
              <List items={[
                'Risk management',
                'Fraud prevention',
                'Service improvement',
                'Security monitoring',
                'Internal administration',
              ]} />
            </Sub>
            <Sub title="Client Consent">
              <p>Where required by law, processing may be based on the client&apos;s consent, which may be withdrawn at any time.</p>
            </Sub>
          </Section>

          <Section title="5. KYC and AML Compliance">
            <p>Swisdex is committed to maintaining robust Know Your Customer (KYC) and Anti-Money Laundering (AML) procedures.</p>
            <p>Clients may be required to provide:</p>
            <List items={[
              'Government-issued identification',
              'Proof of address',
              'Selfie verification',
              'Source of funds documentation',
              'Additional compliance information',
            ]} />
            <p className="mt-4">
              Failure to complete verification requirements may result in account restrictions, deposit delays, or withdrawal limitations.
            </p>
          </Section>

          <Section title="6. Disclosure of Personal Information">
            <p>Swisdex does not sell client personal information.</p>
            <p>Personal information may be shared only when necessary with:</p>
            <Sub title="Service Providers">
              Including:
              <List items={[
                'Technology providers',
                'Hosting providers',
                'Payment and crypto infrastructure providers',
                'Security service providers',
              ]} />
            </Sub>
            <Sub title="Compliance and Regulatory Authorities">
              <p>Where disclosure is required by law, regulation, court order, or government request.</p>
            </Sub>
            <Sub title="Professional Advisors">
              Including:
              <List items={[
                'Legal advisors',
                'Auditors',
                'Compliance consultants',
                'Risk management providers',
              ]} />
            </Sub>
            <Sub title="Business Partners">
              <p>Only where necessary for providing services or fulfilling contractual obligations.</p>
            </Sub>
            <p className="mt-4">
              All third parties receiving personal information are expected to maintain appropriate confidentiality and security standards.
            </p>
          </Section>

          <Section title="7. Cryptocurrency Transactions">
            <p>As Swisdex operates a crypto-funded trading environment:</p>
            <List items={[
              'Deposit and withdrawal transactions may be recorded on public blockchain networks.',
              'Blockchain transactions are transparent and may be publicly visible.',
              'Swisdex cannot control information recorded on public blockchains.',
            ]} />
            <p className="mt-4">
              Clients are responsible for protecting the privacy of their own cryptocurrency wallets and addresses.
            </p>
          </Section>

          <Section title="8. Cookies and Website Analytics">
            <p>Swisdex may use:</p>
            <List items={[
              'Cookies',
              'Analytics tools',
              'Pixel tags',
              'Session tracking technologies',
            ]} />
            <p className="mt-4">These technologies help us:</p>
            <List items={[
              'Improve website performance',
              'Enhance user experience',
              'Analyze traffic patterns',
              'Detect fraud and security risks',
            ]} />
            <p className="mt-4">
              Clients may adjust browser settings to limit cookie usage, although some website functions may be affected.
            </p>
          </Section>

          <Section title="9. International Data Transfers">
            <p>Personal information may be processed or stored in countries outside the client&apos;s country of residence.</p>
            <p>
              Where international transfers occur, Swisdex will take reasonable measures to ensure that personal information receives an appropriate level of protection consistent with applicable privacy requirements.
            </p>
          </Section>

          <Section title="10. Data Retention">
            <p>Swisdex retains personal information only for as long as necessary to:</p>
            <List items={[
              'Provide services',
              'Comply with legal obligations',
              'Resolve disputes',
              'Prevent fraud',
              'Meet regulatory requirements',
            ]} />
            <p className="mt-4">
              Client records, communications, transaction histories, and verification documents may be retained for a minimum period required by applicable AML and compliance regulations.
            </p>
          </Section>

          <Section title="11. Your Rights">
            <p>Depending on applicable laws, clients may have the right to:</p>
            <Sub title="Access">
              <p>Request a copy of personal information held by Swisdex.</p>
            </Sub>
            <Sub title="Correction">
              <p>Request correction of inaccurate or incomplete information.</p>
            </Sub>
            <Sub title="Deletion">
              <p>Request deletion of personal information where legally permitted.</p>
            </Sub>
            <Sub title="Restriction">
              <p>Request limitations on certain processing activities.</p>
            </Sub>
            <Sub title="Objection">
              <p>Object to specific processing activities.</p>
            </Sub>
            <Sub title="Data Portability">
              <p>Request transfer of personal information in a structured format where applicable.</p>
            </Sub>
            <p className="mt-4">Requests may be submitted through our support team.</p>
          </Section>

          <Section title="12. Security Measures">
            <p>Swisdex implements security controls designed to protect personal information, including:</p>
            <List items={[
              'Secure data storage',
              'Access control procedures',
              'Encryption technologies where appropriate',
              'Internal compliance monitoring',
              'Security audits and reviews',
            ]} />
            <p className="mt-4">
              Despite these measures, clients should understand that no electronic system is completely immune from security risks.
            </p>
          </Section>

          <Section title="13. Legal Disclosure">
            <p>Swisdex may disclose personal information when required to:</p>
            <List items={[
              'Comply with legal obligations',
              'Respond to lawful requests',
              'Protect company rights',
              'Prevent fraud',
              'Investigate suspicious activity',
              'Enforce contractual agreements',
            ]} />
            <p className="mt-4">Such disclosures will only occur when legally justified.</p>
          </Section>

          <Section title="14. Changes to This Privacy Policy">
            <p>Swisdex reserves the right to modify this Privacy Policy at any time.</p>
            <p>Updated versions will become effective upon publication on the Swisdex website.</p>
            <p>
              Continued use of Swisdex services following any update constitutes acceptance of the revised Privacy Policy.
            </p>
          </Section>

          <Section title="15. Contact Information">
            <p>For questions, concerns, requests, or complaints regarding this Privacy Policy, please contact:</p>
            <ContactBox team="Support Team" email="support@swisdex.com" />
            <p className="mt-6">
              Swisdex is committed to protecting client privacy and maintaining the highest standards of data security and confidentiality.
            </p>
          </Section>

        </div>
      </section>

      <LandingFooter />
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-4">{title}</h2>
      <div className="text-gray-600 leading-relaxed space-y-3">{children}</div>
    </div>
  )
}

function Sub({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h3 className="font-semibold text-gray-800 mb-2">{title}</h3>
      <div className="text-gray-600 space-y-2">{children}</div>
    </div>
  )
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="list-disc list-inside space-y-1.5 mt-2 text-gray-600">
      {items.map((item) => <li key={item}>{item}</li>)}
    </ul>
  )
}

function ContactBox({ team, email }: { team: string; email: string }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mt-4 text-sm space-y-1">
      <p className="font-semibold text-gray-900">Swisdex {team}</p>
      <p className="text-gray-600">Email: <a href={`mailto:${email}`} className="text-[#55a630] hover:underline">{email}</a></p>
    </div>
  )
}
