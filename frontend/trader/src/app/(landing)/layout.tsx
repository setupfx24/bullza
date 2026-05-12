'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { PopupProvider } from '@/landing/components/PopupContext'
import ScrollProgress from '@/landing/components/animations/ScrollProgress'
import Footer from '@/landing/components/Footer'
import { Navbar as SwisDexNavbar } from '@/swisdex/components/Navbar'
import { ChatBot } from '@/swisdex/components/ChatBot'
import '@/swisdex/styles.css'
import '@/landing/landing.css'

/**
 * Landing layout — wraps every page under (landing). The home page (/)
 * brings its own self-contained chrome (see /swisdex/HomePage), so we
 * skip the legacy Navbar/Footer + scrub the body padding on that exact
 * path. All inner pages (about, contact, how-it-works, etc.) keep the
 * existing landing chrome unchanged.
 */
export default function LandingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isHome = pathname === '/'

  /* Override trader-app theme for landing pages */
  useEffect(() => {
    const html = document.documentElement
    html.setAttribute('data-theme', 'dark')
    html.style.backgroundColor = '#08090b'
    html.style.color = '#f5f5f5'
    return () => {
      html.setAttribute('data-theme', 'light')
      html.style.backgroundColor = '#F2EFE9'
      html.style.color = '#000000'
    }
  }, [])

  if (isHome) {
    // Bare wrapper — HomePage renders its own Navbar + CtaFooter.
    return (
      <PopupProvider>
        <ScrollProgress />
        {children}
        <ChatBot />
      </PopupProvider>
    )
  }

  return (
    <PopupProvider>
      <ScrollProgress />
      <div className="swisdex-home landing-root min-h-screen">
        <SwisDexNavbar />
        {children}
        <Footer />
      </div>
      <ChatBot />
    </PopupProvider>
  )
}
