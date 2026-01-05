import React from 'react'

const ranges = [
  {key:'0-10', label:'Até 10 funcionários'},
  {key:'11-30', label:'11 a 30 funcionários'},
  {key:'31-100', label:'31 a 100 funcionários'},
  {key:'100+', label:'Mais de 100 funcionários'}
]

export default function EmployeeSelector({value, onChange}){
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Faixa de funcionários</label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {ranges.map(r => (
          <button
            key={r.key}
            onClick={()=>onChange(r.key)}
            type="button"
            className={`w-full min-w-0 text-left px-3 py-2 border rounded ${value===r.key? 'bg-brand-500 text-white':'bg-white/6 text-white/90'} text-sm whitespace-normal break-words`}
          >
            {r.label}
          </button>
        ))}
      </div>
    </div>
  )
}
