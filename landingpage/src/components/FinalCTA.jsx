import React from 'react'
import LeadFormFull from './LeadFormFull'

export default function FinalCTA() {
    return (
        <section id="contato" className="section" style={{ background: '#0d1a3a' }}>
            <div className="max-w-2xl mx-auto px-4 md:px-8">
                <h2 className="text-2xl md:text-3xl font-bold text-white text-center mb-3">
                    Quer ver funcionando na sua empresa?
                </h2>
                <p className="text-center text-slate-400 mb-8">
                    Preencha o formulário e receba o link da demo com os valores.
                </p>

                <div className="rounded-2xl shadow-lg p-6 md:p-8" style={{ background: '#fff' }}>
                    <LeadFormFull />
                </div>

                <p className="text-center text-slate-500 text-sm mt-6">
                    Vou responder por e-mail ainda hoje com o link da demo e os valores.
                </p>
            </div>
        </section>
    )
}
