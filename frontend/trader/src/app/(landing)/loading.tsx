/**
 * Landing route-group loading splash.
 *
 * Next.js renders this while any (landing)/page.tsx is suspending — it
 * replaces the empty-screen / FOUC moment the client saw on slower routes.
 * Pairs with TopLoader (a thin progress bar at the top of every route)
 * for the link-click → route-ready visual chain.
 */
import { BRAND_NAME } from '@/lib/brand';

export default function LandingLoading() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="fixed inset-0 z-[9990] flex items-center justify-center"
      style={{ background: '#08090b' }}
    >
      <div className="flex flex-col items-center gap-5">
        <div className="relative size-16">
          <span
            className="absolute inset-0 rounded-full border-2 border-white/10"
            aria-hidden="true"
          />
          <span
            className="absolute inset-0 rounded-full border-2 border-transparent animate-spin"
            style={{
              borderTopColor: '#E85D3D',
              borderRightColor: 'rgba(232, 93, 61,0.4)',
              animationDuration: '1.05s',
            }}
            aria-hidden="true"
          />
          <span
            className="absolute inset-0 grid place-items-center font-display text-[#E85D3D] font-bold text-xl"
            aria-hidden="true"
          >
            {BRAND_NAME.charAt(0)}
          </span>
        </div>
        <div className="font-display uppercase tracking-[0.25em] text-xs text-white/70">
          {BRAND_NAME}
        </div>
      </div>
    </div>
  );
}
