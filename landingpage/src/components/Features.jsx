import React, { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { Camera, Clock, BarChart2, Shield, Zap, Headphones } from 'lucide-react'

const features = [
  {
    icon: Camera,
    title: 'Reconhecimento facial moderno',
    description: 'Terminal tablet fixo na entrada com foto capturada em cada registro. Rápido, seguro e sem necessidade de cartão.',
    color: 'blue',
  },
  {
    icon: Clock,
    title: 'Controle automático de ponto',
    description: 'Entradas, saídas e intervalos registrados automaticamente. Sem planilhas manuais e sem margem para erros.',
    color: 'cyan',
  },
  {
    icon: BarChart2,
    title: 'Relatórios em tempo real',
    description: 'Painel completo com presenças, ausências e horas extras. Exporte em Excel pronto para o departamento pessoal.',
    color: 'blue',
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
    color: 'cyan',
  },
  {
    icon: Headphones,
    title: 'Suporte local e dedicado',
    description: 'Suporte técnico incluso em todos os planos. Atendimento próximo, com resposta rápida quando você precisar.',
    color: 'green',
  },
]

const colorMap = {
  blue: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    icon: 'text-blue-400',
    glow: '0 0 0 1px rgba(59,130,246,0.2), 0 16px 40px rgba(59,130,246,0.12)',
    hoverBorder: 'rgba(59,130,246,0.25)',
  },
  cyan: {
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
    icon: 'text-cyan-400',
    glow: '0 0 0 1px rgba(6,182,212,0.2), 0 16px 40px rgba(6,182,212,0.12)',
    hoverBorder: 'rgba(6,182,212,0.25)',
  },
  green: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    icon: 'text-emerald-400',
    glow: '0 0 0 1px rgba(16,185,129,0.2), 0 16px 40px rgba(16,185,129,0.12)',
    hoverBorder: 'rgba(16,185,129,0.25)',
  },
}

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
}

const item = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.21, 0.47, 0.32, 0.98] } },
}

export default function Features() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section className="py-24 bg-rp-surface relative overflow-hidden">
      <div className="absolute inset-0 bg-hero-grid opacity-40 pointer-events-none" />
      <div className="absolute top-0 right-1/4 w-[600px] h-[350px] rounded-full bg-blue-600/6 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[400px] h-[300px] rounded-full bg-cyan-600/5 blur-[100px] pointer-events-none" />

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
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, delay: 0.1 }}
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight mt-2 mb-4"
          >
            Por que escolher o{' '}
            <span className="gradient-text">REGISTRA.PONTO</span>?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, delay: 0.2 }}
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
                  y: -4,
                  boxShadow: c.glow,
                  borderColor: c.hoverBorder,
                  transition: { duration: 0.2 },
                }}
                className="card-dark p-6 group cursor-default"
              >
                <motion.div
                  whileHover={{ scale: 1.1, rotate: 3 }}
                  transition={{ duration: 0.2, type: 'spring', stiffness: 300 }}
                  className={`w-11 h-11 rounded-xl ${c.bg} border ${c.border} flex items-center justify-center mb-5`}
                >
                  <Icon size={20} className={c.icon} />
                </motion.div>
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
