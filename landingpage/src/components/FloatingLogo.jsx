import React from 'react'
import { motion } from 'framer-motion'
import logoImg from '../../image/logo.png'

export default function FloatingLogo(){
  return (
    <div className="fixed top-3 left-3 sm:top-4 sm:left-4 z-50">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.98 }}
        className="h-12 w-12 sm:h-16 sm:w-16 md:h-36 md:w-36 rounded-full overflow-hidden shadow-2xl bg-transparent p-0 transform-gpu ring-2 sm:ring-4 ring-white/20"
        aria-hidden="true"
      >
        <img src={logoImg} alt="REGISTRA.PONTO" className="w-full h-full object-cover scale-105 transform" />
      </motion.div>
    </div>
  )
}
