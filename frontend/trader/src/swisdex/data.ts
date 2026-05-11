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

// Nav targets all resolve to public landing routes. /markets and
// /account-types are explicit pages with their own content; AuthProvider
// allow-lists them so unauthenticated visitors are not bounced to login.
// Items with `children` render as a dropdown.
export type NavItem = {
  label: string;
  href: string;
  children?: { label: string; href: string }[];
};

export const NAV_ITEMS: NavItem[] = [
  { label: 'Home',         href: '/' },
  { label: 'Markets',      href: '/markets' },
  { label: 'Accounts',     href: '/account-types' },
  { label: 'How it Works', href: '/how-it-works' },
  {
    label: 'Academy',
    href: '/academy/videos',
    children: [
      { label: 'Videos', href: '/academy/videos' },
      { label: 'PDFs',   href: '/academy/pdfs' },
      { label: 'Blogs',  href: '/academy/blogs' },
    ],
  },
  {
    label: 'Risk Management',
    href: '/risk-management/calculator',
    children: [
      { label: 'Lot Size & Profit Calculator', href: '/risk-management/calculator' },
    ],
  },
  {
    label: 'Products',
    href: '/products/ib-referral',
    children: [
      { label: 'IB Referral',            href: '/products/ib-referral' },
      { label: 'Fixed Return Insurance', href: '/products/fixed-return-insurance' },
    ],
  },
  { label: 'About',        href: '/company/about' },
  { label: 'Contact',      href: '/company/contact' },
];

export const HERO = {
  pill: 'Crypto & Forex Investment Platform',
  pillBadge: 'Live',
  headline: 'Trade Smarter Grow Faster',
  sub: 'SwisDex is a decentralised exchange with on-chain insured trades and licensed broker-grade execution — your funds stay in your wallet, your trades stay protected.',
  ctaPrimary: 'Details',
  ctaSecondary: 'Learn How It Works',
  ctaHref: '/how-it-works',
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
  { quote: 'The interface is clean and easy to navigate.' },
  { quote: 'Account setup was straightforward and quick.' },
  { quote: 'I like how simple the trading dashboard feels.' },
  { quote: 'The platform performance has been smooth so far.' },
  { quote: 'Good mobile experience and responsive layout.' },
  { quote: 'Transactions appeared quickly in the dashboard.' },
  { quote: 'Customer support replied within a reasonable time.' },
  { quote: 'The verification process was simple to complete.' },
  { quote: 'Professional interface with a strong focus on usability.' },
  { quote: 'Efficient execution and a polished trading environment.' },
  { quote: 'A modern platform built with simplicity in mind.' },
] as const;

export const FAQ = [
  {
    q: 'What is the minimum deposit required to start trading?',
    a: 'The minimum deposit depends on your account type. Standard accounts start from $100, while Pro and ECN accounts require a minimum of $5,000. A free Demo account with $10,000 in virtual funds is also available — no commitment, identical execution conditions to a live account.',
  },
  {
    q: 'Which deposit and withdrawal methods are available, and how long do they take?',
    a: 'We support bank wire transfers, Visa/Mastercard, Skrill, Neteller, cryptocurrency, and local bank options including UPI. Card and e-wallet deposits are typically instant; bank wires and crypto withdrawals usually settle within 1–3 business days. All deposits are 100% fee-free.',
  },
  {
    q: 'Which trading platforms and devices are supported?',
    a: 'SwisDex offers a fast web platform accessible from any modern browser, plus dedicated iOS and Android mobile apps. All platforms sync to a single account, so your positions, alerts, and watchlists stay in sync across every device.',
  },
  {
    q: 'What leverage options are available, and how does margin work?',
    a: 'Maximum leverage is up to 1:500 across forex, metals, energies, and indices. Hedged positions carry 0% margin requirement. Margin call kicks in at 30% and stop-out at 0% (with stock-specific rules — see contract specifications). Use leverage responsibly.',
  },
  {
    q: 'What lot sizes can I trade?',
    a: 'Minimum lot size is 0.01 across all instruments. Maximum is 200 lots between 7:00–20:59 GMT and 60 lots between 21:00–6:59 GMT. There are no limits on the number of open positions per account.',
  },
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
  { label: 'Markets',      href: '/markets' },
  { label: 'Accounts',     href: '/account-types' },
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

export const COPYRIGHT = `© ${new Date().getFullYear()} SwisDex. All Rights Reserved. · Founded in 2010`;

export const RISK_DISCLAIMER =
  'Trading cryptocurrencies and forex involves significant risk. Past performance is not indicative of future results. Invest only what you can afford to lose.';
