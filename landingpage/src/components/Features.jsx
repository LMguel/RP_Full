import React, { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { Camera, Clock, BarChart2, Shield, Zap, Headphones } from 'lucide-react'

const features = [
  {
    icon: Camera,
    title: 'Reconhecimento facial moderno',
    description: 'Terminal tablet fixo na entrada com foto capturada em cada registro. Rápido, seguro e sem necessidade de cartão.',
    color: 'green',
  },
  {
    icon: Clock,
    title: 'Controle automático de ponto',
    description: 'Entradas, saídas e intervalos registrados automaticamente. Sem planilhas manuais e sem margem para erros.',
    color: 'teal',
  },
  {
    icon: BarChart2,
    title: 'Relatórios em tempo real',
    description: 'Painel completo com presenças, ausências e horas extras. Exporte em Excel pronto para o departamento pessoal.',
    color: 'cyan',
  },
  {
    icon: Shield,
    title: 'Redução de erros manuais',
    description: 'Elimine fraudes e inconsistências. Cada registro tem foto e horário preciso, em conformidade com a CLT.',
    color: 'green',
  },
  {
    icon: Zap,
    title: 'Implantação rápida',
    description: 'Sistema configurado e funcionando no mesmo dia. Levamos o tablet pronto, fazemos a instalação e o treinamento.',
    color: 'teal',
  },
  {
    icon: Headphones,
    title: 'Suporte local e dedicado',
    description: 'Suporte técnico incluso em todos os planos. Atendimento próximo, com resposta rápida quando você precisar.',
    color: 'cyan',
  },
]

const colorMap = {
  green: {
    bg: 'rgba(0,232,122,0.10)',
    border: 'rgba(0,232,122,0.22)',
    icon: '#00E87A',
    glow: '0 0 0 1px rgba(0,232,122,0.20), 0 16px 40px rgba(0,232,122,0.10)',
    hoverBorder: 'rgba(0,232,122,0.28)',
  },
  teal: {
    bg: 'rgba(20,184,166,0.10)',
    border: 'rgba(20,184,166,0.22)',
    icon: '#2DD4BF',
    glow: '0 0 0 1px rgba(20,184,166,0.20), 0 16px 40px rgba(20,184,166,0.10)',
    hoverBorder: 'rgba(20,184,166,0.28)',
  },
  cyan: {
    bg: 'rgba(6,182,212,0.10)',
    border: 'rgba(6,182,212,0.22)',
    icon: '#22D3EE',
    glow: '0 0 0 1px rgba(6,182,212,0.20), 0 16px 40px rgba(6,182,212,0.10)',
    hoverBorder: 'rgba(6,182,212,0.28)',
  },
}

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
}

const item = {
  hidden:  { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
}

export default function Features() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section className="py-24 bg-rp-surface relative overflow-hidden">
      <div className="absolute inset-0 bg-dot-grid opacity-40 pointer-events-none" />
      <div className="absolute top-0 right-1/4 w-[600px] h-[350px] rounded-full bg-emerald-600 opacity-[0.05] blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[400px] h-[300px] rounded-full bg-teal-600 opacity-[0.04] blur-[100px] pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="section-label"
          >
            Benefícios
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="text-2xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight mt-2 mb-4"
          >
            Por que escolher o{' '}
            <span className="gradient-text">REGISTRA.PONTO</span>?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-slate-400 text-lg max-w-2xl mx-auto"
          >
            Sistema completo, fácil de usar e com suporte local dedicado para empresas de qualquer porte.
          </motion.p>
        </div>

        <motion.div
          ref={ref}
          variants={container}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {features.map(({ icon: Icon, title, description, color }) => {
            const c = colorMap[color]
            return (
              <motion.div
                key={title}
                variants={item}
                whileHover={{
                  y: -5,
                  boxShadow: c.glow,
                  transition: { duration: 0.2 },
                }}
                className="card-dark p-6 group cursor-default"
                style={{ borderColor: 'rgba(255,255,255,0.07)' }}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 transition-transform duration-200 group-hover:scale-110 group-hover:rotate-3"
                  style={{ background: c.bg, border: `1px solid ${c.border}` }}
                >
                  <Icon size={20} style={{ color: c.icon }} />
                </div>
                <h3 className="font-semibold text-white mb-2 text-[15px]">{title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}
