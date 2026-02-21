import React from 'react'

const proofs = [
    {
        img: '/image/telafuncionario.png',
        caption: 'Histórico do funcionário no app',
        vertical: true,
    },
    {
        img: '/image/funcionarios.png',
        caption: 'Gestão e cadastro de funcionários',
        vertical: false,
    },
    {
        img: '/image/excel.png',
        caption: 'Exportação Excel pronta para DP',
        vertical: false,
    },
]

export default function ProofGallery({ onImageClick }) {
    return (
        <section className="section" style={{ background: '#0f1d42' }}>
            <div className="max-w-4xl mx-auto px-4 md:px-8">
                <h2 className="section-title" style={{ color: '#fff' }}>Provas do sistema</h2>

                <div className="space-y-8">
                    {proofs.map((p, i) => (
                        <div
                            key={i}
                            className="rounded-2xl p-6 md:p-8"
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                        >
                            <p className="text-sm text-white mb-5 text-center font-medium">{p.caption}</p>

                            {p.vertical ? (
                                <div className="flex justify-center">
                                    <div className="overflow-hidden rounded-xl max-w-[320px]">
                                        <img
                                            src={p.img}
                                            alt={p.caption}
                                            className="w-full aspect-[9/16] object-cover rounded-xl cursor-pointer hover:scale-[1.02] transition-transform"
                                            loading="lazy"
                                            onClick={() => onImageClick?.(p.img, p.caption)}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="overflow-hidden rounded-xl">
                                    <img
                                        src={p.img}
                                        alt={p.caption}
                                        className="w-full rounded-xl cursor-pointer hover:scale-[1.02] transition-transform"
                                        loading="lazy"
                                        onClick={() => onImageClick?.(p.img, p.caption)}
                                    />
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <p className="text-center text-slate-500 mt-8 text-sm">
                    Menos planilha, menos discussão, mais controle.
                </p>
            </div>
        </section>
    )
}
