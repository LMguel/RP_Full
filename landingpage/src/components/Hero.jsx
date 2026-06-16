import React, { useEffect, useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import { ArrowRight, CheckCircle2, Shield, Clock, BarChart3, MessageCircle } from 'lucide-react'

const WA_URL  = 'https://wa.me/5524992272778?text=Ol%C3%A1!%20Tenho%20interesse%20no%20REGISTRA.PONTO.'
const WA_DEMO = 'https://wa.me/5524992272778?text=Ol%C3%A1!%20Gostaria%20de%20ver%20uma%20demonstra%C3%A7%C3%A3o%20do%20REGISTRA.PONTO.'

const stats = [
  { icon: Clock,     value: 'até 48h', numeric: null, label: 'para implantar'  },
  { icon: Shield,    value: '100%',    numeric: 100,  label: 'conforme CLT'    },
  { icon: BarChart3, value: 'Excel',   numeric: null, label: 'pronto para DP'  },
]

const trust = [
  'Sistema em operação em empresas da região',
  'Utilizado diariamente para registro de ponto',
  'Implantação rápida',
]

/* ──────────────────────────────────────────────────
   Particle field — blue tech atmosphere
────────────────────────────────────────────────── */
function ParticleField() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let animId

    const resize = () => {
      const p = canvas.parentElement
      if (!p) return
      canvas.width  = p.offsetWidth
      canvas.height = p.offsetHeight
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas.parentElement)

    const N   = 55
    const MAX = 130
    const MAX2 = MAX * MAX

    const pts = Array.from({ length: N }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      r: Math.random() * 1.2 + 0.4,
    }))

    const draw = () => {
      const w = canvas.width, h = canvas.height
      ctx.clearRect(0, 0, w, h)

      for (const p of pts) {
        p.x = ((p.x + p.vx) % w + w) % w
        p.y = ((p.y + p.vy) % h + h) % h
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(24,71,214,0.35)'
        ctx.fill()
      }

      ctx.lineWidth = 0.5
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const dx = pts[i].x - pts[j].x
          const dy = pts[i].y - pts[j].y
          const d2 = dx * dx + dy * dy
          if (d2 < MAX2) {
            const a = (1 - Math.sqrt(d2) / MAX) * 0.10
            ctx.strokeStyle = `rgba(24,71,214,${a.toFixed(3)})`
            ctx.beginPath()
            ctx.moveTo(pts[i].x, pts[i].y)
            ctx.lineTo(pts[j].x, pts[j].y)
            ctx.stroke()
          }
        }
      }

      animId = requestAnimationFrame(draw)
    }

    draw()
    return () => { cancelAnimationFrame(animId); ro.disconnect() }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none opacity-40"
    />
  )
}

/* ──────────────────────────────────────────────────
   Counter hook
────────────────────────────────────────────────── */
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

/* ──────────────────────────────────────────────────
   Product image — real tablet on wall
────────────────────────────────────────────────── */
function ProductImage() {
  return (
    <div className="relative select-none flex justify-center">
      {/* Blue ambient glow */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(24,71,214,0.10) 0%, transparent 70%)' }}
      />

      <motion.div
        initial={{ opacity: 0, x: 30, scale: 0.97 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{ duration: 0.85, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-[320px] sm:max-w-[380px] lg:max-w-[420px]"
      >
        {/* Image frame */}
        <motion.div
          animate={{ y: [0, -7, 0] }}
          transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut', repeatType: 'mirror' }}
          className="relative rounded-xl overflow-hidden"
          style={{
            border: '1.5px solid rgba(24,71,214,0.14)',
            boxShadow: '0 20px 50px rgba(24,71,214,0.13), 0 6px 18px rgba(0,0,0,0.05)',
            transform: 'perspective(1200px) rotateY(-3deg) rotateX(1.5deg)',
          }}
        >
          <img
            src="/image/captura.png"
            alt="Tablet de registro facial fixo na parede — REGISTRA.PONTO"
            className="w-full block"
            draggable={false}
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, transparent 45%)' }}
          />
        </motion.div>

        {/* Floating badge — top right */}
        <motion.div
          animate={{ y: [0, -7, 0] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-3 -right-3 glass rounded-xl px-3 py-2 hidden sm:flex items-center gap-2"
          style={{ boxShadow: '0 6px 24px rgba(24,71,214,0.12), 0 0 0 1px rgba(24,71,214,0.09)' }}
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(24,71,214,0.10)', border: '1px solid rgba(24,71,214,0.18)' }}
          >
            <CheckCircle2 size={13} style={{ color: '#1847D6' }} />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#0C1A38] leading-none mb-0.5" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Ponto registrado
            </p>
            <p className="text-[10px] text-[#8FA0BE]">08:47 · Carlos Silva</p>
          </div>
        </motion.div>

        {/* Floating badge — bottom left */}
        <motion.div
          animate={{ y: [0, 7, 0] }}
          transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
          className="absolute -bottom-4 -left-3 glass rounded-xl px-3 py-2 hidden sm:block"
          style={{ boxShadow: '0 6px 24px rgba(24,71,214,0.10), 0 0 0 1px rgba(24,71,214,0.07)' }}
        >
          <p className="text-[9px] text-[#8FA0BE] mb-0.5 uppercase tracking-wider font-medium">Ativos agora</p>
          <p className="text-base font-black text-[#0C1A38] leading-none" style={{ fontFamily: 'Outfit, sans-serif' }}>
            24 <span style={{ color: '#1847D6', fontSize: '12px', fontWeight: 600 }}>online</span>
          </p>
        </motion.div>
      </motion.div>
    </div>
  )
}

/* ──────────────────────────────────────────────────
   Stagger variants
────────────────────────────────────────────────── */
const statContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.55 } },
}
const statItem = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
}

