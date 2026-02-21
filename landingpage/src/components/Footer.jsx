import React from 'react'

export default function Footer() {
    return (
        <footer style={{ background: '#070e25' }} className="text-slate-400 py-10">
            <div className="max-w-6xl mx-auto px-4 md:px-8">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                    {/* Left */}
                    <div className="flex items-center gap-3">
                        <img src="/image/logo.png" alt="REGISTRA.PONTO" className="h-8 w-8 object-cover rounded-lg" />
                        <span className="text-white font-bold text-lg">REGISTRA.PONTO</span>
                    </div>

                    {/* Right */}
                    <div className="flex gap-6 text-sm">
                        <a href="#" className="hover:text-white transition-colors">
                            Política de Privacidade
                        </a>
                        <a href="#" className="hover:text-white transition-colors">
                            Termos de Uso
                        </a>
                    </div>
                </div>

                <div className="border-t border-slate-800 mt-8 pt-6 text-center text-xs text-slate-500">
                    © {new Date().getFullYear()} REGISTRA.PONTO. Todos os direitos reservados.
                </div>
            </div>
        </footer>
    )
}
