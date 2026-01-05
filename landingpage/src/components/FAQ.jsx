import React from 'react'

const faqs = [
  {q:'Funciona em celular pessoal?', a:'Sim, registro por celular pessoal é suportado com geolocalização.'},
  {q:'É seguro usar reconhecimento facial?', a:'Sim — imagens são criptografadas e usadas apenas para validação de ponto.'},
  {q:'Posso exportar os dados?', a:'Sim — exportação em Excel/CSV disponível no painel.'},
  {q:'Preciso comprar tablet?', a:'Não necessariamente — oferecemos plano Mobile; o tablet é opcional para entradas físicas.'}
]

export default function FAQ(){
  return (
    <section className="mt-12 py-12">
      <h2 className="text-center text-2xl font-bold">Perguntas frequentes</h2>
      <div className="mt-6 max-w-4xl mx-auto">
        {faqs.map(f => (
          <details key={f.q} className="mb-3 border rounded-lg p-4 glass">
            <summary className="font-semibold text-white">{f.q}</summary>
            <div className="mt-2 text-sm text-white/80">{f.a}</div>
          </details>
        ))}
      </div>
    </section>
  )
}
