import React from 'react'
import { motion } from 'framer-motion'

const problems = [
  {title:'Funcionários batendo ponto por colegas', desc:'Registros falsos que geram horas indevidas e custos.'},
  {title:'Horas extras pagas errado todo mês', desc:'Cálculos manuais e planilhas que levam a erros recorrentes.'},
  {title:'Gestor só descobre problemas no fim do mês', desc:'Falta de visibilidade em tempo real atrasa correções e aumenta custos.'}
]

function Icon({type}){
  if(type === 'fraud'){
    return (
      <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#0F6BFF" />
        <path d="M2 17l10 5 10-5" stroke="#0F6BFF" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if(type === 'manual'){
    return (
      <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="4" width="18" height="16" rx="2" stroke="#0F6BFF" strokeWidth="1.2"/>
        <path d="M7 8h10M7 12h10M7 16h6" stroke="#0F6BFF" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    )
  }
  return (
    <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none">
      <path d="M3 12h18M3 6h18M3 18h18" stroke="#0F6BFF" strokeWidth="1.4" strokeLinecap="round"/>
      <rect x="2" y="2" width="20" height="20" rx="4" stroke="#0F6BFF" strokeWidth="1"/>
    </svg>
  )
}

export default function Problems(){
  return (
    <section className="mt-14 py-12" aria-labelledby="problemas-title">
      <h2 id="problemas-title" className="text-2xl font-bold text-center">Problemas que o REGISTRA.PONTO resolve</h2>
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        {problems.map((p, i) => (
          <motion.article key={p.title} initial={{opacity:0, y:18, filter:'blur(6px)'}} whileInView={{opacity:1, y:0, filter:'blur(0px)'}} viewport={{once:true}} transition={{delay: i*0.12}} whileHover={{y:-6}} className="glass rounded-xl p-6 border hover-glow">
            <div className="h-12 w-12 rounded-md bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-sm">
              {/* Ícone acessível */}
              {i === 0 ? <Icon type="fraud"/> : i === 1 ? <Icon type="manual"/> : <Icon type="reports"/>}
            </div>
            <h3 className="mt-4 font-semibold text-white">{p.title}</h3>
            <p className="mt-2 text-sm text-white/80">{p.desc}</p>
          </motion.article>
        ))}
      </div>
    </section>
  )
}
