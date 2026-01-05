import React, { useState } from 'react'

export default function DemoModal({open, onClose}){
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [employees, setEmployees] = useState('')
  const [status, setStatus] = useState(null)

  const endpoint = import.meta.env.VITE_FORM_ENDPOINT || ''

  if(!open) return null

  async function handleSubmit(e){
    e.preventDefault()
    setStatus('sending')
    try{
      if(endpoint){
        const formData = new FormData()
        formData.append('name', name)
        formData.append('company', company)
        formData.append('email', email)
        formData.append('phone', phone)
        formData.append('employees', employees)
        formData.append('_replyto', email)

        const res = await fetch(endpoint, { method: 'POST', body: formData, headers: { 'Accept': 'application/json' } })
        if(!res.ok) throw new Error('Failed')
        setStatus('ok')
        setName(''); setCompany(''); setEmail(''); setPhone(''); setEmployees('')
        onClose()
      } else {
        // fallback to mail client
        const subject = encodeURIComponent('Agendar demonstração — REGISTRA.PONTO')
        const body = encodeURIComponent(`Nome: ${name}\nEmpresa: ${company}\nEmail: ${email}\nTelefone: ${phone}\nFuncionários: ${employees}`)
        window.location.href = `mailto:miguelesquivel2018@outlook.com?subject=${subject}&body=${body}`
        setStatus('ok')
        onClose()
      }
    }catch(err){
      setStatus('error')
    }
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
        {status === 'sending' && <div className="mt-2 text-sm text-white/80">Enviando...</div>}
        {status === 'ok' && <div className="mt-2 text-sm text-green-400">Enviado com sucesso.</div>}
        {status === 'error' && <div className="mt-2 text-sm text-red-400">Erro ao enviar. Tente novamente.</div>}
      </div>
    </div>
  )
}
