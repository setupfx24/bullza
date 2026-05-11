# Content Placeholders — Academy / Risk Management / Products

This guide lists every `image-placeholder` div and `TODO: …` comment created
when the Academy, Risk Management, and Products pages were scaffolded.
Replace each placeholder with real assets at the paths below.

All paths are **relative to** `frontend/trader/`.

---

## 1. Banner images (every page)

Every new page has a `<BannerPlaceholder>` at the top — a full-width hero
backdrop ~450 px tall with a brand-gradient fill and the page title overlaid.

To replace the gradient with a real banner image:

1. Drop the banner image at:
   - Videos page    → `public/images/banners/academy-videos.webp`
   - PDFs page      → `public/images/banners/academy-pdfs.webp`
   - Blogs page     → `public/images/banners/academy-blogs.webp`
   - Calculator     → `public/images/banners/risk-calculator.webp`
   - IB Referral    → `public/images/banners/ib-referral.webp`
   - Fixed Return   → `public/images/banners/fixed-return-insurance.webp`
2. Edit `src/swisdex/components/BannerPlaceholder.tsx` so the gradient div
   becomes an `<img>` (or `next/image`) pointing to the file. Pass the path
   as a `bannerSrc` prop from each page if you want per-page images.

Recommended dimensions: **1920 × 800 px**, WebP or AVIF, < 250 KB.

---

## 2. Academy — Videos (`/academy/videos`)

Each video card has a placeholder thumbnail.

**Replace:**
- File: `src/app/(landing)/academy/videos/page.tsx`
- Find: `// TODO: Video thumbnail image yahan aayegi`
- Add a `thumbnail` field to each `Video` in the `VIDEOS` array (e.g.
  `thumbnail: '/images/academy/videos/v1.jpg'`) and render it via `<img>`
  in place of the `<PlayCircle />` icon.

Thumbnail folder: `public/images/academy/videos/`
Recommended size: **1280 × 720 px** (16:9), WebP < 80 KB.

Each video also needs a real `Watch Now` link — wire the button's `onClick`
or wrap the card in a `<Link>` to the video file or hosted player URL.

---

## 3. Academy — PDFs (`/academy/pdfs`)

Each PDF card has a placeholder cover and a placeholder `Download` button.

**Replace:**
- File: `src/app/(landing)/academy/pdfs/page.tsx`
- Find: `// TODO: PDF cover thumbnail yahan aayega`
- Drop covers at `public/images/academy/pdfs/<id>.webp` and render an
  `<img>` in place of the `<FileText />` icon.
- Drop the PDFs themselves at `public/files/academy/<id>.pdf` and change the
  `Download` button into an `<a href="/files/academy/<id>.pdf" download>`.

Cover dimensions: **600 × 800 px** (3:4), WebP < 80 KB.

---

## 4. Academy — Blog (`/academy/blogs`)

Featured post hero image + thumbnails on every card.

**Replace:**
- File: `src/app/(landing)/academy/blogs/page.tsx`
- Find: `// TODO: Featured post hero image yahan aayegi`
- Find: `// TODO: Post thumbnail yahan aayega`
- Drop images at `public/images/academy/blogs/<id>.webp`.
- Currently `Read More` and `Read Full Story` are buttons with no link —
  wire each `<button>` to a real post route (e.g.
  `<Link href={\`/academy/blogs/\${post.id}\`}>`) once individual post
  pages exist, or to an external CMS.

Thumbnail dimensions: **1280 × 720 px** (16:9).

---

## 5. Risk Management — Calculator (`/risk-management/calculator`)

Calculator logic is already wired and working. Pip values are approximations.
For production accuracy:

- Replace the `PAIRS` constant in
  `src/app/(landing)/risk-management/calculator/page.tsx` with a live feed
  via `/api/v1/instruments` (or similar). Refresh pip values from current
  market rates of the quote currency.
- Replace the `CURRENCY_TO_USD` static map with live FX rates from your
  market-data service.

No image placeholders on this page beyond the hero banner (see §1).

---

## 6. Products — IB Referral (`/products/ib-referral`)

**Replace:**
- File: `src/app/(landing)/products/ib-referral/page.tsx`
- Find: `// TODO: Partner avatar yahan aayega`
- Drop partner avatars at `public/images/products/ib-referral/<name>.webp`
  and replace the empty `<div className="image-placeholder size-12 …">`
  with an `<img>`.
- Application form posts nowhere — wire `onSubmit` to your CRM endpoint
  (HubSpot, Salesforce, or a local `/api/ib-applications` route).
- `partners@swisdex.com` is a placeholder — update to a real inbox.

---

## 7. Products — Fixed Return Insurance (`/products/fixed-return-insurance`)

**Replace:**
- File: `src/app/(landing)/products/fixed-return-insurance/page.tsx`
- No image placeholders inside the page beyond the hero banner (§1).
- Application form posts nowhere — wire `onSubmit` to your investor-relations
  endpoint.
- All quoted yields (6.5% / 8.5% / 10.0%) are illustrative — confirm with
  compliance and the underwriter before going live.
- The risk-disclosure copy is a generic template — have legal review and
  customise per jurisdiction.

---

## 8. Footer links

`Risk Management`, `Academy`, and `Products` columns were added to
`src/landing/components/Footer.jsx`. The columns auto-render — nothing to
configure once a path is changed.

---

## 9. Navbar dropdowns

The three new dropdowns are wired in `src/swisdex/data.ts` (`NAV_ITEMS`).
Each item supports an optional `children: { label, href }[]`. Add or remove
sub-items by editing that array.

Mobile: hamburger menu expands each parent inline (accordion).
Desktop: hover / focus opens a dropdown panel.

All new routes are allow-listed for unauthenticated visitors in
`src/components/providers/AuthProvider.tsx` — no auth bounce.

---

## 10. Sanity checklist before going live

- [ ] All `image-placeholder` divs replaced with real `<img>` / `<video>`.
- [ ] All forms wired to a real backend (not `alert(…)`).
- [ ] `partners@swisdex.com`, `fixedreturn@swisdex.com` replaced with
      monitored inboxes.
- [ ] Calculator pip values reviewed by trading desk.
- [ ] Fixed Return plan yields, minimums, and disclosure copy reviewed by
      compliance.
- [ ] PDFs uploaded, blog posts wired to per-post routes.
- [ ] Banner images dropped (see §1).
- [ ] OG / Twitter share images added per page (next step — not scaffolded yet).
