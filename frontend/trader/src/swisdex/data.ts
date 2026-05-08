/**
 * Static content for the SwisDex marketing home page.
 *
 * The single CTA target across the page is `/auth/register` so every
 * "Get Started" / "Create Account" / "Start Investing" link drops the
 * user onto the trader signup flow regardless of which CTA they click.
 */

export const SIGNUP_HREF = '/auth/register';

export const BRAND = {
  name: 'SwisDex',
  tagline: 'Trade Smarter. Grow Faster. Invest with Confidence.',
  logo: '/images/swisdex-logo.png',
};

// Nav targets: scroll-to-anchor for sections that already exist on the home
// (Hero/Services/Pourquoi/Process/Faq), and absolute URLs for inner landing
// pages that exist as separate routes. Routes like /markets and /accounts
// were avoided because they live under the auth-protected dashboard
// (/dashboard/accounts, /wallet/markets) — landing visitors hitting those
// got bounced to /auth/login by the auth middleware. Everything below is
// publicly reachable without a session.
export const NAV_ITEMS: { label: string; href: string }[] = [
  { label: 'Home',         href: '/' },
  { label: 'Services',     href: '/#services' },
  { label: 'Why Us',       href: '/#why-choose' },
  { label: 'How it Works', href: '/#process' },
  { label: 'FAQ',          href: '/#faq' },
  { label: 'About',        href: '/company/about' },
  { label: 'Contact',      href: '/company/contact' },
];

export const HERO = {
  pill: 'Crypto & Forex Investment Platform',
  pillBadge: 'Live',
  headline: 'Trade Smarter Grow Faster',
  sub: 'SwisDex is a decentralised exchange with on-chain insured trades and licensed broker-grade execution — your funds stay in your wallet, your trades stay protected.',
  ctaPrimary: 'Get Started',
  ctaSecondary: 'Learn How It Works',
  ctaHref: SIGNUP_HREF,
  ctaSecondaryHref: '/how-it-works',
};

/**
 * Three trust pills rendered above the hero CTAs — the first words a
 * first-time visitor reads. Communicates "what we do" before any scroll:
 * decentralised execution, on-chain trade insurance, regulated broker.
 *
 * Icon names are lucide-react component names — resolved in Hero.tsx via
 * an iconMap so we don't ship the entire icon catalog client-side.
 */
export const HERO_TRUST_PILLS = [
  { icon: 'Network',    label: 'Decentralised Exchange', sub: 'Non-custodial. Your wallet, your keys.' },
  { icon: 'ShieldCheck', label: 'Insured Trade',          sub: 'Every position is policy-backed.' },
  { icon: 'BadgeCheck', label: 'Licensed Broker',         sub: 'Institutional-grade execution.' },
] as const;

export const LIVE_TICKER = [
  { pair: 'BTC/USD',   price: '67,420',  change: '+1.82%', up: true },
  { pair: 'ETH/USD',   price: '3,580',   change: '+0.94%', up: true },
  { pair: 'EUR/USD',   price: '1.0842',  change: '+0.12%', up: true },
  { pair: 'XAU/USD',   price: '2318.50', change: '+0.45%', up: true },
  { pair: 'SOL/USD',   price: '168.20',  change: '+2.31%', up: true },
  { pair: 'GBP/USD',   price: '1.2654',  change: '-0.08%', up: false },
  { pair: 'USD/JPY',   price: '149.82',  change: '+0.23%', up: true },
  { pair: 'XRP/USD',   price: '0.5423',  change: '-0.15%', up: false },
  { pair: 'ADA/USD',   price: '0.4612',  change: '+0.72%', up: true },
  { pair: 'AUD/USD',   price: '0.6512',  change: '+0.08%', up: true },
  { pair: 'MATIC/USD', price: '0.8120',  change: '+1.05%', up: true },
  { pair: 'DOT/USD',   price: '7.42',    change: '-0.21%', up: false },
];

export const INSTRUMENTS = [
  { icon: 'Cpu',        title: 'AI-Driven Auto Trading',         badge: '24/7 Active',       body: 'Our intelligent algorithms monitor markets 24/7 and execute high-frequency trades to maximise your returns with minimal risk.', href: SIGNUP_HREF },
  { icon: 'BarChart2',  title: 'Portfolio Management',           badge: 'Expert Managed',    body: 'Expert asset allocation and continuous rebalancing to build a diversified, resilient portfolio aligned with your goals.',      href: SIGNUP_HREF },
  { icon: 'TrendingUp', title: 'Market Research & Analysis',     badge: 'Daily Reports',     body: 'In-depth technical and fundamental analysis reports, updated daily to keep your investment decisions sharp.',                  href: SIGNUP_HREF },
  { icon: 'Layers',     title: 'Educational Resources',          badge: 'Beginner Friendly', body: 'Learn trading strategies, crypto fundamentals, and market dynamics through curated workshops, guides, and webinars.',          href: SIGNUP_HREF },
  { icon: 'Gem',        title: 'ICO & Early-Stage Investments',  badge: 'Exclusive Access',  body: 'Early access to promising new blockchain projects, vetted by SwisDex before they hit the wider market.',                       href: SIGNUP_HREF },
  { icon: 'Building',   title: 'Automated Profit Generation',    badge: 'Algo Powered',      body: 'Beyond standard trading, SwisDex deploys advanced algorithmic bots designed to generate consistent returns even in volatile markets.', href: SIGNUP_HREF },
] as const;

