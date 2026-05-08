import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Tablet, Smartphone, Layers, ArrowRight, Info } from 'lucide-react'

const ranges = [
  { label: 'Até 10 func.', key: '10' },
  { label: '11 a 20 func.', key: '20' },
  { label: '21 a 30 func.', key: '30' },
]

const plans = [
  {
    id: 'tablet',
    icon: Tablet,
    name: 'Tablet',
    tagline: 'Registro em dispositivo fixo',
    popular: true,
    accent: 'blue',
    prices: { '10': 129, '20': 159, '30': 199 },
    description: 'Ideal para empresas que registram o ponto em um dispositivo fixo instalado na entrada.',
    features: [
      'Terminal tablet fixo na empresa',
      'Foto capturada em cada registro',
      'Painel de gestão completo',
      'Relatórios e exportação Excel',
      'Suporte inicial incluso',
    ],
    note: '* Tablet fornecido pelo cliente ou cotado à parte.',
  },
  {
    id: 'mobile',
    icon: Smartphone,
    name: 'Mobile',
    tagline: 'Registro no celular com GPS',
    popular: false,
    accent: 'cyan',
    prices: { '10': 149, '20': 179, '30': 219 },
    description: 'Ideal para equipes em campo que precisam de registro pelo celular com geolocalização.',
    features: [
      'App no celular do colaborador',
      'Geolocalização em cada registro',
      'Painel de gestão completo',
      'Relatórios e exportação Excel',
      'Suporte inicial incluso',
    ],
  },
  {
    id: 'hibrido',
    icon: Layers,
    name: 'Híbrido',
    tagline: 'Tablet + Mobile no mesmo contrato',
    popular: false,
    accent: 'green',
    prices: { '10': 189, '20': 229, '30': 279 },
    description: 'Ideal para empresas que precisam de tablet fixo na sede e mobile para equipes externas.',
    features: [
      'Tablet + Mobile habilitados',
      'Painel de gestão unificado',
      'Geolocalização inclusa',
      'Relatórios e exportação Excel',
      'Suporte inicial incluso',
    ],
  },
]

const accentCard = {
  blue: {
    border: 'border-blue-500/30',
    glow: 'shadow-[0_0_40px_rgba(59,130,246,0.12)]',
    badge: 'bg-blue-600 text-white',
    icon: 'bg-blue-500/10 text-blue-400',
    btn: 'btn-primary',
    check: 'text-blue-400',
  },
  cyan: {
    border: 'border-cyan-500/20',
    glow: '',
    badge: '',
    icon: 'bg-cyan-500/10 text-cyan-400',
    btn: 'btn-secondary',
    check: 'text-cyan-400',
  },
  green: {
    border: 'border-emerald-500/20',
    glow: '',
    badge: '',
    icon: 'bg-emerald-500/10 text-emerald-400',
    btn: 'btn-secondary',
    check: 'text-emerald-400',
  },
}

const item = {
  hidden: { opacity: 0, y: 24 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.1, ease: [0.21, 0.47, 0.32, 0.98] },
  }),
}

