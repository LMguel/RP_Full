import React, { useRef, useState, useEffect } from 'react'
import { motion, useInView } from 'framer-motion'
import { Check, Star, ArrowRight, MessageCircle, Package, Sparkles, Monitor, Tablet } from 'lucide-react'

const WA_BASE = 'https://wa.me/5524992272778?text='
const WA_IMPL = `${WA_BASE}${encodeURIComponent('Olá! Gostaria de solicitar um orçamento para a Implantação + Tablet do REGISTRA.PONTO.')}`

const baseFeatures = [
  'Reconhecimento facial',
  'Dashboard web',
  'Relatórios de ponto',
  'Gestão de funcionários',
  'Exportação Excel',
  'Suporte técnico',
]

const startImplItems = [
  'Configuração inicial',
  'Cadastro facial inicial',
  'Treinamento remoto',
  'Sistema pronto para operar',
]

const plans = [
  {
    id: 'plano10',
    name: 'Plano 10',
    employees: 'Até 10 funcionários',
    price: 179,
    roi: '≈ R$6/dia por até 10 funcionários',
    popular: true,
    tabletNote: 'Tablet opcional — use dispositivo da empresa ou receba tablet dedicado.',
    waUrl: `${WA_BASE}${encodeURIComponent('Olá! Tenho interesse no Plano 10 do REGISTRA.PONTO. Poderia me dar mais informações?')}`,
    features: baseFeatures,
  },
  {
    id: 'plano20',
    name: 'Plano 20',
    employees: 'Até 20 funcionários',
    price: 239,
    roi: '= R$8/dia — menos que uma multa trabalhista',
    popular: false,
    tabletNote: 'Tablet dedicado recomendado para maior fluidez operacional.',
    waUrl: `${WA_BASE}${encodeURIComponent('Olá! Tenho interesse no Plano 20 do REGISTRA.PONTO. Poderia me dar mais informações?')}`,
    features: [...baseFeatures, 'Suporte prioritário'],
  },
  {
    id: 'plano30',
    name: 'Plano 30',
    employees: 'Até 30 funcionários',
    price: 299,
    roi: '≈ R$10/dia para equipes de até 30 pessoas',
    popular: false,
    tabletNote: 'Tablet dedicado recomendado para maior fluidez operacional.',
    waUrl: `${WA_BASE}${encodeURIComponent('Olá! Tenho interesse no Plano 30 do REGISTRA.PONTO. Poderia me dar mais informações?')}`,
    features: [...baseFeatures, 'Suporte prioritário', 'Treinamento operacional'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    employees: '31+ funcionários',
    price: null,
    roi: null,
    popular: false,
    description: 'Implantação personalizada',
    ctaLabel: 'Solicitar orçamento',
    ctaGreen: true,
    waUrl: `${WA_BASE}${encodeURIComponent('Olá! Gostaria de solicitar um orçamento para o plano Enterprise do REGISTRA.PONTO.')}`,
    features: [],
  },
]

const implantationItems = [
  'Tablet incluso',
  'Tablet configurado com o sistema',
  'Instalação',
  'Configuração da empresa',
  'Cadastro facial inicial',
  'Treinamento da equipe',
  'Suporte no primeiro mês',
  'Operacional em até 48 horas',
]

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
  const ref    = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  const [regMethod, setRegMethod] = useState('device')

  const price119 = useCountUp(119, 1000, inView)
  const price179 = useCountUp(179, 1100, inView)
  const price239 = useCountUp(239, 1200, inView)
  const price299 = useCountUp(299, 1300, inView)

  const priceOf = (plan) => {
    if (plan.id === 'plano10') return price179
    if (plan.id === 'plano20') return price239
    if (plan.id === 'plano30') return price299
    return null
  }

  return (
    <section id="planos" className="py-24 bg-rp-surface relative overflow-hidden">
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full opacity-[0.05]"
        style={{ background: '#1847D6', filter: 'blur(130px)' }}
      />
      <div
        className="absolute bottom-0 right-0 w-[400px] h-[300px] rounded-full opacity-[0.04]"
        style={{ background: '#38BDF8', filter: 'blur(120px)' }}
      />

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
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#0C1A38] tracking-tight mt-2 mb-4"
          >
            Planos do{' '}
            <span className="gradient-text">REGISTRA.PONTO</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-[#4D5E7A] text-lg max-w-xl mx-auto"
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
            background: 'rgba(24,71,214,0.05)',
            border: '1px solid rgba(24,71,214,0.14)',
          }}
        >
          <p className="text-sm text-[#4D5E7A] leading-relaxed">
            <span className="text-[#1847D6] font-semibold">
              💡 Uma única autuação trabalhista pode custar R$3.000+.
            </span>{' '}
            O REGISTRA.PONTO se paga no primeiro mês.
          </p>
        </motion.div>

        {/* Wrapper ref para countUp */}
        <div ref={ref}>

          {/* ── START — entrada acessível ── */}
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="mb-6 max-w-4xl mx-auto"
          >
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background: '#FFFFFF',
                border: '1.5px solid rgba(24,71,214,0.09)',
                boxShadow: '0 4px 16px rgba(24,71,214,0.05)',
              }}
            >
              {/* Card header */}
              <div className="px-6 pt-6 pb-4 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-lg font-bold text-[#0C1A38]">Start</h3>
                  <span
                    className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider"
                    style={{ background: 'rgba(14,165,233,0.09)', color: '#0EA5E9', border: '1px solid rgba(14,165,233,0.22)' }}
                  >
                    Sem tablet
                  </span>
                </div>
                <p className="text-sm text-[#8FA0BE]">Até 5 funcionários</p>
              </div>

              <div className="h-px mx-6" style={{ background: 'rgba(24,71,214,0.07)' }} />

              {/* 2 colunas: mensalidade | implantação */}
              <div className="grid grid-cols-1 lg:grid-cols-2">

                {/* Mensalidade */}
                <div className="p-6">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8FA0BE] mb-4">
                    Mensalidade
                  </p>
                  <div className="flex items-start gap-1 mb-3">
                    <span className="text-[#4D5E7A] text-sm mt-2.5 font-medium">R$</span>
                    <span
                      className="text-5xl font-black text-[#0C1A38] tracking-tight leading-none"
                      style={{ fontFamily: 'Outfit, sans-serif' }}
                    >
                      {price119}
                    </span>
                    <span className="text-[#8FA0BE] text-sm self-end mb-1">/mês</span>
                  </div>
                  <p className="text-sm text-[#4D5E7A] leading-relaxed mb-5">
                    Use computador, notebook ou celular da empresa para registrar ponto com reconhecimento facial.
                  </p>
                  <ul className="space-y-2.5">
                    {baseFeatures.map((f) => (
                      <li key={f} className="flex items-center gap-2.5 text-sm text-[#4D5E7A]">
                        <Check size={13} className="flex-shrink-0" style={{ color: '#0EA5E9' }} strokeWidth={2.5} />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Implantação Start */}
                <div
                  className="p-6 lg:border-l"
                  style={{
                    borderColor: 'rgba(24,71,214,0.07)',
                    background: 'rgba(24,71,214,0.02)',
                  }}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8FA0BE] mb-4">
                    Implantação Start
                  </p>
                  <div className="mb-4">
                    <div className="flex items-baseline gap-1.5 mb-1">
                      <span className="text-xs text-[#4D5E7A] font-medium">12x de</span>
                      <span
                        className="text-3xl font-black text-[#0C1A38] leading-none tracking-tight"
                        style={{ fontFamily: 'Outfit, sans-serif' }}
                      >
                        R$49
                      </span>
                    </div>
                    <p className="text-sm text-[#4D5E7A]">
                      ou{' '}
                      <span className="font-semibold text-[#0C1A38]">R$399 à vista</span>
                    </p>
                    <p className="text-[11px] text-[#8FA0BE] mt-0.5">Pagamento único.</p>
                  </div>

                  <div className="h-px mb-4" style={{ background: 'rgba(24,71,214,0.07)' }} />

                  <ul className="space-y-2.5 mb-3">
                    {startImplItems.map((f) => (
                      <li key={f} className="flex items-center gap-2.5 text-sm text-[#4D5E7A]">
                        <Check size={12} className="flex-shrink-0" style={{ color: '#1847D6' }} strokeWidth={2.5} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-[#8FA0BE]">Sem tablet dedicado.</p>
                </div>
              </div>

              {/* CTA */}
              <div className="px-6 pb-6">
                <div className="h-px mb-5" style={{ background: 'rgba(24,71,214,0.07)' }} />
                <a
                  href={`${WA_BASE}${encodeURIComponent('Olá! Tenho interesse no Plano Start do REGISTRA.PONTO. Poderia me dar mais informações?')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary w-full py-3"
                >
                  Começar agora
                  <ArrowRight size={14} />
                </a>
              </div>
            </div>
          </motion.div>

          {/* ── Planos 10 / 20 / 30 / Enterprise ── */}
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-14">
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
                  className="relative flex flex-col rounded-2xl p-6 border transition-all duration-300"
                  style={{
                    background: plan.popular
                      ? 'linear-gradient(145deg, #EEF4FF, #FFFFFF)'
                      : '#FFFFFF',
                    borderColor: plan.popular
                      ? 'rgba(24,71,214,0.30)'
                      : 'rgba(24,71,214,0.09)',
                    boxShadow: plan.popular
                      ? '0 0 60px rgba(24,71,214,0.10), 0 8px 32px rgba(24,71,214,0.08)'
                      : '0 4px 16px rgba(24,71,214,0.05)',
                  }}
                >
                  {plan.popular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap">
                      <span
                        className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-1.5 rounded-full"
                        style={{
                          background: 'linear-gradient(135deg, #1847D6, #1035BC)',
                          color: '#FFFFFF',
                          boxShadow: '0 4px 16px rgba(24,71,214,0.35)',
                        }}
                      >
                        <Star size={10} fill="#FFFFFF" strokeWidth={0} />
                        Mais escolhido
                      </span>
                    </div>
                  )}

                  <div className="mb-4">
                    <h3 className="text-lg font-bold text-[#0C1A38] mb-1">{plan.name}</h3>
                    <p className="text-sm text-[#8FA0BE]">{plan.employees}</p>
                  </div>

                  {/* Nota tablet opcional/recomendado */}
                  {plan.tabletNote && (
                    <div
                      className="flex items-start gap-2 px-3 py-2 rounded-lg mb-4 text-xs"
                      style={{ background: 'rgba(24,71,214,0.05)', color: '#4D5E7A', border: '1px solid rgba(24,71,214,0.10)' }}
                    >
                      <Tablet size={11} className="flex-shrink-0 mt-0.5" style={{ color: '#1847D6' }} />
                      {plan.tabletNote}
                    </div>
                  )}

                  <div className="mb-6">
                    {plan.price !== null ? (
                      <>
                        <div className="flex items-start gap-1">
                          <span className="text-[#4D5E7A] text-sm mt-2.5 font-medium">R$</span>
                          <span
                            className="text-5xl font-black text-[#0C1A38] tracking-tight leading-none"
                            style={{ fontFamily: 'Outfit, sans-serif' }}
                          >
                            {displayed}
                          </span>
                          <span className="text-[#8FA0BE] text-sm self-end mb-1">/mês</span>
                        </div>
                        {plan.roi && (
                          <p className="text-[11px] text-[#8FA0BE] mt-1.5 leading-snug">
                            {plan.roi}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-base font-medium text-[#4D5E7A] leading-relaxed">
                        {plan.description}
                      </p>
                    )}
                  </div>

                  <div className="h-px mb-5" style={{ background: 'rgba(24,71,214,0.07)' }} />

                  {plan.features.length > 0 && (
                    <ul className="space-y-2.5 mb-6 flex-1">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2.5 text-sm text-[#4D5E7A]">
                          <Check
                            size={13}
                            className="mt-0.5 flex-shrink-0"
                            style={{ color: plan.popular ? '#1847D6' : '#0EA5E9' }}
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

        </div>{/* /ref wrapper */}

        {/* RH/Folha Plus add-on */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative rounded-3xl overflow-hidden mb-10 max-w-5xl mx-auto"
          style={{
            background: 'linear-gradient(135deg, #3B0764 0%, #5B21B6 45%, #6D28D9 100%)',
            boxShadow: '0 24px 64px rgba(109,40,217,0.30), 0 0 0 1px rgba(167,139,250,0.18)',
          }}
        >
          <div
            className="absolute inset-0 pointer-events-none opacity-20"
            style={{
              backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.35) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />
          <div
            className="absolute -top-20 -right-20 w-[320px] h-[320px] rounded-full pointer-events-none"
            style={{ background: '#A855F7', filter: 'blur(100px)', opacity: 0.25 }}
          />

          <div className="relative">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-7 sm:p-10 pb-6">
              <div>
                <div className="flex items-center gap-2 mb-5">
                  <span
                    className="inline-flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded-full uppercase tracking-widest"
                    style={{
                      background: 'rgba(255,255,255,0.15)',
                      border: '1px solid rgba(255,255,255,0.25)',
                      color: '#E9D5FF',
                    }}
                  >
                    <Sparkles size={11} />
                    Plus
                  </span>
                  <span className="text-xs text-purple-300 font-medium">Módulo adicional</span>
                </div>
                <h3
                  className="text-2xl sm:text-3xl font-bold leading-tight mb-3"
                  style={{ color: '#FFFFFF', fontFamily: 'Outfit, sans-serif' }}
                >
                  RH & Folha de Pagamento
                </h3>
                <p className="text-sm text-purple-200 leading-relaxed">
                  Cadastre salários, configure regras de horas extras, finais de semana e feriados.
                  Ao fechar o mês, o sistema analisa o banco de horas e calcula o salário previsto automaticamente.
                </p>
              </div>

              <div className="flex flex-col justify-between gap-6">
                <ul className="space-y-2.5">
                  {[
                    'Cadastro de salário base por funcionário',
                    'Regras de horas extras (semana, fim de semana e feriados)',
                    'Fechamento mensal com análise do banco de horas',
                    'Cálculo automático do salário previsto',
                    'Exportação consolidada para o departamento pessoal',
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-purple-100">
                      <span
                        className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center"
                        style={{ background: 'rgba(255,255,255,0.15)' }}
                      >
                        <Check size={10} strokeWidth={3} className="text-white" />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>

                <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                  <div>
                    <p className="text-xs text-purple-300 mb-1 uppercase tracking-wider font-semibold">Adicione ao seu plano</p>
                    <div className="flex items-start gap-1">
                      <span className="text-purple-300 text-sm mt-2 font-medium">+ R$</span>
                      <span
                        className="text-5xl font-black text-white leading-none tracking-tight"
                        style={{ fontFamily: 'Outfit, sans-serif' }}
                      >
                        89
                      </span>
                      <div className="flex flex-col self-end mb-0.5">
                        <span className="text-white font-bold text-lg leading-none">,90</span>
                        <span className="text-purple-300 text-xs leading-none">/mês</span>
                      </div>
                    </div>
                  </div>
                  <a
                    href={`${WA_BASE}${encodeURIComponent('Olá! Tenho interesse no módulo RH & Folha (Plus) do REGISTRA.PONTO. Poderia me dar mais informações?')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 font-semibold text-sm py-3 px-6 rounded-xl transition-all duration-200 whitespace-nowrap"
                    style={{
                      background: 'rgba(255,255,255,0.15)',
                      border: '1.5px solid rgba(255,255,255,0.30)',
                      color: '#FFFFFF',
                      backdropFilter: 'blur(8px)',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.22)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)' }}
                  >
                    <MessageCircle size={15} />
                    Saber mais sobre o Plus
                  </a>
                </div>
              </div>
            </div>

            <div className="px-7 sm:px-10 pb-7 sm:pb-10">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="rounded-2xl overflow-hidden"
                style={{
                  boxShadow: '0 16px 48px rgba(0,0,0,0.40), 0 0 0 1px rgba(255,255,255,0.10)',
                }}
              >
                <img
                  src="/image/folha.png"
                  alt="Módulo RH & Folha — REGISTRA.PONTO Plus"
                  className="w-full block"
                  loading="lazy"
                />
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* Clarificação */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="text-center mb-12"
        >
          <p className="text-sm text-[#4D5E7A] leading-relaxed">
            Os planos acima são{' '}
            <span className="font-semibold text-[#0C1A38]">mensalidades recorrentes.</span>{' '}
            A implantação é realizada{' '}
            <span className="font-semibold text-[#0C1A38]">uma única vez</span>{' '}
            e cobrada separadamente — com ou sem tablet, de acordo com a sua escolha.
          </p>
        </motion.div>

        {/* ── Escolha sua implantação ── */}
        <div id="implantacao" className="max-w-5xl mx-auto">

          {/* Cabeçalho + simulador */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="text-center mb-8"
          >
            <span className="section-label mb-3">Implantação</span>
            <h3 className="text-2xl sm:text-3xl font-bold text-[#0C1A38] tracking-tight mb-6">
              Escolha como implantar
            </h3>

            {/* Simulador */}
            <div className="inline-flex flex-col sm:flex-row items-center gap-3 mb-4">
              <span className="text-sm text-[#4D5E7A] font-medium whitespace-nowrap">Como deseja registrar o ponto?</span>
              <div
                className="flex rounded-xl overflow-hidden"
                style={{ border: '1.5px solid rgba(24,71,214,0.14)' }}
              >
                <button
                  onClick={() => setRegMethod('device')}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-all duration-200"
                  style={{
                    background: regMethod === 'device' ? '#1847D6' : 'transparent',
                    color: regMethod === 'device' ? '#FFFFFF' : '#4D5E7A',
                  }}
                >
                  <Monitor size={14} />
                  Dispositivo da empresa
                </button>
                <button
                  onClick={() => setRegMethod('tablet')}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-all duration-200"
                  style={{
                    background: regMethod === 'tablet' ? '#1847D6' : 'transparent',
                    color: regMethod === 'tablet' ? '#FFFFFF' : '#4D5E7A',
                    borderLeft: '1.5px solid rgba(24,71,214,0.14)',
                  }}
                >
                  <Tablet size={14} />
                  Tablet dedicado
                </button>
              </div>
            </div>

            {/* Mensagem contextual */}
            <p
              className="text-sm font-medium transition-all duration-300"
              style={{ color: regMethod === 'device' ? '#0EA5E9' : '#1847D6' }}
            >
              {regMethod === 'device'
                ? '✓ Tablet opcional — ideal para equipes de até 10 funcionários.'
                : '✓ Tablet dedicado recomendado para maior fluidez operacional.'}
            </p>
          </motion.div>

          {/* Comparação 2 colunas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Col 1: Remota */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="card-dark flex flex-col p-6"
            >
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-2">
                  <Monitor size={15} style={{ color: '#0EA5E9' }} />
                  <h4 className="font-bold text-[#0C1A38] text-base">Implantação Remota</h4>
                </div>
                <p className="text-xs text-[#8FA0BE]">Ideal para até 10 funcionários</p>
              </div>

              <div className="mb-5">
                <div className="flex items-baseline gap-1.5 mb-1">
                  <span className="text-3xl font-black text-[#0C1A38] tracking-tight leading-none" style={{ fontFamily: 'Outfit, sans-serif' }}>
                    R$399
                  </span>
                  <span className="text-sm text-[#4D5E7A] font-medium">à vista</span>
                </div>
                <p className="text-sm text-[#4D5E7A]">
                  ou <span className="font-semibold text-[#0C1A38]">12x de R$49</span>
                </p>
                <p className="text-[11px] text-[#8FA0BE] mt-1">Pagamento único.</p>
              </div>

              <div className="h-px mb-5" style={{ background: 'rgba(24,71,214,0.07)' }} />

              <ul className="space-y-2.5 flex-1 mb-5">
                {[
                  'Configuração inicial',
                  'Cadastro facial',
                  'Treinamento remoto',
                  'Uso em computador, notebook ou celular da empresa',
                  'Sistema pronto para operar',
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-[#4D5E7A]">
                    <Check size={13} className="mt-0.5 flex-shrink-0" style={{ color: '#0EA5E9' }} strokeWidth={2.5} />
                    {f}
                  </li>
                ))}
              </ul>

              <p className="text-[11px] text-[#8FA0BE] mb-5">Sem tablet incluso.</p>

              <a
                href={`${WA_BASE}${encodeURIComponent('Olá! Tenho interesse na Implantação Remota do REGISTRA.PONTO. Poderia me dar mais informações?')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary w-full py-3 mt-auto"
              >
                Começar agora
                <ArrowRight size={14} />
              </a>
            </motion.div>

            {/* Col 2: Tablet Incluso (destacada) */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.55, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="relative flex flex-col rounded-2xl p-6"
              style={{
                background: 'linear-gradient(145deg, #EEF4FF, #FFFFFF)',
                border: '1.5px solid rgba(24,71,214,0.28)',
                boxShadow: '0 0 60px rgba(24,71,214,0.10), 0 8px 32px rgba(24,71,214,0.08)',
              }}
            >
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap">
                <span
                  className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-1.5 rounded-full"
                  style={{
                    background: 'linear-gradient(135deg, #1847D6, #1035BC)',
                    color: '#FFFFFF',
                    boxShadow: '0 4px 16px rgba(24,71,214,0.35)',
                  }}
                >
                  <Package size={10} />
                  Tudo incluso
                </span>
              </div>

              <div className="mb-5 mt-2">
                <div className="flex items-center gap-2 mb-2">
                  <Tablet size={15} style={{ color: '#1847D6' }} />
                  <h4 className="font-bold text-[#0C1A38] text-base">Implantação + Tablet Incluso</h4>
                </div>
                <p className="text-xs text-[#8FA0BE]">Ideal para empresas que desejam um ponto dedicado</p>
              </div>

              <div className="mb-5">
                <div className="flex items-baseline gap-1.5 mb-1">
                  <span className="text-3xl font-black text-[#0C1A38] tracking-tight leading-none" style={{ fontFamily: 'Outfit, sans-serif' }}>
                    R$1.599
                  </span>
                  <span className="text-sm text-[#4D5E7A] font-medium">à vista</span>
                </div>
                <p className="text-sm text-[#4D5E7A]">
                  ou <span className="font-semibold text-[#0C1A38]">12x de R$149</span>
                </p>
                <p className="text-[11px] text-[#8FA0BE] mt-1">Pagamento único.</p>
              </div>

              <div className="h-px mb-5" style={{ background: 'rgba(24,71,214,0.10)' }} />

              <ul className="space-y-2.5 flex-1 mb-5">
                {[
                  'Tablet incluso',
                  'Tablet configurado com o sistema',
                  'Instalação presencial',
                  'Cadastro facial inicial',
                  'Treinamento da equipe',
                  'Suporte no primeiro mês',
                  'Operacional em até 48 horas',
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-[#4D5E7A]">
                    <Check size={13} className="mt-0.5 flex-shrink-0" style={{ color: '#1847D6' }} strokeWidth={2.5} />
                    {f}
                  </li>
                ))}
              </ul>

              {/* Patrimônio callout */}
              <div
                className="rounded-xl px-4 py-3 mb-5"
                style={{ background: 'rgba(24,71,214,0.06)', border: '1px solid rgba(24,71,214,0.14)' }}
              >
                <p className="text-xs font-semibold text-[#1847D6] mb-1">
                  O tablet passa a ser patrimônio da empresa após a implantação.
                </p>
                <p className="text-[11px] text-[#4D5E7A] leading-relaxed">
                  Sem aluguel. Sem devolução. Equipamento definitivo da empresa.
                </p>
              </div>

              <a
                href={WA_IMPL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary w-full py-3 mt-auto"
              >
                Solicitar demonstração
                <ArrowRight size={14} />
              </a>
            </motion.div>

          </div>

          <p className="text-center text-xs text-[#8FA0BE] mt-6">
            Mensalidade contratada separadamente, conforme o plano escolhido.
          </p>
        </div>

      </div>
    </section>
  )
}
