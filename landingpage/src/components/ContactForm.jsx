import React, { useState } from 'react'

export default function ContactForm(){
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState(null)

  const endpoint = import.meta.env.VITE_FORM_ENDPOINT || ''
  const toEmail = 'miguelesquivel2018@outlook.com'

  async function handleSubmit(e){
    e.preventDefault()
    setStatus('sending')
    const payload = { name, email, company, message }
    try{
      if(endpoint){
        // Formspree accepts form-encoded posts; use FormData for maximum compatibility
        const formData = new FormData()
        formData.append('name', name)
        formData.append('email', email)
        formData.append('company', company)
        formData.append('message', message)
        // optional reply-to field for some services
        formData.append('_replyto', email)

        const res = await fetch(endpoint, { method: 'POST', body: formData, headers: { 'Accept': 'application/json' } })
        if(!res.ok) throw new Error('Failed')
        setStatus('ok')
        // clear form on success
        setName('')
        setEmail('')
        setCompany('')
        setMessage('')
      } else {
        // fallback to mailto: opens user's mail client; includes form data in body
        const subject = encodeURIComponent('Novo contato — REGISTRA.PONTO')
        const body = encodeURIComponent(`Nome: ${name}\nEmail: ${email}\nEmpresa: ${company}\n\nMensagem:\n${message}`)
        window.location.href = `mailto:${toEmail}?subject=${subject}&body=${body}`
        setStatus('ok')
      }
    }catch(err){
      setStatus('error')
    }
  }

  return (
    <section className="mt-12 px-4 sm:px-0">
      <div className="max-w-2xl mx-auto glass rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white">Fale conosco</h3>
        <p className="text-sm text-white/80">Preencha o formulário e nós entraremos em contato.</p>

        <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 gap-3">
          <input required className="w-full p-3 rounded bg-white/5 text-white" placeholder="Seu nome" value={name} onChange={e=>setName(e.target.value)} />
          <input required type="email" className="w-full p-3 rounded bg-white/5 text-white" placeholder="Seu e-mail" value={email} onChange={e=>setEmail(e.target.value)} />
          <input className="w-full p-3 rounded bg-white/5 text-white" placeholder="Empresa (opcional)" value={company} onChange={e=>setCompany(e.target.value)} />
          <textarea className="w-full p-3 rounded bg-white/5 text-white" placeholder="Mensagem" rows={4} value={message} onChange={e=>setMessage(e.target.value)} />

          <div className="flex items-center gap-3">
            <button type="submit" className="bg-brand-500 hover:bg-brand-600 text-white font-semibold px-5 py-3 rounded btn-touch">Enviar</button>
            {status === 'sending' && <span className="text-sm text-white/70">Enviando...</span>}
            {status === 'ok' && <span className="text-sm text-green-400">Enviado com sucesso.</span>}
            {status === 'error' && <span className="text-sm text-red-400">Erro ao enviar. Tente novamente.</span>}
          </div>
        </form>

        <div className="mt-3 text-xs text-white/60">Observação: se preferir, configure `VITE_FORM_ENDPOINT` com um endpoint (Formspree, EmailJS, ou sua API) para envio automático por servidor.</div>
      </div>
    </section>
  )
}
