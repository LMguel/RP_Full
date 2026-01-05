import React from 'react'
import PlanCard from './PlanCard'

export default function Pricing({onRequestDemo}){
  return (
    <section className="mt-12 py-12">
      <h2 className="text-center text-2xl font-bold">Planos e preços</h2>
      <p className="text-center mt-2 text-white">O valor varia conforme o número de funcionários e a forma de uso. Empresas com múltiplas unidades ou mais de 100 funcionários possuem planos personalizados.</p>
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <PlanCard planKey="mobile" title="Plano Mobile" subtitle="Registro de ponto pelo celular com geolocalização." startingText="A partir de R$ 79 / mês" onRequestDemo={onRequestDemo} />
        <PlanCard planKey="tablet" title="Plano Tablet" subtitle="Tablet fixo com reconhecimento facial." startingText="A partir de R$ 149 / mês" onRequestDemo={onRequestDemo} />
        <PlanCard planKey="hybrid" title="Plano Híbrido" subtitle="Tablet fixo + celular com geolocalização." startingText="A partir de R$ 179 / mês" onRequestDemo={onRequestDemo} />
      </div>
    </section>
  )
}
