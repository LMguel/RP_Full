import React from 'react'
import { motion } from 'framer-motion'
import { Settings, Tablet, Users, LayoutDashboard } from 'lucide-react'

const steps = [
  {
    number: '01',
    icon: Settings,
    title: 'Configuração da empresa',
    description: 'Cadastramos horários, jornadas, feriados e regras de banco de horas.',
    color: 'blue',
  },
  {
    number: '02',
    icon: Tablet,
    title: 'Instalação do tablet',
    description: 'Configuramos o dispositivo que será utilizado para os registros de ponto.',
    color: 'cyan',
  },
  {
    number: '03',
    icon: Users,
    title: 'Cadastro da equipe',
    description: 'Realizamos o cadastro dos funcionários e do reconhecimento facial.',
    color: 'blue',
  },
  {
    number: '04',
    icon: LayoutDashboard,
    title: 'Operação em funcionamento',
    description: 'Sua equipe registra o ponto em segundos e a gestão acompanha tudo pelo painel online.',
    color: 'cyan',
  },
]

const colorMap = {
  blue: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    icon: 'text-blue-400',
    numberColor: 'text-blue-500/30',
  },
  cyan: {
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
    icon: 'text-cyan-400',
    numberColor: 'text-cyan-500/30',
  },
}

export default function HowItWorks() {
  return (
    <section className="py-24 bg-rp-bg relative overflow-hidden">
      <div className="absolute inset-0 bg-hero-grid opacity-30 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[400px] rounded-full bg-blue-600/5 blur-[150px] pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="section-label"
          >
            Como funciona
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight mt-2 mb-4"
          >
            Implantação acompanhada{' '}
            <span className="gradient-text">do início ao fim</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-slate-400 text-lg max-w-2xl mx-auto"
          >
            Cuidamos de toda a configuração para que sua empresa comece a registrar ponto com reconhecimento facial sem complicação.
          </motion.p>
        </div>

        <div className="relative grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Connecting line — desktop */}
          <div className="hidden lg:block absolute top-[28px] left-[13%] right-[13%] h-px bg-gradient-to-r from-blue-500/25 via-cyan-500/25 to-blue-500/25" />

          {steps.map(({ number, icon: Icon, title, description, color }, i) => {
            const c = colorMap[color]
            return (
              <motion.div
                key={number}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.55, delay: i * 0.13, ease: [0.21, 0.47, 0.32, 0.98] }}
                className="relative flex flex-col items-center text-center lg:items-start lg:text-left"
              >
                {/* Icon with step number */}
                <div className="relative mb-6 z-10">
                  <div
                    className={`w-14 h-14 rounded-2xl ${c.bg} border ${c.border} flex items-center justify-center`}
                    style={{ boxShadow: `0 8px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)` }}
                  >
                    <Icon size={24} className={c.icon} />
                  </div>
                  <span
                    className={`absolute -top-3 -right-3 text-xs font-black ${c.numberColor} bg-rp-bg border border-white/[0.06] rounded-full w-6 h-6 flex items-center justify-center text-[10px] tracking-wide`}
                  >
                    {number}
                  </span>
                </div>

                <h3 className="font-bold text-white text-[15px] mb-2 leading-snug">{title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
