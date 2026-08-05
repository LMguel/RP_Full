import React from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { GraduationCap, ShoppingBag, UtensilsCrossed, CheckCircle2 } from 'lucide-react'

const sectors = [
  { icon: GraduationCap,   label: 'Escola',       desc: 'Registro integrado para docentes e funcionários administrativos.', path: '/escolas' },
  { icon: UtensilsCrossed, label: 'Restaurante',  desc: 'Controle de jornada em ambiente com alta rotatividade de turno.', path: '/restaurantes' },
  { icon: ShoppingBag,     label: 'Comércio',     desc: 'Visibilidade em tempo real da equipe de vendas e estoque.' },
]

const stats = [
  { value: '48h',  label: 'da assinatura ao primeiro registro' },
  { value: 'R$6',  label: 'por dia para 10 funcionários' },
  { value: '0',    label: 'cartão ou senha necessário' },
]

export default function Testimonial() {
  return (
    <section className="py-20 bg-rp-surface relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 50% 40% at 50% 0%, rgba(24,71,214,0.05) 0%, transparent 70%)' }}
      />

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header — centered */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="section-label"
          >
            Quem usa
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#0C1A38] tracking-tight mt-2 mb-5"
            style={{ textWrap: 'balance' }}
          >
            Já em uso em{' '}
            <span className="gradient-text">Angra dos Reis e região</span>
          </motion.h2>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.14 }}
            className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 mb-5"
            style={{ background: 'rgba(24,71,214,0.06)', border: '1px solid rgba(24,71,214,0.16)' }}
          >
            <CheckCircle2 size={14} style={{ color: '#1847D6' }} />
            <span className="text-xs font-semibold text-[#1847D6]">3 empresas registram ponto todos os dias pelo sistema</span>
          </motion.div>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.18 }}
            className="text-[#4D5E7A] leading-relaxed"
          >
            O REGISTRA.PONTO funciona em qualquer negócio com funcionários sob CLT.
            Instalamos, configuramos e treinamos a equipe — você não precisa entender de tecnologia.
          </motion.p>
        </div>

        {/* Stats row — centered */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.24 }}
          className="flex items-center justify-center gap-6 sm:gap-10 mb-14 pb-10"
          style={{ borderBottom: '1px solid rgba(24,71,214,0.10)' }}
        >
          {stats.map((s, i) => (
            <React.Fragment key={s.label}>
              {i > 0 && <div className="w-px h-10 bg-[rgba(24,71,214,0.10)]" />}
              <div className="text-center">
                <p className="text-2xl sm:text-3xl font-black text-[#0C1A38] tracking-tight leading-none mb-1" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  {s.value}
                </p>
                <p className="text-[11px] sm:text-xs text-[#8FA0BE] leading-snug max-w-[110px]">{s.label}</p>
              </div>
            </React.Fragment>
          ))}
        </motion.div>

        {/* Sector cards — centered row */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
          }}
          className="grid sm:grid-cols-3 gap-5 max-w-3xl mx-auto"
        >
          {sectors.map(({ icon: Icon, label, desc, path }) => {
            const content = (
              <>
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: 'rgba(24,71,214,0.07)', border: '1px solid rgba(24,71,214,0.14)' }}
                >
                  <Icon size={20} style={{ color: '#1847D6' }} />
                </div>
                <p className="text-sm font-semibold text-[#0C1A38] mb-1.5">{label}</p>
                <p className="text-xs text-[#8FA0BE] leading-relaxed">{desc}</p>
              </>
            )
            return (
              <motion.div
                key={label}
                variants={{
                  hidden:  { opacity: 0, y: 20 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
                }}
                whileHover={{ y: -3 }}
                className="card-dark p-6 text-center flex flex-col items-center transition-transform duration-200"
              >
                {path ? (
                  <Link to={path} className="flex flex-col items-center">
                    {content}
                  </Link>
                ) : (
                  content
                )}
              </motion.div>
            )
          })}
        </motion.div>

      </div>
    </section>
  )
}
