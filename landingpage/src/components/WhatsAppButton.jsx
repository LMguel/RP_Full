import React from 'react'
import { motion } from 'framer-motion'
import { MessageCircle } from 'lucide-react'

const WA_URL = 'https://wa.me/5524992272778?text=Olá!%20Tenho%20interesse%20no%20REGISTRA.PONTO.'

export default function WhatsAppButton() {
  return (
    <motion.a
      href={WA_URL}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: 1.8, duration: 0.45, ease: [0.21, 0.47, 0.32, 0.98] }}
      whileHover={{ scale: 1.06, y: -2 }}
      whileTap={{ scale: 0.95 }}
      aria-label="Falar no WhatsApp"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl pl-4 pr-5 py-3.5 font-semibold text-sm text-white select-none"
      style={{
        background: '#25D366',
        boxShadow:
          '0 8px 32px rgba(37,211,102,0.40), 0 2px 8px rgba(0,0,0,0.35), 0 0 0 1px rgba(37,211,102,0.30)',
      }}
    >
      <MessageCircle size={20} fill="white" strokeWidth={0} />
      <span className="hidden sm:inline">Falar no WhatsApp</span>
    </motion.a>
  )
}
