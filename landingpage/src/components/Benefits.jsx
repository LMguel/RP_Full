import React from 'react'

const benefits = [
    'Ajuda a reduzir retrabalho no DP',
    'Facilita conferência de horas extras e ausências',
    'Mantém histórico organizado para auditoria',
    'Dá previsibilidade no fechamento do mês',
]

export default function Benefits() {
    return (
        <section className="section" style={{ background: '#070e25' }}>
            <div className="max-w-3xl mx-auto px-4 md:px-8">
                <h2 className="section-title" style={{ color: '#fff' }}>Por que isso evita dor de cabeça</h2>

                <ul className="space-y-4">
                    {benefits.map((b, i) => (
                        <li
                            key={i}
                            className="flex items-start gap-4 rounded-xl p-4"
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                        >
                            <span className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                                style={{ background: 'rgba(37,99,235,0.2)', color: '#93C5FD' }}>
                                ✓
                            </span>
                            <span className="text-slate-300 text-base leading-relaxed">{b}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    )
}
