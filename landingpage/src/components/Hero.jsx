import React, { useRef, useState, useEffect } from 'react'
import { motion, useInView } from 'framer-motion'
import { ArrowRight, CheckCircle2, Shield, Clock, BarChart3, MessageCircle } from 'lucide-react'

const WA_URL  = 'https://wa.me/5524992272778?text=Ol%C3%A1!%20Tenho%20interesse%20no%20REGISTRA.PONTO.'
const WA_DEMO = 'https://wa.me/5524992272778?text=Ol%C3%A1!%20Gostaria%20de%20ver%20uma%20demonstra%C3%A7%C3%A3o%20do%20REGISTRA.PONTO.'

const stats = [
  { icon: Clock,     value: 'até 48h', numeric: null, label: 'para implantar' },
  { icon: Shield,    value: '100%',    numeric: 100,  label: 'conforme CLT'   },
  { icon: BarChart3, value: 'Excel',   numeric: null, label: 'pronto para DP' },
]

const trust = [
  'Já em uso em empresas da região',
  'Reconhecimento facial + GPS incluso',
  'Suporte local, não só remoto',
]

function useCountUp(target, duration = 1600, trigger = false) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!trigger || target === null) return
    let start = null
    const tick = (now) => {
      if (!start) start = now
      const t = Math.min((now - start) / duration, 1)
      const e = 1 - Math.pow(1 - t, 3)
      setVal(Math.round(target * e))
      if (t < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [trigger, target, duration])
  return val
}

const statContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.55 } },
}
const statItem = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
}

export default function Hero() {
  const statsRef    = useRef(null)
  const statsInView = useInView(statsRef, { once: true, margin: '-60px' })
  const count100    = useCountUp(100, 1500, statsInView)

  return (
    <section
      className="relative overflow-hidden"
      style={{ minHeight: '100dvh', paddingTop: '68px' }}
    >
      {/* ── Full-bleed background image ── */}
      <div className="absolute inset-0 pointer-events-none">
        <img
          src="/image/banner.png"
          alt=""
          aria-hidden="true"
          className="w-full h-full object-cover [object-position:82%_center] sm:[object-position:75%_center] lg:[object-position:60%_center]"
          draggable={false}
        />

        {/* Left fade — makes text readable against the scene */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to right, rgba(255,255,255,0.99) 0%, rgba(255,255,255,0.97) 38%, rgba(255,255,255,0.88) 54%, rgba(255,255,255,0.40) 70%, rgba(255,255,255,0.08) 82%, transparent 92%)',
          }}
        />

        {/* Bottom gradient — blends into next section with brand blue tint */}
        <div
          className="absolute bottom-0 left-0 right-0"
          style={{
            height: '38%',
            background:
              'linear-gradient(to bottom, transparent 0%, rgba(236,242,255,0.55) 55%, rgba(255,255,255,1) 100%)',
          }}
        />

        {/* Subtle top vignette */}
        <div
          className="absolute top-0 left-0 right-0"
          style={{
            height: '15%',
            background: 'linear-gradient(to bottom, rgba(255,255,255,0.25), transparent)',
          }}
        />
      </div>

      {/* ── Content overlay ── */}
      <div
        className="relative z-10 px-6 sm:px-10 lg:px-16 xl:px-24 flex flex-col"
        style={{ minHeight: 'calc(100dvh - 68px)' }}
      >
        {/* Main content — vertically centered */}
        <div className="flex-1 flex flex-col justify-center py-10 sm:py-14">
          <div className="max-w-[520px] lg:max-w-[660px] xl:max-w-[740px]">

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="text-xs lg:text-sm font-semibold tracking-widest uppercase mb-5"
              style={{ color: '#1847D6' }}
            >
              Sistema de ponto eletrônico B2B
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="text-[2rem] sm:text-[2.6rem] lg:text-[3.8rem] xl:text-[4.6rem] font-bold text-[#0C1A38] leading-[1.06] tracking-tight mb-5"
              style={{ textWrap: 'balance' }}
            >
              Feche a folha sem conflito.{' '}
              <span className="gradient-text">Registro de ponto</span>{' '}
              em segundos.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="text-base lg:text-lg xl:text-xl text-[#4D5E7A] leading-relaxed mb-8 max-w-[480px] lg:max-w-[540px]"
            >
              Reconhecimento facial no tablet, acompanhamento em tempo real e exportação
              pronta para simplificar o controle da empresa.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-wrap gap-3 mb-7"
            >
              <a href={WA_DEMO} target="_blank" rel="noopener noreferrer"
                 className="btn-primary px-6 py-3.5 text-sm lg:text-base lg:px-8 lg:py-4">
                Ver demonstração
                <ArrowRight size={15} />
              </a>
              <a href={WA_URL} target="_blank" rel="noopener noreferrer"
                 className="btn-green px-6 py-3.5 text-sm lg:text-base lg:px-8 lg:py-4">
                <MessageCircle size={15} />
                WhatsApp
              </a>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.42 }}
              className="flex flex-wrap gap-x-5 gap-y-2"
            >
              {trust.map((t) => (
                <div key={t} className="flex items-center gap-1.5 text-xs lg:text-sm text-[#4D5E7A]">
                  <CheckCircle2 size={12} style={{ color: '#1847D6' }} className="flex-shrink-0" />
                  {t}
                </div>
              ))}
            </motion.div>
          </div>
        </div>

        {/* ── Stats band — bottom of section ── */}
        <motion.div
          ref={statsRef}
          variants={statContainer}
          initial="hidden"
          animate={statsInView ? 'visible' : 'hidden'}
          className="pb-8 grid grid-cols-3 gap-2 sm:gap-3 max-w-md lg:max-w-lg"
        >
          {stats.map(({ icon: Icon, value, numeric, label }) => (
            <motion.div
              key={label}
              variants={statItem}
              whileHover={{ y: -3 }}
              className="stat-card p-3 sm:p-4 flex-row gap-2 sm:gap-3"
            >
              <div
                className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                  background: 'rgba(24,71,214,0.09)',
                  border: '1px solid rgba(24,71,214,0.18)',
                }}
              >
                <Icon size={13} style={{ color: '#1847D6' }} />
              </div>
              <div>
                <p
                  className="text-base sm:text-xl font-black text-[#0C1A38] leading-none tracking-tight mb-0.5"
                  style={{ fontFamily: 'Outfit, sans-serif' }}
                >
                  {numeric !== null ? `${count100}%` : value}
                </p>
                <p className="text-[9px] sm:text-[10px] text-[#8FA0BE] leading-none">{label}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
