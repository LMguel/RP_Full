import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Minus } from 'lucide-react'

const faqs = [
  {
    q: 'O tablet está incluso no plano Tablet?',
    a: 'O tablet não está incluso — ele deve ser fornecido pelo cliente ou pode ser cotado à parte. Utilizamos tablets Android comuns (a partir de R$ 600), sem necessidade de equipamento proprietário ou contrato de hardware.',
  },
  {
    q: 'Funciona no celular pessoal do funcionário?',
    a: 'Sim. O plano Mobile e Híbrido funcionam no celular Android ou iPhone do próprio colaborador. Basta instalar o aplicativo e o funcionário já está pronto para registrar o ponto com geolocalização.',
  },
  {
    q: 'O que vem incluído nos relatórios e no Excel?',
    a: 'Os relatórios incluem horas trabalhadas, horas extras, banco de horas, faltas e atrasos. A exportação em Excel vem formatada para o departamento pessoal, com filtros por funcionário, período e tipo de registro.',
  },
  {
    q: 'Como funciona a implantação?',
    a: 'Configuramos o sistema remotamente e fazemos o cadastro inicial dos colaboradores. Para o plano Tablet e Híbrido, levamos o tablet já configurado e pronto para uso diretamente na sua empresa — sem burocracia, sem aprendizado técnico. Para o plano Mobile, a ativação é remota e os colaboradores já podem registrar o ponto no mesmo dia.',
  },
  {
    q: 'Existe fidelidade ou multa de cancelamento?',
    a: 'Não. Não há fidelidade nem multa. Você pode cancelar a qualquer momento, sem burocracia.',
  },
  {
    q: 'O sistema é compatível com a legislação trabalhista?',
    a: 'Sim. O REGISTRA.PONTO gera registros com timestamp, localização (quando aplicável) e foto do colaborador no momento do registro, atendendo aos requisitos da Portaria 671 do Ministério do Trabalho.',
  },
  {
    q: 'Quantos funcionários posso cadastrar?',
    a: 'Os planos cobrem até 30 funcionários. Para equipes maiores, cada colaborador excedente tem um acréscimo de R$ 10,00/mês, sem necessidade de mudança de plano.',
  },
]

export default function FAQ() {
  const [open, setOpen] = useState(null)

  return (
    <section id="faq" className="py-24 bg-rp-bg relative overflow-hidden">
      <div className="absolute inset-0 bg-hero-grid opacity-30" />

      <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="section-label"
          >
            Dúvidas frequentes
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-3xl sm:text-4xl font-bold text-white tracking-tight mt-2 mb-4"
          >
            Perguntas frequentes
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-slate-400"
          >
            Não encontrou sua dúvida?{' '}
            <a
              href="https://wa.me/5524992272778?text=Olá!%20Tenho%20uma%20dúvida%20sobre%20o%20REGISTRA.PONTO."
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:text-emerald-300 transition-colors underline underline-offset-2"
            >
              Fale pelo WhatsApp
            </a>
            .
          </motion.p>
        </div>

        <div className="space-y-2">
          {faqs.map((faq, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ delay: i * 0.05 }}
              className={`card-dark overflow-hidden transition-colors duration-200 ${open === i ? 'bg-rp-elevated' : ''}`}
            >
              <button
                className="w-full flex items-center justify-between gap-4 text-left p-5"
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
              >
                <span className={`font-medium text-sm sm:text-base transition-colors duration-150 ${open === i ? 'text-white' : 'text-slate-200'}`}>
                  {faq.q}
                </span>
                <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 ${
                  open === i
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/5 text-slate-400'
                }`}>
                  {open === i ? <Minus size={13} strokeWidth={2.5} /> : <Plus size={13} strokeWidth={2.5} />}
                </span>
              </button>

              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <p className="px-5 pb-5 text-sm text-slate-400 leading-relaxed border-t border-white/[0.05] pt-4">
                      {faq.a}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
