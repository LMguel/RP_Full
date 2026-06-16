import React from 'react'
import { motion } from 'framer-motion'
import { FileSpreadsheet, MessageCircle } from 'lucide-react'

const highlights = [
  {
    icon: FileSpreadsheet,
    title: 'Exportação organizada para acompanhamento',
    description:
      'Os registros são consolidados e exportados em formato estruturado, facilitando a conferência e o fechamento do mês sem retrabalho.',
    color: 'blue',
  },
  {
    icon: MessageCircle,
    title: 'Fluxo avaliado por profissional da área contábil',
    description:
      'O fluxo operacional foi apresentado a profissional da área contábil, que destacou a simplicidade do processo como ponto positivo.',
    color: 'sky',
  },
]

const colorMap = {
  blue: { bg: 'rgba(24,71,214,0.08)', border: 'rgba(24,71,214,0.18)', icon: '#1847D6' },
  sky:  { bg: 'rgba(14,165,233,0.08)', border: 'rgba(14,165,233,0.20)', icon: '#0EA5E9' },
}

export default function OperationalValidation() {
  return (
    <section className="py-16 bg-rp-bg relative overflow-hidden">
      <div className="absolute inset-0 bg-dot-grid opacity-40 pointer-events-none" />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="section-label"
          >
            Praticidade
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="text-xl sm:text-2xl lg:text-3xl font-bold text-[#0C1A38] tracking-tight mt-2"
          >
            Pensado para facilitar a{' '}
            <span className="gradient-text">rotina administrativa</span>
          </motion.h2>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {highlights.map(({ icon: Icon, title, description, color }, i) => {
            const c = colorMap[color]
            return (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ delay: i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="card-dark p-5 flex gap-4 items-start"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: c.bg, border: `1px solid ${c.border}` }}
                >
                  <Icon size={18} style={{ color: c.icon }} />
                </div>
                <div>
                  <h3 className="font-semibold text-[#0C1A38] text-sm mb-1.5 leading-snug">{title}</h3>
                  <p className="text-xs text-[#4D5E7A] leading-relaxed">{description}</p>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
