import React from 'react'
import { motion } from 'framer-motion'
import { MessageCircle, Instagram } from 'lucide-react'

const WA_URL = 'https://wa.me/5524992272778?text=Ol%C3%A1!%20Tenho%20interesse%20no%20REGISTRA.PONTO.'
const IG_URL = 'https://www.instagram.com/lmetech/'

const links = [
  {
    title: 'Produto',
    items: [
      { label: 'Funcionalidades', href: '#dashboard' },
      { label: 'Como funciona',   href: '#tablet' },
      { label: 'Planos e preços', href: '#planos' },
      { label: 'Implantação',     href: '#implantacao' },
    ],
  },
  {
    title: 'Suporte',
    items: [
      { label: 'FAQ',     href: '#faq' },
      { label: 'Contato via WhatsApp', href: WA_URL },
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
    <footer
      className="bg-rp-bg"
      style={{ borderTop: '1px solid rgba(24,71,214,0.09)' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8 sm:gap-12 mb-10 sm:mb-12">
          {/* Brand */}
          <div className="sm:col-span-2">
            <a href="#" className="flex items-center gap-2.5 mb-4">
              <img
                src="/image/logo.png"
                alt="REGISTRA.PONTO"
                className="h-12 w-auto object-contain block flex-shrink-0"
                draggable={false}
              />
              <span
                className="font-bold text-[#0C1A38] tracking-tight"
                style={{ fontFamily: 'Outfit, sans-serif' }}
              >
                REGISTRA<span style={{ color: '#1847D6' }}>.</span>PONTO
              </span>
            </a>
            <p className="text-sm text-[#8FA0BE] leading-relaxed max-w-xs mb-1">
              Sistema de controle de ponto eletrônico com reconhecimento facial para empresas modernas.
            </p>
            <p className="text-xs text-[#B0C0D4] mb-5">
              Desenvolvido por{' '}
              <span className="font-semibold text-[#8FA0BE]" style={{ fontFamily: 'Outfit, sans-serif' }}>LME Tech</span>
            </p>
            <div className="flex flex-col gap-2">
              <a
                href={WA_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-[#4D5E7A] hover:text-[#0C1A38] transition-colors group w-fit"
              >
                <MessageCircle size={14} className="text-emerald-500 group-hover:text-emerald-600" />
                Falar pelo WhatsApp
              </a>
              <a
                href={IG_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-[#4D5E7A] hover:text-[#0C1A38] transition-colors group w-fit"
              >
                <Instagram size={14} className="text-[#E1306C] group-hover:text-[#C2185B]" />
                Instagram
              </a>
            </div>
          </div>

          {/* Links */}
          {links.map((col) => (
            <div key={col.title}>
              <p className="text-xs font-semibold text-[#8FA0BE] uppercase tracking-widest mb-4">{col.title}</p>
              <ul className="space-y-3">
                {col.items.map((item) => (
                  <li key={item.label}>
                    <a
                      href={item.href}
                      className="text-sm text-[#8FA0BE] hover:text-[#0C1A38] transition-colors duration-150"
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
          style={{ borderTop: '1px solid rgba(24,71,214,0.07)' }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
            <p className="text-xs text-[#B0C0D4]">
              © {new Date().getFullYear()} REGISTRA.PONTO · LME Tech. Todos os direitos reservados.
            </p>
            <span className="hidden sm:inline text-[#B0C0D4]">·</span>
            <p className="text-xs text-[#B0C0D4]">
              CNPJ: 57.800.994/0001-46
            </p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 6 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-3 text-xs text-[#8FA0BE]"
          >
            <a
              href={WA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[#8FA0BE] hover:text-[#0C1A38] transition-colors duration-150 group"
              aria-label="WhatsApp"
            >
              <MessageCircle size={13} className="text-emerald-500 group-hover:text-emerald-600 transition-colors" />
              <span>WhatsApp</span>
            </a>
            <span className="text-[#B0C0D4]">·</span>
            <a
              href={IG_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[#8FA0BE] hover:text-[#0C1A38] transition-colors duration-150 group"
              aria-label="Instagram"
            >
              <Instagram size={13} className="text-[#E1306C] group-hover:text-[#C2185B] transition-colors" />
              <span>Instagram</span>
            </a>
          </motion.div>
        </div>
      </div>
    </footer>
  )
}
