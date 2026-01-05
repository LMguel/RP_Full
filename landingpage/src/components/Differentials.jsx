import React from 'react'
import { motion } from 'framer-motion'

const diffs = [
  'Reconhecimento facial (anti-fraude)',
  'Geolocalização configurável',
  'Sem necessidade de relógio físico',
  'Ideal para PMEs',
  'Setup rápido',
  'Relatórios detalhados'
]

export default function Differentials(){
  return (
    <section className="mt-12 py-12">
      <h2 className="text-center text-2xl font-bold">Diferenciais</h2>
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {diffs.map((d, i) => (
          <motion.div
            key={d}
            initial={{ opacity: 0, y: 24, filter: 'blur(6px)' }}
            whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, delay: i * 0.12 }}
            className="p-6 rounded-xl transform transition-all glass hover-glow"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-md">{i+1}</div>
              <div className="text-left font-semibold text-white">{d}</div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
