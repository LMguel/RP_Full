import React, { useEffect, useState } from 'react'

// Toggle simples de tema dark/light. Mantém preferência no localStorage e aplica a classe `dark` no <html>.
export default function ThemeToggle(){
  const [isDark, setIsDark] = useState(() => {
    try { return localStorage.getItem('rp-theme') === 'dark' }
    catch(e){ return false }
  })

  useEffect(()=>{
    const root = document.documentElement
    if(isDark) root.classList.add('dark')
    else root.classList.remove('dark')
    try { localStorage.setItem('rp-theme', isDark ? 'dark' : 'light') } catch(e){}
  }, [isDark])

  return (
    <button aria-label={`Ativar tema ${isDark ? 'claro' : 'escuro'}`} title="Alternar tema" onClick={()=>setIsDark(!isDark)} className="p-2 rounded-md bg-white/10 hover:bg-white/20 text-white">
      {isDark ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="inline-block" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" fill="white"/>
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="inline-block" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M12 3v2M12 19v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="12" cy="12" r="3" fill="#fff"/>
        </svg>
      )}
    </button>
  )
}