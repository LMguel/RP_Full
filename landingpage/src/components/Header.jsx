import React, { useState, useEffect } from 'react'

export default function Header() {
    const [menuOpen, setMenuOpen] = useState(false)
    const [scrolled, setScrolled] = useState(false)

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 10)
        window.addEventListener('scroll', onScroll, { passive: true })
        return () => window.removeEventListener('scroll', onScroll)
    }, [])

    const links = [
        { label: 'Como funciona', href: '#como-funciona' },
        { label: 'Planos', href: '#planos' },
        { label: 'FAQ', href: '#faq' },
    ]

    function handleNav(href) {
        setMenuOpen(false)
        document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' })
    }

    return (
        <header
            className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${scrolled ? 'shadow-md' : ''
                }`}
            style={{ background: scrolled ? 'rgba(7,14,37,0.97)' : '#070e25' }}
        >
            <div className="max-w-6xl mx-auto px-4 md:px-8 flex items-center justify-between h-16">
                {/* Logo + Title */}
                <a href="#" className="flex items-center gap-3">
                    <div
                        className="h-11 w-11 rounded-xl overflow-hidden flex-shrink-0"
                        style={{ background: '#1a2555' }}
                    >
                        <img
                            src="/image/logo.png"
                            alt="RP"
                            className="h-full w-full"
                            style={{ objectFit: 'cover', objectPosition: 'center', transform: 'scale(1.8)' }}
                        />
                    </div>
                    <span
                        className="text-white font-bold text-xl md:text-2xl tracking-tight"
                        style={{ fontFamily: 'DM Sans, sans-serif' }}
                    >
                        REGISTRA.PONTO
                    </span>
                </a>

                {/* Desktop nav */}
                <nav className="hidden md:flex items-center gap-8">
                    {links.map((l) => (
                        <button
                            key={l.href}
                            onClick={() => handleNav(l.href)}
                            className="text-slate-300 hover:text-white font-medium text-sm transition-colors"
                        >
                            {l.label}
                        </button>
                    ))}
                    <button
                        onClick={() => handleNav('#contato')}
                        className="btn-primary py-2 px-5 text-sm"
                    >
                        Solicitar demo
                    </button>
                </nav>

                {/* Mobile hamburger */}
                <button
                    className="md:hidden p-2 text-slate-300"
                    onClick={() => setMenuOpen(!menuOpen)}
                    aria-label="Menu"
                >
                    {menuOpen ? (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    ) : (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 12h18M3 6h18M3 18h18" />
                        </svg>
                    )}
                </button>
            </div>

            {/* Mobile menu */}
            {menuOpen && (
                <div className="md:hidden px-4 pb-4" style={{ background: '#070e25', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    {links.map((l) => (
                        <button
                            key={l.href}
                            onClick={() => handleNav(l.href)}
                            className="block w-full text-left py-3 text-slate-300 font-medium"
                            style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                        >
                            {l.label}
                        </button>
                    ))}
                    <button
                        onClick={() => handleNav('#contato')}
                        className="btn-primary w-full mt-3 py-3"
                    >
                        Solicitar demo
                    </button>
                </div>
            )}
        </header>
    )
}
