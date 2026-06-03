import React, { useEffect, useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import { ArrowRight, CheckCircle2, Shield, Clock, BarChart3, MessageCircle } from 'lucide-react'

const WA_URL  = 'https://wa.me/5524992272778?text=Ol%C3%A1!%20Tenho%20interesse%20no%20REGISTRA.PONTO.'
const WA_DEMO = 'https://wa.me/5524992272778?text=Ol%C3%A1!%20Gostaria%20de%20ver%20uma%20demonstra%C3%A7%C3%A3o%20do%20REGISTRA.PONTO.'

const stats = [
  { icon: Clock,    value: '< 1 dia', numeric: null,  label: 'para implantar', color: 'emerald' },
  { icon: Shield,   value: '100%',    numeric: 100,   label: 'conforme CLT',   color: 'emerald' },
  { icon: BarChart3,value: 'Excel',   numeric: null,  label: 'pronto para DP', color: 'teal' },
]

const trust = ['Implantação inclusa', 'Sem fidelidade', 'Suporte incluso']

/* ──────────────────────────────────────────────────
   Particle field (canvas) — green tech atmosphere
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
        ctx.fillStyle = 'rgba(0,232,122,0.55)'
        ctx.fill()
      }

      ctx.lineWidth = 0.5
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const dx = pts[i].x - pts[j].x
          const dy = pts[i].y - pts[j].y
          const d2 = dx * dx + dy * dy
          if (d2 < MAX2) {
            const a = (1 - Math.sqrt(d2) / MAX) * 0.14
            ctx.strokeStyle = `rgba(0,232,122,${a.toFixed(3)})`
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
      className="absolute inset-0 w-full h-full pointer-events-none opacity-35"
    />
  )
}

/* ──────────────────────────────────────────────────
   Counter hook — ease-out cubic count-up
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
   3-D tablet mockup with interactive flash
────────────────────────────────────────────────── */
function TabletMockup() {
  const [phase, setPhase] = useState('idle') // idle | flash | success

  const tap = () => {
    if (phase !== 'idle') return
    setPhase('flash')
    setTimeout(() => setPhase('success'), 210)
    setTimeout(() => setPhase('idle'),    3900)
  }

  return (
    <div className="relative select-none">
      {/* Ambient glow behind tablet */}
      <div
        className="absolute inset-0 -m-10 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(0,232,122,0.10) 0%, transparent 70%)' }}
      />

      {/* Perspective wrapper — scale down on very small screens */}
      <div style={{ perspective: '1200px', perspectiveOrigin: '50% 40%' }}
           className="scale-[0.72] xs:scale-[0.82] sm:scale-100 origin-center">
        <motion.div
          style={{ transformStyle: 'preserve-3d', willChange: 'transform' }}
          animate={{ y: [0, -14, 0] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', repeatType: 'mirror' }}
        >
          {/* Tablet chassis */}
          <div
            onClick={tap}
            style={{
              width: '264px',
              height: '374px',
              background: 'linear-gradient(145deg, #1E2D44, #0D1929)',
              borderRadius: '28px',
              border: '1.5px solid rgba(255,255,255,0.11)',
              boxShadow: `
                0 0 0 0.5px rgba(0,0,0,0.6),
                0 44px 88px rgba(0,0,0,0.80),
                0 16px 36px rgba(0,0,0,0.55),
                inset 0 1px 0 rgba(255,255,255,0.08),
                0 0 70px rgba(0,232,122,0.06)
              `,
              transform: 'rotateX(12deg) rotateY(-22deg) rotateZ(1.5deg)',
              position: 'relative',
              cursor: phase === 'idle' ? 'pointer' : 'default',
              willChange: 'transform',
            }}
          >
            {/* Left-edge depth highlight */}
            <div style={{
              position: 'absolute', left: 0, top: '18%',
              width: '2px', height: '64%',
              background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.06), transparent)',
              borderRadius: '2px',
            }} />

            {/* Front camera */}
            <div style={{
              position: 'absolute', top: '13px', left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex', alignItems: 'center', gap: '6px', zIndex: 5,
            }}>
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: '#101B29', border: '1px solid rgba(255,255,255,0.15)',
                boxShadow: 'inset 0 0 4px rgba(0,0,0,0.9)', position: 'relative',
              }}>
                <div style={{
                  position: 'absolute', top: '1.5px', left: '1.5px',
                  width: '2.5px', height: '2.5px', borderRadius: '50%',
                  background: 'rgba(255,255,255,0.28)',
                }} />
              </div>
              <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />
            </div>

            {/* Screen */}
            <div style={{
              position: 'absolute', top: '34px', left: '9px', right: '9px', bottom: '28px',
              borderRadius: '18px', background: '#06101C',
              overflow: 'hidden', boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)',
            }}>

              {/* ── FLASH ── */}
              {phase === 'flash' && (
                <div style={{
                  position: 'absolute', inset: 0, background: 'white', zIndex: 30,
                  animation: 'flash-fade 0.22s ease-out forwards',
                }} />
              )}

              {/* ── SUCCESS ── */}
              {phase === 'success' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.28 }}
                  style={{
                    position: 'absolute', inset: 0, zIndex: 20,
                    background: 'linear-gradient(160deg, #041B0F, #051E12)',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: '10px',
                  }}
                >
                  <motion.div
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 320, damping: 18, delay: 0.08 }}
                    style={{
                      width: '58px', height: '58px', borderRadius: '50%',
                      background: 'rgba(0,232,122,0.14)',
                      border: '2px solid #00E87A',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 0 32px rgba(0,232,122,0.35)',
                    }}
                  >
                    <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                      <path d="M5 13l6 6 10-10" stroke="#00E87A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </motion.div>

                  <motion.p
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.18 }}
                    style={{ fontSize: '9px', color: '#00E87A', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}
                  >
                    Registro realizado
                  </motion.p>

                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.26 }}
                    style={{ textAlign: 'center' }}
                  >
                    <p style={{ fontSize: '15px', color: 'white', fontWeight: 700, fontFamily: 'Outfit, sans-serif', lineHeight: 1.2 }}>
                      Carlos Silva
                    </p>
                    <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginTop: '3px' }}>
                      08:47 · Entrada
                    </p>
                  </motion.div>

                  {/* Indicator dots */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    style={{
                      position: 'absolute', bottom: '16px', left: '50%',
                      transform: 'translateX(-50%)', display: 'flex', gap: '4px',
                    }}
                  >
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{
                        width: '4px', height: '4px', borderRadius: '50%',
                        background: 'rgba(0,232,122,0.5)',
                      }} />
                    ))}
                  </motion.div>
                </motion.div>
              )}

              {/* ── IDLE ── */}
              {phase === 'idle' && (
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 12px',
                }}>
                  {/* Top bar */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <span style={{ fontSize: '7px', color: 'rgba(255,255,255,0.22)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                      REGISTRA.PONTO
                    </span>
                    {/* Battery icon */}
                    <div style={{ width: '12px', height: '7px', borderRadius: '1.5px', border: '0.5px solid rgba(255,255,255,0.28)', position: 'relative' }}>
                      <div style={{ position: 'absolute', inset: '1px 1.5px', background: 'rgba(0,232,122,0.75)', borderRadius: '0.5px', width: '65%' }} />
                      <div style={{ position: 'absolute', right: '-2.5px', top: '1.5px', width: '1.5px', height: '4px', background: 'rgba(255,255,255,0.28)', borderRadius: '1px' }} />
                    </div>
                  </div>

                  {/* Clock */}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      fontSize: '36px', fontWeight: 800, color: 'white',
                      letterSpacing: '-0.04em', lineHeight: 1,
                      fontFamily: 'Outfit, sans-serif',
                    }}>
                      08:47
                    </div>
                    <div style={{ fontSize: '8.5px', color: 'rgba(255,255,255,0.32)', marginTop: '5px', letterSpacing: '0.06em' }}>
                      TERÇA, 03 DE JUNHO
                    </div>
                  </div>

                  {/* Face detection frame */}
                  <div style={{ position: 'relative', width: '88px', height: '88px' }}>
                    <svg width="88" height="88" style={{ position: 'absolute', inset: 0 }}>
                      {/* Corner brackets */}
                      <path d="M10,4 L4,4 L4,10"    stroke="rgba(0,232,122,0.75)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                      <path d="M78,4 L84,4 L84,10"   stroke="rgba(0,232,122,0.75)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                      <path d="M10,84 L4,84 L4,78"   stroke="rgba(0,232,122,0.75)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                      <path d="M78,84 L84,84 L84,78"  stroke="rgba(0,232,122,0.75)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                      {/* Dashed circle */}
                      <circle cx="44" cy="44" r="30" stroke="rgba(0,232,122,0.13)" strokeWidth="1" fill="none" strokeDasharray="4 4"/>
                    </svg>

                    {/* Scanning line */}
                    <div style={{
                      position: 'absolute', left: '10px', right: '10px',
                      height: '1.5px', top: '10px',
                      background: 'linear-gradient(90deg, transparent, rgba(0,232,122,0.95), transparent)',
                      animation: 'tablet-scan 2.8s ease-in-out infinite',
                      borderRadius: '2px',
                      boxShadow: '0 0 6px rgba(0,232,122,0.5)',
                    }} />

                    {/* Face silhouette (subtle) */}
                    <svg width="54" height="54" style={{ position: 'absolute', top: '17px', left: '17px', opacity: 0.18 }} viewBox="0 0 56 56" fill="none">
                      <ellipse cx="28" cy="20" rx="13" ry="15" fill="rgba(255,255,255,0.6)"/>
                      <path d="M6 56 Q6 38 28 38 Q50 38 50 56" fill="rgba(255,255,255,0.6)"/>
                    </svg>
                  </div>

                  {/* Register prompt */}
                  <div style={{
                    background: 'rgba(0,232,122,0.09)',
                    border: '1px solid rgba(0,232,122,0.28)',
                    borderRadius: '8px', padding: '8px 20px',
                    textAlign: 'center',
                    boxShadow: '0 0 14px rgba(0,232,122,0.07)',
                  }}>
                    <span style={{ fontSize: '7.5px', color: '#00E87A', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                      Toque para registrar
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Home indicator */}
            <div style={{
              position: 'absolute', bottom: '10px', left: '50%',
              transform: 'translateX(-50%)',
              width: '38px', height: '3px',
              background: 'rgba(255,255,255,0.11)', borderRadius: '2px',
            }} />
          </div>
        </motion.div>
      </div>

      {/* Invite text */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.2, duration: 0.8 }}
        className="text-center mt-5 text-[11px] text-slate-600 tracking-widest select-none pointer-events-none uppercase"
      >
        ← clique para testar
      </motion.p>
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
  hidden:   { opacity: 0, y: 24 },
  visible:  { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
}

/* ──────────────────────────────────────────────────
   Hero
────────────────────────────────────────────────── */
export default function Hero() {
  const statsRef = useRef(null)
  const statsInView = useInView(statsRef, { once: true, margin: '-60px' })
  const count100 = useCountUp(100, 1500, statsInView)

  return (
    <section className="relative min-h-screen flex flex-col justify-center overflow-hidden pt-[68px]">

      {/* Particle field */}
      <ParticleField />

      {/* Dot grid overlay */}
      <div className="absolute inset-0 bg-dot-grid opacity-50 pointer-events-none" />

      {/* Atmospheric glows */}
      <motion.div
        animate={{ scale: [1, 1.06, 1], opacity: [0.07, 0.13, 0.07] }}
        transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -top-[15%] left-[5%] w-[700px] h-[700px] rounded-full bg-emerald-600 blur-[140px] pointer-events-none"
      />
      <div className="absolute top-[40%] right-[-8%] w-[350px] h-[350px] rounded-full bg-teal-600 opacity-[0.06] blur-[110px] pointer-events-none" />
      <div className="absolute bottom-0 left-[-5%] w-[450px] h-[350px] rounded-full bg-emerald-900 opacity-20 blur-[110px] pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-20 lg:py-28">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">

          {/* ── LEFT: Copy ── */}
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
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="text-[1.75rem] sm:text-4xl lg:text-[3.5rem] font-bold text-white leading-[1.1] tracking-tight mb-5 sm:mb-6"
            >
              Controle de ponto{' '}
              <span className="gradient-text">com reconhecimento facial</span>{' '}
              para sua empresa
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="text-base sm:text-lg text-slate-400 leading-relaxed mb-6 sm:mb-8 max-w-[490px]"
            >
              Tablet fixo com reconhecimento facial, dashboard completo e relatórios prontos
              para exportação. Implantação e suporte incluso — tudo resolvido para você.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-wrap gap-3 mb-10"
            >
              <a href={WA_DEMO} target="_blank" rel="noopener noreferrer"
                 className="btn-primary px-7 py-3.5 text-[15px]">
                Ver demonstração
                <ArrowRight size={16} />
              </a>
              <a href={WA_URL} target="_blank" rel="noopener noreferrer"
                 className="btn-green px-7 py-3.5 text-[15px]">
                <MessageCircle size={16} />
                Falar no WhatsApp
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

          {/* ── RIGHT: 3D Tablet ── */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="relative flex items-center justify-center"
          >
            <TabletMockup />

            {/* Floating badge — top right */}
            <motion.div
              animate={{ y: [0, -9, 0] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -top-4 -right-4 glass rounded-2xl px-4 py-3 hidden sm:flex items-center gap-3"
              style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,232,122,0.14)' }}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                   style={{ background: 'rgba(0,232,122,0.12)', border: '1px solid rgba(0,232,122,0.25)' }}>
                <CheckCircle2 size={16} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white leading-none mb-1" style={{ fontFamily: 'Outfit, sans-serif' }}>Ponto registrado</p>
                <p className="text-xs text-slate-400">08:47 · Carlos Silva</p>
              </div>
            </motion.div>

            {/* Floating badge — bottom left */}
            <motion.div
              animate={{ y: [0, 9, 0] }}
              transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
              className="absolute -bottom-6 -left-6 glass rounded-2xl px-4 py-3 hidden sm:block"
              style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,232,122,0.10)' }}
            >
              <p className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider font-medium">Ativos agora</p>
              <p className="text-xl font-black text-white leading-none" style={{ fontFamily: 'Outfit, sans-serif' }}>
                24{' '}
                <span className="text-emerald-400 text-sm font-semibold">online</span>
              </p>
            </motion.div>
          </motion.div>
        </div>

        {/* ── Stats band ── */}
        <motion.div
          ref={statsRef}
          variants={statContainer}
          initial="hidden"
          animate={statsInView ? 'visible' : 'hidden'}
          className="mt-12 sm:mt-20 grid grid-cols-3 gap-2 sm:gap-4 max-w-2xl mx-auto"
        >
          {stats.map(({ icon: Icon, value, numeric, label, color }) => (
            <motion.div key={label} variants={statItem} whileHover={{ y: -3 }}
              className="stat-card p-3 sm:p-5 gap-2 sm:gap-4">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                   style={{
                     background: color === 'teal' ? 'rgba(6,182,212,0.12)' : 'rgba(0,232,122,0.12)',
                     border: color === 'teal' ? '1px solid rgba(6,182,212,0.24)' : '1px solid rgba(0,232,122,0.24)',
                   }}>
                <Icon size={15} className={color === 'teal' ? 'text-teal-400' : 'text-emerald-400'} />
              </div>
              <div>
                <p className="text-lg sm:text-2xl font-black text-white leading-none tracking-tight mb-1" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  {numeric !== null ? `${count100}%` : value}
                </p>
                <p className="text-[10px] sm:text-xs text-slate-500 leading-none">{label}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
