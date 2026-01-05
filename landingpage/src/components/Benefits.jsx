import React from 'react'

export default function Benefits({onRequestDemo}){
  return (
    <section className="mt-8 px-4 sm:px-0">
      <div className="max-w-3xl mx-auto text-center">
        <h3 className="text-xl font-semibold text-white">Benefícios principais</h3>
        <p className="text-sm text-white/80 mt-2">Resultados rápidos sem complicação</p>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-transparent text-white rounded-xl glass flex items-start gap-3">
            <div className="text-2xl">❌</div>
            <div>
              <div className="font-semibold">Sem ponto por procuração</div>
              <div className="text-sm text-white/80">Elimine registros falsos por reconhecimento facial</div>
            </div>
          </div>

          <div className="p-4 bg-transparent text-white rounded-xl glass flex items-start gap-3">
            <div className="text-2xl">📍</div>
            <div>
              <div className="font-semibold">Localização confiável</div>
              <div className="text-sm text-white/80">Registro por GPS direto do celular</div>
            </div>
          </div>

          <div className="p-4 bg-transparent text-white rounded-xl glass flex items-start gap-3">
            <div className="text-2xl">📊</div>
            <div>
              <div className="font-semibold">Relatórios claros</div>
              <div className="text-sm text-white/80">Relatórios automáticos e banco de horas transparente</div>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <button onClick={onRequestDemo} className="inline-block bg-brand-500 hover:bg-brand-600 text-white font-semibold px-6 py-3 rounded-lg shadow-lg btn-touch">Testar grátis por 15 dias</button>
        </div>
      </div>
    </section>
  )
}
