import React from 'react'

export default function Footer(){
  return (
    <footer className="mt-12 border-t py-6 bg-gray-50 dark:bg-gray-900" role="contentinfo">
      <div className="max-w-6xl mx-auto px-6 text-center text-sm text-gray-600 dark:text-gray-400">
        <div className="font-semibold">REGISTRA.PONTO</div>
        <div className="mt-2">© {new Date().getFullYear()} REGISTRA.PONTO. Todos os direitos reservados.</div>
      </div>
    </footer>
  )
}
