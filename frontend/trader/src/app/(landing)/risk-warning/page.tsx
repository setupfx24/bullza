'use client';

/**
 * Risk Warning — public legal page.
 *
 * Surfaces the same core warning copy already shown in the Footer
 * Risk Warning callout, expanded into a full document. This sits
 * alongside /risk (the deeper Risk Disclaimer) and is linked from
 * the footer 'Legal documents' row.
 */
import Link from 'next/link';
import { TriangleAlert, ArrowUpRight, ShieldAlert, Mail } from 'lucide-react';
import { BannerPlaceholder } from '@/home/components/BannerPlaceholder';
import { BRAND_NAME, BRAND_SUPPORT_EMAIL } from '@/lib/brand';

const SECTIONS = [
  {
    h: '1. General Risk Warning',
    body: `Please note that forex trading and trading in other leveraged products involves a significant level of risk and is not suitable for all investors. Trading in financial instruments may result in losses as well as profits, and your losses can be greater than your initial invested capital. Before undertaking any such transactions, you should ensure that you fully understand the risks involved and seek independent advice if necessary. ${BRAND_NAME} does not provide investment advice.`,
  },
  {
    h: '2. Leverage Risk',
    body: 'Leverage allows a trader to control a position larger than the deposited margin and can magnify both profits and losses. A small adverse market move can result in losses that exceed the deposited margin. Clients are advised to size positions appropriately and use stop-loss orders.',
  },
  {
    h: '3. Market Volatility',
    body: 'Forex, CFD, indices, commodity, and cryptocurrency markets can move sharply due to economic releases, geopolitical events, central-bank actions, or sudden liquidity changes. Slippage, requotes, gapping, and price spikes may occur, particularly during low-liquidity hours and around scheduled news events.',
  },
  {
    h: '4. Cryptocurrency-Specific Risks',
    body: 'Cryptocurrency trading carries additional risks including but not limited to:',
    list: [
      'Extreme intraday volatility',
      'Regulatory uncertainty in many jurisdictions',
      'Blockchain network congestion, fee spikes, or temporary outages',
      'Smart-contract, custody, and exchange-platform risk',
      'Irreversibility of on-chain transactions',
    ],
    trailing: 'Past price performance is not indicative of future results.',
  },
  {
    h: '5. Liquidity Risk',
    body: 'During periods of low liquidity, some instruments may be difficult to enter or exit at the displayed price. Spreads may widen materially, and orders may be filled at prices significantly different from the price shown at the time of order placement.',
  },
  {
    h: '6. Counterparty & Platform Risk',
    body: `Trades placed on the ${BRAND_NAME} platform are subject to the operational performance of the platform and its third-party liquidity providers. Internet connectivity, platform outages, hardware faults, and force-majeure events may temporarily prevent the execution or modification of orders.`,
  },
  {
    h: '7. Bonus & Promotion Risks',
    body: 'Promotional bonuses, deposit matches, referral rewards, and similar offers are subject to their own terms. Bonus equity is absorbed by losing trades before deposited capital and is generally non-withdrawable in isolation. Misuse of bonuses may result in bonus revocation, account restrictions, or closure.',
  },
  {
    h: '8. Regulatory & Jurisdictional Risk',
    body: `Services may be restricted, modified, or withdrawn in your jurisdiction at any time due to changes in local laws or regulatory guidance. See our Restricted Countries page for the current list of jurisdictions where ${BRAND_NAME} services are not available.`,
  },
  {
    h: '9. No Investment Advice',
    body: `Information provided on the ${BRAND_NAME} website, the trading platform, or through any ${BRAND_NAME} communication channel is for general informational purposes only and does not constitute investment, financial, tax, or legal advice. Clients should consult independent professional advisers before making any trading decision.`,
  },
  {
    h: '10. Acknowledgement',
    body: `By opening and funding a ${BRAND_NAME} account you confirm that you have read, understood, and accept this Risk Warning, alongside our Terms & Conditions, Privacy Policy, and Risk Disclaimer. You acknowledge that you are trading at your own risk.`,
  },
];

export default function RiskWarningPage() {
  return (
    <main className="min-h-screen" style={{ background: '#08090b', color: '#f5f5f5' }}>
      <BannerPlaceholder
        title="Risk Warning"
        tagline="Trading carries a high level of risk. Read carefully before you fund an account."
      />

      {/* Top alert — highlighted warning above the section list */}
      <section className="mx-auto max-w-[840px] px-[var(--gutter)] pt-10 pb-2">
        <div
          className="rounded-2xl p-5 sm:p-6 flex items-start gap-4"
          style={{
            background: 'hsl(0 100% 41% / 0.10)',
            border: '1px solid hsl(0 100% 41% / 0.35)',
          }}
        >
          <TriangleAlert className="size-5 text-secondary shrink-0 mt-0.5" />
          <div className="text-sm sm:text-[15px] text-foreground/85 leading-relaxed">
            <span className="font-semibold text-foreground">Important:</span> Trading forex, CFDs,
            cryptocurrencies, and other leveraged products is high-risk and may not be suitable for
            every investor. You may lose some or all of your invested capital — only trade with
            money you can afford to lose.
          </div>
        </div>
      </section>

      <article className="mx-auto max-w-[840px] px-[var(--gutter)] py-6 sm:py-8 space-y-7">
        {SECTIONS.map(({ h, body, list, trailing }) => (
          <section key={h} className="liquid-glass rounded-2xl p-6 sm:p-7">
            <h2 className="font-display text-lg sm:text-xl uppercase tracking-tight text-foreground mb-4">
              {h}
            </h2>
            <div className="text-sm sm:text-[15px] leading-relaxed text-foreground/75 space-y-3">
              <p>{body}</p>
              {list && (
                <ul className="list-disc list-inside space-y-1.5 mt-1 ml-1">
                  {list.map((item) => <li key={item}>{item}</li>)}
                </ul>
              )}
              {trailing && <p>{trailing}</p>}
            </div>
          </section>
        ))}

        <div className="liquid-glass-strong rounded-2xl p-6 sm:p-7 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <ShieldAlert className="size-5 text-primary shrink-0 mt-0.5" />
            <p className="text-sm text-foreground/75 leading-relaxed">
              Read this alongside our{' '}
              <Link href="/risk" className="text-primary underline-offset-4 hover:underline">
                Risk Disclaimer
              </Link>{' '}
              and{' '}
              <Link href="/terms" className="text-primary underline-offset-4 hover:underline">
                Terms of Service
              </Link>
              .
            </p>
          </div>
          <a
            href={`mailto:${BRAND_SUPPORT_EMAIL}`}
            className="inline-flex items-center gap-2 rounded-full bg-primary text-white px-5 py-2.5 text-sm font-semibold uppercase tracking-wider hover:opacity-90 shrink-0"
          >
            <Mail className="size-4" /> Contact Support
          </a>
        </div>
      </article>

      <section className="mx-auto max-w-[1200px] px-[var(--gutter)] pb-20">
        <div className="liquid-glass-strong rounded-3xl p-8 sm:p-12 text-center">
          <h2 className="font-display uppercase text-2xl sm:text-3xl tracking-tight">
            Trade Responsibly
          </h2>
          <p className="mt-4 text-foreground/70 max-w-xl mx-auto text-sm sm:text-base">
            Open an account only after reading and accepting all our risk disclosures.
          </p>
          <Link
            href="/auth/register"
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-primary text-white px-6 py-3 text-sm font-semibold uppercase tracking-wider hover:opacity-90"
          >
            Open Account <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
