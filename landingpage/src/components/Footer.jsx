import React from 'react'
import { motion } from 'framer-motion'
import { MessageCircle, Linkedin, Github } from 'lucide-react'

const links = [
  {
    title: 'Produto',
    items: [
      { label: 'Funcionalidades', href: '#dashboard' },
      { label: 'Como funciona',  href: '#planos' },
      { label: 'Planos e preços',href: '#planos' },
      { label: 'Implantação',    href: '#implantacao' },
    ],
  },
  {
    title: 'Suporte',
    items: [
      { label: 'FAQ',     href: '#faq' },
      { label: 'Contato', href: '#' },
    ],
  },
  {
    title: 'Legal',
    items: [
      { label: 'Política de Privacidade', href: '#' },
      { label: 'Termos de Uso',           href: '#' },
    ],
  },
]

export default function Footer() {
  return (
    <footer className="bg-rp-bg" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8 sm:gap-12 mb-10 sm:mb-12">
          {/* Brand */}
          <div className="sm:col-span-2">
            <a href="#" className="flex items-center gap-2.5 mb-4">
              <img
                src="/image/logo.png"
                alt="REGISTRA.PONTO"
                className="h-8 w-auto object-contain flex-shrink-0"
                draggable={false}
              />
              <span className="font-bold text-white tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
                REGISTRA<span style={{ color: '#00E87A' }}>.</span>PONTO
              </span>
            </a>
            <p className="text-sm text-slate-500 leading-relaxed max-w-xs mb-6">
              Sistema de controle de ponto eletrônico com reconhecimento facial para empresas modernas.
            </p>
            <a
              href="https://wa.me/5524992272778?text=Ol%C3%A1!%20Tenho%20interesse%20no%20REGISTRA.PONTO."
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors group w-fit"
            >
              <MessageCircle size={14} className="text-emerald-400 group-hover:text-emerald-300" />
              Falar pelo WhatsApp
            </a>
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

        {/* Bottom bar */}
        <div
          className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-5"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
        >
          <p className="text-xs text-slate-600">
            © {new Date().getFullYear()} REGISTRA.PONTO. Todos os direitos reservados.
          </p>

          {/* Developer attribution */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-2 text-xs text-slate-500"
          >
            <span>Desenvolvido por</span>
            <span className="text-slate-300 font-semibold" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Luís Miguel
            </span>
            <span className="text-slate-700">·</span>
            <a
              href="https://www.linkedin.com/in/lmiguelesqui/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-slate-500 hover:text-white transition-colors duration-150 group"
              aria-label="LinkedIn"
            >
              <Linkedin size={13} className="group-hover:text-blue-400 transition-colors" />
              <span>LinkedIn</span>
            </a>
            <span className="text-slate-700">·</span>
            <a
              href="https://github.com/LMguel"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-slate-500 hover:text-white transition-colors duration-150 group"
              aria-label="GitHub"
            >
              <Github size={13} className="group-hover:text-slate-200 transition-colors" />
              <span>GitHub</span>
            </a>
          </motion.div>
        </div>
      </div>
    </footer>
  )
}
