import React from 'react'
import { motion } from 'framer-motion'

export default function Trust(){
  return (
    <motion.section className="mt-8 py-8 text-center rounded-lg"
      initial={{opacity:0, y:8}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{duration:0.6}}>
      <div className="max-w-3xl mx-auto p-6 rounded-xl glass hover-glow">
        <p className="text-white font-medium">Sistema em uso piloto em ambiente real</p>
        <p className="mt-2 text-white/80">Desenvolvido para pequenas e médias empresas</p>
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 text-sm text-white">
          <div className="flex flex-col items-center gap-2 w-full sm:flex-row sm:items-center sm:w-auto">
            <span className="h-10 w-10 bg-gradient-to-br from-brand-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold">✓</span>
            <span className="mt-1 sm:mt-0 sm:ml-2">Confiável</span>
          </div>
          <div className="flex flex-col items-center gap-2 w-full sm:flex-row sm:items-center sm:w-auto">
            <span className="h-10 w-10 bg-gradient-to-br from-teal-400 to-green-400 rounded-full flex items-center justify-center text-white font-semibold">⚙</span>
            <span className="mt-1 sm:mt-0 sm:ml-2">Suporte</span>
          </div>
          <div className="flex flex-col items-center gap-2 w-full sm:flex-row sm:items-center sm:w-auto">
            <span className="h-10 w-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-semibold">↻</span>
            <span className="mt-1 sm:mt-0 sm:ml-2">Atualizações</span>
          </div>
        </div>
      </div>
    </motion.section>
  )
}
