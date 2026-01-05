import React, { useState, useEffect } from 'react'

export default function CookieConsent(){
  const [show, setShow] = useState(false)
  useEffect(()=>{
    const accepted = localStorage.getItem('rp_cookie_accepted')
    if(!accepted) setShow(true)
  },[])
  function accept(){
    localStorage.setItem('rp_cookie_accepted','1')
    setShow(false)
  }
  if(!show) return null
  return (
    <div className="fixed left-4 bottom-4 z-50 glass border rounded-lg p-4 max-w-sm">
      <div className="text-sm text-white/90">Usamos cookies para melhorar a experiência e analytics. Ao continuar, você concorda com nossa Política de Privacidade.</div>
      <div className="mt-3 flex justify-end">
        <button onClick={accept} className="px-3 py-1 gradient-btn text-white rounded">Aceitar</button>
      </div>
    </div>
  )
}
