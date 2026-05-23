import React from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Clock, Shield, Headphones, MessageCircle } from 'lucide-react'

const WA_URL = 'https://wa.me/5524992272778?text=Olá!%20Tenho%20interesse%20no%20REGISTRA.PONTO.'

const perks = [
  { icon: Clock, text: 'Implantação em até 48h' },
  { icon: Shield, text: 'Sem fidelidade ou multa' },
  { icon: Headphones, text: 'Suporte incluso' },
]

export default function FinalCTA({ onContact }) {
  return (
    <section className="py-24 relative overflow-hidden bg-rp-surface">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-hero-grid opacity-30" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full bg-blue-600/10 blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[300px] rounded-full bg-cyan-500/8 blur-[100px]" />
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
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1, duration: 0.6 }}
          className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-[1.1] mb-6"
        >
          Modernize o controle de ponto{' '}
          <span className="gradient-text">da sua empresa</span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="text-lg text-slate-400 mb-10 max-w-2xl mx-auto"
        >
          Fale com um consultor e receba uma proposta personalizada para o tamanho ideal da sua empresa.
          Implantação rápida, suporte incluso e sem fidelidade.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-3 justify-center mb-12"
        >
          <button onClick={onContact} className="btn-primary px-8 py-4 text-base">
            Solicitar demonstração
            <ArrowRight size={18} />
          </button>
          <a
            href={WA_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-green px-8 py-4 text-base"
          >
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
              <Icon size={15} className="text-blue-400 flex-shrink-0" />
              {text}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
