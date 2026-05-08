import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X } from 'lucide-react'

const links = [
  { label: 'Funcionalidades', href: '#dashboard' },
  { label: 'Planos', href: '#planos' },
  { label: 'FAQ', href: '#faq' },
]

export default function Navbar({ onContact }) {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  function handleMobileLink(href) {
    setMobileOpen(false)
    setTimeout(() => {
      document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }

  return (
    <>
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        style={{
          background: scrolled
            ? 'rgba(5,10,22,0.96)'
            : 'rgba(5,10,22,0.82)',
          backdropFilter: 'blur(28px) saturate(160%)',
          WebkitBackdropFilter: 'blur(28px) saturate(160%)',
          borderBottom: scrolled
            ? '1px solid rgba(255,255,255,0.09)'
            : '1px solid rgba(255,255,255,0.05)',
          boxShadow: scrolled
            ? '0 4px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)'
            : 'none',
        }}
        className="fixed top-0 left-0 right-0 z-50 transition-[background,box-shadow,border-color] duration-300"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-[68px]">

            {/* Logo */}
            <a href="#" className="flex items-center gap-3 select-none group">
              {/* Logo maior com fundo branco discreto */}
              <div className="bg-transparent rounded-full p-[1px] flex-shrink-0">
                <img
                  src="/image/logo.png"
                  alt="REGISTRA.PONTO"
                  className="h-14 w-auto object-contain block"
                  draggable={false}
                />
              </div>
              <span className="font-bold text-[#F1F5F9] tracking-tight text-[15px] sm:text-base leading-none">
                REGISTRA<span className="text-blue-400">.</span>PONTO
              </span>
            </a>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-8">
              {links.map((l) => (
                <motion.a
                  key={l.href}
                  href={l.href}
                  className="relative text-sm font-medium text-slate-400 hover:text-white transition-colors duration-150 group py-1"
                  whileHover={{ color: '#fff' }}
                >
                  {l.label}
                  <span className="absolute bottom-0 left-0 w-0 h-px bg-gradient-to-r from-blue-400 to-cyan-400 group-hover:w-full transition-all duration-250 ease-out" />
                </motion.a>
              ))}
            </nav>

            {/* Desktop CTA */}
            <div className="hidden md:flex items-center">
              <button onClick={onContact} className="btn-primary text-sm px-5 py-2.5">
                Falar com consultor
              </button>
            </div>

            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
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
            className="fixed inset-x-0 top-[68px] z-40 bg-[#07111F]/98 backdrop-blur-xl border-b border-white/[0.06] md:hidden"
          >
            <div className="px-4 py-4 flex flex-col gap-1">
              {links.map((l) => (
                <button
                  key={l.href}
                  onClick={() => handleMobileLink(l.href)}
                  className="text-left py-3 px-3 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                >
                  {l.label}
                </button>
              ))}
              <button
                onClick={() => { setMobileOpen(false); onContact() }}
                className="btn-primary mt-2 w-full"
              >
                Falar com consultor
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
