import React, { useEffect } from 'react'
import { motion } from 'framer-motion'

export default function ImageModal({open, images = [], index = 0, onClose, onPrev, onNext}){
  if(!open) return null
  const img = images?.[index]

  useEffect(()=>{
    function onKey(e){
      if(e.key === 'Escape') onClose && onClose()
      if(e.key === 'ArrowLeft') onPrev && onPrev()
      if(e.key === 'ArrowRight') onNext && onNext()
    }
    window.addEventListener('keydown', onKey)
    return ()=> window.removeEventListener('keydown', onKey)
  }, [onClose, onPrev, onNext])

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/65" onClick={onClose} />
      <div className="relative max-w-5xl w-full mx-4">
        <button onClick={onClose} aria-label="Fechar" className="absolute right-3 top-3 z-50 bg-white/10 text-white rounded-full p-3 shadow-md">✕</button>

        <button onClick={(e)=>{ e.stopPropagation(); onPrev && onPrev() }} aria-label="Anterior" className="hidden sm:flex items-center justify-center absolute left-3 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white/10 text-white z-50">‹</button>
        <button onClick={(e)=>{ e.stopPropagation(); onNext && onNext() }} aria-label="Próximo" className="hidden sm:flex items-center justify-center absolute right-3 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white/10 text-white z-50">›</button>

        <div className="glass rounded overflow-hidden">
          <motion.img
            key={img?.src}
            src={img?.src}
            alt={img?.alt}
            className="w-full h-[80vh] object-contain rounded touch-action-pan-y"
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.25}
            onDragEnd={(e, info)=>{
              const x = info.offset.x
              if(x > 60) onPrev && onPrev()
              else if(x < -60) onNext && onNext()
            }}
          />
        </div>

        <div className="mt-2 text-center text-sm text-white/70">{img?.label}</div>
      </div>
    </div>
  )
}
