import React, { useState } from 'react'

const ENDPOINT = import.meta.env.VITE_FORM_ENDPOINT

export default function LeadFormFull() {
    const [status, setStatus] = useState('idle')

    async function handleSubmit(e) {
        e.preventDefault()
        setStatus('submitting')
        const data = new FormData(e.target)
        try {
            const res = await fetch(ENDPOINT, {
                method: 'POST',
                body: data,
                headers: { Accept: 'application/json' },
            })
            if (res.ok) {
                setStatus('succeeded')
                e.target.reset()
            } else {
                setStatus('error')
            }
        } catch {
            setStatus('error')
        }
    }

    if (status === 'succeeded') {
        return (
            <div className="bg-green-50 border border-green-200 rounded-card p-6 text-center">
                <p className="text-green-700 font-semibold text-lg">✓ Enviado!</p>
                <p className="text-green-600 text-sm mt-2">
                    Vou responder ainda hoje por e-mail com o link da demo e os valores.
                </p>
            </div>
        )
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4 max-w-lg mx-auto">
            {/* Honeypot */}
            <input type="text" name="_gotcha" style={{ display: 'none' }} tabIndex="-1" autoComplete="off" />

            <div>
                <label htmlFor="full-nome" className="block text-sm font-medium text-slate-700 mb-1">
                    Nome *
                </label>
                <input
                    id="full-nome"
                    type="text"
                    name="nome"
                    required
                    className="form-input"
                />
            </div>

            <div>
                <label htmlFor="full-email" className="block text-sm font-medium text-slate-700 mb-1">
                    E-mail *
                </label>
                <input
                    id="full-email"
                    type="email"
                    name="email"
                    required
                    className="form-input"
                />
            </div>

            <div>
                <label htmlFor="full-empresa" className="block text-sm font-medium text-slate-700 mb-1">
                    Empresa *
                </label>
                <input
                    id="full-empresa"
                    type="text"
                    name="empresa"
                    required
                    className="form-input"
                />
            </div>

            <div>
                <label htmlFor="full-faixa" className="block text-sm font-medium text-slate-700 mb-1">
                    Quantidade de funcionários *
                </label>
                <select
                    id="full-faixa"
                    name="faixa_funcionarios"
                    required
                    className="form-select"
                    defaultValue=""
                >
                    <option value="" disabled>Selecione</option>
                    <option value="1-5">1 a 5 funcionários</option>
                    <option value="6-15">6 a 15 funcionários</option>
                    <option value="16-30">16 a 30 funcionários</option>
                </select>
            </div>

            <div>
                <label htmlFor="full-msg" className="block text-sm font-medium text-slate-700 mb-1">
                    Mensagem (opcional)
                </label>
                <textarea
                    id="full-msg"
                    name="mensagem"
                    rows="3"
                    className="form-textarea"
                    placeholder="Conte um pouco sobre sua necessidade..."
                />
            </div>

            <button
                type="submit"
                disabled={status === 'submitting'}
                className="btn-primary w-full py-3 text-base"
            >
                {status === 'submitting' ? (
                    <span className="flex items-center justify-center gap-2">
                        <span className="spinner" /> Enviando...
                    </span>
                ) : (
                    'Solicitar demo por e-mail'
                )}
            </button>

            {status === 'error' && (
                <p className="text-red-600 text-sm text-center">
                    Não foi possível enviar. Tente novamente.
                </p>
            )}
        </form>
    )
}
