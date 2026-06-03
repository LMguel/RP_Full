import React from 'react'
import { motion } from 'framer-motion'
import { Settings, Tablet, Users, LayoutDashboard } from 'lucide-react'

const steps = [
  {
    number: '01',
    icon: Settings,
    title: 'Configuração da empresa',
    description: 'Cadastramos horários, jornadas, feriados e regras de banco de horas.',
    color: 'green',
  },
  {
    number: '02',
    icon: Tablet,
    title: 'Instalação do tablet',
    description: 'Configuramos o dispositivo que será utilizado para os registros de ponto.',
    color: 'teal',
  },
  {
    number: '03',
    icon: Users,
    title: 'Cadastro da equipe',
    description: 'Realizamos o cadastro dos funcionários e do reconhecimento facial.',
    color: 'green',
  },
  {
    number: '04',
    icon: LayoutDashboard,
    title: 'Operação em funcionamento',
    description: 'Sua equipe registra o ponto em segundos e a gestão acompanha tudo pelo painel online.',
    color: 'teal',
  },
]

const colorMap = {
  green: {
    bg: 'rgba(0,232,122,0.10)',
    border: 'rgba(0,232,122,0.22)',
    icon: '#00E87A',
    number: 'rgba(0,232,122,0.35)',
  },
  teal: {
    bg: 'rgba(20,184,166,0.10)',
    border: 'rgba(20,184,166,0.22)',
    icon: '#2DD4BF',
    number: 'rgba(20,184,166,0.35)',
  },
}

export default function HowItWorks() {
  return (
    <section className="py-24 bg-rp-bg relative overflow-hidden">
      <div className="absolute inset-0 bg-dot-grid opacity-30 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[400px] rounded-full bg-emerald-600 opacity-[0.04] blur-[150px] pointer-events-none" />

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
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="text-2xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight mt-2 mb-4"
          >
            Implantação acompanhada{' '}
            <span className="gradient-text">do início ao fim</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-slate-400 text-lg max-w-2xl mx-auto"
          >
            Cuidamos de toda a configuração para que sua empresa comece a registrar ponto com
            reconhecimento facial sem complicação.
          </motion.p>
        </div>

        <div className="relative grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Connecting line — desktop */}
          <div
            className="hidden lg:block absolute top-[28px] left-[13%] right-[13%] h-px pointer-events-none"
            style={{ background: 'linear-gradient(90deg, rgba(0,232,122,0.20), rgba(20,184,166,0.20), rgba(0,232,122,0.20))' }}
          />

          {steps.map(({ number, icon: Icon, title, description, color }, i) => {
            const c = colorMap[color]
            return (
              <motion.div
                key={number}
                initial={{ opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.58, delay: i * 0.13, ease: [0.22, 1, 0.36, 1] }}
                className="relative flex flex-col items-center text-center lg:items-start lg:text-left"
              >
                <div className="relative mb-6 z-10">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{
                      background: c.bg,
                      border: `1px solid ${c.border}`,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)',
                    }}
                  >
                    <Icon size={24} style={{ color: c.icon }} />
                  </div>
                  <span
                    className="absolute -top-3 -right-3 text-[10px] font-black rounded-full w-6 h-6 flex items-center justify-center bg-rp-bg"
                    style={{
                      color: c.number,
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
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
