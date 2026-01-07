import React, { useState } from 'react'
import { motion } from 'framer-motion'
import EmployeeSelector from './EmployeeSelector'
import PriceDisplay from './PriceDisplay'

export default function PlanCard({planKey, title, subtitle, startingText, onRequestDemo}){
  const [open, setOpen] = useState(false)
  const [range, setRange] = useState(null)

  function handleToggle(){ setOpen(o=>!o) }

  return (
    <motion.div
      layout
      className={`p-8 rounded-2xl glass transition-transform transform ${open ? 'scale-103' : ''} hover-glow`}
      style={{ borderColor: 'rgba(15,107,255,0.28)', borderWidth: '2px' }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="text-2xl md:text-3xl font-extrabold text-white">{title}</div>
          <div className="text-base md:text-md text-white/80 mt-2">{subtitle}</div>
          <div className="mt-3 text-lg md:text-xl text-brand-300 font-semibold">{startingText}</div>
        </div>
        <div className="flex-shrink-0">
          <button onClick={handleToggle} className="px-4 py-2 gradient-btn text-white rounded-md border border-transparent shadow-sm">{open? 'Fechar':'Ver detalhes'}</button>
        </div>
      </div>

      {open && (
        <motion.div initial={{opacity:0, y:8, filter:'blur(6px)'}} animate={{opacity:1, y:0, filter:'blur(0px)'}} transition={{duration:0.28}} className="mt-6 space-y-4">
          <EmployeeSelector value={range} onChange={setRange} />
          <PriceDisplay planKey={planKey} range={range} />
          <div className="flex flex-col items-center">
            <div className="text-sm text-white mb-2">✔️ Sem fidelidade</div>
            <button disabled={!range} onClick={onRequestDemo} className={`px-5 py-3 rounded-lg font-semibold ${range? 'gradient-btn text-white':'bg-gray-200 text-gray-400'}`}>{range=== '100+' ? 'Solicitar proposta' : 'Solicitar demonstração'}</button>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
