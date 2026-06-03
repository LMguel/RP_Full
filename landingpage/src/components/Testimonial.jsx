import React from 'react'
import { motion } from 'framer-motion'
import { Star, BadgeCheck } from 'lucide-react'

const data = {
  quote:    'O REGISTRA.PONTO nos deu controle total sobre a jornada dos funcionários. Acabaram os conflitos de horário e hoje temos total segurança para evitar problemas trabalhistas.',
  name:     'Centro Educacional Positiva Idade',
  role:     'Cliente desde 2025',
  initials: 'CP',
}

export default function Testimonial() {
  return (
    <section className="py-16 sm:py-20 bg-rp-surface relative overflow-hidden">
      <div className="absolute inset-0 bg-dot-grid opacity-25 pointer-events-none" />
      {/* Radial green spotlight */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 55% 55% at 50% 50%, rgba(0,232,122,0.055) 0%, transparent 70%)' }}
      />

      <div className="relative max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="relative rounded-3xl p-7 sm:p-10"
          style={{
            background: 'linear-gradient(145deg, #0C1830 0%, #080F1E 100%)',
            border: '1px solid rgba(0,232,122,0.17)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          {/* Decorative opening quote */}
          <span
            aria-hidden
            className="absolute top-4 left-6 sm:top-6 sm:left-8 select-none pointer-events-none"
            style={{
              fontSize: '88px',
              lineHeight: 1,
              fontFamily: 'Georgia, serif',
              color: 'rgba(0,232,122,0.09)',
              userSelect: 'none',
            }}
          >
            "
          </span>

          {/* Stars */}
          <div className="flex items-center gap-1 mb-5 relative z-10">
            {[0,1,2,3,4].map(i => (
              <Star key={i} size={15} fill="#00E87A" strokeWidth={0} />
            ))}
          </div>

          {/* Quote text */}
          <blockquote
            className="text-slate-200 text-[15px] sm:text-base leading-relaxed mb-7 relative z-10"
            style={{ fontStyle: 'normal' }}
          >
            "{data.quote}"
          </blockquote>

          {/* Author row */}
          <div className="flex items-center gap-3 sm:gap-4 relative z-10">
            {/* Avatar */}
            <div
              className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center flex-shrink-0 text-sm font-black"
              style={{
                background: 'linear-gradient(135deg, rgba(0,232,122,0.18), rgba(0,200,107,0.10))',
                border: '1.5px solid rgba(0,232,122,0.32)',
                color: '#00E87A',
                fontFamily: 'Outfit, sans-serif',
                letterSpacing: '0.02em',
              }}
            >
              {data.initials}
            </div>

            <div className="flex-1 min-w-0">
              <p
                className="font-semibold text-white text-sm leading-tight"
                style={{ fontFamily: 'Outfit, sans-serif' }}
              >
                {data.name}
              </p>
              <p className="text-slate-500 text-xs mt-0.5">{data.role}</p>
            </div>

            {/* Verified badge — hidden on the smallest screens */}
            <div
              className="hidden xs:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full flex-shrink-0"
              style={{
                background: 'rgba(0,232,122,0.07)',
                border: '1px solid rgba(0,232,122,0.17)',
              }}
            >
              <BadgeCheck size={12} style={{ color: '#00E87A' }} />
              <span className="text-[10px] font-semibold text-emerald-400 tracking-wide whitespace-nowrap">
                Cliente verificado
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
