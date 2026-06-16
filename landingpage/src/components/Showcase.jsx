import React from 'react'
import { motion } from 'framer-motion'
import { Check, ArrowRight } from 'lucide-react'

const WA_BASE = 'https://wa.me/5524992272778?text='

const accentMap = {
  blue: {
    label:       'text-[#1847D6]',
    glowColor:   'rgba(24,71,214,0.12)',
    glowBlur:    '#1847D6',
    border:      'rgba(24,71,214,0.14)',
    dot:         'bg-[#1847D6]',
    check:       { bg: 'rgba(24,71,214,0.10)', color: '#1847D6' },
  },
  sky: {
    label:       'text-[#0EA5E9]',
    glowColor:   'rgba(14,165,233,0.12)',
    glowBlur:    '#0EA5E9',
    border:      'rgba(14,165,233,0.16)',
    dot:         'bg-[#0EA5E9]',
    check:       { bg: 'rgba(14,165,233,0.10)', color: '#0EA5E9' },
  },
  indigo: {
    label:       'text-[#4F46E5]',
    glowColor:   'rgba(79,70,229,0.10)',
    glowBlur:    '#4F46E5',
    border:      'rgba(79,70,229,0.14)',
    dot:         'bg-[#4F46E5]',
    check:       { bg: 'rgba(79,70,229,0.09)', color: '#4F46E5' },
  },
}

export default function Showcase({ id, label, title, description, image, imageAlt, side, accent, features, imageClass }) {
  const c      = accentMap[accent] || accentMap.blue
  const isRight = side === 'right'
  const waUrl  = `${WA_BASE}${encodeURIComponent(`Olá! Gostaria de saber mais sobre ${label} no REGISTRA.PONTO.`)}`

  return (
    <section
      id={id}
      className={`py-20 lg:py-28 relative overflow-hidden ${isRight ? 'bg-rp-bg' : 'bg-rp-surface'}`}
    >
      <div className="absolute inset-0 bg-dot-grid opacity-50 pointer-events-none" />
      <div
        className={`absolute ${isRight ? 'right-[-10%]' : 'left-[-10%]'} top-1/2 -translate-y-1/2 w-[550px] h-[550px] rounded-full pointer-events-none opacity-[0.05]`}
        style={{ background: c.glowBlur, filter: 'blur(140px)' }}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`grid lg:grid-cols-2 gap-8 lg:gap-20 items-center ${isRight ? '' : 'lg:[&>*:first-child]:order-2'}`}>

          {/* ── Text ── */}
          <motion.div
            initial={{ opacity: 0, x: isRight ? -28 : 28 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className={`section-label ${c.label}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
              {label}
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#0C1A38] tracking-tight mt-2 mb-4 leading-[1.14]">
              {title}
            </h2>
            <p className="text-[#4D5E7A] leading-relaxed mb-8 max-w-md">
              {description}
            </p>

            <ul className="space-y-3.5 mb-8">
              {features.map((f, i) => (
                <motion.li
                  key={f}
                  initial={{ opacity: 0, x: -14 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 + i * 0.07, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  className="flex items-center gap-3 text-sm text-[#4D5E7A]"
                >
                  <span
                    className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: c.check.bg }}
                  >
                    <Check size={11} strokeWidth={3} style={{ color: c.check.color }} />
                  </span>
                  {f}
                </motion.li>
              ))}
            </ul>

            <motion.a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ x: 2 }}
              transition={{ duration: 0.15 }}
              className="btn-secondary group"
            >
              Saiba mais
              <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform duration-150" />
            </motion.a>
          </motion.div>

          {/* ── Image ── */}
          <motion.div
            initial={{ opacity: 0, x: isRight ? 28 : -28, scale: 0.97 }}
            whileInView={{ opacity: 1, x: 0, scale: 1 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            {/* Diffuse glow */}
            <div
              className="absolute -inset-6 rounded-3xl blur-3xl pointer-events-none opacity-50"
              style={{ background: `radial-gradient(ellipse at center, ${c.glowColor} 0%, transparent 70%)` }}
            />

            <motion.div
              whileHover={{ scale: 1.015, transition: { duration: 0.3 } }}
              className="relative rounded-2xl overflow-hidden"
              style={{
                border: `1.5px solid ${c.border}`,
                boxShadow: `0 0 0 1px ${c.glowColor}, 0 24px 60px rgba(24,71,214,0.09), 0 8px 24px rgba(0,0,0,0.05)`,
              }}
            >
              <img
                src={image}
                alt={imageAlt}
                className={imageClass ?? 'w-full block'}
                loading="lazy"
              />
            </motion.div>
          </motion.div>

        </div>
      </div>
    </section>
  )
}
