import React from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, CheckCircle2, Shield, Clock, BarChart3 } from 'lucide-react'

const stats = [
  {
    icon: Clock,
    value: '< 30min',
    label: 'para implantar',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    icon_c: 'text-blue-400',
    glow: 'rgba(59,130,246,0.15)',
  },
  {
    icon: Shield,
    value: '100%',
    label: 'conforme CLT',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    icon_c: 'text-emerald-400',
    glow: 'rgba(16,185,129,0.15)',
  },
  {
    icon: BarChart3,
    value: 'Excel',
    label: 'pronto para DP',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
    icon_c: 'text-cyan-400',
    glow: 'rgba(6,182,212,0.15)',
  },
]

const trust = ['Implantação inclusa', 'Sem fidelidade', 'Suporte incluso']

const statContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.65 } },
}

const statItem = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.21, 0.47, 0.32, 0.98] } },
}

export default function Hero({ onContact }) {
  return (
    <section className="relative min-h-screen flex flex-col justify-center overflow-hidden pt-[68px]">

      {/* ── Background atmosphere ── */}
      <div className="absolute inset-0 bg-hero-grid opacity-60 pointer-events-none" />
      <motion.div
        animate={{ scale: [1, 1.05, 1], opacity: [0.08, 0.13, 0.08] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-[-10%] left-[10%] w-[700px] h-[700px] rounded-full bg-blue-600 blur-[130px] pointer-events-none"
      />
      <div className="absolute top-[30%] right-[-5%] w-[400px] h-[400px] rounded-full bg-cyan-600/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-[-5%] w-[450px] h-[350px] rounded-full bg-blue-900/20 blur-[100px] pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">

          {/* ── Left — Copy ── */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
            >
              <div className="feature-badge mb-6 w-fit">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Sistema de ponto eletrônico B2B
              </div>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-[3.4rem] font-bold text-white leading-[1.08] tracking-tight mb-6"
            >
              Controle de ponto{' '}
              <span className="gradient-text">eletrônico</span>{' '}
              simples e confiável
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.2 }}
              className="text-lg text-slate-400 leading-relaxed mb-8 max-w-[480px]"
            >
              Tablet com reconhecimento facial ou mobile com GPS. Dashboard completo,
              relatórios prontos e exportação Excel inclusos. Da implantação ao suporte — tudo resolvido.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.3 }}
              className="flex flex-wrap gap-3 mb-10"
            >
              <button onClick={onContact} className="btn-primary px-7 py-3.5 text-[15px]">
                Falar com consultor
                <ArrowRight size={16} />
              </button>
              <a href="#planos" className="btn-secondary px-7 py-3.5 text-[15px]">
                Ver planos e preços
              </a>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="flex flex-wrap gap-x-6 gap-y-2"
            >
              {trust.map((t) => (
                <div key={t} className="flex items-center gap-2 text-sm text-slate-400">
                  <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0" />
                  {t}
                </div>
              ))}
            </motion.div>
          </div>

          {/* ── Right — Dashboard screenshot ── */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.2, ease: [0.21, 0.47, 0.32, 0.98] }}
            className="relative"
          >
            {/* Multi-layer glow */}
            <div className="absolute -inset-6 bg-gradient-to-r from-blue-600/20 via-cyan-500/10 to-blue-600/15 rounded-3xl blur-3xl pointer-events-none" />
            <div className="absolute -inset-2 bg-blue-600/8 rounded-3xl blur-xl pointer-events-none" />

            {/* Screenshot container */}
            <div
              className="relative rounded-2xl overflow-hidden"
              style={{
                border: '1px solid rgba(255,255,255,0.10)',
                boxShadow:
                  '0 0 0 1px rgba(59,130,246,0.12), 0 24px 64px rgba(0,0,0,0.7), 0 8px 24px rgba(0,0,0,0.5)',
              }}
            >
              {/* Top chrome bar */}
              <div className="flex items-center gap-1.5 px-4 py-2.5 bg-[#0A1628] border-b border-white/[0.06]">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
                <div className="ml-3 flex-1 h-4 rounded bg-white/[0.05] flex items-center px-2">
                  <span className="text-[9px] text-slate-600 tracking-wide">app.registra.ponto.com.br</span>
                </div>
              </div>
              <img
                src="/image/dashboard.png"
                alt="Dashboard do REGISTRA.PONTO"
                className="w-full block"
                loading="eager"
              />
              {/* Bottom fade */}
              <div className="absolute bottom-0 inset-x-0 h-20 bg-gradient-to-t from-rp-bg/60 to-transparent pointer-events-none" />
            </div>

            {/* Floating badge — top right */}
            <motion.div
              animate={{ y: [0, -9, 0] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -top-5 -right-5 glass rounded-2xl px-4 py-3 hidden sm:flex items-center gap-3"
              style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(16,185,129,0.15)' }}
            >
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 size={16} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white leading-none mb-1">Ponto registrado</p>
                <p className="text-xs text-slate-400">08:47 · Carlos Silva</p>
              </div>
            </motion.div>

            {/* Floating badge — bottom left */}
            <motion.div
              animate={{ y: [0, 9, 0] }}
              transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
              className="absolute -bottom-5 -left-5 glass rounded-2xl px-4 py-3 hidden sm:block"
              style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(59,130,246,0.12)' }}
            >
              <p className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider font-medium">Ativos agora</p>
              <p className="text-xl font-black text-white leading-none">
                24{' '}
                <span className="text-emerald-400 text-sm font-semibold">online</span>
              </p>
            </motion.div>
          </motion.div>
        </div>

        {/* ── Stats — premium mini cards ── */}
        <motion.div
          variants={statContainer}
          initial="hidden"
          animate="visible"
          className="mt-20 grid grid-cols-3 gap-4 max-w-2xl mx-auto"
        >
          {stats.map(({ icon: Icon, value, label, bg, border, icon_c, glow }) => (
            <motion.div
              key={label}
              variants={statItem}
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
              className="stat-card"
              style={{ '--glow': glow }}
            >
              <div className={`w-10 h-10 rounded-xl ${bg} border ${border} flex items-center justify-center flex-shrink-0`}>
                <Icon size={18} className={icon_c} />
              </div>
              <div>
                <p className="text-2xl font-black text-white leading-none tracking-tight mb-1">
                  {value}
                </p>
                <p className="text-xs text-slate-500 leading-none">{label}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
