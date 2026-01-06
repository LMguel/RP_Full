import React from 'react'
import { motion } from 'framer-motion'
import capturaImg from '../../image/captura.png'
import excelImg from '../../image/excel.png'
import localizacao from '../../image/localizacao.png'

const items = [
  {title:'Garante que apenas o funcionário correto registre o ponto', desc:'Reconhecimento facial evita fraudes e batidas por terceiros.'},
  {title:'Evita registros fora do local autorizado', desc:'Geolocalização configurável assegura que o registro ocorra no local correto.'},
  {title:'Facilita o fechamento da folha', desc:'Relatórios automáticos que simplificam o fechamento da folha e reduzem retrabalho.'}
]

export default function Solution(){
  return (
    <section className="mt-12 py-12">
      <h2 className="text-xl md:text-2xl font-bold text-center">Nossa solução</h2>
      <p className="text-center mt-2 text-white">Uma plataforma completa que une segurança, agilidade e relatórios acionáveis.</p>
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        {items.map((it, idx)=> (
          <motion.div key={it.title} initial={{opacity:0, y:16, filter:'blur(6px)'}} whileInView={{opacity:1, y:0, filter:'blur(0px)'}} viewport={{once:true}} transition={{delay: idx*0.12}} whileHover={{scale:1.02}} className="p-6 rounded-xl glass border hover-glow">
            <div className="h-12 w-12 rounded-md bg-gradient-to-br from-brand-500 to-indigo-600 text-white flex items-center justify-center font-semibold" aria-hidden="true">
              {idx === 0 && (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2a7 7 0 100 14 7 7 0 000-14z" fill="white"/>
                  <path d="M12 8v4l3 2" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
              {idx === 1 && (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 6h16v12H4z" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M8 10h8" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
              {idx === 2 && (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 3h18v18H3V3z" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M7 13h10M7 17h6" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
            <h3 className="mt-4 font-semibold text-white">{it.title}</h3>
            <p className="mt-2 text-sm text-white/80">{it.desc}</p>
          </motion.div>
        ))}
      </div>

      {/* Screenshots showcase */}
      <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.figure initial={{opacity:0, y:12}} whileInView={{opacity:1, y:0}} viewport={{once:true}} className="rounded-lg overflow-hidden glass shadow-md">
          <img src={capturaImg} alt="Registro por reconhecimento facial" className="w-full h-56 object-cover" />
          <figcaption className="p-4 text-center text-sm text-white/80">Registro por reconhecimento facial</figcaption>
        </motion.figure>

        <motion.figure initial={{opacity:0, y:12}} whileInView={{opacity:1, y:0}} viewport={{once:true}} transition={{delay:0.06}} className="rounded-lg overflow-hidden glass shadow-md">
          <img src={excelImg} alt="Exportação para planilhas Excel" className="w-full h-56 object-cover" />
          <figcaption className="p-4 text-center text-sm text-white/80">Exportação para planilhas Excel</figcaption>
        </motion.figure>

        <motion.figure initial={{opacity:0, y:12}} whileInView={{opacity:1, y:0}} viewport={{once:true}} transition={{delay:0.12}} className="rounded-lg overflow-hidden glass shadow-md">
          <img src={localizacao} alt="Registro por localização" className="w-full h-56 object-cover" />
          <figcaption className="p-4 text-center text-sm text-white/80">Registro por localização</figcaption>
        </motion.figure>
      </div>
    </section>
  )
}
