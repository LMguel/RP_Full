import React from 'react'

const priceTable = {
  mobile: {
    '0-10': 79,
    '11-30': 99,
    '31-100': 129
  },
  tablet: {
    '0-10': 149,
    '11-30': 179,
    '31-100': 219
  },
  hybrid: {
    '0-10': 179,
    '11-30': 209,
    '31-100': 259
  }
}

export default function PriceDisplay({planKey, range}){
  if(!range) return <div className="text-sm text-gray-500">Selecione uma faixa para ver o preço</div>
  if(range === '100+') return <div className="text-sm font-semibold">Sob consulta — <span className="text-gray-600">entre em contato</span></div>
  const value = priceTable[planKey]?.[range]
  if(!value) return <div className="text-sm text-gray-500">Preço indisponível</div>

  const hasDeploymentFee = planKey === 'tablet' || planKey === 'hybrid'

  return (
    <div className="text-center">
      <div className="text-sm text-gray-500">Valor por mês</div>
      <div className="mt-1 text-3xl font-bold">R$ {value} <span className="text-sm font-normal">/ mês</span></div>

      {hasDeploymentFee && (
        <div className="mt-3 text-sm text-gray-700">
          <span className="inline-block bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-semibold">Taxa única de implantação</span>
        </div>
      )}

      {hasDeploymentFee && (
        <div className="mt-2">
          <div className="text-sm text-white">Pagamento único: R$ 349</div>
        </div>
      )}

      {hasDeploymentFee && (
        <div className="mt-4 text-xs text-white">
          Implantação inicial: entrega, cadastro e treinamento.
          <div className="mt-1">Tablet em comodato.</div>
        </div>
      )}
    </div>
  )
}
