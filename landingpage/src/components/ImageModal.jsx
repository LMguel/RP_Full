import React from 'react'

export default function ImageModal({open, src, alt, onClose}){
  if(!open) return null
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/65" onClick={onClose} />
      <div className="relative max-w-5xl w-full mx-4">
        <button onClick={onClose} aria-label="Fechar" className="absolute right-3 top-3 z-70 bg-white/10 text-white rounded-full p-2 shadow">✕</button>
        <div className="glass rounded overflow-hidden">
          <img src={src} alt={alt} className="w-full h-[80vh] object-contain rounded" />
        </div>
      </div>
    </div>
  )
}
