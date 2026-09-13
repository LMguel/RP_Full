import React, { useRef, useState, useEffect } from 'react'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import { Check, Star, ArrowRight, MessageCircle, Sparkles, Smartphone, Tablet } from 'lucide-react'
import { trackWhatsAppClick } from '../lib/analytics'
import { buildWaUrl, BASE_FEATURES, METHODS, TIERS, ENTERPRISE_TIER, PLUS_MODULE_PRICE } from '../data/plans'

const METHOD_ICONS = { Smartphone, Tablet }

function fmtBRL(v) {
  if (v == null) return null
  return v % 1 === 0
    ? v.toLocaleString('pt-BR')
    : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function installmentsLabel(installments) {
  return installments.map((i) => `${i.n}x R$${fmtBRL(i.value)}`).join(' ou ')
}

function useCountUp(target, duration = 1100, trigger = false) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!trigger || target == null) return
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
    transition: { duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] },
  }),
}

function TierCard({ tier, method, methodId, index, trigger }) {
  const Icon = METHOD_ICONS[method.icon]
  const data = tier[methodId]
  const displayedPrice = useCountUp(data.monthly, 900 + index * 100, trigger)
  const waMsg = `Olá! Tenho interesse no ${method.name} (${tier.employees}) do REGISTRA.PONTO. Poderia me dar mais informações?`

  return (
    <motion.div
      custom={index}
      variants={cardVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-60px' }}
      whileHover={!tier.popular ? { y: -5, transition: { duration: 0.2 } } : {}}
      className="relative flex flex-col rounded-2xl p-6 border transition-all duration-300"
      style={{
        background: tier.popular ? 'linear-gradient(145deg, #EEF4FF, #FFFFFF)' : '#FFFFFF',
        borderColor: tier.popular ? 'rgba(24,71,214,0.30)' : 'rgba(24,71,214,0.09)',
        boxShadow: tier.popular
          ? '0 0 60px rgba(24,71,214,0.10), 0 8px 32px rgba(24,71,214,0.08)'
          : '0 4px 16px rgba(24,71,214,0.05)',
      }}
    >
      {tier.popular && (
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

      <div className="mb-1 flex items-center gap-2">
        <Icon size={14} style={{ color: '#1847D6' }} />
        <span className="text-[11px] font-semibold text-[#8FA0BE] uppercase tracking-wider">{method.shortLabel}</span>
      </div>
      <h3 className="text-lg font-bold text-[#0C1A38] mb-4">{tier.employees}</h3>

      <div className="mb-4">
        <div className="flex items-start gap-1">
          <span className="text-[#4D5E7A] text-sm mt-2.5 font-medium">R$</span>
          <span
            className="text-5xl font-black text-[#0C1A38] tracking-tight leading-none"
            style={{ fontFamily: 'Outfit, sans-serif' }}
          >
            {displayedPrice}
          </span>
          <span className="text-[#8FA0BE] text-sm self-end mb-1">/mês</span>
        </div>
      </div>

      <div
        className="rounded-xl px-3.5 py-3 mb-5"
        style={{ background: 'rgba(24,71,214,0.04)', border: '1px solid rgba(24,71,214,0.10)' }}
      >
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8FA0BE] mb-1.5">
          Implantação (única vez)
        </p>
        <p className="text-sm font-bold text-[#0C1A38]">
          R${fmtBRL(data.implCash)} à vista
        </p>
        <p className="text-[11px] text-[#4D5E7A] mt-0.5">
          ou {installmentsLabel(data.installments)}
        </p>
      </div>

      <div className="h-px mb-5" style={{ background: 'rgba(24,71,214,0.07)' }} />

      <ul className="space-y-2.5 mb-6 flex-1">
        {BASE_FEATURES.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-sm text-[#4D5E7A]">
            <Check size={13} className="mt-0.5 flex-shrink-0" style={{ color: tier.popular ? '#1847D6' : '#0EA5E9' }} strokeWidth={2.5} />
            {f}
          </li>
        ))}
        {methodId === 'kiosk' && (
          <li className="flex items-start gap-2.5 text-sm text-[#4D5E7A]">
            <Check size={13} className="mt-0.5 flex-shrink-0" style={{ color: tier.popular ? '#1847D6' : '#0EA5E9' }} strokeWidth={2.5} />
            Tablet — patrimônio definitivo da empresa
          </li>
        )}
      </ul>

      <a
        href={buildWaUrl(waMsg)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackWhatsAppClick(`pricing_${methodId}_${tier.id}`)}
        className={`w-full mt-auto py-3 ${tier.popular ? 'btn-primary' : 'btn-secondary'}`}
      >
        Ver demonstração
        <ArrowRight size={14} />
      </a>
    </motion.div>
  )
}

export default function Pricing() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  const [methodId, setMethodId] = useState('mobile')

  const method = METHODS.find((m) => m.id === methodId)

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
        <div className="text-center mb-10">
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
            Duas formas de registrar o ponto, mesmo sistema por trás — escolha a que combina com sua empresa.
          </motion.p>
        </div>

        {/* ROI alert */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mb-8 rounded-2xl px-5 py-4 max-w-2xl mx-auto text-center"
          style={{ background: 'rgba(24,71,214,0.05)', border: '1px solid rgba(24,71,214,0.14)' }}
        >
          <p className="text-sm text-[#4D5E7A] leading-relaxed">
            <span className="text-[#1847D6] font-semibold">
              💡 Uma única autuação trabalhista pode custar R$3.000+.
            </span>{' '}
            O REGISTRA.PONTO se paga no primeiro mês.
          </p>
        </motion.div>

        {/* Method toggle */}
        <div className="flex flex-col items-center mb-10">
          <div
            className="inline-flex rounded-xl overflow-hidden mb-3"
            style={{ border: '1.5px solid rgba(24,71,214,0.14)' }}
          >
            {METHODS.map((m) => {
              const Icon = METHOD_ICONS[m.icon]
              const active = methodId === m.id
              return (
                <button
                  key={m.id}
                  onClick={() => setMethodId(m.id)}
                  className="flex items-center gap-2 px-5 py-3 text-sm font-semibold transition-all duration-200"
                  style={{
                    background: active ? '#1847D6' : 'transparent',
                    color: active ? '#FFFFFF' : '#4D5E7A',
                    borderLeft: m.id !== METHODS[0].id ? '1.5px solid rgba(24,71,214,0.14)' : undefined,
                  }}
                >
                  <Icon size={15} />
                  {m.name}
                </button>
              )
            })}
          </div>
          <AnimatePresence mode="wait">
            <motion.p
              key={methodId}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="text-sm text-[#4D5E7A] max-w-md text-center"
            >
              {method.tagline}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Tier cards */}
        <div ref={ref} className="grid sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
          <AnimatePresence mode="wait">
            {TIERS.map((tier, i) => (
              <TierCard
                key={`${methodId}-${tier.id}`}
                tier={tier}
                method={method}
                methodId={methodId}
                index={i}
                trigger={inView}
              />
            ))}
          </AnimatePresence>
        </div>

        {/* Enterprise */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-2xl p-6 mb-14 max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4"
          style={{ background: '#FFFFFF', border: '1.5px solid rgba(24,71,214,0.09)', boxShadow: '0 4px 16px rgba(24,71,214,0.05)' }}
        >
          <div className="text-center sm:text-left">
            <h3 className="text-base font-bold text-[#0C1A38] mb-1">{ENTERPRISE_TIER.employees}</h3>
            <p className="text-sm text-[#4D5E7A]">{ENTERPRISE_TIER.description} — mensalidade e implantação sob consulta.</p>
          </div>
          <a
            href={buildWaUrl('Olá! Gostaria de solicitar um orçamento para o plano Enterprise (31+ funcionários) do REGISTRA.PONTO.')}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackWhatsAppClick('pricing_enterprise')}
            className="btn-green py-3 px-6 whitespace-nowrap"
          >
            Solicitar orçamento
            <ArrowRight size={14} />
          </a>
        </motion.div>

        {/* Clarificação */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="text-center mb-14"
        >
          <p className="text-sm text-[#4D5E7A] leading-relaxed">
            Os valores acima são{' '}
            <span className="font-semibold text-[#0C1A38]">mensalidade recorrente + implantação única</span>{' '}
            (cobrada separadamente, à vista ou parcelada). O {METHODS.find((m) => m.id === 'kiosk').name}{' '}
            inclui o tablet — o {METHODS.find((m) => m.id === 'mobile').name} usa o celular que o funcionário já tem.
          </p>
        </motion.div>

        {/* RH/Folha Plus add-on */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative rounded-3xl overflow-hidden max-w-5xl mx-auto"
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
                        {Math.floor(PLUS_MODULE_PRICE)}
                      </span>
                      <div className="flex flex-col self-end mb-0.5">
                        <span className="text-white font-bold text-lg leading-none">,{String(Math.round((PLUS_MODULE_PRICE % 1) * 100)).padStart(2, '0')}</span>
                        <span className="text-purple-300 text-xs leading-none">/mês</span>
                      </div>
                    </div>
                  </div>
                  <a
                    href={buildWaUrl('Olá! Tenho interesse no módulo RH & Folha (Plus) do REGISTRA.PONTO. Poderia me dar mais informações?')}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackWhatsAppClick('pricing_plus')}
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
                style={{ boxShadow: '0 16px 48px rgba(0,0,0,0.40), 0 0 0 1px rgba(255,255,255,0.10)' }}
              >
                <img
                  src="/image/folha.webp"
                  alt="Módulo RH & Folha — REGISTRA.PONTO Plus"
                  className="w-full block"
                  loading="lazy"
                />
              </motion.div>
            </div>
          </div>
        </motion.div>

      </div>
    </section>
  )
}
