import React from 'react'

export default function StickyCTA({onRequestDemo}){
  return (
    <div className="fixed right-4 bottom-6 z-50">
      <button onClick={onRequestDemo} className="bg-brand-500 text-white px-4 py-3 rounded-full shadow-lg">Agendar demonstração</button>
    </div>
  )
}
