'use client';

/**
 * Reusable hero banner placeholder. Drop the final banner image / video
 * at the path documented in README-CONTENT-PLACEHOLDERS.md.
 */
export function BannerPlaceholder({
  title,
  tagline,
  height = 450,
  bannerSrc,
}: {
  title: string;
  tagline?: string;
  height?: number;
  /** Optional banner image — drop in `public/images/banners/<slug>.webp` and pass `/images/banners/<slug>.webp`. */
  bannerSrc?: string;
}) {
  return (
    <section
      role="banner"
      aria-label={title}
      className="relative w-full overflow-hidden"
      style={{ minHeight: `min(${height}px, 60vh)` }}
    >
      {bannerSrc ? (
        // Real banner image. Drop a 1920×800 WebP at the supplied path.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={bannerSrc}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          aria-hidden
        />
      ) : (
        // Fallback gradient until an image is dropped.
        // TODO: Banner image / video yahan aayegi — see README-CONTENT-PLACEHOLDERS.md
        <div
          className="image-placeholder absolute inset-0 bg-foreground/[0.06]"
          style={{
            backgroundImage:
              'linear-gradient(135deg, hsl(99 55% 42% / 0.10) 0%, hsl(0 0% 6%) 60%, hsl(0 100% 41% / 0.10) 100%)',
          }}
        />
      )}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 55% at 50% 50%, transparent 0%, hsl(0 0% 6%) 90%)',
        }}
      />

      <div className="relative z-10 mx-auto max-w-[1200px] px-[var(--gutter)] pt-32 pb-12 sm:pt-40 sm:pb-20 md:pt-48 md:pb-24 text-center">
        <h1 className="font-display uppercase tracking-tight leading-[0.95] text-foreground text-3xl sm:text-5xl md:text-6xl break-words">
          {title}
        </h1>
        {tagline && (
          <p className="mt-5 sm:mt-7 mx-auto max-w-2xl text-foreground/70 text-sm sm:text-base md:text-lg leading-relaxed">
            {tagline}
          </p>
        )}
      </div>
    </section>
  );
}
