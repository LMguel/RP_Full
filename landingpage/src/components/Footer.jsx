import React from 'react'
import { motion } from 'framer-motion'
import { MessageCircle } from 'lucide-react'

const links = [
  {
    title: 'Produto',
    items: [
      { label: 'Funcionalidades', href: '#dashboard' },
      { label: 'Planos e preços', href: '#planos' },
      { label: 'Implantação', href: '#planos' },
    ],
  },
  {
    title: 'Suporte',
    items: [
      { label: 'FAQ', href: '#faq' },
      { label: 'Contato', href: '#' },
    ],
  },
  {
    title: 'Legal',
    items: [
      { label: 'Política de Privacidade', href: '#' },
      { label: 'Termos de Uso', href: '#' },
    ],
  },
]

export default function Footer({ onContact }) {
  return (
    <footer className="bg-rp-bg border-t border-white/[0.05]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-12 mb-12">
          {/* Brand */}
          <div className="sm:col-span-2">
            <a href="#" className="flex items-center gap-2.5 mb-4">
              <img
                src="/image/logo.png"
                alt="REGISTRA.PONTO"
                className="h-8 w-auto object-contain flex-shrink-0"
                draggable={false}
              />
              <span className="font-bold text-white tracking-tight">
                REGISTRA<span className="text-blue-400">.</span>PONTO
              </span>
            </a>
            <p className="text-sm text-slate-500 leading-relaxed max-w-xs mb-6">
              Sistema de controle de ponto eletrônico para empresas modernas. Tablet, mobile ou híbrido.
            </p>
            <div className="flex flex-col gap-2">
              <a
                href="https://wa.me/5524992272778?text=Olá!%20Tenho%20interesse%20no%20REGISTRA.PONTO."
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors group w-fit"
              >
                <MessageCircle size={14} className="text-emerald-400 group-hover:text-emerald-300" />
                Falar pelo WhatsApp
              </a>
            </div>
          </div>

          {/* Links */}
          {links.map((col) => (
            <div key={col.title}>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">{col.title}</p>
              <ul className="space-y-3">
                {col.items.map((item) => (
                  <li key={item.label}>
                    <a
                      href={item.href}
                      className="text-sm text-slate-500 hover:text-white transition-colors duration-150"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-white/[0.05] pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-600">
            © {new Date().getFullYear()} REGISTRA.PONTO. Todos os direitos reservados.
          </p>
          <p className="text-xs text-slate-600">
            Sistema de ponto eletrônico · Tablet · Mobile · Híbrido
          </p>
        </div>
      </div>
    </footer>
  )
}
