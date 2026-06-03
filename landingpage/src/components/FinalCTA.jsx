import React from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Clock, Shield, Headphones, MessageCircle } from 'lucide-react'

const WA_URL  = 'https://wa.me/5524992272778?text=Ol%C3%A1!%20Tenho%20interesse%20no%20REGISTRA.PONTO.'
const WA_DEMO = 'https://wa.me/5524992272778?text=Ol%C3%A1!%20Gostaria%20de%20ver%20uma%20demonstra%C3%A7%C3%A3o%20do%20REGISTRA.PONTO.'

const perks = [
  { icon: Clock,      text: 'Implantação em até 48h' },
  { icon: Shield,     text: 'Sem fidelidade ou multa' },
  { icon: Headphones, text: 'Suporte incluso' },
]

export default function FinalCTA() {
  return (
    <section className="py-24 relative overflow-hidden bg-rp-surface">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-dot-grid opacity-30" />
        {/* Green radial spotlight */}
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 70% 60% at 50% 0%, rgba(0,232,122,0.09) 0%, transparent 70%)',
          }}
        />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full bg-emerald-600 opacity-[0.07] blur-[130px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[300px] rounded-full bg-teal-600 opacity-[0.04] blur-[100px]" />
      </div>

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="section-label mb-6"
        >
          Comece hoje
        </motion.span>

        <motion.h2
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1, duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="text-3xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-[1.1] mb-5 sm:mb-6"
        >
          Modernize o controle de ponto{' '}
          <span className="gradient-text">da sua empresa</span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="text-lg text-slate-400 mb-10 max-w-2xl mx-auto"
        >
          Fale com um consultor e receba uma proposta personalizada para o tamanho ideal da
          sua empresa. Implantação rápida, suporte incluso e sem fidelidade.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-3 justify-center mb-10 sm:mb-12"
        >
          <a href={WA_DEMO} target="_blank" rel="noopener noreferrer"
             className="btn-primary w-full sm:w-auto px-8 py-3.5 sm:py-4 text-base">
            Ver demonstração
            <ArrowRight size={18} />
          </a>
          <a href={WA_URL} target="_blank" rel="noopener noreferrer"
             className="btn-green w-full sm:w-auto px-8 py-3.5 sm:py-4 text-base">
            <MessageCircle size={18} />
            Falar no WhatsApp
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="flex flex-wrap justify-center gap-6"
        >
          {perks.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-2 text-sm text-slate-400">
              <Icon size={15} className="text-emerald-400 flex-shrink-0" />
              {text}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
