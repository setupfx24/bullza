import LandingHeader from '@/components/landing/LandingHeader'
import LandingFooter from '@/components/landing/LandingFooter'
import { Phone, Mail, MessageCircle, MapPin, Clock } from 'lucide-react'
import { Section, SectionHeading, PageHero } from '@/marketing/components'
import { BRAND_NAME, BRAND_SUPPORT_EMAIL } from '@/lib/brand'
import '@/marketing/tokens.css'

/**
 * Standalone /contact. Restyled onto the shared marketing design system —
 * the body is wrapped in `.mk` so it picks up the marketing tokens (this
 * route sits outside the (landing) group, which normally applies them).
 *
 * The enquiry form keeps every field, label, placeholder, option and the
 * submit control exactly as before; only the visual treatment changed.
 *
 * LandingHeader / LandingFooter keep their own existing styling; they are
 * shared chrome outside this restyle's scope.
 */

export const metadata = { title: `Contact Us — ${BRAND_NAME}` }

/** Shared field styling — one source of truth for every control below. */
const FIELD_STYLE: React.CSSProperties = {
  background: 'var(--mk-surface-2)',
  border: '1px solid var(--mk-line)',
  borderRadius: 'var(--mk-radius-sm)',
  color: 'var(--mk-text)',
  fontSize: 'var(--mk-text-sm)',
  width: '100%',
  padding: '0.75rem 1rem',
  outline: 'none',
}

const LABEL_STYLE: React.CSSProperties = {
  display: 'block',
  marginBottom: 'var(--mk-space-2)',
  fontSize: 'var(--mk-text-sm)',
  color: 'var(--mk-text-muted)',
}

const CONTACT_METHODS = [
  { icon: Phone, title: 'WhatsApp', value: '+44 7737 119978', desc: 'Available 24/7' },
  { icon: Mail, title: 'Email', value: BRAND_SUPPORT_EMAIL, desc: 'Response within 1 hour' },
  { icon: MessageCircle, title: 'Live Chat', value: 'Chat with us', desc: 'Instant support' },
]

const OFFICES = [
  {
    city: 'Scotland Office',
    address: `${BRAND_NAME} Office 23US, 18 Young St, UNIT LGE 1/1, Edinburgh EH2 4JB, Scotland`,
    hours: 'Mon-Fri: 9:00 AM - 6:00 PM GMT',
  },
  {
    city: 'St. Lucia Office',
    address: 'Rodney Bay, Gros Islet, St. Lucia',
    hours: 'Mon-Fri: 9:00 AM - 5:00 PM AST',
  },
]

export default function ContactPage() {
  return (
    <div className="min-h-screen">
      <LandingHeader />

      <div className="mk">
        <PageHero
          kicker="Contact"
          title={<>Get in Touch<br /><span style={{ color: 'var(--mk-accent)' }}>We&apos;re Here to Help</span></>}
          lead="Have questions? Our support team is available 24/7 to assist you."
        />

        {/* Contact Methods */}
        <Section raised>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {CONTACT_METHODS.map(({ icon: Icon, title, value, desc }) => (
              <article key={title} className="mk-card mk-card--hover text-center flex flex-col items-center gap-3">
                <span
                  className="inline-flex h-14 w-14 items-center justify-center rounded-xl shrink-0"
                  style={{ background: 'var(--mk-accent-soft)', color: 'var(--mk-accent)' }}
                >
                  <Icon className="h-6 w-6" />
                </span>
                <h3 className="mk-h3">{title}</h3>
                <p className="font-bold break-words" style={{ color: 'var(--mk-accent)' }}>{value}</p>
                <p className="mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>{desc}</p>
              </article>
            ))}
          </div>

          {/* Contact Form */}
          <div className="mk-card max-w-2xl mx-auto mt-12">
            <h2 className="mk-h2 mb-6">Send us a Message</h2>
            <form className="flex flex-col gap-5">
              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <label style={LABEL_STYLE}>First Name</label>
                  <input type="text" style={FIELD_STYLE} placeholder="John" />
                </div>
                <div>
                  <label style={LABEL_STYLE}>Last Name</label>
                  <input type="text" style={FIELD_STYLE} placeholder="Doe" />
                </div>
              </div>
              <div>
                <label style={LABEL_STYLE}>Email</label>
                <input type="email" style={FIELD_STYLE} placeholder="john@example.com" />
              </div>
              <div>
                <label style={LABEL_STYLE}>Subject</label>
                <select style={FIELD_STYLE}>
                  <option>General Inquiry</option>
                  <option>Technical Support</option>
                  <option>Account Issues</option>
                  <option>Partnership</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label style={LABEL_STYLE}>Message</label>
                <textarea rows={5} style={{ ...FIELD_STYLE, resize: 'none' }} placeholder="How can we help you?" />
              </div>
              <button type="submit" className="mk-btn mk-btn--primary w-full">
                Send Message
              </button>
            </form>
          </div>
        </Section>

        {/* Office Locations */}
        <Section>
          <SectionHeading kicker="Offices" title="Our Offices" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-12">
            {OFFICES.map(({ city, address, hours }) => (
              <article key={city} className="mk-card mk-card--hover flex flex-col gap-4">
                <h3 className="mk-h3">{city}</h3>
                <div className="flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 mt-0.5 shrink-0" style={{ color: 'var(--mk-accent)' }} />
                    <p className="mk-body">{address}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 shrink-0" style={{ color: 'var(--mk-accent)' }} />
                    <p className="mk-body">{hours}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </Section>
      </div>

      <LandingFooter />
    </div>
  )
}
