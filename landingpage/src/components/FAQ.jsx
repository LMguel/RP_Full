import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Minus } from 'lucide-react'

const faqs = [
  {
    q: 'O tablet fica com a empresa?',
    a: 'Sim. O tablet utilizado na implantação passa a ser propriedade da empresa — não é alugado nem precisa ser devolvido. É um equipamento definitivo, adquirido uma única vez.',
  },
  {
    q: 'O tablet é obrigatório?',
    a: 'Não. Para equipes de até 10 funcionários, é possível utilizar computador, notebook ou celular da própria empresa para registrar o ponto com reconhecimento facial. Para equipes maiores, recomendamos tablet dedicado para garantir maior fluidez no registro diário.',
  },
  {
    q: 'O tablet está incluso na implantação?',
    a: 'Depende da modalidade escolhida. Na Implantação Remota, não há tablet — o sistema opera em dispositivos da empresa. Na Implantação + Tablet Incluso, o tablet vem configurado e passa a ser da empresa após a instalação.',
  },
  {
    q: 'O sistema funciona sem relógio de ponto tradicional?',
    a: 'Sim. O REGISTRA.PONTO utiliza reconhecimento facial em tablet, eliminando a necessidade de relógios de ponto caros e equipamentos complexos.',
  },
  {
    q: 'O sistema funciona mesmo se a internet cair?',
    a: 'Sim. O sistema possui funcionamento com armazenamento temporário local, garantindo continuidade dos registros mesmo em quedas momentâneas de internet.',
  },
  {
    q: 'Como funciona o cadastro dos funcionários?',
    a: 'O cadastro pode ser realizado diretamente no tablet durante a implantação, de forma rápida e prática, sem necessidade de envio manual de fotos.',
  },
  {
    q: 'Como funciona a implantação?',
    a: 'Nós realizamos toda a configuração inicial do sistema, instalação do tablet, treinamento e ativação da empresa para deixar tudo pronto para uso.',
  },
  {
    q: 'Quais relatórios o sistema oferece?',
    a: 'O sistema fornece relatórios completos de registros de ponto, horários, entradas, saídas e informações para acompanhamento da equipe. Além de exportação em Excel formatada para o DP.',
  },
  {
    q: 'Existe fidelidade ou multa de cancelamento?',
    a: 'Não trabalhamos com fidelidade obrigatória. Nosso objetivo é manter os clientes pela qualidade do serviço e suporte oferecido.',
  },
  {
    q: 'O sistema é compatível com a legislação trabalhista?',
    a: 'O sistema foi desenvolvido para auxiliar empresas no controle e organização da jornada de trabalho dos funcionários, seguindo as diretrizes da CLT.',
  },
  {
    q: 'Quantos funcionários posso cadastrar?',
    a: 'A quantidade de funcionários varia conforme o plano contratado, com opções para pequenas, médias e grandes empresas.',
  },
]

export default function FAQ() {
  const [open, setOpen] = useState(null)

  return (
    <section id="faq" className="py-24 bg-rp-bg relative overflow-hidden">
      <div className="absolute inset-0 bg-dot-grid opacity-50" />

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
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="text-3xl sm:text-4xl font-bold text-[#0C1A38] tracking-tight mt-2 mb-4"
          >
            Perguntas frequentes
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-[#4D5E7A]"
          >
            Não encontrou sua dúvida?{' '}
            <a
              href="https://wa.me/5524992272778?text=Ol%C3%A1!%20Tenho%20uma%20d%C3%BAvida%20sobre%20o%20REGISTRA.PONTO."
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#1847D6] hover:text-[#1035BC] transition-colors underline underline-offset-2"
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
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
              className="card-dark overflow-hidden transition-colors duration-200"
              style={open === i ? { background: '#F7FBFF', borderColor: 'rgba(24,71,214,0.18)' } : {}}
            >
              <button
                className="w-full flex items-center justify-between gap-4 text-left p-5"
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
              >
                <span className={`font-medium text-sm sm:text-base transition-colors duration-150 ${open === i ? 'text-[#0C1A38]' : 'text-[#1E2D45]'}`}>
                  {faq.q}
                </span>
                <span
                  className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200"
                  style={{
                    background: open === i ? '#1847D6' : 'rgba(24,71,214,0.07)',
                    color: open === i ? '#FFFFFF' : '#1847D6',
                  }}
                >
                  {open === i
                    ? <Minus size={13} strokeWidth={2.5} />
                    : <Plus  size={13} strokeWidth={2.5} />
                  }
                </span>
              </button>

              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.26, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <p
                      className="px-5 pb-5 text-sm text-[#4D5E7A] leading-relaxed pt-4"
                      style={{ borderTop: '1px solid rgba(24,71,214,0.07)' }}
                    >
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
