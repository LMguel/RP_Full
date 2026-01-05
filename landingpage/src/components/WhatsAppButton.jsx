import React from 'react'

// Botão fixo do WhatsApp com placeholder de número. Mantemos acessibilidade e label claro.
export default function WhatsAppButton(){
  return (
    <a aria-label="Falar no WhatsApp" title="Falar no WhatsApp" href="https://wa.me/5511999999999" target="_blank" rel="noreferrer" className="whatsapp-fixed fixed z-50">
      <div className="bg-green-500 hover:bg-green-600 text-white p-4 rounded-full shadow-lg dark:shadow-none dark:ring-2 dark:ring-green-700">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M21 3.008A11.93 11.93 0 0 0 12.004 0C5.373 0 .015 5.37 0 12.004c0 2.116.554 4.18 1.608 6.02L0 24l6.18-1.59A11.94 11.94 0 0 0 12 24c6.63 0 12-5.37 12-11.996 0-1.96-.46-3.807-1.316-5.22L21 3.008z" fill="white"/>
        </svg>
      </div>
    </a>
  )
}