/* ──────────────────────────────────────────────────
   Hero
────────────────────────────────────────────────── */
export default function Hero() {
  const statsRef   = useRef(null)
  const statsInView = useInView(statsRef, { once: true, margin: '-60px' })
  const count100   = useCountUp(100, 1500, statsInView)

  return (
    <section className="relative flex flex-col justify-center overflow-hidden bg-rp-bg"
             style={{ minHeight: 'calc(100vh - 68px)', paddingTop: '68px' }}>

      {/* Particle field */}
      <ParticleField />

      {/* Dot grid overlay */}
      <div className="absolute inset-0 bg-dot-grid opacity-60 pointer-events-none" />

      {/* Atmospheric glows */}
      <motion.div
        animate={{ scale: [1, 1.06, 1], opacity: [0.05, 0.10, 0.05] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -top-[10%] left-[5%] w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: '#1847D6', filter: 'blur(130px)' }}
      />
      <div
        className="absolute top-[40%] right-[-8%] w-[280px] h-[280px] rounded-full pointer-events-none opacity-[0.05]"
        style={{ background: '#38BDF8', filter: 'blur(100px)' }}
      />

      <div className="relative max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-10 lg:py-12">
        <div className="grid lg:grid-cols-2 gap-6 lg:gap-12 items-center">

          {/* ── LEFT: Copy ── */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
            >
              <div className="feature-badge mb-4 w-fit">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1847D6] animate-pulse" />
                Sistema de ponto eletrônico B2B
              </div>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="text-[1.55rem] sm:text-3xl lg:text-[2.8rem] font-bold text-[#0C1A38] leading-[1.12] tracking-tight mb-3 sm:mb-4"
            >
              Feche a folha sem conflito.{' '}
              <span className="gradient-text">Registro de ponto</span>{' '}
              em segundos.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="text-sm sm:text-base text-[#4D5E7A] leading-relaxed mb-4 sm:mb-6 max-w-[460px]"
            >
              Reconhecimento facial no tablet, acompanhamento em tempo real e exportação
              pronta para simplificar o controle da empresa.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-wrap gap-2.5 mb-4 sm:mb-6"
            >
              <a href={WA_DEMO} target="_blank" rel="noopener noreferrer"
                 className="btn-primary px-5 py-3 text-sm">
                Ver demonstração
                <ArrowRight size={15} />
              </a>
              <a href={WA_URL} target="_blank" rel="noopener noreferrer"
                 className="btn-green px-5 py-3 text-sm">
                <MessageCircle size={15} />
                WhatsApp
              </a>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="flex flex-wrap gap-x-5 gap-y-1.5"
            >
              {trust.map((t) => (
                <div key={t} className="flex items-center gap-1.5 text-xs text-[#4D5E7A]">
                  <CheckCircle2 size={12} style={{ color: '#1847D6' }} className="flex-shrink-0" />
                  {t}
                </div>
              ))}
            </motion.div>
          </div>

          {/* ── RIGHT: Product photo ── */}
          <div className="relative flex items-center justify-center">
            <ProductImage />
          </div>
        </div>

        {/* ── Stats band ── */}
        <motion.div
          ref={statsRef}
          variants={statContainer}
          initial="hidden"
          animate={statsInView ? 'visible' : 'hidden'}
          className="mt-6 sm:mt-10 grid grid-cols-3 gap-2 sm:gap-3 max-w-xl mx-auto"
        >
          {stats.map(({ icon: Icon, value, numeric, label }) => (
            <motion.div key={label} variants={statItem} whileHover={{ y: -3 }}
              className="stat-card p-3 sm:p-4 flex-row gap-2 sm:gap-3">
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
                <p className="text-base sm:text-xl font-black text-[#0C1A38] leading-none tracking-tight mb-0.5" style={{ fontFamily: 'Outfit, sans-serif' }}>
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
