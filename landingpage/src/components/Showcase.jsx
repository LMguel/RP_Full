import React from 'react'
import { motion } from 'framer-motion'
import { Check, ArrowRight } from 'lucide-react'

const accentMap = {
  blue: {
    label: 'text-blue-400',
    glowClass: 'bg-blue-600/8',
    glowColor: 'rgba(59,130,246,0.18)',
    border: 'border-blue-500/20',
    borderHover: 'rgba(59,130,246,0.35)',
    dot: 'bg-blue-400',
    check: 'bg-blue-500/10 text-blue-400',
    dot_pulse: 'bg-blue-400',
  },
  cyan: {
    label: 'text-cyan-400',
    glowClass: 'bg-cyan-500/8',
    glowColor: 'rgba(6,182,212,0.18)',
    border: 'border-cyan-500/20',
    borderHover: 'rgba(6,182,212,0.35)',
    dot: 'bg-cyan-400',
    check: 'bg-cyan-500/10 text-cyan-400',
    dot_pulse: 'bg-cyan-400',
  },
  green: {
    label: 'text-emerald-400',
    glowClass: 'bg-emerald-500/8',
    glowColor: 'rgba(16,185,129,0.18)',
    border: 'border-emerald-500/20',
    borderHover: 'rgba(16,185,129,0.35)',
    dot: 'bg-emerald-400',
    check: 'bg-emerald-500/10 text-emerald-400',
    dot_pulse: 'bg-emerald-400',
  },
}

export default function Showcase({ id, label, title, description, image, imageAlt, side, accent, features, onContact, imageClass }) {
  const c = accentMap[accent] || accentMap.blue
  const isRight = side === 'right'

  return (
    <section
      id={id}
      className={`py-20 lg:py-28 relative overflow-hidden ${isRight ? 'bg-rp-bg' : 'bg-rp-surface'}`}
    >
      <div className="absolute inset-0 bg-hero-grid opacity-25 pointer-events-none" />
      <div
        className={`absolute ${isRight ? 'right-[-10%]' : 'left-[-10%]'} top-1/2 -translate-y-1/2 w-[550px] h-[550px] rounded-full ${c.glowClass} blur-[140px] pointer-events-none`}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`grid lg:grid-cols-2 gap-12 lg:gap-20 items-center ${isRight ? '' : 'lg:[&>*:first-child]:order-2'}`}>

          {/* ── Text ── */}
          <motion.div
            initial={{ opacity: 0, x: isRight ? -28 : 28 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, ease: [0.21, 0.47, 0.32, 0.98] }}
          >
            <span className={`section-label ${c.label}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
              {label}
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mt-2 mb-4 leading-[1.15]">
              {title}
            </h2>
            <p className="text-slate-400 leading-relaxed mb-8 max-w-md">
              {description}
            </p>

            <ul className="space-y-3.5 mb-8">
              {features.map((f, i) => (
                <motion.li
                  key={f}
                  initial={{ opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 + i * 0.07, duration: 0.4 }}
                  className="flex items-center gap-3 text-sm text-slate-300"
                >
                  <span className={`flex-shrink-0 w-5 h-5 rounded-full ${c.check} flex items-center justify-center`}>
                    <Check size={11} strokeWidth={3} />
                  </span>
                  {f}
                </motion.li>
              ))}
            </ul>

            {onContact && (
              <motion.button
                onClick={onContact}
                whileHover={{ x: 2 }}
                transition={{ duration: 0.15 }}
                className="btn-secondary group"
              >
                Saiba mais
                <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform duration-150" />
              </motion.button>
            )}
          </motion.div>

          {/* ── Image ── */}
          <motion.div
            initial={{ opacity: 0, x: isRight ? 28 : -28, scale: 0.97 }}
            whileInView={{ opacity: 1, x: 0, scale: 1 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.65, delay: 0.1, ease: [0.21, 0.47, 0.32, 0.98] }}
            className="relative"
          >
            {/* Outer diffuse glow */}
            <div
              className="absolute -inset-6 rounded-3xl blur-3xl pointer-events-none opacity-70"
              style={{ background: `radial-gradient(ellipse at center, ${c.glowColor} 0%, transparent 70%)` }}
            />
            {/* Inner glow ring */}
            <div
              className="absolute -inset-px rounded-2xl pointer-events-none"
              style={{ background: `linear-gradient(135deg, ${c.glowColor} 0%, transparent 60%)`, opacity: 0.5 }}
            />

            <motion.div
              whileHover={{ scale: 1.015, transition: { duration: 0.3 } }}
              className={`relative rounded-2xl overflow-hidden ${c.border} border ${imageClass || ''}`}
              style={{
                boxShadow: `0 0 0 1px ${c.glowColor}, 0 24px 60px rgba(0,0,0,0.65), 0 8px 24px rgba(0,0,0,0.4)`,
              }}
            >
              <img
                src={image}
                alt={imageAlt}
                className="w-full block object-cover"
                loading="lazy"
              />
            </motion.div>
          </motion.div>

        </div>
      </div>
    </section>
  )
}
