import React from 'react'
import { motion } from 'framer-motion'
import { Check, Star, ArrowRight, MessageCircle, Package } from 'lucide-react'

const WA_BASE = 'https://wa.me/5524992272778?text='
const WA_IMPL = `${WA_BASE}${encodeURIComponent('Olá! Gostaria de solicitar um orçamento para a Implantação Completa do REGISTRA.PONTO.')}`

const sharedFeatures = [
  'Reconhecimento facial',
  'Dashboard web',
  'Relatórios de ponto',
  'Gestão de funcionários',
  'Exportação Excel',
  'Suporte técnico',
]

const plans = [
  {
    id: 'plano10',
    name: 'Plano 10',
    employees: 'Até 10 funcionários',
    price: 179,
    popular: false,
    waUrl: `${WA_BASE}${encodeURIComponent('Olá! Tenho interesse no Plano 10 do REGISTRA.PONTO. Poderia me dar mais informações?')}`,
    features: sharedFeatures,
  },
  {
    id: 'plano20',
    name: 'Plano 20',
    employees: 'Até 20 funcionários',
    price: 239,
    popular: true,
    waUrl: `${WA_BASE}${encodeURIComponent('Olá! Tenho interesse no Plano 20 do REGISTRA.PONTO. Poderia me dar mais informações?')}`,
    features: sharedFeatures,
  },
  {
    id: 'plano30',
    name: 'Plano 30',
    employees: 'Até 30 funcionários',
    price: 299,
    popular: false,
    waUrl: `${WA_BASE}${encodeURIComponent('Olá! Tenho interesse no Plano 30 do REGISTRA.PONTO. Poderia me dar mais informações?')}`,
    features: sharedFeatures,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    employees: '31+ funcionários',
    price: null,
    popular: false,
    description: 'Entre em contato',
    ctaLabel: 'Solicitar orçamento',
    ctaGreen: true,
    waUrl: `${WA_BASE}${encodeURIComponent('Olá! Gostaria de solicitar um orçamento para o plano Enterprise do REGISTRA.PONTO.')}`,
    features: [],
  },
]

const implantationItems = [
  'Tablet configurado com o sistema',
  'Instalação e configuração da empresa',
  'Cadastro facial dos funcionários',
  'Treinamento da equipe',
  'Suporte no primeiro mês',
]

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.1, ease: [0.21, 0.47, 0.32, 0.98] },
  }),
}

export default function Pricing() {
  return (
    <section id="planos" className="py-24 bg-rp-surface relative overflow-hidden">
      <div className="absolute inset-0 bg-hero-grid opacity-30" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-blue-600/6 blur-[120px]" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[300px] rounded-full bg-cyan-600/5 blur-[120px]" />

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
            Planos do{' '}
            <span className="gradient-text">REGISTRA.PONTO</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-slate-400 text-lg max-w-xl mx-auto"
          >
            Solução completa de ponto eletrônico com reconhecimento facial para empresas.
          </motion.p>
        </div>

        {/* Plan cards */}
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-14">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.id}
              custom={i}
              variants={cardVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              className={`relative flex flex-col rounded-2xl p-6 border transition-all duration-300 ${
                plan.popular
                  ? 'bg-rp-card border-blue-500/40 shadow-[0_0_50px_rgba(59,130,246,0.14)]'
                  : 'bg-rp-card border-white/[0.07] hover:border-white/[0.14] hover:shadow-[0_8px_32px_rgba(0,0,0,0.4)]'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg shadow-blue-500/30">
                    <Star size={10} fill="white" strokeWidth={0} />
                    Mais escolhido
                  </span>
                </div>
              )}

              <div className="mb-5">
                <h3 className="text-lg font-bold text-white mb-1">{plan.name}</h3>
                <p className="text-sm text-slate-500">{plan.employees}</p>
              </div>

              <div className="mb-6">
                {plan.price !== null ? (
                  <div className="flex items-start gap-1">
                    <span className="text-slate-400 text-sm mt-2.5 font-medium">R$</span>
                    <span className="text-5xl font-black text-white tracking-tight leading-none">
                      {plan.price}
                    </span>
                    <span className="text-slate-400 text-sm self-end mb-1">/mês</span>
                  </div>
                ) : (
                  <p className="text-base font-medium text-slate-300 leading-relaxed">
                    {plan.description}
                  </p>
                )}
              </div>

              <div className="h-px bg-white/[0.06] mb-5" />

              {plan.features.length > 0 && (
                <ul className="space-y-2.5 mb-6 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-slate-300">
                      <Check
                        size={13}
                        className={`mt-0.5 flex-shrink-0 ${plan.popular ? 'text-blue-400' : 'text-emerald-400'}`}
                        strokeWidth={2.5}
                      />
                      {f}
                    </li>
                  ))}
                </ul>
              )}

              {plan.id === 'enterprise' && <div className="flex-1 min-h-[60px]" />}

              <a
                href={plan.waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`w-full mt-auto py-3 ${
                  plan.popular ? 'btn-primary' : plan.ctaGreen ? 'btn-green' : 'btn-secondary'
                }`}
              >
                {plan.ctaLabel || 'Solicitar demonstração'}
                <ArrowRight size={14} />
              </a>
            </motion.div>
          ))}
        </div>

        {/* Implementation section */}
        <motion.div
          id="implantacao"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="rounded-3xl border border-blue-500/25 bg-gradient-to-br from-blue-600/8 via-rp-card to-rp-surface p-8 lg:p-10 max-w-5xl mx-auto"
        >
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <div className="flex items-center gap-2 mb-5">
                <Package size={16} className="text-blue-400" />
                <span className="text-xs font-semibold text-blue-400 uppercase tracking-widest">
                  Implantação Completa
                </span>
              </div>
              <h3 className="text-2xl lg:text-3xl font-bold text-white mb-3 leading-tight">
                Chegamos até você com tudo pronto.
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Instalação, configuração e treinamento inclusos. Você não precisa fazer nada — a gente cuida de tudo.
              </p>
            </div>

            <div>
              <ul className="space-y-3 mb-7">
                {implantationItems.map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm text-slate-300">
                    <div className="w-5 h-5 rounded-full bg-blue-500/15 border border-blue-500/25 flex items-center justify-center flex-shrink-0">
                      <Check size={11} className="text-blue-400" strokeWidth={2.5} />
                    </div>
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href={WA_IMPL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-green w-full py-3.5"
              >
                <MessageCircle size={16} />
                Solicitar orçamento
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
