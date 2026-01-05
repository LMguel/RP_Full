import React from 'react'
import { motion } from 'framer-motion'

const steps = [
  {title:'Cadastro', desc:'Cadastre colaboradores em minutos com foto e dados básicos.'},
  {title:'Registro', desc:'Batida por reconhecimento facial rápida ou manual com geolocalização segura.'},
  {title:'Relatórios', desc:'Relatórios automáticos exportáveis e integráveis.'}
]

export default function HowItWorks(){
  return (
    <section id="como-funciona" className="mt-12 py-12">
      <h2 className="text-center text-2xl font-bold">Como funciona — 3 passos</h2>
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        {steps.map((s,i) => (
          <motion.div key={s.title} initial={{opacity:0, scale:0.98, filter:'blur(6px)'}} whileInView={{opacity:1, scale:1, filter:'blur(0px)'}} whileHover={{y:-6}} viewport={{once:true}} transition={{delay:i*0.12}} className="p-6 border rounded-xl glass hover-glow">
            <div className="text-brand-300 font-bold text-lg">{i+1}</div>
            <h3 className="mt-3 font-semibold text-white">{s.title}</h3>
            <p className="mt-2 text-sm text-white/80">{s.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
