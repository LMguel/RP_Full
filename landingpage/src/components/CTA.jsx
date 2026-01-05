import React from 'react'

export default function CTA(){
  return (
    <section className="mt-12 mb-16 py-12 bg-gradient-to-r from-gray-900 to-brand-700 text-white rounded-xl px-6">
      <div className="max-w-4xl mx-auto text-center">
        <h3 className="text-2xl font-bold">Pronto para eliminar fraudes e poupar tempo?</h3>
        <p className="mt-3 text-gray-200 dark:text-gray-200">Converse com nosso time pelo WhatsApp e saiba como implantar o REGISTRA.PONTO na sua instituição.</p>
        <div className="mt-6">
          <a href="https://wa.me/5511999999999" className="inline-block bg-green-500 hover:bg-green-600 px-6 py-3 rounded-lg font-semibold shadow transition-transform transform hover:-translate-y-1">Falar no WhatsApp</a>
        </div>
      </div>
    </section>
  )
}
