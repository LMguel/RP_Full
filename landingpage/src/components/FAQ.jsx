import React, { useState } from 'react'

const faqs = [
    {
        q: 'Funciona no celular do funcionário?',
        a: 'Sim. O plano Mobile funciona no celular pessoal do funcionário, usando GPS para registrar o local da batida. Não precisa instalar nada além do app.',
    },
    {
        q: 'Precisa comprar relógio de ponto?',
        a: 'Não. O plano Tablet usa um tablet comum como terminal fixo com reconhecimento facial. Não precisa de relógio de ponto tradicional.',
    },
    {
        q: 'O que vem nos relatórios e no Excel?',
        a: 'Relatórios com horas trabalhadas, horas extras, faltas, atrasos e banco de horas. A exportação em Excel vem pronta para o departamento pessoal, com filtros por funcionário e período.',
    },
    {
        q: 'Como é a implantação do tablet?',
        a: 'Enviamos todo o passo a passo por e-mail. A configuração é simples e leva menos de 30 minutos. O suporte fica disponível durante todo o processo.',
    },
    {
        q: 'O suporte é remoto?',
        a: 'Sim. O suporte é 100% remoto, por e-mail. Respondemos em até 24 horas úteis.',
    },
    {
        q: 'Posso cancelar quando quiser?',
        a: 'Sim. Não há fidelidade nem multa de cancelamento. Você pode cancelar a qualquer momento.',
    },
]

export default function FAQ() {
    const [openIndex, setOpenIndex] = useState(null)

    function toggle(i) {
        setOpenIndex(openIndex === i ? null : i)
    }

    return (
        <section id="faq" className="section bg-white">
            <div className="max-w-3xl mx-auto px-4 md:px-8">
                <h2 className="section-title">Perguntas frequentes</h2>

                <div>
                    {faqs.map((faq, i) => (
                        <div key={i} className="accordion-item">
                            <button className="accordion-header w-full" onClick={() => toggle(i)}>
                                <span className="pr-4">{faq.q}</span>
                                <svg
                                    className={`w-5 h-5 flex-shrink-0 text-slate-400 transition-transform duration-200 ${openIndex === i ? 'rotate-180' : ''
                                        }`}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                >
                                    <path d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                            <div className={`accordion-content ${openIndex === i ? 'open' : ''}`}>
                                <p className="pb-5 text-slate-600 text-sm leading-relaxed">{faq.a}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
