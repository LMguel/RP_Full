import React, { useState } from 'react'

const ENDPOINT = import.meta.env.VITE_FORM_ENDPOINT

export default function LeadFormCompact() {
    const [status, setStatus] = useState('idle') // idle | submitting | succeeded | error

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
            <div className="bg-green-50 border border-green-200 rounded-card p-5 text-center">
                <p className="text-green-700 font-semibold">✓ Enviado!</p>
                <p className="text-green-600 text-sm mt-1">Vou responder ainda hoje por e-mail.</p>
            </div>
        )
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            {/* Honeypot */}
            <input type="text" name="_gotcha" style={{ display: 'none' }} tabIndex="-1" autoComplete="off" />

            <input
                type="text"
                name="nome"
                placeholder="Seu nome"
                required
                className="form-input"
            />
            <input
                type="email"
                name="email"
                placeholder="Seu e-mail"
                required
                className="form-input"
            />
            <input
                type="text"
                name="empresa"
                placeholder="Nome da empresa"
                required
                className="form-input"
            />

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

            <p className="text-slate-500 text-xs text-center">Resposta por e-mail ainda hoje.</p>
        </form>
    )
}
