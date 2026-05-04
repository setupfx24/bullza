'use client';

import './styles.css';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { ServicesBento } from './components/ServicesBento';
import { Pourquoi } from './components/Pourquoi';
import { Process } from './components/Process';
import { Stats } from './components/Stats';
import { Testimonials } from './components/Testimonials';
import { Faq } from './components/Faq';
import { CtaFooter } from './components/CtaFooter';

/**
 * SwisDex public marketing home — ported from the standalone swisdex_web
 * Vite project. Self-contained: brings its own Navbar, footer, fonts and
 * theme tokens via `./styles.css`. Drop into any Next.js page and that
 * page becomes the cinematic landing experience.
 *
 * All "Get Started" / "Create Account" CTAs route to /auth/register.
 */
export default function SwisDexHomePage() {
  return (
    <div className="swisdex-home">
      <Navbar />
      <main>
        <Hero />
        <ServicesBento />
        <Pourquoi />
        <Process />
        <Stats />
        <Testimonials />
        <Faq />
        <CtaFooter />
      </main>
    </div>
  );
}
