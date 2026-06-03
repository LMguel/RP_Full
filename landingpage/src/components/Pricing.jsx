import React, { useRef, useState, useEffect } from 'react'
import { motion, useInView } from 'framer-motion'
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
    roi: '≈ R$6/dia por até 10 funcionários',
    popular: false,
    waUrl: `${WA_BASE}${encodeURIComponent('Olá! Tenho interesse no Plano 10 do REGISTRA.PONTO. Poderia me dar mais informações?')}`,
    features: sharedFeatures,
  },
  {
    id: 'plano20',
    name: 'Plano 20',
    employees: 'Até 20 funcionários',
    price: 239,
    roi: '= R$8/dia — menos que uma multa trabalhista',
    popular: true,
    waUrl: `${WA_BASE}${encodeURIComponent('Olá! Tenho interesse no Plano 20 do REGISTRA.PONTO. Poderia me dar mais informações?')}`,
    features: sharedFeatures,
  },
  {
    id: 'plano30',
    name: 'Plano 30',
    employees: 'Até 30 funcionários',
    price: 299,
    roi: '≈ R$10/dia para equipes de até 30 pessoas',
    popular: false,
    waUrl: `${WA_BASE}${encodeURIComponent('Olá! Tenho interesse no Plano 30 do REGISTRA.PONTO. Poderia me dar mais informações?')}`,
    features: sharedFeatures,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    employees: '31+ funcionários',
    price: null,
    roi: null,
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

/* Counter that animates from 0 to target when triggered */
function useCountUp(target, duration = 1300, trigger = false) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!trigger || target === null) return
    let start = null
    const tick = (now) => {
      if (!start) start = now
      const t = Math.min((now - start) / duration, 1)
      setVal(Math.round(target * (1 - Math.pow(1 - t, 3))))
      if (t < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [trigger, target, duration])
  return val
}

const cardVariants = {
  hidden: { opacity: 0, y: 28 },
  visible: (i) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.55, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] },
  }),
}

export default function Pricing() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })

  const price10  = useCountUp(179, 1100, inView)
  const price20  = useCountUp(239, 1200, inView)
  const price30  = useCountUp(299, 1300, inView)

  const priceOf = (plan) => {
    if (plan.id === 'plano10') return price10
    if (plan.id === 'plano20') return price20
    if (plan.id === 'plano30') return price30
    return null
  }

  return (
    <section id="planos" className="py-24 bg-rp-surface relative overflow-hidden">
      <div className="absolute inset-0 bg-dot-grid opacity-30" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-emerald-600 opacity-[0.05] blur-[130px]" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[300px] rounded-full bg-teal-600 opacity-[0.04] blur-[120px]" />

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
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight mt-2 mb-4"
          >
            Planos do{' '}
            <span className="gradient-text">REGISTRA.PONTO</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-slate-400 text-lg max-w-xl mx-auto"
          >
            Solução completa de ponto eletrônico com reconhecimento facial para empresas.
          </motion.p>
        </div>

        {/* ROI alert */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mb-8 rounded-2xl px-5 py-4 max-w-2xl mx-auto text-center"
          style={{
            background: 'rgba(0,232,122,0.06)',
            border: '1px solid rgba(0,232,122,0.15)',
          }}
        >
          <p className="text-sm text-slate-300 leading-relaxed">
            <span className="text-emerald-400 font-semibold">
              💡 Uma única autuação trabalhista pode custar R$3.000+.
            </span>{' '}
            O REGISTRA.PONTO se paga no primeiro mês.
          </p>
        </motion.div>

        {/* Plan cards */}
        <div ref={ref} className="grid sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-14">
          {plans.map((plan, i) => {
            const displayed = priceOf(plan)
            return (
              <motion.div
                key={plan.id}
                custom={i}
                variants={cardVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-60px' }}
                whileHover={!plan.popular ? { y: -5, transition: { duration: 0.2 } } : {}}
                className={`relative flex flex-col rounded-2xl p-6 border transition-all duration-300 ${
                  plan.popular
                    ? 'bg-rp-card shadow-[0_0_60px_rgba(0,232,122,0.10)]'
                    : 'bg-rp-card hover:shadow-[0_8px_32px_rgba(0,0,0,0.4)]'
                }`}
                style={{
                  borderColor: plan.popular
                    ? 'rgba(0,232,122,0.38)'
                    : 'rgba(255,255,255,0.07)',
                }}
              >
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap">
                    <span
                      className="inline-flex items-center gap-1.5 text-white text-xs font-bold px-4 py-1.5 rounded-full"
                      style={{
                        background: 'linear-gradient(135deg, #00E87A, #00C96A)',
                        color: '#050C18',
                        boxShadow: '0 4px 16px rgba(0,232,122,0.35)',
                      }}
                    >
                      <Star size={10} fill="#050C18" strokeWidth={0} />
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
                    <>
                      <div className="flex items-start gap-1">
                        <span className="text-slate-400 text-sm mt-2.5 font-medium">R$</span>
                        <span className="text-5xl font-black text-white tracking-tight leading-none" style={{ fontFamily: 'Outfit, sans-serif' }}>
                          {displayed}
                        </span>
                        <span className="text-slate-400 text-sm self-end mb-1">/mês</span>
                      </div>
                      {plan.roi && (
                        <p className="text-[11px] text-slate-500 mt-1.5 leading-snug">
                          {plan.roi}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-base font-medium text-slate-300 leading-relaxed">
                      {plan.description}
                    </p>
                  )}
                </div>

                <div className="h-px mb-5" style={{ background: 'rgba(255,255,255,0.06)' }} />

                {plan.features.length > 0 && (
                  <ul className="space-y-2.5 mb-6 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-slate-300">
                        <Check
                          size={13}
                          className="mt-0.5 flex-shrink-0"
                          style={{ color: plan.popular ? '#00E87A' : '#34D399' }}
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
                  {plan.ctaLabel || 'Ver demonstração'}
                  <ArrowRight size={14} />
                </a>
              </motion.div>
            )
          })}
        </div>

        {/* Implementation section */}
        <motion.div
          id="implantacao"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-3xl p-5 sm:p-8 lg:p-10 max-w-5xl mx-auto"
          style={{
            border: '1px solid rgba(0,232,122,0.22)',
            background: 'linear-gradient(135deg, rgba(0,232,122,0.05) 0%, rgba(11,21,39,0.9) 50%, rgba(7,15,31,0.95) 100%)',
          }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 items-center">
            <div>
              <div className="flex items-center gap-2 mb-5">
                <Package size={16} className="text-emerald-400" />
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">
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
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                         style={{ background: 'rgba(0,232,122,0.12)', border: '1px solid rgba(0,232,122,0.25)' }}>
                      <Check size={11} style={{ color: '#00E87A' }} strokeWidth={2.5} />
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
