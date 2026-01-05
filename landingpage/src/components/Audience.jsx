import React from 'react'

const groups = [
  {
    title: 'Escolas',
    emoji: '🏫',
    desc: 'Registro de ponto simples para professores e funcionários',
  },
  {
    title: 'Clínicas',
    emoji: '🩺',
    desc: 'Controle de turnos, chegadas e saídas de equipes médicas',
  },
  {
    title: 'Comércios',
    emoji: '🏬',
    desc: 'Escalas flexíveis para lojas e pontos de venda',
  },
  {
    title: 'Pequenas e médias empresas',
    emoji: '🏢',
    desc: 'Soluções escaláveis para times em crescimento',
  },
]

export default function Audience(){
  return (
    <section className="mt-12 py-12">
      <div className="max-w-7xl mx-auto px-4">
        <h2 className="text-center text-3xl md:text-4xl font-extrabold text-white">Para quem é o sistema</h2>
        <p className="text-center text-sm text-gray-300 mt-2">Perfis típicos — escolha o seu e veja como o REGISTRA.PONTO se adapta</p>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {groups.map(g => (
            <div
              key={g.title}
              className="p-6 rounded-2xl shadow-lg bg-gradient-to-r from-blue-800 to-indigo-900 text-white transform hover:scale-105 transition-all duration-250"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-xl">{g.emoji}</div>
                <div>
                  <div className="font-semibold text-lg">{g.title}</div>
                  <div className="text-sm opacity-90 mt-1">{g.desc}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