export default function Pricing({ onContact }) {
  const [range, setRange] = useState('10')

  return (
    <section id="planos" className="py-24 bg-rp-surface relative overflow-hidden">
      <div className="absolute inset-0 bg-hero-grid opacity-30" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-blue-600/6 blur-[120px]" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-14">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="section-label"
          >
            Planos e preços
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight mt-2 mb-4"
          >
            Simples, transparente, sem surpresas
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-slate-400 text-lg max-w-xl mx-auto"
          >
            Escolha o plano ideal para o tamanho da sua equipe.
          </motion.p>
        </div>

        {/* Range switcher */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.25 }}
          className="flex justify-center mb-10"
        >
          <div className="inline-flex bg-rp-card border border-white/[0.07] rounded-xl p-1 gap-1">
            {ranges.map((r) => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                  range === r.key
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Cards */}
        <div className="grid lg:grid-cols-3 gap-6 mb-10">
          {plans.map((plan, i) => {
            const a = accentCard[plan.accent]
            const Icon = plan.icon
            return (
              <motion.div
                key={plan.id}
                custom={i}
                variants={item}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-60px' }}
                className={`relative rounded-2xl p-7 border transition-all duration-300 ${
                  plan.popular
                    ? `bg-rp-card ${a.border} ${a.glow}`
                    : 'bg-rp-card border-white/[0.07] hover:border-white/[0.12]'
                }`}
              >
                {/* Popular badge */}
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="bg-blue-600 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg shadow-blue-500/30">
                      ✦ Mais Popular
                    </span>
                  </div>
                )}

                {/* Icon + Name */}
                <div className={`w-11 h-11 rounded-xl ${a.icon} flex items-center justify-center mb-5`}>
                  <Icon size={20} />
                </div>

                <h3 className="text-xl font-bold text-white mb-1">{plan.name}</h3>
                <p className="text-sm text-slate-400 mb-6">{plan.tagline}</p>

                {/* Price */}
                <motion.div
                  key={range}
                  initial={{ opacity: 0.5, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2 }}
                  className="mb-6"
                >
                  <div className="flex items-start gap-1">
                    <span className="text-slate-400 text-sm mt-2.5 font-medium">R$</span>
                    <span className="text-5xl font-black text-white tracking-tight leading-none">
                      {plan.prices[range]}
                    </span>
                    <span className="text-slate-400 text-sm self-end mb-1">/mês</span>
                  </div>
                </motion.div>

                <div className="h-px bg-white/[0.06] mb-6" />

                {/* Description */}
                <p className="text-xs text-slate-500 mb-5">{plan.description}</p>

                {/* Features */}
                <ul className="space-y-3 mb-7">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-slate-300">
                      <Check size={13} className={a.check} strokeWidth={2.5} />
                      {f}
                    </li>
                  ))}
                </ul>

                {plan.note && (
                  <p className="text-xs text-slate-600 mb-5 italic">{plan.note}</p>
                )}

                <button
                  onClick={() => onContact(plan.name)}
                  className={`w-full ${a.btn} py-3`}
                >
                  Solicitar proposta
                  <ArrowRight size={14} />
                </button>
              </motion.div>
            )
          })}
        </div>

        {/* Overage note */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="card-dark p-5 flex items-start gap-4 max-w-3xl mx-auto mb-10"
        >
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Info size={15} className="text-amber-400" />
          </div>
          <div>
            <p className="text-sm text-slate-300 leading-relaxed">
              <span className="font-semibold text-white">Acima de 30 colaboradores:</span>{' '}
              acréscimo de <span className="font-semibold text-white">R$ 10,00 por colaborador excedente/mês</span>, cobrado no ciclo de faturamento seguinte ao período em que o limite foi ultrapassado.
            </p>
          </div>
        </motion.div>

        {/* Implementation box */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-2xl border border-blue-500/20 bg-blue-600/5 p-8 max-w-4xl mx-auto"
        >
          <div className="grid sm:grid-cols-2 gap-6 items-center">
            <div>
              <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-2">Implantação única</p>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-2xl text-slate-400">R$</span>
                <span className="text-6xl font-black text-white tracking-tight">799</span>
              </div>
              <p className="text-sm text-slate-400">Pagamento único · sem recorrência</p>
              <p className="text-xs text-slate-500 mt-1">ou 10× de R$ 79,90</p>
            </div>
            <ul className="space-y-3">
              {[
                'Ativação e configuração completa do sistema',
                'Cadastro inicial dos colaboradores',
                'Instalação presencial do tablet na empresa (plano Tablet e Híbrido)',
                'Tablet levado configurado e pronto para uso no dia da instalação',
              ].map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-slate-300">
                  <Check size={13} className="text-blue-400 flex-shrink-0" strokeWidth={2.5} />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
