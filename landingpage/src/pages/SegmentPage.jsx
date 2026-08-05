import React from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, MessageCircle } from 'lucide-react'
import Navbar from '../components/Navbar'
import Pricing from '../components/Pricing'
import FAQ from '../components/FAQ'
import FinalCTA from '../components/FinalCTA'
import Footer from '../components/Footer'
import WhatsAppButton from '../components/WhatsAppButton'
import { trackWhatsAppClick } from '../lib/analytics'
import { buildWaUrl } from '../data/plans'
import { useDocumentHead } from '../lib/useDocumentHead'

export default function SegmentPage({ segment }) {
  useDocumentHead({
    title: segment.seo.title,
    description: segment.seo.description,
    path: segment.path,
  })

  const waUrl = buildWaUrl(segment.ctaMessage)

  return (
    <>
      <Navbar />

      {/* ── Segment hero — centered ── */}
      <section className="relative overflow-hidden bg-rp-bg" style={{ paddingTop: '128px', paddingBottom: '64px' }}>
        <div className="absolute inset-0 bg-dot-grid opacity-40 pointer-events-none" />
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[360px] rounded-full pointer-events-none opacity-[0.06]"
          style={{ background: '#1847D6', filter: 'blur(130px)' }}
        />

        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="section-label"
          >
            {segment.badge}
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="text-[1.9rem] sm:text-[2.6rem] lg:text-[3.2rem] font-bold text-[#0C1A38] leading-[1.1] tracking-tight mt-2 mb-5"
            style={{ textWrap: 'balance' }}
          >
            {segment.headline}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="text-base lg:text-lg text-[#4D5E7A] leading-relaxed mb-8 max-w-xl mx-auto"
          >
            {segment.subheadline}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-wrap justify-center gap-3"
          >
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackWhatsAppClick(`segment_${segment.slug}_hero`)}
              className="btn-green px-6 py-3.5 text-sm lg:text-base lg:px-8 lg:py-4"
            >
              <MessageCircle size={15} />
              Falar no WhatsApp
            </a>
            <a href="#planos" className="btn-secondary px-6 py-3.5 text-sm lg:text-base lg:px-8 lg:py-4">
              Ver planos
              <ArrowRight size={15} />
            </a>
          </motion.div>
        </div>

        {/* Image */}
        <motion.div
          initial={{ opacity: 0, y: 28, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 mt-14"
        >
          <div
            className="rounded-2xl overflow-hidden mx-auto"
            style={{
              border: '1.5px solid rgba(24,71,214,0.14)',
              boxShadow: '0 24px 60px rgba(24,71,214,0.10), 0 8px 24px rgba(0,0,0,0.05)',
              maxWidth: 720,
            }}
          >
            <img src={segment.heroImage} alt={segment.heroImageAlt} className="w-full block" loading="eager" />
          </div>
        </motion.div>
      </section>

      {/* ── Pain points ── */}
      <section className="py-20 bg-rp-surface relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-xl mx-auto mb-12">
            <span className="section-label">Feito para o seu dia a dia</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#0C1A38] tracking-tight mt-2">
              O que muda na prática
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            {segment.painPoints.map(({ icon: Icon, title, description }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="card-dark p-6 flex gap-4 items-start"
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(24,71,214,0.08)', border: '1px solid rgba(24,71,214,0.18)' }}
                >
                  <Icon size={20} style={{ color: '#1847D6' }} />
                </div>
                <div>
                  <h3 className="font-semibold text-[#0C1A38] text-[15px] mb-1.5 leading-snug">{title}</h3>
                  <p className="text-sm text-[#4D5E7A] leading-relaxed">{description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
      <WhatsAppButton />
    </>
  )
}
