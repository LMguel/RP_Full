import React, { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { Tablet, Smartphone, BarChart2, FileSpreadsheet, Users, Headphones } from 'lucide-react'

const features = [
  {
    icon: Tablet,
    title: 'Tablet com facial',
    description: 'Terminal fixo na entrada da empresa com foto capturada em cada registro.',
    color: 'blue',
  },
  {
    icon: Smartphone,
    title: 'Mobile com GPS',
    description: 'Colaboradores externos registram o ponto no celular com geolocalização.',
    color: 'cyan',
  },
  {
    icon: BarChart2,
    title: 'Dashboard completo',
    description: 'Painel em tempo real com presenças, ausências e horas extras da equipe.',
    color: 'blue',
  },
  {
    icon: FileSpreadsheet,
    title: 'Exportação Excel',
    description: 'Espelho de ponto exportado em .xlsx pronto para o departamento pessoal.',
    color: 'green',
  },
  {
    icon: Users,
    title: 'Gestão de equipe',
    description: 'Cadastro de colaboradores, jornadas, turnos e histórico completo.',
    color: 'cyan',
  },
  {
    icon: Headphones,
    title: 'Suporte incluso',
    description: 'Implantação e suporte incluso em todos os planos. Respondemos em 24h.',
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
            Tudo que você precisa
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, delay: 0.1 }}
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight mt-2 mb-4"
          >
            Uma plataforma. Todas as modalidades.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, delay: 0.2 }}
            className="text-slate-400 text-lg max-w-2xl mx-auto"
          >
            Do tablet fixo ao celular em campo — controle completo da jornada de trabalho da sua equipe em um único sistema.
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
