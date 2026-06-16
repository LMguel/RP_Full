import React, { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { Camera, BarChart2, Shield, Zap, BrainCircuit, WifiOff } from 'lucide-react'

const features = [
  {
    icon: BrainCircuit,
    title: 'Chatbot de RH com Inteligência Artificial',
    description: 'Consulte presenças, faltas e banco de horas de qualquer funcionário em linguagem natural — sem abrir relatório, sem esperar. O assistente responde em segundos com os dados do seu time.',
    color: 'blue',
    large: true,
  },
  {
    icon: Camera,
    title: 'Reconhecimento facial moderno',
    description: 'Tablet fixo na entrada com foto capturada em cada registro. Rápido, seguro e sem necessidade de cartão ou senha.',
    color: 'sky',
    large: false,
  },
  {
    icon: Shield,
    title: 'Sem fraude, sem conflito',
    description: 'Cada registro tem foto e horário preciso. Conformidade total com a CLT e segurança para evitar autuações trabalhistas.',
    color: 'blue',
    large: false,
  },
  {
    icon: BarChart2,
    title: 'Relatórios prontos para o DP',
    description: 'Painel completo com presenças, ausências e horas extras. Exporte em Excel pronto para o departamento pessoal.',
    color: 'sky',
    large: false,
  },
  {
    icon: Zap,
    title: 'Implantação em até 48 horas',
    description: 'Levamos o tablet configurado, instalamos e treinamos a equipe. Operacional em horas, não em semanas.',
    color: 'blue',
    large: false,
  },
  {
    icon: WifiOff,
    title: 'Funciona sem internet',
    description: 'Os registros continuam normalmente mesmo sem conexão. Assim que a internet voltar, tudo é sincronizado automaticamente — sem perda de dados.',
    color: 'sky',
    large: false,
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
      <div className="absolute inset-0 bg-dot-grid opacity-60 pointer-events-none" />
      <div
        className="absolute top-0 right-1/4 w-[600px] h-[350px] rounded-full pointer-events-none opacity-[0.06]"
        style={{ background: '#1847D6', filter: 'blur(120px)' }}
      />
      <div
        className="absolute bottom-0 left-1/4 w-[400px] h-[300px] rounded-full pointer-events-none opacity-[0.05]"
        style={{ background: '#38BDF8', filter: 'blur(100px)' }}
      />

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
            className="text-2xl sm:text-4xl lg:text-5xl font-bold text-[#0C1A38] tracking-tight mt-2 mb-4"
          >
            Por que escolher o{' '}
            <span className="gradient-text">REGISTRA.PONTO</span>?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-[#4D5E7A] text-lg max-w-2xl mx-auto"
          >
            Sistema completo, fácil de usar e com suporte local para empresas de qualquer porte.
          </motion.p>
        </div>

        <motion.div
          ref={ref}
          variants={container}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {features.map(({ icon: Icon, title, description, color, large: isLarge }) => {
            const c = colorMap[color]
            return (
              <motion.div
                key={title}
                variants={item}
                whileHover={{ y: -5, boxShadow: c.glow, transition: { duration: 0.2 } }}
                className="card-dark p-6 group cursor-default"
                style={isLarge ? { background: 'linear-gradient(135deg, rgba(24,71,214,0.04) 0%, #FFFFFF 60%)' } : {}}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 transition-transform duration-200 group-hover:scale-110 group-hover:rotate-3"
                  style={{ background: c.bg, border: `1px solid ${c.border}` }}
                >
                  <Icon size={20} style={{ color: c.icon }} />
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-[#0C1A38] text-[15px]">{title}</h3>
                  {isLarge && (
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex-shrink-0"
                      style={{ background: 'rgba(24,71,214,0.09)', color: '#1847D6', border: '1px solid rgba(24,71,214,0.18)' }}
                    >
                      Novidade
                    </span>
                  )}
                </div>
                <p className="text-sm text-[#4D5E7A] leading-relaxed">{description}</p>
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}
