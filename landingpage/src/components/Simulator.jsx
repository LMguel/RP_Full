import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, Monitor, Tablet, BrainCircuit, Check, ArrowRight, MessageCircle, RotateCcw, ArrowLeft } from 'lucide-react'

const WA_BASE = 'https://wa.me/5524992272778?text='

const employeeOptions = [
  { id: 'up5',   label: 'Até 5',   sub: 'Plano Start'  },
  { id: '6-10',  label: '6 – 10',  sub: 'Plano 10'     },
  { id: '11-20', label: '11 – 20', sub: 'Plano 20'     },
  { id: '21-30', label: '21 – 30', sub: 'Plano 30'     },
  { id: '31+',   label: '31+',     sub: 'Enterprise'   },
]

const planMap = {
  'up5':   { name: 'Start',      price: 119  },
  '6-10':  { name: 'Plano 10',   price: 179  },
  '11-20': { name: 'Plano 20',   price: 239  },
  '21-30': { name: 'Plano 30',   price: 299  },
  '31+':   { name: 'Enterprise', price: null },
}

const implMap = {
  device: { label: 'Dispositivo da empresa', cash: 399,  installV: 49,  installN: 12 },
  tablet: { label: 'Tablet incluso',         cash: 1599, installV: 149, installN: 12 },
}

const STEPS = 4

function fmtBRL(v) {
  if (v == null) return null
  return v % 1 === 0
    ? v.toLocaleString('pt-BR')
    : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const slide = {
  enter:  (d) => ({ opacity: 0, x: d > 0 ? 36 : -36 }),
  center: { opacity: 1, x: 0, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } },
  exit:   (d) => ({ opacity: 0, x: d > 0 ? -36 : 36, transition: { duration: 0.22, ease: 'easeIn' } }),
}

/* ── Selection Card ─────────────────────────────────── */
function SelCard({ selected, onClick, children }) {
  return (
    <motion.button
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="w-full text-left rounded-xl px-4 py-3.5 transition-all duration-200 cursor-pointer"
      style={{
        background: selected ? 'rgba(24,71,214,0.07)' : '#FFFFFF',
        border: selected
          ? '1.5px solid rgba(24,71,214,0.40)'
          : '1.5px solid rgba(24,71,214,0.10)',
        boxShadow: selected ? '0 0 0 3px rgba(24,71,214,0.08)' : '0 2px 8px rgba(24,71,214,0.04)',
      }}
    >
      {children}
    </motion.button>
  )
}

