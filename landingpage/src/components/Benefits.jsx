import React from 'react'
import { motion } from 'framer-motion'

const benefits = [
  {title:'Sem ponto por procuração', desc:'Elimine registros falsos por reconhecimento facial', icon:'facial'},
  {title:'Localização confiável', desc:'Registro por GPS direto do celular', icon:'location'},
  {title:'Relatórios claros', desc:'Relatórios automáticos e banco de horas transparente', icon:'reports'}
]

function Icon({type}){
  if(type === 'facial'){
    return (
      <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="10" r="4" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M4 20c0-4 4-6 8-6s8 2 8 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        <path d="M9 9h.01M15 9h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <path d="M9.5 12a2.5 2.5 0 005 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    )
  }
  if(type === 'location'){
    return (
      <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="currentColor" strokeWidth="1.2"/>
        <circle cx="12" cy="9" r="2.5" fill="currentColor"/>
      </svg>
    )
  }
  return (
    <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M7 8h10M7 12h6M7 16h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M17 14l-3 3 3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export default function Benefits({onRequestDemo}){
  return (
    <section className="mt-8 px-4 sm:px-0">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-2xl font-bold text-center">Benefícios principais</h2>
        <p className="text-sm text-white/80 mt-2">Resultados rápidos sem complicação</p>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          {benefits.map((b, i) => (
            <motion.article key={b.title} initial={{opacity:0, y:18, filter:'blur(6px)'}} whileInView={{opacity:1, y:0, filter:'blur(0px)'}} viewport={{once:true}} transition={{delay: i*0.12}} whileHover={{y:-6}} className="glass rounded-xl p-6 border hover-glow text-left">
              <div className="h-12 w-12 rounded-md bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-sm">
                <Icon type={b.icon}/>
              </div>
              <h3 className="mt-4 font-semibold text-white">{b.title}</h3>
              <p className="mt-2 text-sm text-white/80">{b.desc}</p>
            </motion.article>
          ))}
        </div>

        <div className="mt-8">
          <button onClick={onRequestDemo} className="inline-block bg-brand-500 hover:bg-brand-600 text-white font-semibold px-6 py-3 rounded-lg shadow-lg btn-touch">Testar grátis por 15 dias</button>
        </div>
      </div>
    </section>
  )
}
