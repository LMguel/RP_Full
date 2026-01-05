import React, { useState } from 'react'
import Hero from './components/Hero'
import Trust from './components/Trust'
import Problems from './components/Problems'
import Solution from './components/Solution'
import HowItWorks from './components/HowItWorks'
import Screens from './components/Screens'
import Testimonials from './components/Testimonials'
import Differentials from './components/Differentials'
import Audience from './components/Audience'
import Pricing from './components/Pricing'
import Security from './components/Security'
import FAQ from './components/FAQ'
import FinalCTA from './components/FinalCTA'
import Footer from './components/Footer'
import WhatsAppButton from './components/WhatsAppButton'
import DemoModal from './components/DemoModal'
import StickyCTA from './components/StickyCTA'
import CookieConsent from './components/CookieConsent'
import FloatingLogo from './components/FloatingLogo'
import Reveal from './components/Reveal'

// App layout composing the sections - textos em Português conforme solicitado
export default function App(){
  const [demoOpen, setDemoOpen] = useState(false)
  const openDemo = () => setDemoOpen(true)
  const closeDemo = () => setDemoOpen(false)

  return (
    <div className="site-bg min-h-screen text-gray-100">
      <div className="site-content">
      <Hero onRequestDemo={openDemo} />
      <main className="max-w-6xl mx-auto px-6 md:px-8">
        <Reveal><Trust /></Reveal>
        <Reveal delay={0.06}><Problems /></Reveal>
        <Reveal delay={0.08}><Solution /></Reveal>
        <Reveal delay={0.10}><HowItWorks /></Reveal>
        <Reveal delay={0.12}><Screens /></Reveal>
        <Reveal delay={0.14}><Testimonials /></Reveal>
        <Reveal delay={0.16}><Differentials /></Reveal>
        <Reveal delay={0.18}><Audience /></Reveal>
        <Reveal delay={0.20}><Pricing onRequestDemo={openDemo} /></Reveal>
        <Reveal delay={0.22}><Security /></Reveal>
        <Reveal delay={0.24}><FAQ /></Reveal>
        <Reveal delay={0.26}><FinalCTA onRequestDemo={openDemo} /></Reveal>
      </main>
      <Footer />
      <FloatingLogo />
      <WhatsAppButton />
      <StickyCTA onRequestDemo={openDemo} />
      <DemoModal open={demoOpen} onClose={closeDemo} />
      <CookieConsent />
      </div>
    </div>
  )
}