/* ── Progress bar ──────────────────────────────────── */
function ProgressBar({ step }) {
  const pct = ((step - 1) / (STEPS - 1)) * 100
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold text-[#8FA0BE] uppercase tracking-wider">
          Passo {step} de {STEPS}
        </span>
        <span className="text-[11px] font-semibold text-[#8FA0BE]">{Math.round(pct)}%</span>
      </div>
      <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(24,71,214,0.10)' }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: 'linear-gradient(90deg, #1847D6, #38BDF8)' }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  )
}

/* ── Step heading ──────────────────────────────────── */
function StepLabel({ children }) {
  return (
    <h3
      className="text-lg sm:text-xl font-bold text-[#0C1A38] mb-5 leading-snug"
      style={{ fontFamily: 'Outfit, sans-serif' }}
    >
      {children}
    </h3>
  )
}

export default function Simulator() {
  const [step,       setStep]       = useState(1)
  const [dir,        setDir]        = useState(1)
  const [employees,  setEmployees]  = useState(null)
  const [regMethod,  setRegMethod]  = useState(null)
  const [plusModule, setPlusModule] = useState(null)

  const plan          = employees ? planMap[employees] : null
  const impl          = regMethod ? implMap[regMethod] : null
  const tabletOptional = employees === 'up5' || employees === '6-10'
  const isEnterprise  = employees === '31+'
  const mensalidade   = plan?.price != null ? plan.price + (plusModule ? 89.90 : 0) : null

  function goTo(n) {
    setDir(n > step ? 1 : -1)
    setStep(n)
  }

  function pick(setter, value, nextStep) {
    setter(value)
    setTimeout(() => goTo(nextStep), 280)
  }

  function reset() {
    setDir(-1)
    setEmployees(null)
    setRegMethod(null)
    setPlusModule(null)
    setTimeout(() => setStep(1), 10)
  }

  function buildWAUrl() {
    const empLabel = employeeOptions.find(e => e.id === employees)?.label ?? '-'
    const msg = [
      'Olá! Simulei um orçamento no REGISTRA.PONTO.',
      '',
      `Funcionários: ${empLabel}`,
      `Registro: ${impl?.label ?? 'A definir'}`,
      `Plano: ${plan?.name ?? '-'}`,
      `Módulo Folha de Pagamento Plus: ${plusModule ? 'Sim (+R$89,90/mês)' : 'Não'}`,
      `Mensalidade: ${mensalidade != null ? `R$${fmtBRL(mensalidade)}/mês` : 'A consultar'}`,
      impl
        ? `Implantação: R$${fmtBRL(impl.cash)} à vista ou ${impl.installN}x de R$${fmtBRL(impl.installV)}`
        : 'Implantação: A consultar',
      '',
      'Gostaria de receber uma demonstração.',
    ].join('\n')
    return `${WA_BASE}${encodeURIComponent(msg)}`
  }

  return (
    <section className="py-14 sm:py-18 bg-rp-bg relative overflow-hidden">
      <div className="absolute inset-0 bg-dot-grid opacity-50 pointer-events-none" />
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] rounded-full pointer-events-none opacity-[0.05]"
        style={{ background: '#1847D6', filter: 'blur(120px)' }}
      />

      <div className="relative max-w-2xl mx-auto px-4 sm:px-6">
        {/* Section header */}
        <div className="text-center mb-8">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="section-label"
          >
            Simulador
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="text-2xl sm:text-3xl font-bold text-[#0C1A38] tracking-tight mt-2 mb-2"
          >
            Descubra o plano ideal para sua empresa
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.14 }}
            className="text-sm text-[#4D5E7A]"
          >
            Simule em poucos segundos e receba um orçamento pelo WhatsApp.
          </motion.p>
        </div>

        {/* Simulator card */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.18, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-2xl overflow-hidden"
          style={{
            background: '#FFFFFF',
            border: '1.5px solid rgba(24,71,214,0.12)',
            boxShadow: '0 16px 48px rgba(24,71,214,0.10), 0 4px 16px rgba(24,71,214,0.06)',
          }}
        >
          <div className="p-6 sm:p-8">
            <ProgressBar step={step} />

            <div style={{ minHeight: 300 }}>
              <AnimatePresence mode="wait" custom={dir}>
                {/* ── PASSO 1: Funcionários ── */}
                {step === 1 && (
                  <motion.div key="step1" custom={dir} variants={slide} initial="enter" animate="center" exit="exit">
                    <StepLabel>Quantos funcionários sua empresa possui?</StepLabel>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {employeeOptions.map((opt) => (
                        <SelCard
                          key={opt.id}
                          selected={employees === opt.id}
                          onClick={() => pick(setEmployees, opt.id, 2)}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-bold text-[#0C1A38] text-base leading-none mb-0.5">{opt.label}</p>
                              <p className="text-xs text-[#8FA0BE]">{opt.sub}</p>
                            </div>
                            {employees === opt.id && (
                              <div
                                className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                                style={{ background: '#1847D6' }}
                              >
                                <Check size={11} className="text-white" strokeWidth={3} />
                              </div>
                            )}
                          </div>
                        </SelCard>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* ── PASSO 2: Método de registro ── */}
                {step === 2 && (
                  <motion.div key="step2" custom={dir} variants={slide} initial="enter" animate="center" exit="exit">
                    <StepLabel>Como deseja registrar o ponto?</StepLabel>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Dispositivo */}
                      <SelCard selected={regMethod === 'device'} onClick={() => pick(setRegMethod, 'device', 3)}>
                        <div className="flex flex-col gap-2">
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center"
                            style={{ background: 'rgba(14,165,233,0.10)', border: '1px solid rgba(14,165,233,0.20)' }}
                          >
                            <Monitor size={17} style={{ color: '#0EA5E9' }} />
                          </div>
                          <div>
                            <p className="font-bold text-[#0C1A38] text-sm mb-0.5">Usar dispositivo da empresa</p>
                            <p className="text-xs text-[#4D5E7A] mb-1">Notebook, computador ou celular.</p>
                            <p className="text-[11px] font-semibold" style={{ color: '#0EA5E9' }}>Menor investimento inicial.</p>
                          </div>
                        </div>
                      </SelCard>

                      {/* Tablet */}
                      <SelCard selected={regMethod === 'tablet'} onClick={() => pick(setRegMethod, 'tablet', 3)}>
                        <div className="flex flex-col gap-2">
                          <div className="flex items-start justify-between">
                            <div
                              className="w-9 h-9 rounded-lg flex items-center justify-center"
                              style={{ background: 'rgba(24,71,214,0.10)', border: '1px solid rgba(24,71,214,0.18)' }}
                            >
                              <Tablet size={17} style={{ color: '#1847D6' }} />
                            </div>
                            {!tabletOptional && (
                              <span
                                className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                style={{ background: 'rgba(24,71,214,0.09)', color: '#1847D6', border: '1px solid rgba(24,71,214,0.18)' }}
                              >
                                Recomendado
                              </span>
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-[#0C1A38] text-sm mb-0.5">Receber tablet dedicado</p>
                            <p className="text-xs text-[#4D5E7A] mb-1">Tablet incluso na implantação.</p>
                            <p className="text-[11px] font-semibold" style={{ color: '#1847D6' }}>
                              O equipamento passa a ser patrimônio da empresa.
                            </p>
                          </div>
                        </div>
                      </SelCard>
                    </div>

                    {!tabletOptional && (
                      <p className="text-[11px] text-[#8FA0BE] mt-3 text-center">
                        Para equipes acima de 10 funcionários, recomendamos tablet dedicado para maior fluidez.
                      </p>
                    )}
                  </motion.div>
                )}

                {/* ── PASSO 3: Módulo Plus ── */}
                {step === 3 && (
                  <motion.div key="step3" custom={dir} variants={slide} initial="enter" animate="center" exit="exit">
                    <StepLabel>Precisa fechar a folha de pagamento pelo sistema?</StepLabel>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <SelCard selected={plusModule === false} onClick={() => pick(setPlusModule, false, 4)}>
                        <p className="font-bold text-[#0C1A38] text-sm mb-0.5">Não, por enquanto</p>
                        <p className="text-xs text-[#8FA0BE]">Controle de ponto e banco de horas já inclusos no plano.</p>
                      </SelCard>

                      <SelCard selected={plusModule === true} onClick={() => pick(setPlusModule, true, 4)}>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="font-bold text-[#0C1A38] text-sm">Sim, quero o módulo Folha</p>
                          <span
                            className="whitespace-nowrap text-[11px] font-bold px-2 py-1 rounded-full flex-shrink-0"
                            style={{ background: 'rgba(109,40,217,0.09)', color: '#6D28D9', border: '1px solid rgba(109,40,217,0.20)' }}
                          >
                            +R$89,90/mês
                          </span>
                        </div>
                        <p className="text-xs text-[#4D5E7A] leading-relaxed">
                          Analisa o banco de horas e gera previsão de salário para facilitar o fechamento com o DP.
                        </p>
                      </SelCard>
                    </div>
                  </motion.div>
                )}

                {/* ── PASSO 4: Resultado ── */}
                {step === 4 && (
                  <motion.div key="step4" custom={dir} variants={slide} initial="enter" animate="center" exit="exit">
                    <div className="flex items-center justify-between mb-5">
                      <h3 className="text-lg font-bold text-[#0C1A38]" style={{ fontFamily: 'Outfit, sans-serif' }}>
                        Seu plano recomendado
                      </h3>
                      <span
                        className="text-xs font-bold px-3 py-1 rounded-full"
                        style={{
                          background: 'linear-gradient(135deg, #1847D6, #1035BC)',
                          color: '#FFFFFF',
                          boxShadow: '0 2px 10px rgba(24,71,214,0.30)',
                        }}
                      >
                        {plan?.name}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                      {/* Mensalidade */}
                      <div
                        className="rounded-xl p-4"
                        style={{ background: 'rgba(24,71,214,0.04)', border: '1px solid rgba(24,71,214,0.12)' }}
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8FA0BE] mb-2">Mensalidade</p>
                        {mensalidade != null ? (
                          <>
                            <div className="flex items-baseline gap-0.5">
                              <span className="text-xs text-[#4D5E7A] font-medium">R$</span>
                              <span
                                className="text-3xl font-black text-[#0C1A38] leading-none tracking-tight"
                                style={{ fontFamily: 'Outfit, sans-serif' }}
                              >
                                {fmtBRL(mensalidade)}
                              </span>
                              <span className="text-xs text-[#8FA0BE] font-medium ml-0.5">/mês</span>
                            </div>
                            {plusModule && (
                              <p className="text-[11px] text-[#6D28D9] mt-1 font-semibold">Inclui módulo Folha de Pagamento +R$89,90</p>
                            )}
                          </>
                        ) : (
                          <p className="text-base font-semibold text-[#4D5E7A]">A consultar</p>
                        )}
                      </div>

                      {/* Implantação */}
                      <div
                        className="rounded-xl p-4"
                        style={{ background: 'rgba(14,165,233,0.04)', border: '1px solid rgba(14,165,233,0.14)' }}
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8FA0BE] mb-2">
                          Implantação (única vez)
                        </p>
                        {impl ? (
                          <>
                            <div className="flex items-baseline gap-0.5">
                              <span className="text-xs text-[#4D5E7A] font-medium">R$</span>
                              <span
                                className="text-3xl font-black text-[#0C1A38] leading-none tracking-tight"
                                style={{ fontFamily: 'Outfit, sans-serif' }}
                              >
                                {fmtBRL(impl.cash)}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#4D5E7A] mt-1">
                              ou {impl.installN}x de{' '}
                              <span className="font-semibold text-[#0C1A38]">R${fmtBRL(impl.installV)}</span>
                            </p>
                          </>
                        ) : (
                          <p className="text-base font-semibold text-[#4D5E7A]">A consultar</p>
                        )}
                      </div>
                    </div>

                    {/* Recursos inclusos */}
                    <div
                      className="rounded-xl p-4 mb-4"
                      style={{ background: '#FAFCFF', border: '1px solid rgba(24,71,214,0.08)' }}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8FA0BE] mb-3">Incluso no plano</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                        {[
                          'Reconhecimento facial',
                          'Dashboard web',
                          'Exportação Excel',
                          'Relatórios de ponto',
                          'Gestão de funcionários',
                          'Banco de horas',
                          'Funciona offline',
                          'Suporte técnico',
                        ].map((f) => (
                          <div key={f} className="flex items-center gap-2 text-xs text-[#4D5E7A]">
                            <Check size={11} style={{ color: '#1847D6' }} strokeWidth={3} className="flex-shrink-0" />
                            {f}
                          </div>
                        ))}
                      </div>
                    </div>

                    <p className="text-[11px] text-[#B0C0D4] text-center mb-5">
                      Valores estimados. Orçamento final confirmado pelo consultor.
                    </p>

                    {/* CTA WhatsApp */}
                    <a
                      href={buildWAUrl()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-green w-full py-3.5 text-base"
                    >
                      <MessageCircle size={18} />
                      Solicitar orçamento no WhatsApp
                    </a>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer navigation */}
            <div className="flex items-center justify-between mt-5 pt-4" style={{ borderTop: '1px solid rgba(24,71,214,0.07)' }}>
              {step > 1 ? (
                <button
                  onClick={() => goTo(step - 1)}
                  className="flex items-center gap-1.5 text-sm text-[#4D5E7A] hover:text-[#0C1A38] transition-colors"
                >
                  <ArrowLeft size={14} />
                  Voltar
                </button>
              ) : <span />}

              {step === 4 ? (
                <button
                  onClick={reset}
                  className="flex items-center gap-1.5 text-xs text-[#8FA0BE] hover:text-[#4D5E7A] transition-colors"
                >
                  <RotateCcw size={12} />
                  Refazer simulação
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  {Array.from({ length: STEPS }).map((_, i) => (
                    <div
                      key={i}
                      className="rounded-full transition-all duration-300"
                      style={{
                        width:  i + 1 === step ? 16 : 6,
                        height: 6,
                        background: i + 1 <= step ? '#1847D6' : 'rgba(24,71,214,0.18)',
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
