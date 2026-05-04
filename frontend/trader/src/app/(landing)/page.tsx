import SwisDexHomePage from '@/swisdex/HomePage'

/**
 * Public homepage at swisdex.com/.
 *
 * Renders the cinematic SwisDex marketing site (ported from the
 * standalone swisdex_web Vite project) which brings its own Navbar,
 * footer, fonts and dark-only theme. The (landing) layout detects the
 * `/` path and suppresses its legacy chrome so the two don't stack.
 */
export default function LandingHomePage() {
  return <SwisDexHomePage />
}
