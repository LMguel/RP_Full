import React from 'react'
import { motion } from 'framer-motion'
import { GraduationCap, ShoppingBag, UtensilsCrossed } from 'lucide-react'

const sectors = [
  {
    icon: GraduationCap,
    label: 'Escolas',
    description: 'Registro realizado diretamente no tablet, sem necessidade de cartão ou equipamento adicional.',
    color: 'blue',
  },
  {
    icon: ShoppingBag,
    label: 'Comércios',
    description: 'Acompanhamento centralizado da equipe com visibilidade em tempo real pelo painel.',
    color: 'sky',
  },
  {
    icon: UtensilsCrossed,
    label: 'Restaurantes',
    description: 'Controle simples e organizado da jornada, com exportação pronta para o departamento pessoal.',
    color: 'indigo',
  },
]

const colorMap = {
  blue:   { bg: 'rgba(24,71,214,0.08)',  border: 'rgba(24,71,214,0.18)',  icon: '#1847D6'  },
  sky:    { bg: 'rgba(14,165,233,0.08)', border: 'rgba(14,165,233,0.20)', icon: '#0EA5E9'  },
  indigo: { bg: 'rgba(79,70,229,0.08)',  border: 'rgba(79,70,229,0.18)',  icon: '#4F46E5'  },
}

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
}

const item = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
}

export default function Testimonial() {
  return (
    <section className="py-20 bg-rp-surface relative overflow-hidden">
      <div className="absolute inset-0 bg-dot-grid opacity-50 pointer-events-none" />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 55% 50% at 50% 50%, rgba(24,71,214,0.04) 0%, transparent 70%)' }}
      />

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="section-label"
          >
            Clientes
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#0C1A38] tracking-tight mt-2 mb-4"
          >
            REGISTRA<span style={{ color: '#1847D6' }}>.</span>PONTO{' '}
            <span className="gradient-text">em operação</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-[#4D5E7A] max-w-xl mx-auto"
          >
            Empresas utilizam o REGISTRA.PONTO diariamente para simplificar o controle de ponto.
          </motion.p>
        </div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          className="grid sm:grid-cols-3 gap-5"
        >
          {sectors.map(({ icon: Icon, label, description, color }) => {
            const c = colorMap[color]
            return (
              <motion.div
                key={label}
                variants={item}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="card-dark p-6 flex flex-col gap-4 cursor-default"
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: c.bg, border: `1px solid ${c.border}` }}
                >
                  <Icon size={20} style={{ color: c.icon }} />
                </div>
                <div>
                  <h3 className="font-bold text-[#0C1A38] text-[15px] mb-1.5">{label}</h3>
                  <p className="text-sm text-[#4D5E7A] leading-relaxed">{description}</p>
                </div>
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}
