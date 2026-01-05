import React, { useState } from 'react'

export default function DemoModal({open, onClose}){
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [employees, setEmployees] = useState('')

  if(!open) return null

  function handleSubmit(e){
    e.preventDefault()
    const msg = `Olá, gostaria de agendar demonstração:\nNome: ${name}\nEmpresa: ${company}\nEmail: ${email}\nTelefone: ${phone}\nFuncionários: ${employees}`
    const wa = `https://wa.me/5511999999999?text=${encodeURIComponent(msg)}`
    window.open(wa, '_blank')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative glass rounded-lg w-full max-w-md mx-4 p-6 shadow-2xl">
        <h3 className="text-xl font-bold text-white">Agendar demonstração gratuita</h3>
        <p className="text-sm text-white/80 mt-1">Sem compromisso — suporte local e piloto disponível</p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <input required value={name} onChange={e=>setName(e.target.value)} placeholder="Seu nome" className="w-full border border-white/8 bg-transparent px-3 py-2 rounded text-white" />
          <input value={company} onChange={e=>setCompany(e.target.value)} placeholder="Empresa" className="w-full border border-white/8 bg-transparent px-3 py-2 rounded text-white" />
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" type="email" className="w-full border border-white/8 bg-transparent px-3 py-2 rounded text-white" />
          <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Telefone" className="w-full border border-white/8 bg-transparent px-3 py-2 rounded text-white" />
          <input value={employees} onChange={e=>setEmployees(e.target.value)} placeholder="# de funcionários (aprox.)" className="w-full border border-white/8 bg-transparent px-3 py-2 rounded text-white" />
          <div className="flex items-center justify-end gap-3 mt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded border border-white/8 text-white">Fechar</button>
            <button type="submit" className="px-4 py-2 rounded gradient-btn text-white">Enviar</button>
          </div>
        </form>
      </div>
    </div>
  )
}
