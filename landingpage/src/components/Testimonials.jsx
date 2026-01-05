import React from 'react'
import { motion } from 'framer-motion'

const testimonials = [
  {name:'Mariana Silva', role:'RH — Escola ABC', text:'Reduzimos fraudes e ganhamos visibilidade imediata das jornadas.'},
  {name:'Carlos Pereira', role:'Gerente — Clínica Vida', text:'Implantação rápida e suporte local — recomendados.'},
  {name:'Ana Costa', role:'Administradora — Comércio XYZ', text:'Economia de tempo e precisão nas horas extras.'}
]

export default function Testimonials(){
  return (
    <section className="mt-12 py-12">
      <h2 className="text-center text-2xl font-bold">O que nossos clientes dizem</h2>
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        {testimonials.map((t, i) => (
          <motion.blockquote
            key={t.name}
            initial={{ opacity: 0, y: 24, filter: 'blur(6px)' }}
            whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, delay: i * 0.12 }}
            className="p-6 rounded-xl transform transition-all glass hover-glow"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-500 flex items-center justify-center text-white/90 shadow-md" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white">
                  <path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5z" fill="currentColor"/>
                  <path d="M4 20c0-3.314 2.686-6 6-6h4c3.314 0 6 2.686 6 6v1H4v-1z" fill="currentColor"/>
                </svg>
              </div>
              <div>
                <div className="font-semibold text-white">{t.name}</div>
                <div className="text-sm text-white/70">{t.role}</div>
              </div>
            </div>
            <p className="mt-4 text-white/80 text-sm">{t.text}</p>
          </motion.blockquote>
        ))}
      </div>
    </section>
  )
}
