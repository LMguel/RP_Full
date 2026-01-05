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
  return (
    <div className="text-center">
      <div className="text-sm text-gray-500">Valor por mês</div>
      <div className="mt-1 text-3xl font-bold">R$ {value} <span className="text-sm font-normal">/ mês</span></div>
    </div>
  )
}
