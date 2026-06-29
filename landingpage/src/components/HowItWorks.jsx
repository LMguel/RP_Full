import React from 'react'
import { motion } from 'framer-motion'
import { Settings, Tablet, Users, LayoutDashboard } from 'lucide-react'

const steps = [
  {
    number: '01',
    icon: Settings,
    title: 'Configuração da empresa',
    description: 'Cadastramos horários, jornadas, feriados e regras de banco de horas conforme sua necessidade.',
    color: 'blue',
  },
  {
    number: '02',
    icon: Tablet,
    title: 'Instalação do tablet',
    description: 'Configuramos o dispositivo na entrada da empresa, pronto para uso imediato.',
    color: 'sky',
  },
  {
    number: '03',
    icon: Users,
    title: 'Cadastro da equipe',
    description: 'Realizamos o cadastro dos funcionários e o reconhecimento facial de todos.',
    color: 'blue',
  },
  {
    number: '04',
    icon: LayoutDashboard,
    title: 'Operação em funcionamento',
    description: 'Sua equipe registra o ponto em segundos e a gestão acompanha tudo pelo painel online.',
    color: 'sky',
  },
]

const colorMap = {
  blue: {
    bg:     'rgba(24,71,214,0.08)',
    border: 'rgba(24,71,214,0.18)',
    icon:   '#1847D6',
    number: '#1847D6',
  },
  sky: {
    bg:     'rgba(14,165,233,0.08)',
    border: 'rgba(14,165,233,0.18)',
    icon:   '#0EA5E9',
    number: '#0EA5E9',
  },
}

export default function HowItWorks() {
  return (
    <section className="py-24 bg-rp-bg relative overflow-hidden">
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[300px] rounded-full pointer-events-none opacity-[0.04]"
        style={{ background: '#1847D6', filter: 'blur(160px)' }}
      />

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
            className="text-2xl sm:text-4xl lg:text-5xl font-bold text-[#0C1A38] tracking-tight mt-2 mb-4"
          >
            Implantação acompanhada{' '}
            <span className="gradient-text">do início ao fim</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-[#4D5E7A] text-lg max-w-2xl mx-auto"
          >
            Cuidamos de toda a configuração para que sua empresa comece a registrar ponto com
            reconhecimento facial sem complicação.
          </motion.p>
        </div>

        <div className="relative grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Connecting line — desktop */}
          <div
            className="hidden lg:block absolute top-[28px] left-[13%] right-[13%] h-px pointer-events-none"
            style={{ background: 'linear-gradient(90deg, rgba(24,71,214,0.18), rgba(14,165,233,0.18), rgba(24,71,214,0.18))' }}
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
                      boxShadow: '0 8px 24px rgba(24,71,214,0.08), inset 0 1px 0 rgba(255,255,255,0.9)',
                    }}
                  >
                    <Icon size={24} style={{ color: c.icon }} />
                  </div>
                  <span
                    className="absolute -top-3 -right-3 text-[10px] font-black rounded-full w-6 h-6 flex items-center justify-center bg-white"
                    style={{
                      color: c.number,
                      border: '1.5px solid rgba(24,71,214,0.14)',
                      boxShadow: '0 2px 8px rgba(24,71,214,0.08)',
                    }}
                  >
                    {number}
                  </span>
                </div>

                <h3 className="font-bold text-[#0C1A38] text-[15px] mb-2 leading-snug">{title}</h3>
                <p className="text-sm text-[#4D5E7A] leading-relaxed">{description}</p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
