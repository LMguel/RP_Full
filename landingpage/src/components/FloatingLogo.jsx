import React from 'react'
import { motion } from 'framer-motion'
import logoImg from '../../image/logo.png'

export default function FloatingLogo(){
  return (
    <div className="fixed top-4 left-4 z-50">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.98 }}
        className="h-28 w-28 md:h-36 md:w-36 rounded-full overflow-hidden shadow-2xl bg-transparent p-0 transform-gpu ring-4 ring-white/20"
        aria-hidden="true"
      >
        <img src={logoImg} alt="REGISTRA.PONTO" className="w-full h-full object-cover scale-125 transform" />
      </motion.div>
    </div>
  )
}
