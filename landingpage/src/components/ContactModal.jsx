import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle2, MessageCircle } from 'lucide-react'

const WA_NUMBER = '5524992272778'

function openWhatsApp(message) {
  window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(message)}`, '_blank', 'noopener')
}

const initialForm = { nome: '', empresa: '', email: '', telefone: '', plano: '' }

function formatPhone(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits.replace(/^(\d{0,2})/, '($1')
  if (digits.length <= 7) return digits.replace(/^(\d{2})(\d{0,5})/, '($1) $2')
  return digits.replace(/^(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3')
}

export default function ContactModal({ open, plan, onClose }) {
  const [form, setForm] = useState(initialForm)
  const [errors, setErrors] = useState({})
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (open) {
      setForm({ ...initialForm, plano: plan || '' })
      setErrors({})
      setSuccess(false)
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open, plan])

  function validate() {
    const e = {}
    if (!form.nome.trim()) e.nome = true
    if (!form.empresa.trim()) e.empresa = true
    if (!form.telefone.trim() || form.telefone.replace(/\D/g, '').length < 10) e.telefone = true
    return e
  }

  function handleChange(e) {
    const { name, value } = e.target
    setForm((f) => ({
      ...f,
      [name]: name === 'telefone' ? formatPhone(value) : value,
    }))
    if (errors[name]) setErrors((errs) => ({ ...errs, [name]: false }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    const lines = [
      'Olá! Tenho interesse no *REGISTRA.PONTO*.',
      '',
      `*Nome:* ${form.nome}`,
      `*Empresa:* ${form.empresa}`,
      form.email ? `*E-mail:* ${form.email}` : null,
      `*Telefone:* ${form.telefone}`,
      form.plano ? `*Plano de interesse:* ${form.plano}` : null,
    ].filter(Boolean).join('\n')

    openWhatsApp(lines)
    setSuccess(true)
  }

  const inputBase = (hasError) =>
    `w-full px-4 py-3 rounded-xl text-sm bg-rp-bg border text-white placeholder:text-slate-600 focus:outline-none transition-all duration-150 ${
      hasError
        ? 'border-red-500/60 focus:border-red-500'
        : 'border-white/[0.08] focus:border-blue-500/60'
    }`

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.25, ease: [0.21, 0.47, 0.32, 0.98] }}
            className="w-full max-w-md rounded-2xl border border-white/[0.08] shadow-card-lg overflow-hidden"
            style={{ background: '#0D1B2E' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between px-6 pt-6 pb-0">
              <div>
                <h2 className="text-lg font-bold text-white">Fale pelo WhatsApp</h2>
                <p className="text-sm text-slate-400 mt-0.5">
                  Preencha e envie — abrimos o WhatsApp pra você.
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors flex-shrink-0 mt-0.5"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6">
              <AnimatePresence mode="wait">
                {success ? (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center py-8"
                  >
                    <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 size={32} className="text-emerald-400" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">WhatsApp aberto!</h3>
                    <p className="text-slate-400 text-sm mb-6">
                      Sua mensagem já foi preenchida. Basta enviar no WhatsApp para falar com um consultor.
                    </p>
                    <button onClick={onClose} className="btn-secondary px-8">
                      Fechar
                    </button>
                  </motion.div>
                ) : (
                  <motion.form
                    key="form"
                    onSubmit={handleSubmit}
                    noValidate
                    className="space-y-4"
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">Nome *</label>
                        <input
                          name="nome"
                          value={form.nome}
                          onChange={handleChange}
                          placeholder="Seu nome"
                          autoComplete="name"
                          className={inputBase(errors.nome)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">Empresa *</label>
                        <input
                          name="empresa"
                          value={form.empresa}
                          onChange={handleChange}
                          placeholder="Nome da empresa"
                          autoComplete="organization"
                          className={inputBase(errors.empresa)}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">Telefone *</label>
                      <input
                        type="tel"
                        name="telefone"
                        value={form.telefone}
                        onChange={handleChange}
                        placeholder="(00) 00000-0000"
                        autoComplete="tel"
                        className={inputBase(errors.telefone)}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">E-mail <span className="text-slate-600">(opcional)</span></label>
                      <input
                        type="email"
                        name="email"
                        value={form.email}
                        onChange={handleChange}
                        placeholder="seu@email.com"
                        autoComplete="email"
                        className={inputBase(false)}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">Plano de interesse</label>
                      <select
                        name="plano"
                        value={form.plano}
                        onChange={handleChange}
                        className={`${inputBase(false)} appearance-none cursor-pointer`}
                        style={{ background: '#050B18' }}
                      >
                        <option value="">Selecione um plano...</option>
                        <option value="Tablet">Tablet — R$ 129/mês</option>
                        <option value="Mobile">Mobile (GPS) — R$ 149/mês</option>
                        <option value="Híbrido">Híbrido — R$ 189/mês</option>
                        <option value="Ainda não sei">Ainda não sei</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3.5 mt-2 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all duration-200 hover:-translate-y-0.5"
                      style={{ background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)', boxShadow: '0 4px 20px rgba(37,211,102,0.3)' }}
                    >
                      <MessageCircle size={17} />
                      Enviar pelo WhatsApp
                    </button>

                    <p className="text-center text-xs text-slate-600">
                      Você será redirecionado ao WhatsApp com a mensagem preenchida.
                    </p>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
