import React from 'react'
import LeadFormCompact from './LeadFormCompact'

export default function Hero({ onImageClick }) {
    return (
        <section className="pt-16" style={{ background: '#070e25' }}>
            <div className="max-w-6xl mx-auto px-4 md:px-8 py-16 md:py-24">
                <div className="grid md:grid-cols-2 gap-10 md:gap-14 items-center">
                    {/* Left — Copy + Form */}
                    <div>
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight">
                            Controle de ponto simples para PMEs
                        </h1>
                        <p className="mt-5 text-lg md:text-xl text-slate-300 leading-relaxed">
                            Mobile (GPS) e Tablet (Facial).{' '}
                            <span className="font-semibold text-white">
                                Relatórios e exportação Excel inclusos.
                            </span>
                        </p>

                        <ul className="mt-6 space-y-3">
                            {[
                                'Organize jornada e horas extras',
                                'Registros claros para auditoria',
                                'Fechamento do mês em minutos (Excel)',
                            ].map((item) => (
                                <li key={item} className="flex items-start gap-3 text-slate-200">
                                    <span className="mt-1 flex-shrink-0 w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold">
                                        ✓
                                    </span>
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>

                        {/* Compact form in white card */}
                        <div className="mt-8 p-5 bg-white rounded-2xl shadow-lg">
                            <LeadFormCompact />
                        </div>
                    </div>

                    {/* Right — Dashboard image (larger) */}
                    <div className="flex justify-center">
                        <img
                            src="/image/dashboard.png"
                            alt="Painel do gestor — REGISTRA.PONTO"
                            className="rounded-2xl shadow-2xl w-full cursor-pointer hover:scale-[1.02] transition-transform duration-200"
                            loading="eager"
                            onClick={() => onImageClick?.('/image/dashboard.png', 'Painel do gestor — REGISTRA.PONTO')}
                        />
                    </div>
                </div>
            </div>
        </section>
    )
}
