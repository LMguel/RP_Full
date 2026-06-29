import React from 'react'
import { motion } from 'framer-motion'
import { GraduationCap, ShoppingBag, UtensilsCrossed, Building2, Wrench } from 'lucide-react'

const sectors = [
  { icon: GraduationCap, label: 'Escolas e faculdades',     desc: 'Registro integrado para docentes e funcionários administrativos.' },
  { icon: ShoppingBag,   label: 'Comércios locais',         desc: 'Visibilidade em tempo real da equipe de vendas e estoque.' },
  { icon: UtensilsCrossed, label: 'Restaurantes e buffets', desc: 'Controle de jornada em ambientes com alta rotatividade de turno.' },
  { icon: Building2,     label: 'Empresas de serviços',     desc: 'Gestão centralizada de equipes internas e externas.' },
  { icon: Wrench,        label: 'Oficinas e indústrias',    desc: 'Ponto preciso por setor, pronto para o departamento pessoal.' },
]

export default function Testimonial() {
  return (
    <section className="py-20 bg-rp-surface relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 40% 40% at 80% 50%, rgba(24,71,214,0.04) 0%, transparent 70%)' }}
      />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-5 gap-12 lg:gap-16 items-start">

          {/* Left: statement */}
          <div className="lg:col-span-3">
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
              Empresas de diferentes setores registram ponto{' '}
              <span className="gradient-text">todo dia com o sistema</span>
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.18 }}
              className="text-[#4D5E7A] leading-relaxed max-w-lg"
            >
              O REGISTRA.PONTO funciona em qualquer negócio com funcionários sob CLT.
              Instalamos, configuramos e treinamos a equipe — você não precisa entender de tecnologia.
            </motion.p>

            {/* Divider stat */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.28 }}
              className="mt-8 pt-8 flex items-center gap-6"
              style={{ borderTop: '1px solid rgba(24,71,214,0.10)' }}
            >
              <div>
                <p className="text-3xl font-black text-[#0C1A38] tracking-tight leading-none mb-1" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  48h
                </p>
                <p className="text-xs text-[#8FA0BE] leading-snug">da assinatura ao<br />primeiro registro</p>
              </div>
              <div className="w-px h-10 bg-[rgba(24,71,214,0.10)]" />
              <div>
                <p className="text-3xl font-black text-[#0C1A38] tracking-tight leading-none mb-1" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  R$6
                </p>
                <p className="text-xs text-[#8FA0BE] leading-snug">por dia para<br />10 funcionários</p>
              </div>
              <div className="w-px h-10 bg-[rgba(24,71,214,0.10)]" />
              <div>
                <p className="text-3xl font-black text-[#0C1A38] tracking-tight leading-none mb-1" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  0
                </p>
                <p className="text-xs text-[#8FA0BE] leading-snug">cartão ou senha<br />necessário</p>
              </div>
            </motion.div>
          </div>

          {/* Right: sector list */}
          <div className="lg:col-span-2">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } },
              }}
              className="flex flex-col divide-y"
              style={{ borderTop: '1px solid rgba(24,71,214,0.09)', borderBottom: '1px solid rgba(24,71,214,0.09)' }}
            >
              {sectors.map(({ icon: Icon, label, desc }) => (
                <motion.div
                  key={label}
                  variants={{
                    hidden:  { opacity: 0, x: 16 },
                    visible: { opacity: 1, x: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
                  }}
                  className="flex items-start gap-3 py-4 group"
                  style={{ borderColor: 'rgba(24,71,214,0.07)' }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 transition-transform duration-200 group-hover:scale-110"
                    style={{ background: 'rgba(24,71,214,0.07)', border: '1px solid rgba(24,71,214,0.14)' }}
                  >
                    <Icon size={15} style={{ color: '#1847D6' }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#0C1A38] mb-0.5">{label}</p>
                    <p className="text-xs text-[#8FA0BE] leading-relaxed">{desc}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>

        </div>
      </div>
    </section>
  )
}
