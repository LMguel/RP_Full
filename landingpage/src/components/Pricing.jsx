import React, { useState } from 'react'

function scrollToContato() {
    document.querySelector('#contato')?.scrollIntoView({ behavior: 'smooth' })
}

const plans = [
    {
        name: 'Mobile (GPS no celular)',
        badge: 'Recomendado para começar',
        price: 'A partir de R$ 69/mês',
        setup: 'Setup grátis',
        setupClass: 'text-green-600 font-semibold',
        featured: true,
        bullets: [
            'Funcionário bate o ponto no próprio celular',
            'Localização no registro',
            'Relatórios + Excel para DP',
        ],
    },
    {
        name: 'Tablet (Ponto Facial)',
        badge: null,
        price: 'A partir de R$ 109/mês',
        setup: 'Setup: 12× de R$ 79,99 ou R$ 799 à vista',
        setupClass: 'text-slate-500',
        featured: false,
        bullets: [
            'Ponto fixo na empresa',
            'Reconhecimento facial anti-fraude',
            'Relatórios + Excel para DP',
        ],
    },
    {
        name: 'Híbrido (Celular + Tablet)',
        badge: null,
        price: 'A partir de R$ 139/mês',
        setup: 'Setup: 12× de R$ 79,99 ou R$ 799 à vista',
        setupClass: 'text-slate-500',
        featured: false,
        bullets: [
            'Quem está externo usa o celular',
            'Quem está presencial usa o tablet',
            'Relatórios + Excel para DP',
        ],
    },
]

const faixas = [
    {
        plan: 'Mobile',
        setup: 'Setup grátis',
        ranges: [
            { label: 'Até 5 func.', price: 'R$ 69/mês' },
            { label: 'Até 15 func.', price: 'R$ 99/mês' },
            { label: 'Até 30 func.', price: 'R$ 129/mês' },
        ],
    },
    {
        plan: 'Tablet',
        setup: 'Setup: 12× R$ 79,99 ou R$ 799 à vista',
        ranges: [
            { label: 'Até 5 func.', price: 'R$ 109/mês' },
            { label: 'Até 15 func.', price: 'R$ 139/mês' },
            { label: 'Até 30 func.', price: 'R$ 179/mês' },
        ],
    },
    {
        plan: 'Híbrido',
        setup: 'Setup: 12× R$ 79,99 ou R$ 799 à vista',
        ranges: [
            { label: 'Até 5 func.', price: 'R$ 139/mês' },
            { label: 'Até 15 func.', price: 'R$ 169/mês' },
            { label: 'Até 30 func.', price: 'R$ 219/mês' },
        ],
    },
]

export default function Pricing() {
    const [faixaOpen, setFaixaOpen] = useState(false)

    return (
        <section id="planos" className="section" style={{ background: '#F8FAFC' }}>
            <div className="max-w-6xl mx-auto px-4 md:px-8">
                {/* Title */}
                <h2 className="section-title">Planos simples para PMEs</h2>
                <p className="text-center text-sm mb-10" style={{ color: '#475569', marginTop: '-1.5rem' }}>
                    Relatórios e exportação Excel inclusos em todos os planos.
                </p>

                {/* Cards */}
                <div className="grid md:grid-cols-3 gap-6">
                    {plans.map((plan) => (
                        <div
                            key={plan.name}
                            className="card flex flex-col"
                            style={plan.featured
                                ? { borderColor: '#2563EB', borderWidth: '2px', boxShadow: '0 4px 20px rgba(37,99,235,0.10)' }
                                : {}
                            }
                        >
                            {/* Badge */}
                            {plan.badge && (
                                <span
                                    className="self-start text-xs font-semibold px-3 py-1 rounded-full mb-3"
                                    style={{ background: '#DBEAFE', color: '#2563EB' }}
                                >
                                    {plan.badge}
                                </span>
                            )}

                            {/* Name */}
                            <h3 className="font-bold text-lg" style={{ color: '#0F172A' }}>
                                {plan.name}
                            </h3>

                            {/* Price */}
                            <p className="mt-2 text-2xl font-bold" style={{ color: '#0F172A' }}>
                                {plan.price}
                            </p>

                            {/* Setup */}
                            <p className={`text-xs mt-1 ${plan.setupClass}`}>
                                {plan.setup}
                            </p>

                            {/* Bullets */}
                            <ul className="mt-5 space-y-2 flex-1">
                                {plan.bullets.map((b, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm" style={{ color: '#334155' }}>
                                        <span className="mt-0.5 flex-shrink-0 text-blue-500">✓</span>
                                        <span>{b}</span>
                                    </li>
                                ))}
                            </ul>

                            {/* CTA */}
                            <button
                                onClick={scrollToContato}
                                className="btn-primary w-full py-3 mt-6 text-sm"
                            >
                                Receber proposta por e-mail
                            </button>
                        </div>
                    ))}
                </div>

                {/* Faixas accordion */}
                <div className="mt-10 max-w-3xl mx-auto">
                    <button
                        onClick={() => setFaixaOpen(!faixaOpen)}
                        className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors"
                        style={{ color: '#2563EB' }}
                    >
                        <span>Ver valores por faixa (até 5, 15 e 30 funcionários)</span>
                        <svg
                            className={`w-4 h-4 transition-transform duration-200 ${faixaOpen ? 'rotate-180' : ''}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"
                        >
                            <path d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    <div className={`accordion-content ${faixaOpen ? 'open' : ''}`}>
                        <div className="grid md:grid-cols-3 gap-4 pt-4 pb-2">
                            {faixas.map((f) => (
                                <div key={f.plan} className="bg-white border border-slate-200 rounded-xl p-4">
                                    <p className="font-bold text-sm mb-1" style={{ color: '#0F172A' }}>{f.plan}</p>
                                    <p className="text-xs mb-3" style={{ color: '#64748B' }}>{f.setup}</p>
                                    {f.ranges.map((r) => (
                                        <div key={r.label} className="flex justify-between py-1.5 border-b border-slate-100 last:border-0">
                                            <span className="text-xs" style={{ color: '#475569' }}>{r.label}</span>
                                            <span className="text-sm font-semibold" style={{ color: '#0F172A' }}>{r.price}</span>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Microcopy */}
                <p className="text-center text-xs mt-6" style={{ color: '#64748B' }}>
                    Sem surpresas: você escolhe o plano e eu envio a proposta por e-mail.
                </p>

                {/* CTA final */}
                <div className="text-center mt-8">
                    <button onClick={scrollToContato} className="btn-primary py-3 px-8">
                        Receber proposta por e-mail
                    </button>
                    <p className="text-xs mt-3" style={{ color: '#64748B' }}>
                        Respondo ainda hoje por e-mail.
                    </p>
                </div>
            </div>
        </section>
    )
}
