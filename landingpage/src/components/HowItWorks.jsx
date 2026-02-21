import React from 'react'

const steps = [
    {
        title: 'Faça login',
        desc: 'Funcionário entra pelo celular (Mobile) ou a empresa acessa pelo tablet (Facial)',
        img: '/image/login.png',
        vertical: true,
    },
    {
        title: 'Registre o ponto',
        desc: 'Batida por localização GPS ou reconhecimento facial — anti-fraude',
        img: '/image/localizacao.png',
        imgAlt: '/image/captura.jpg',
        vertical: true,
        dual: true,
    },
    {
        title: 'Monitore tudo',
        desc: 'Acompanhe os registros em tempo real no painel do administrador',
        img: '/image/registros.png',
        vertical: false,
    },
]

export default function HowItWorks({ onImageClick }) {
    return (
        <section id="como-funciona" className="section" style={{ background: '#0d1a3a' }}>
            <div className="max-w-4xl mx-auto px-4 md:px-8">
                <h2 className="section-title" style={{ color: '#fff' }}>Como funciona</h2>

                <div className="space-y-8">
                    {steps.map((step, i) => (
                        <div
                            key={i}
                            className="rounded-2xl p-6 md:p-8"
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                        >
                            {/* Step badge + title */}
                            <div className="flex items-center gap-3 mb-4">
                                <span
                                    className="text-xs font-bold px-3 py-1 rounded-full"
                                    style={{ background: 'rgba(37,99,235,0.2)', color: '#93C5FD' }}
                                >
                                    Passo {i + 1}
                                </span>
                                <h3 className="font-bold text-lg text-white">{step.title}</h3>
                            </div>
                            <p className="text-sm text-white mb-5 text-center font-medium">{step.desc}</p>

                            {/* Images */}
                            {step.dual ? (
                                <div className="flex gap-4 justify-center">
                                    <div className="overflow-hidden rounded-xl flex-1 max-w-[280px]">
                                        <img
                                            src={step.img}
                                            alt="GPS"
                                            className="w-full aspect-[9/16] object-cover rounded-xl cursor-pointer hover:scale-[1.02] transition-transform"
                                            loading="lazy"
                                            onClick={() => onImageClick?.(step.img, 'Registro por localização GPS')}
                                        />
                                    </div>
                                    <div className="overflow-hidden rounded-xl flex-1 max-w-[280px]">
                                        <img
                                            src={step.imgAlt}
                                            alt="Facial"
                                            className="w-full aspect-[9/16] object-cover rounded-xl cursor-pointer hover:scale-[1.02] transition-transform"
                                            loading="lazy"
                                            onClick={() => onImageClick?.(step.imgAlt, 'Reconhecimento facial')}
                                        />
                                    </div>
                                </div>
                            ) : step.vertical ? (
                                <div className="flex justify-center">
                                    <div className="overflow-hidden rounded-xl max-w-[320px]">
                                        <img
                                            src={step.img}
                                            alt={step.desc}
                                            className="w-full aspect-[9/16] object-cover rounded-xl cursor-pointer hover:scale-[1.02] transition-transform"
                                            loading="lazy"
                                            onClick={() => onImageClick?.(step.img, step.desc)}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="overflow-hidden rounded-xl">
                                    <img
                                        src={step.img}
                                        alt={step.desc}
                                        className="w-full rounded-xl cursor-pointer hover:scale-[1.02] transition-transform"
                                        loading="lazy"
                                        onClick={() => onImageClick?.(step.img, step.desc)}
                                    />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
