import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X } from 'lucide-react'

const WA_CONSULTOR = 'https://wa.me/5524992272778?text=Ol%C3%A1!%20Gostaria%20de%20falar%20com%20um%20consultor%20do%20REGISTRA.PONTO.'

const links = [
  { label: 'Funcionalidades', href: '#dashboard' },
  { label: 'Planos',          href: '#planos' },
  { label: 'FAQ',             href: '#faq' },
]

export default function Navbar() {
  const [scrolled,   setScrolled]   = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  function handleMobileLink(href) {
    setMobileOpen(false)
    setTimeout(() => document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  return (
    <>
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        style={{
          background: scrolled ? 'rgba(255,255,255,0.97)' : 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(28px) saturate(160%)',
          WebkitBackdropFilter: 'blur(28px) saturate(160%)',
          borderBottom: scrolled
            ? '1px solid rgba(24,71,214,0.12)'
            : '1px solid rgba(24,71,214,0.06)',
          boxShadow: scrolled
            ? '0 4px 32px rgba(24,71,214,0.08), inset 0 -1px 0 rgba(24,71,214,0.06)'
            : 'none',
        }}
        className="fixed top-0 left-0 right-0 z-50 transition-[background,box-shadow,border-color] duration-300"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-[68px]">

            {/* Logo */}
            <a href="#" className="flex items-center gap-3 select-none group">
              <div
                className="flex-shrink-0 flex items-center justify-center rounded-xl p-1.5"
                style={{ background: '#1847D6' }}
              >
                <img
                  src="/image/logo.png"
                  alt="REGISTRA.PONTO"
                  className="h-10 w-auto object-contain block"
                  draggable={false}
                />
              </div>
              <span
                className="font-bold tracking-tight text-[15px] sm:text-base leading-none text-[#0C1A38]"
                style={{ fontFamily: 'Outfit, sans-serif' }}
              >
                REGISTRA<span style={{ color: '#1847D6' }}>.</span>PONTO
              </span>
            </a>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-8">
              {links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  className="relative text-sm font-medium text-[#4D5E7A] hover:text-[#0C1A38] transition-colors duration-150 group py-1"
                >
                  {l.label}
                  <span
                    className="absolute bottom-0 left-0 w-0 h-px group-hover:w-full transition-all duration-250 ease-out"
                    style={{ background: 'linear-gradient(90deg, #1847D6, #38BDF8)' }}
                  />
                </a>
              ))}
            </nav>

            {/* Desktop CTA */}
            <div className="hidden md:flex items-center">
              <a
                href={WA_CONSULTOR}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary text-sm px-5 py-2.5"
              >
                Falar com consultor
              </a>
            </div>

            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 rounded-lg text-[#4D5E7A] hover:text-[#0C1A38] hover:bg-[rgba(24,71,214,0.05)] transition-colors"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Menu"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </motion.header>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-0 top-[68px] z-40 backdrop-blur-xl border-b md:hidden"
            style={{ background: 'rgba(255,255,255,0.98)', borderColor: 'rgba(24,71,214,0.10)' }}
          >
            <div className="px-4 py-4 flex flex-col gap-1">
              {links.map((l) => (
                <button
                  key={l.href}
                  onClick={() => handleMobileLink(l.href)}
                  className="text-left py-3 px-3 text-sm font-medium text-[#4D5E7A] hover:text-[#0C1A38] hover:bg-[rgba(24,71,214,0.05)] rounded-lg transition-colors"
                >
                  {l.label}
                </button>
              ))}
              <a
                href={WA_CONSULTOR}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMobileOpen(false)}
                className="btn-primary mt-2 w-full"
              >
                Falar com consultor
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