export const WHY_US = [
  { icon: 'Zap',          title: 'AI-Powered Returns',                body: 'Sophisticated algorithms generate consistent profits across crypto and forex markets — analysing thousands of market signals per second.' },
  { icon: 'ShieldCheck',  title: 'Secure Wallet Infrastructure',      body: 'All assets stored in offline cold storage. Multi-layer encryption keeps every holding safe from breaches and threats.' },
  { icon: 'Headphones',   title: 'Expert Human Oversight',            body: 'Our team of experienced analysts monitors all trades for optimal performance — technology paired with seasoned market judgment.' },
  { icon: 'TrendingDown', title: 'Flexible Plans for Every Investor', body: 'From starter to premium plans, the right option for your budget. Start with $500 and scale as confidence grows.' },
] as const;

export const HOW_IT_WORKS = [
  { n: '1', title: 'Create Free Account', body: 'Sign up in under three minutes and claim your $200 welcome bonus on first deposit. Verification completed within 24 hours.' },
  { n: '2', title: 'Choose Your Plan',    body: 'Select the investment tier that matches your goals — Starter, Growth, Premium, or Elite. Upgrade anytime as you scale.' },
  { n: '3', title: 'Fund Your Wallet',    body: 'Deposit via crypto, bank transfer, or card. Funds are credited instantly and held in fully insured cold-storage wallets.' },
  { n: '4', title: 'Watch Profits Grow',  body: 'Our AI engine takes over from there — executing trades, rebalancing your portfolio, and generating returns 24/7.' },
] as const;

export const STATS = [
  { value: '96%',  label: 'Profitable Trades' },
  { value: '10K+', label: 'Active Investors Worldwide' },
  { value: '$200', label: 'Welcome Bonus for New Members' },
  { value: '24/7', label: 'Automated Trading, Always On' },
] as const;

export const TESTIMONIALS = [
  { quote: 'SwisDex completely changed how I invest. The AI does all the heavy lifting and I just watch my portfolio grow.',   name: 'James R.',  role: 'United States' },
  { quote: 'I was skeptical at first, but the results speak for themselves. My returns have exceeded every expectation.',     name: 'Amara K.',  role: 'United Kingdom' },
  { quote: 'The educational resources helped me understand crypto deeply. The platform is seamless and transparent.',         name: 'Liam T.',   role: 'Australia' },
  { quote: 'The Growth plan paid for itself in the first cycle. SwisDex delivers what other platforms only promise.',         name: 'Sophia M.', role: 'Germany' },
  { quote: 'Cold-storage security and live human oversight gave me confidence to invest a serious amount. No regrets.',       name: 'Daniel K.', role: 'Canada' },
  { quote: 'The dashboard is beautifully designed. I can see every trade my AI is making and the profits add up daily.',      name: 'Priya N.',  role: 'Singapore' },
] as const;

export const FAQ = [
  { q: "How does SwisDex's AI trading work?",                   a: 'Our proprietary AI engine analyses thousands of market signals per second across crypto and forex pairs, executing high-probability trades automatically. You retain full visibility into every trade in your dashboard.' },
  { q: 'What is the minimum investment to get started?',        a: 'The Starter plan begins at $500. New members also receive a $200 welcome bonus credited to their first deposit. You can upgrade plans at any time as your portfolio scales.' },
  { q: 'How are my funds and assets protected?',                a: 'All client assets are held in offline cold-storage wallets, segregated from operational funds. Bank-grade SSL encryption, ISO-compliant infrastructure, and 24/7 security monitoring.' },
  { q: 'Can I withdraw my profits at any time?',                a: 'Yes. Withdrawals are processed within standard plan windows — Starter (7 days), Growth (14 days), Premium (30 days). Elite members enjoy priority withdrawals.' },
  { q: 'Do I need trading experience to use SwisDex?',          a: 'No. SwisDex is built for investors at every experience level. The AI handles all trading decisions automatically; the educational library helps you learn at your own pace.' },
  { q: 'What returns can I realistically expect?',              a: 'Returns vary by plan. These are projections based on AI performance — past results do not guarantee future returns and trading involves risk.' },
  { q: 'Is SwisDex available worldwide?',                       a: 'SwisDex serves clients in 40+ countries. Multi-currency deposits and withdrawals; 24/7 support in 12 languages. Some jurisdictions may have local restrictions.' },
] as const;

export const CTA = {
  headline: 'Ready to Start Your Investment Journey?',
  sub: 'Join SwisDex today and receive a $200 Welcome Bonus on your first deposit.',
  primary: 'Create Free Account',
  secondary: 'How It Works',
  href: SIGNUP_HREF,
  secondaryHref: '/how-it-works',
};

export const FOOTER_QUICK_LINKS = [
  { label: 'Home',         href: '/' },
  { label: 'About Us',     href: '/company/about' },
  { label: 'Services',     href: '/#services' },
  { label: 'Why Us',       href: '/#why-choose' },
  { label: 'How it Works', href: '/how-it-works' },
  { label: 'Contact',      href: '/company/contact' },
];

export const FOOTER_SERVICES = [
  { label: 'AI Auto Trading',       href: SIGNUP_HREF },
  { label: 'Portfolio Management',  href: SIGNUP_HREF },
  { label: 'Educational Resources', href: SIGNUP_HREF },
  { label: 'ICO Investments',       href: SIGNUP_HREF },
];

export const FOOTER_LINKS = [
  { label: 'Privacy Policy',   href: '/privacy' },
  { label: 'Terms of Service', href: '/terms' },
  { label: 'Risk Disclaimer',  href: '/risk' },
];

export const COPYRIGHT = `© ${new Date().getFullYear()} SwisDex. All Rights Reserved.`;

export const RISK_DISCLAIMER =
  'Trading cryptocurrencies and forex involves significant risk. Past performance is not indicative of future results. Invest only what you can afford to lose.';
