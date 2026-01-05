import React from 'react'
import { motion } from 'framer-motion'

export default function FinalCTA({onRequestDemo}){
  return (
    <motion.section initial={{opacity:0, y:10}} whileInView={{opacity:1, y:0}} viewport={{once:true}} transition={{duration:0.6}} className="mt-12 mb-12 py-12 text-center">
      <div className="max-w-3xl mx-auto px-6">
        <div className="p-6 rounded-xl glass hover-glow">
          <h2 className="text-2xl md:text-3xl font-bold text-white">Pronto para modernizar o controle de ponto da sua empresa?</h2>
          <p className="mt-3 text-white/80">Agende uma demonstração e veja o REGISTRA.PONTO em ação.</p>

          <div className="mt-6">
            <motion.button whileHover={{scale:1.03}} whileTap={{scale:0.98}} onClick={onRequestDemo} className="inline-block gradient-btn text-white px-8 py-3 rounded-md text-lg font-semibold shadow">
              Agendar demonstração
            </motion.button>
          </div>
        </div>
      </div>
    </motion.section>
  )
}
