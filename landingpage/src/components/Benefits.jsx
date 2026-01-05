import React from 'react'
import { motion } from 'framer-motion'

const benefits = [
  'Segurança contra fraudes',
  'Economia de tempo e custos administrativos',
  'Relatórios e exportação automática',
  'Fácil integração com sistemas existentes',
  'Mobile friendly e escalável'
]

export default function Benefits(){
  return (
    <section className="mt-12 py-12">
      <h2 className="text-center text-2xl font-bold">Benefícios</h2>
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        {benefits.map((b,i) => (
          <motion.div key={b} initial={{opacity:0, x:-8, filter:'blur(6px)'}} whileInView={{opacity:1, x:0, filter:'blur(0px)'}} whileHover={{scale:1.02}} viewport={{once:true}} transition={{delay:i*0.08}} className="p-4 flex items-start gap-4 border rounded-lg glass hover-glow">
            <div className="rounded-full bg-gradient-to-br from-brand-500 to-indigo-600 text-white w-10 h-10 flex items-center justify-center font-bold" aria-hidden="true">✓</div>
            <div className="text-sm text-white/90">{b}</div>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
