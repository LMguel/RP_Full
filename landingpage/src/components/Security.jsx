import React from 'react'
import { motion } from 'framer-motion'

export default function Security(){
  return (
    <motion.section initial={{opacity:0, y:8}} whileInView={{opacity:1, y:0}} viewport={{once:true}} transition={{duration:0.6}} className="mt-12 py-12">
      <div className="max-w-3xl mx-auto p-6 rounded-xl glass hover-glow">
        <div className="flex items-center justify-center gap-3">
          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center text-white shadow">🔒</div>
          <h3 className="text-center text-2xl font-bold text-white">Segurança e LGPD</h3>
        </div>

        <div className="mt-4 text-white/80 text-sm max-w-3xl mx-auto space-y-2">
          <p>Dados protegidos e criptografados.</p>
          <p>Reconhecimento facial usado apenas para controle de ponto.</p>
          <p>Conformidade com LGPD — nenhuma imagem é utilizada para outros fins.</p>
        </div>
      </div>
    </motion.section>
  )
}
