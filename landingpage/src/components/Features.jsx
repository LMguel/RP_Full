import React, { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { Camera, BarChart2, Shield, Zap, BrainCircuit, WifiOff } from 'lucide-react'

const features = [
  {
    icon: BrainCircuit,
    title: 'Chatbot de RH com inteligência artificial',
    description: 'Consulte presenças, faltas e banco de horas de qualquer funcionário em linguagem natural — sem abrir relatório, sem esperar. O assistente responde em segundos com os dados do seu time.',
    color: 'blue',
    span: 2,
    wide: true,
  },
  {
    icon: Camera,
    title: 'Reconhecimento facial moderno',
    description: 'Tablet fixo na entrada com foto capturada em cada registro. Rápido, seguro e sem necessidade de cartão ou senha.',
    color: 'sky',
    span: 1,
  },
  {
    icon: Shield,
    title: 'Sem fraude, sem conflito',
    description: 'Cada registro tem foto e horário preciso. Conformidade total com a CLT e segurança para evitar autuações trabalhistas.',
    color: 'blue',
    span: 1,
  },
  {
    icon: BarChart2,
    title: 'Relatórios prontos para o DP',
    description: 'Painel completo com presenças, ausências e horas extras. Exporte em Excel pronto para o departamento pessoal.',
    color: 'sky',
    span: 1,
  },
  {
    icon: Zap,
    title: 'Implantação em até 48 horas',
    description: 'Levamos o tablet configurado, instalamos e treinamos a equipe. Operacional em horas, não em semanas.',
    color: 'blue',
    span: 1,
    smSpan: 2,
  },
  {
    icon: WifiOff,
    title: 'Funciona sem internet',
    description: 'Os registros continuam normalmente mesmo sem conexão. Assim que a internet voltar, tudo é sincronizado automaticamente — sem perda de dados.',
    color: 'sky',
    span: 3,
    wide: true,
  },
]

const colorMap = {
  blue: {
    bg:    'rgba(24,71,214,0.08)',
    border:'rgba(24,71,214,0.18)',
    icon:  '#1847D6',
    glow:  '0 0 0 1px rgba(24,71,214,0.14), 0 16px 40px rgba(24,71,214,0.09)',
  },
  sky: {
    bg:    'rgba(56,189,248,0.09)',
    border:'rgba(56,189,248,0.22)',
    icon:  '#0EA5E9',
    glow:  '0 0 0 1px rgba(56,189,248,0.16), 0 16px 40px rgba(56,189,248,0.09)',
  },
}

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
}

const item = {
  hidden:  { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
}

export default function Features() {
  const ref    = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section className="py-24 bg-rp-surface relative overflow-hidden">
      <div
        className="absolute top-0 right-1/4 w-[500px] h-[300px] rounded-full pointer-events-none opacity-[0.05]"
        style={{ background: '#1847D6', filter: 'blur(130px)' }}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header — left-aligned, split layout */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-14">
          <div>
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="section-label"
            >
              Funcionalidades
            </motion.span>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="text-2xl sm:text-4xl lg:text-5xl font-bold text-[#0C1A38] tracking-tight mt-2"
              style={{ textWrap: 'balance' }}
            >
              Tudo que você precisa,{' '}
              <span className="gradient-text">numa plataforma só</span>
            </motion.h2>
          </div>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-[#4D5E7A] text-base lg:max-w-xs lg:text-right lg:pb-1 shrink-0"
          >
            Sistema completo, fácil de usar e com suporte local para empresas de qualquer porte.
          </motion.p>
        </div>

        {/* Asymmetric grid */}
        <motion.div
          ref={ref}
          variants={container}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {features.map(({ icon: Icon, title, description, color, span, smSpan, wide }) => {
            const c = colorMap[color]
            const colSpanClass =
              span === 3 ? 'sm:col-span-2 lg:col-span-3'
              : span === 2 ? 'lg:col-span-2'
              : smSpan === 2 ? 'sm:col-span-2 lg:col-span-1'
              : ''

            return (
              <motion.div
                key={title}
                variants={item}
                whileHover={{ y: -4, boxShadow: c.glow, transition: { duration: 0.2 } }}
                className={`card-dark group cursor-default ${colSpanClass} ${wide ? 'flex flex-row gap-6 p-6 items-start' : 'p-6'}`}
              >
                <div className={wide ? 'flex flex-col gap-5 flex-1' : ''}>
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-110 group-hover:rotate-3"
                    style={{ background: c.bg, border: `1px solid ${c.border}` }}
                  >
                    <Icon size={20} style={{ color: c.icon }} />
                  </div>
                  <div className={wide ? '' : 'mt-5'}>
                    <h3 className="font-semibold text-[#0C1A38] text-[15px] mb-2 leading-snug">{title}</h3>
                    <p className="text-sm text-[#4D5E7A] leading-relaxed">{description}</p>
                  </div>
                </div>

                {/* Wide card right side accent */}
                {wide && span === 2 && (
                  <div className="hidden sm:flex items-center justify-center flex-shrink-0 w-28 lg:w-36">
                    <span
                      className="inline-flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wider"
                      style={{ background: 'rgba(24,71,214,0.09)', color: '#1847D6', border: '1px solid rgba(24,71,214,0.18)' }}
                    >
                      Novidade
                    </span>
                  </div>
                )}
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}
